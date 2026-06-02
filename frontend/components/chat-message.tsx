import { Copy, FileSearch, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { PDFSource } from '@/types/graphTypes';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    sources?: PDFSource[];
  };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [activeSource, setActiveSource] = useState<PDFSource | null>(null);
  const isLoading = message.role === 'assistant' && message.content === '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const showSources =
    message.role === 'assistant' &&
    message.sources &&
    message.sources.length > 0;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-md px-4 py-3 ${
          isUser
            ? 'bg-black text-white'
            : 'border bg-white text-slate-900 shadow-sm'
        }`}
      >
        {isLoading ? (
          <div className="flex space-x-1 h-6 items-center">
            <div className="w-1.5 h-1.5 bg-current rounded-full animate-[loading_1s_ease-in-out_infinite]" />
            <div className="w-1.5 h-1.5 bg-current rounded-full animate-[loading_1s_ease-in-out_0.2s_infinite]" />
            <div className="w-1.5 h-1.5 bg-current rounded-full animate-[loading_1s_ease-in-out_0.4s_infinite]" />
          </div>
        ) : (
          <>
            {isUser ? (
              <p className="whitespace-pre-wrap text-sm leading-6">
                {message.content}
              </p>
            ) : (
              <FormattedAssistantMessage content={message.content} />
            )}
            {showSources && message.sources && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.sources.map((source, index) => (
                  <SourceHoverCard key={index} source={source} index={index} />
                ))}
              </div>
            )}
            {!isUser && (
              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopy}
                  title={copied ? 'Copied!' : 'Copy to clipboard'}
                >
                  <Copy
                    className={`h-4 w-4 ${copied ? 'text-green-500' : ''}`}
                  />
                  </Button>
                </div>
              )}
            {showSources && message.sources && (
              <Accordion type="single" collapsible className="w-full mt-2">
                <AccordionItem value="sources" className="border-b-0">
                  <AccordionTrigger className="text-sm py-2 justify-start gap-2 hover:no-underline">
                    View Sources ({message.sources.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {message.sources?.map((source, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setActiveSource(source)}
                          className="rounded-md border bg-background/50 p-3 text-left transition-colors hover:bg-cyan-50"
                        >
                          <div className="flex items-start gap-2">
                            {source.content_type === 'table' ? (
                              <Table2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
                            ) : (
                              <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {source.filename || 'N/A'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Page {source.page || 'N/A'}
                                {source.table_index
                                  ? `, Table ${source.table_index}`
                                  : ''}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                                {source.snippet || source.content}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
            <SourceDialog
              source={activeSource}
              onOpenChange={(open) => {
                if (!open) setActiveSource(null);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function SourceHoverCard({
  source,
  index,
}: {
  source: PDFSource;
  index: number;
}) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-900"
        >
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            {index + 1}
          </span>
          <span className="max-w-[14rem] truncate">{source.filename}</span>
          <span className="text-slate-400">
            {source.page ? `p.${source.page}` : 'source'}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {source.filename}
            </p>
            <p className="text-xs text-muted-foreground">
              {source.page ? `Page ${source.page}` : 'Page unavailable'}
              {source.table_index ? `, Table ${source.table_index}` : ''}
              {source.extraction_method ? `, ${source.extraction_method}` : ''}
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 p-3 text-xs leading-5 text-slate-700">
            <p className="line-clamp-5">
              {source.snippet || source.content || 'No preview available.'}
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function SourceDialog({
  source,
  onOpenChange,
}: {
  source: PDFSource | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(source)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] max-w-3xl overflow-hidden">
        {source && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                {source.content_type === 'table' ? (
                  <Table2 className="h-4 w-4 text-cyan-700" />
                ) : (
                  <FileSearch className="h-4 w-4 text-cyan-700" />
                )}
                <span className="truncate">{source.filename}</span>
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Page {source.page || 'N/A'}
                {source.table_index ? `, Table ${source.table_index}` : ''}
                {source.extraction_method
                  ? `, ${source.extraction_method}`
                  : ''}
              </p>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-auto rounded-md border bg-slate-50 p-4 text-sm leading-6 text-slate-800">
              {renderHighlightedContent(source.content, source.snippet)}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function renderHighlightedContent(content: string, snippet: string) {
  const sourceText = content || '';
  const highlight = snippet?.replace(/\.\.\.$/, '').trim();

  if (!highlight) {
    return <pre className="whitespace-pre-wrap font-sans">{sourceText}</pre>;
  }

  const index = sourceText.toLowerCase().indexOf(highlight.toLowerCase());
  if (index === -1) {
    return (
      <pre className="whitespace-pre-wrap font-sans">
        <mark className="rounded bg-amber-200 px-1">{highlight}</mark>
        {'\n\n'}
        {sourceText}
      </pre>
    );
  }

  const before = sourceText.slice(0, index);
  const match = sourceText.slice(index, index + highlight.length);
  const after = sourceText.slice(index + highlight.length);

  return (
    <pre className="whitespace-pre-wrap font-sans">
      {before}
      <mark className="rounded bg-amber-200 px-1">{match}</mark>
      {after}
    </pre>
  );
}

function FormattedAssistantMessage({ content }: { content: string }) {
  const blocks = parseMarkdownLite(content);

  return (
    <div className="space-y-3 text-sm leading-6">
      {blocks.map((block, index) => {
        if (block.type === 'h1') {
          return (
            <h2
              key={index}
              className="border-b pb-2 text-lg font-semibold text-slate-950"
            >
              {renderInlineText(block.text)}
            </h2>
          );
        }

        if (block.type === 'h2') {
          return (
            <h3
              key={index}
              className="pt-1 text-base font-semibold text-slate-900"
            >
              {renderInlineText(block.text)}
            </h3>
          );
        }

        if (block.type === 'list') {
          return (
            <ul key={index} className="space-y-2 pl-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600" />
                  <span>{renderInlineText(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'source') {
          return (
            <p
              key={index}
              className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-900"
            >
              {renderInlineText(block.text)}
            </p>
          );
        }

        return (
          <p key={index} className="text-slate-700">
            {renderInlineText(block.text)}
          </p>
        );
      })}
    </div>
  );
}

type MessageBlock =
  | { type: 'h1' | 'h2' | 'paragraph' | 'source'; text: string }
  | { type: 'list'; items: string[] };

function parseMarkdownLite(content: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  const lines = content.split('\n');
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: 'list', items: listItems });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith('# ')) {
      flushList();
      blocks.push({ type: 'h1', text: line.replace(/^#\s+/, '') });
      continue;
    }

    if (line.startsWith('## ')) {
      flushList();
      blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '') });
      continue;
    }

    if (line.startsWith('- ')) {
      listItems.push(line.replace(/^-\s+/, ''));
      continue;
    }

    flushList();

    if (line.startsWith('*(') && line.endsWith(')*')) {
      blocks.push({ type: 'source', text: line.replace(/^\*\(|\)\*$/g, '') });
    } else {
      blocks.push({ type: 'paragraph', text: line });
    }
  }

  flushList();
  return blocks;
}

function renderInlineText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-slate-950">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <span key={index}>{part}</span>;
  });
}
