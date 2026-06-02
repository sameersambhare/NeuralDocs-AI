import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';
import { PDFSource } from '@/types/graphTypes';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {message.sources?.map((source, index) => (
                        <Card
                          key={index}
                          className="bg-background/50 transition-all duration-200 hover:bg-background hover:shadow-md hover:scale-[1.02] cursor-pointer"
                        >
                          <CardContent className="p-3">
                            <p className="text-sm font-medium truncate">
                              {source.filename || 'N/A'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Page {source.page || 'N/A'}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </>
        )}
      </div>
    </div>
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
