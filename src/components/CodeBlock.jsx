import React, { useState, useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-go';
import { Copy, Check, Terminal, Play, Eye } from 'lucide-react';

export const CodeBlock = ({ code, language = 'text', onOpenInWorkspace }) => {
  const [copied, setCopied] = useState(false);

  const cleanLang = language.toLowerCase().trim() || 'text';
  const isPreviewable = ['html', 'javascript', 'js', 'css', 'react', 'jsx', 'tsx', 'python', 'py'].includes(cleanLang);

  useEffect(() => {
    Prism.highlightAll();
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getHighlightedCode = () => {
    const prismLang = Prism.languages[cleanLang] || Prism.languages.text;
    try {
      return Prism.highlight(code, prismLang, cleanLang);
    } catch (e) {
      return code;
    }
  };

  return (
    <div className="relative my-3.5 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800/80 bg-[#1e222d] shadow-sm">
      {/* Code Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#171a23] border-b border-gray-800 text-xs font-mono text-gray-400">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-brand-400" />
          <span className="font-semibold text-gray-300 uppercase tracking-wider">{cleanLang}</span>
        </div>

        <div className="flex items-center gap-2">
          {isPreviewable && onOpenInWorkspace && (
            <button
              onClick={() => onOpenInWorkspace(code, cleanLang)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-300 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 transition-colors"
              title="Open in Live Code Sandbox & Editor"
            >
              <Play className="w-3 h-3 fill-indigo-400" />
              <span>Live Preview</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div className="overflow-x-auto p-4 text-sm font-mono leading-relaxed text-gray-200">
        <pre className="!m-0 !p-0 !bg-transparent">
          <code
            className={`language-${cleanLang}`}
            dangerouslySetInnerHTML={{ __html: getHighlightedCode() }}
          />
        </pre>
      </div>
    </div>
  );
};
