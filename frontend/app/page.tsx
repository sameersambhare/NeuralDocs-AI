'use client';

import type React from 'react';

import { useToast } from '@/hooks/use-toast';
import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowUp,
  FileText,
  Loader2,
  Paperclip,
  Search,
  Sparkles,
} from 'lucide-react';
import { ExamplePrompts } from '@/components/example-prompts';
import { ChatMessage } from '@/components/chat-message';
import { FilePreview } from '@/components/file-preview';
import { PDFSource } from '@/types/graphTypes';

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
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null); // Add this ref

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMessages((prev) => {
        const newArr = [...prev];
        newArr[newArr.length - 1] = {
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
        };
        return newArr;
      });
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

      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload files');
      }

      setFiles((prev) => [...prev, ...selectedFiles]);
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
          <div className="hidden rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm sm:block">
            RAG-powered PDF chat
          </div>
        </header>
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
