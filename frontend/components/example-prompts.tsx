import { ArrowUpRight } from 'lucide-react';

import { Card } from '@/components/ui/card';

interface ExamplePromptsProps {
  onPromptSelect: (prompt: string) => void;
}

const EXAMPLE_PROMPTS = [
  {
    title: 'Summarize the uploaded document',
    description: 'Create a short overview of the main ideas.',
  },
  {
    title: 'List the key points with sources',
    description: 'Pull out important details and cite retrieved pages.',
  },
];

export function ExamplePrompts({ onPromptSelect }: ExamplePromptsProps) {
  return (
    <div className="grid w-full max-w-2xl grid-cols-1 gap-3 md:grid-cols-2">
      {EXAMPLE_PROMPTS.map((prompt, i) => (
        <Card
          key={i}
          className="group cursor-pointer rounded-md p-4 text-left shadow-sm transition-colors hover:bg-slate-50"
          onClick={() => onPromptSelect(prompt.title)}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{prompt.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {prompt.description}
              </p>
            </div>
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
        </Card>
      ))}
    </div>
  );
}

