'use client';

import type React from 'react';

import { useToast } from '@/hooks/use-toast';
import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowUp,
  FileText,
  Folder,
  Loader2,
  Paperclip,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ExamplePrompts } from '@/components/example-prompts';
import { ChatMessage } from '@/components/chat-message';
import { FilePreview } from '@/components/file-preview';
import { PDFSource } from '@/types/graphTypes';

type WorkspaceFile = {
  filename: string;
  chunk_count: number;
  last_page?: number | null;
  content_types?: string[];
};

export default function Home() {
  const { toast } = useToast(); // Add this hook
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      sources?: PDFSource[];
    }>
  >([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [isLoadingWorkspaceFiles, setIsLoadingWorkspaceFiles] = useState(false);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState('default');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null); // Add this ref
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    sessionIdRef.current =
      globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  }, []);

  useEffect(() => {
    const workspace = workspaceId.trim() || 'default';
    let cancelled = false;

    const loadWorkspaceFiles = async () => {
      setIsLoadingWorkspaceFiles(true);

      try {
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspace)}/files`,
        );
        if (!response.ok) {
          throw new Error('Failed to load workspace files');
        }

        const data = (await response.json()) as WorkspaceFile[];
        if (!cancelled) {
          setWorkspaceFiles(data);
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspaceFiles([]);
          console.error('Error loading workspace files:', error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWorkspaceFiles(false);
        }
      }
    };

    void loadWorkspaceFiles();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, sources: undefined }, // Clear sources for new user message
      { role: 'assistant', content: '', sources: undefined }, // Clear sources for new assistant message
    ]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          workspaceId: workspaceId.trim() || 'default',
          filenames: files.length > 0 ? files.map((file) => file.name) : null,
          sessionId: sessionIdRef.current,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      await streamChatResponse(response);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description:
          'Failed to send message. Please try again.\n' +
          (error instanceof Error ? error.message : 'Unknown error'),
        variant: 'destructive',
      });
      setMessages((prev) => {
        const newArr = [...prev];
        newArr[newArr.length - 1].content =
          'Sorry, there was an error processing your message.';
        return newArr;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const streamChatResponse = async (response: Response) => {
    if (!response.body) {
      throw new Error('No response stream available');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const eventText of events) {
        processStreamEvent(eventText);
      }
    }

    if (buffer.trim()) {
      processStreamEvent(buffer);
    }
  };

  const processStreamEvent = (eventText: string) => {
    const event = parseServerSentEvent(eventText);
    if (!event) return;

    if (event.event === 'token') {
      setMessages((prev) => {
        const newArr = [...prev];
        const last = newArr[newArr.length - 1];
        newArr[newArr.length - 1] = {
          ...last,
          content: `${last.content}${event.data.text || ''}`,
        };
        return newArr;
      });
      return;
    }

    if (event.event === 'sources') {
      setMessages((prev) => {
        const newArr = [...prev];
        const last = newArr[newArr.length - 1];
        newArr[newArr.length - 1] = {
          ...last,
          sources: event.data.sources || [],
        };
        return newArr;
      });
      return;
    }

    if (event.event === 'error') {
      throw new Error(event.data.detail || 'Streaming failed');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const nonPdfFiles = selectedFiles.filter(
      (file) => file.type !== 'application/pdf',
    );
    if (nonPdfFiles.length > 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload PDF files only',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('workspace_id', workspaceId.trim() || 'default');

      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload files');
      }

      setFiles((prev) => [...prev, ...selectedFiles]);
      await refreshWorkspaceFiles();
      toast({
        title: 'Success',
        description: `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} uploaded successfully`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Upload failed',
        description:
          'Failed to upload files. Please try again.\n' +
          (error instanceof Error ? error.message : 'Unknown error'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setFiles(files.filter((file) => file !== fileToRemove));
    toast({
      title: 'File removed',
      description: `${fileToRemove.name} has been removed`,
      variant: 'default',
    });
  };

  const refreshWorkspaceFiles = async () => {
    const workspace = workspaceId.trim() || 'default';
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspace)}/files`,
      );
      if (!response.ok) {
        throw new Error('Failed to refresh workspace files');
      }
      const data = (await response.json()) as WorkspaceFile[];
      setWorkspaceFiles(data);
    } catch (error) {
      console.error('Error refreshing workspace files:', error);
    }
  };

  const handleDeleteWorkspaceFile = async (filename: string) => {
    const workspace = workspaceId.trim() || 'default';
    const confirmed = window.confirm(
      `Delete "${filename}" from workspace "${workspace}"? This removes all indexed chunks for that file.`,
    );
    if (!confirmed) return;

    setDeletingFilename(filename);
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspace)}/files?filename=${encodeURIComponent(filename)}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.detail || 'Failed to delete file');
      }

      setFiles((prev) => prev.filter((file) => file.name !== filename));
      await refreshWorkspaceFiles();
      toast({
        title: 'Deleted',
        description: `${filename} was removed from the workspace`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Error deleting workspace file:', error);
      toast({
        title: 'Delete failed',
        description:
          'Could not delete the file from the workspace.\n' +
          (error instanceof Error ? error.message : 'Unknown error'),
        variant: 'destructive',
      });
    } finally {
      setDeletingFilename(null);
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_32%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-4 pb-36 pt-6 md:px-8 md:pt-10">
      <div className="w-full max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
              <FileText className="h-5 w-5" />
            </div>
          <div>
              <p className="text-base font-semibold leading-none">
                NeuralDocs AI
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Document intelligence workspace
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-md border bg-white px-3 py-2 shadow-sm sm:flex">
            <Folder className="h-4 w-4 text-cyan-700" />
            <Input
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              aria-label="Workspace ID"
              className="h-7 w-44 border-0 bg-transparent px-0 text-xs font-medium text-slate-700 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
          </div>
        </header>

        <section className="mb-6 rounded-xl border bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Workspace files
              </p>
              <p className="text-sm text-muted-foreground">
                Previously uploaded PDFs for the current workspace.
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {isLoadingWorkspaceFiles
                ? 'Refreshing...'
                : `${workspaceFiles.length} file${workspaceFiles.length === 1 ? '' : 's'}`}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {workspaceFiles.length > 0 ? (
              workspaceFiles.map((file) => (
                <div
                  key={file.filename}
                  className="inline-flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-1.5 text-sm text-slate-700 shadow-sm transition-colors hover:bg-cyan-50 hover:text-cyan-900"
                >
                  <FileText className="h-3.5 w-3.5 text-cyan-700" />
                  <span className="max-w-[14rem] truncate font-medium">
                    {file.filename}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                    {file.chunk_count} chunk{file.chunk_count === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteWorkspaceFile(file.filename)}
                    disabled={deletingFilename === file.filename}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Delete ${file.filename}`}
                    title="Delete file from workspace"
                  >
                    {deletingFilename === file.filename ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No files indexed yet for this workspace.
              </p>
            )}
          </div>
        </section>
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm font-medium text-slate-600 shadow-sm">
              <Sparkles className="h-4 w-4 text-cyan-600" />
              Ask questions across your uploaded PDFs
            </div>
            <h1 className="text-4xl font-semibold tracking-normal text-slate-950 md:text-6xl">
              NeuralDocs AI
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-7 text-muted-foreground md:text-lg">
              Upload research papers, reports, notes, or business documents.
              NeuralDocs AI retrieves relevant context and streams concise,
              source-backed answers.
            </p>
            <div className="mt-7 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
              <div className="rounded-md border bg-white p-4 shadow-sm">
                <FileText className="mb-3 h-5 w-5 text-cyan-700" />
                <p className="text-sm font-semibold">PDF ingestion</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Parse and index document pages with metadata.
                </p>
              </div>
              <div className="rounded-md border bg-white p-4 shadow-sm">
                <Search className="mb-3 h-5 w-5 text-emerald-700" />
                <p className="text-sm font-semibold">Semantic search</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Retrieve the most relevant chunks from Supabase.
                </p>
              </div>
              <div className="rounded-md border bg-white p-4 shadow-sm">
                <Sparkles className="mb-3 h-5 w-5 text-violet-700" />
                <p className="text-sm font-semibold">Grounded answers</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate responses with visible source references.
                </p>
              </div>
            </div>
          </div>
          <ExamplePrompts onPromptSelect={setInput} />
        </div>
      ) : (
        <div className="mb-20 w-full max-w-5xl space-y-4">
          {messages.map((message, i) => (
            <ChatMessage key={i} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/95 p-4 shadow-[0_-12px_30px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 shadow-sm sm:hidden">
            <Folder className="h-4 w-4 text-cyan-700" />
            <Input
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              aria-label="Workspace ID"
              className="h-8 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((file, index) => (
                <FilePreview
                  key={`${file.name}-${index}`}
                  file={file}
                  onRemove={() => handleRemoveFile(file)}
                />
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative">
            <div className="flex overflow-hidden rounded-md border bg-white shadow-sm">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf"
                multiple
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-12 rounded-none"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isUploading
                    ? 'Uploading PDF...'
                    : 'Ask a question about your documents...'
                }
                className="h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isUploading || isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="h-12 rounded-none"
                disabled={!input.trim() || isUploading || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

function parseServerSentEvent(eventText: string) {
  const lines = eventText.split('\n');
  const eventLine = lines.find((line) => line.startsWith('event:'));
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/, ''));

  if (!eventLine || dataLines.length === 0) {
    return null;
  }

  return {
    event: eventLine.replace(/^event:\s?/, '').trim(),
    data: JSON.parse(dataLines.join('\n')),
  };
}
