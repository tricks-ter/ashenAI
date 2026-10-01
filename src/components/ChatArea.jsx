import React, { useRef, useEffect, useState } from 'react';
import { Sparkles, ArrowDown, Code2, Cpu, FileText, Lightbulb } from 'lucide-react';
import { ChatMessage } from './ChatMessage';

const STARTER_PROMPTS = [
  {
    icon: Code2,
    title: 'Code Streamer Class',
    desc: 'Write a Python generator for streaming tokens from HuggingFace models.',
    prompt: 'Write an asynchronous Python generator class for streaming tokens from a HuggingFace CausalLM model with type hints and error handling.'
  },
  {
    icon: Cpu,
    title: 'Explain Quantum Attention',
    desc: 'Explain how attention works mathematically in LLM Transformers.',
    prompt: 'Explain the mathematics of the Scaled Dot-Product Attention mechanism in Transformers with KaTeX formulas.'
  },
  {
    icon: Lightbulb,
    title: 'Colab Optimization Tips',
    desc: 'Tips for running 7B/8B models on 15GB free Colab T4 GPU.',
    prompt: 'What are the best quantization and memory optimization techniques to run 7B-8B parameter LLMs on a free 15GB Colab GPU?'
  },
  {
    icon: FileText,
    title: 'Reasoning & Thinking Demo',
    desc: 'Ask a complex puzzle to see <think> reasoning tokens.',
    prompt: 'Solve this riddle with step-by-step reasoning inside <think> tags: If three cats catch three mice in three minutes, how many cats catch one hundred mice in one hundred minutes?'
  }
];

export const ChatArea = ({
  messages = [],
  isStreaming = false,
  onSendMessage,
  onRegenerate,
  onEditMessage,
  currentModelName,
  onOpenInWorkspace
}) => {
  const scrollContainerRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isAutoScrollActiveRef = useRef(true);

  // Auto scroll logic
  const scrollToBottom = (behavior = 'smooth') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior
      });
    }
  };

  useEffect(() => {
    if (isAutoScrollActiveRef.current) {
      scrollToBottom(isStreaming ? 'auto' : 'smooth');
    }
  }, [messages, isStreaming]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    // If user scrolled up by more than 120px, pause auto-scroll and show button
    if (distanceFromBottom > 120) {
      isAutoScrollActiveRef.current = false;
      setShowScrollBottom(true);
    } else {
      isAutoScrollActiveRef.current = true;
      setShowScrollBottom(false);
    }
  };

  const handleJumpToBottom = () => {
    isAutoScrollActiveRef.current = true;
    setShowScrollBottom(false);
    scrollToBottom('smooth');
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden relative"
      >
        {messages.length === 0 ? (
          /* Empty / Welcome State */
          <div className="max-w-3xl mx-auto px-4 py-8 sm:py-16 flex flex-col items-center justify-center min-h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-brand-500/25 mb-6 ring-4 ring-brand-100 dark:ring-brand-950/40">
              <Sparkles className="w-7 h-7" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
              How can I assist you today?
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-8 sm:mb-12">
              Ready for coding, deep reasoning, LaTeX math, and general assistance. Powered by your remote GPU.
            </p>

            {/* Quick Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
              {STARTER_PROMPTS.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(card.prompt)}
                    className="p-3.5 rounded-2xl border border-gray-200/90 dark:border-gray-800/80 bg-white dark:bg-[#131722]/80 hover:bg-gray-50 dark:hover:bg-[#181d2a] hover:border-brand-500/50 dark:hover:border-brand-500/40 shadow-sm transition-all duration-200 group flex items-start gap-3"
                  >
                    <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-100 mb-0.5 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {card.title}
                      </div>
                      <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                        {card.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Messages List */
          <div className="pb-6">
            {messages.map((msg, index) => (
              <ChatMessage
                key={msg.id || index}
                message={msg}
                isLast={index === messages.length - 1}
                isStreaming={isStreaming}
                onRegenerate={onRegenerate}
                onEdit={msg.role === 'user' ? (newText) => onEditMessage(index, newText) : undefined}
                onOpenInWorkspace={onOpenInWorkspace}
              />
            ))}
          </div>
        )}
      </div>

        {/* Jump to bottom Floating Button */}
        {showScrollBottom && (
          <button
            onClick={handleJumpToBottom}
            className="absolute bottom-4 right-6 z-10 p-2.5 rounded-full bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 shadow-xl hover:bg-gray-100 dark:hover:bg-dark-hover transition-all animate-bounce"
            title="Scroll to bottom"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
    </div>
  );
};

