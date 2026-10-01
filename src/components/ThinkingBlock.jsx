import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

export const ThinkingBlock = ({ thinking, isStreaming = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!thinking || !thinking.trim()) return null;

  return (
    <div className="my-2.5 rounded-xl border border-indigo-200/60 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/25 overflow-hidden transition-all duration-200 shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className={`w-4 h-4 ${isStreaming ? 'animate-bounce text-indigo-500' : 'text-indigo-600 dark:text-indigo-400'}`} />
          <span className="font-semibold">Thought Process</span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-200/80 dark:bg-indigo-900/80 text-indigo-900 dark:text-indigo-200 font-mono animate-pulse">
              <Sparkles className="w-2.5 h-2.5" /> Thinking live...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <span className="text-[11px] font-medium">{isOpen ? 'Hide Thoughts' : 'View Thoughts'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 border-t border-indigo-100 dark:border-indigo-900/40 font-sans leading-relaxed whitespace-pre-wrap bg-white/70 dark:bg-black/30 font-mono text-[11.5px]">
          {thinking}
          {isStreaming && <span className="blinking-cursor" />}
        </div>
      )}
    </div>
  );
};

