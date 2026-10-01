import React, { useMemo } from 'react';
import katex from 'katex';
import { CodeBlock } from './CodeBlock';
import { ThinkingBlock } from './ThinkingBlock';

export const MarkdownRenderer = ({ content = '', isStreaming = false, onOpenInWorkspace }) => {
  // 1. Separate <think> blocks if present (handles standard <think> tags & omitted opening tags)
  const { thinking, mainContent } = useMemo(() => {
    if (!content) return { thinking: null, mainContent: '' };

    // Case 1: Explicit <think> tag present
    if (/<think>/i.test(content)) {
      const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
      if (thinkMatch) {
        const thinkingText = thinkMatch[1].trim();
        const afterThink = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();
        return { thinking: thinkingText, mainContent: afterThink };
      }
    }

    // Case 2: Omitted opening tag but closing </think> present (common in Qwen/DeepSeek reasoning outputs)
    if (/<\/think>/i.test(content)) {
      const parts = content.split(/<\/think>/i);
      const thinkingText = (parts[0] || '').trim();
      const afterThink = parts.slice(1).join('</think>').trim();
      return { thinking: thinkingText, mainContent: afterThink };
    }

    return { thinking: null, mainContent: content };
  }, [content]);

  // Render LaTeX formulas safely
  const renderMathString = (tex, displayMode = false) => {
    try {
      return katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        output: 'html'
      });
    } catch (e) {
      return tex;
    }
  };

  // Parse custom Markdown text into React nodes
  const renderedNodes = useMemo(() => {
    if (!mainContent) return null;

    // Split text by code blocks first: ```lang\ncode\n```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(mainContent)) !== null) {
      const textBefore = mainContent.substring(lastIndex, match.index);
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore });
      }
      parts.push({
        type: 'code',
        language: match[1] || 'text',
        code: match[2]
      });
      lastIndex = match.index + match[0].length;
    }

    const trailingText = mainContent.substring(lastIndex);
    if (trailingText) {
      // Check if user is currently streaming an unclosed code block
      const unclosedCodeMatch = trailingText.match(/```([a-zA-Z0-9_-]*)\n([\s\S]*)$/);
      if (unclosedCodeMatch) {
        const textBefore = trailingText.substring(0, unclosedCodeMatch.index);
        if (textBefore) {
          parts.push({ type: 'text', content: textBefore });
        }
        parts.push({
          type: 'code',
          language: unclosedCodeMatch[1] || 'text',
          code: unclosedCodeMatch[2]
        });
      } else {
        parts.push({ type: 'text', content: trailingText });
      }
    }

    return parts;
  }, [mainContent]);

  // Helper to render markdown paragraphs, lists, tables, and inline math
  const renderFormattedText = (textBlock) => {
    if (!textBlock) return null;

    // Split into lines/paragraphs
    const lines = textBlock.split('\n');
    const elements = [];
    let inList = false;
    let listType = 'ul';
    let listItems = [];
    let inTable = false;
    let tableRows = [];

    const flushList = () => {
      if (listItems.length > 0) {
        if (listType === 'ol') {
          elements.push(
            <ol key={`ol-${elements.length}`} className="list-decimal pl-6 my-2 space-y-1 text-gray-800 dark:text-gray-200">
              {listItems.map((item, idx) => (
                <li key={idx}>{parseInlineFormatting(item)}</li>
              ))}
            </ol>
          );
        } else {
          elements.push(
            <ul key={`ul-${elements.length}`} className="list-disc pl-6 my-2 space-y-1 text-gray-800 dark:text-gray-200">
              {listItems.map((item, idx) => (
                <li key={idx}>{parseInlineFormatting(item)}</li>
              ))}
            </ul>
          );
        }
        listItems = [];
        inList = false;
      }
    };

    const flushTable = () => {
      if (tableRows.length > 0) {
        const [headerRow, ...bodyRows] = tableRows;
        // Check if row 1 is a delimiter row (|---|---|)
        const isDelimiter = (r) => r.every(cell => /^[-: ]+$/.test(cell));
        const filteredBody = bodyRows.filter(r => !isDelimiter(r));

        elements.push(
          <div key={`table-${elements.length}`} className="overflow-x-auto my-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 dark:bg-dark-card border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-800 dark:text-gray-200">
                <tr>
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} className="px-3.5 py-2.5">{parseInlineFormatting(cell.trim())}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 bg-white dark:bg-dark-surface">
                {filteredBody.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-gray-50/50 dark:hover:bg-dark-card/50 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2 text-gray-700 dark:text-gray-300">
                        {parseInlineFormatting(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for LaTeX block $$ ... $$
      if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
        flushList();
        flushTable();
        const mathContent = trimmed.slice(2, -2).trim();
        elements.push(
          <div
            key={`math-${i}`}
            className="my-3 overflow-x-auto text-center py-2 px-3 bg-gray-50/80 dark:bg-dark-card/50 rounded-lg border border-gray-200/60 dark:border-gray-800"
            dangerouslySetInnerHTML={{ __html: renderMathString(mathContent, true) }}
          />
        );
        continue;
      }

      // Check for Table Row
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        flushList();
        inTable = true;
        const cells = trimmed.split('|').slice(1, -1);
        tableRows.push(cells);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Headers
      if (trimmed.startsWith('# ')) {
        flushList();
        flushTable();
        elements.push(<h1 key={`h1-${i}`} className="text-xl md:text-2xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">{parseInlineFormatting(trimmed.slice(2))}</h1>);
      } else if (trimmed.startsWith('## ')) {
        flushList();
        flushTable();
        elements.push(<h2 key={`h2-${i}`} className="text-lg md:text-xl font-bold mt-3.5 mb-2 text-gray-900 dark:text-gray-100">{parseInlineFormatting(trimmed.slice(3))}</h2>);
      } else if (trimmed.startsWith('### ')) {
        flushList();
        flushTable();
        elements.push(<h3 key={`h3-${i}`} className="text-base md:text-lg font-semibold mt-3 mb-1.5 text-gray-900 dark:text-gray-100">{parseInlineFormatting(trimmed.slice(4))}</h3>);
      } else if (trimmed.startsWith('> ')) {
        // Blockquote
        flushList();
        flushTable();
        elements.push(
          <blockquote key={`quote-${i}`} className="border-l-4 border-brand-500 pl-3.5 py-1 my-2 text-gray-600 dark:text-gray-300 italic bg-gray-50/50 dark:bg-dark-card/30 rounded-r-md">
            {parseInlineFormatting(trimmed.slice(2))}
          </blockquote>
        );
      } else if (/^[-*+]\s+/.test(trimmed)) {
        // Unordered list
        flushTable();
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
        }
        listItems.push(trimmed.replace(/^[-*+]\s+/, ''));
      } else if (/^\d+\.\s+/.test(trimmed)) {
        // Ordered list
        flushTable();
        if (!inList || listType !== 'ol') {
          flushList();
          inList = true;
          listType = 'ol';
        }
        listItems.push(trimmed.replace(/^\d+\.\s+/, ''));
      } else if (trimmed === '---' || trimmed === '***') {
        flushList();
        flushTable();
        elements.push(<hr key={`hr-${i}`} className="my-4 border-gray-200 dark:border-gray-800" />);
      } else if (trimmed === '') {
        flushList();
        flushTable();
      } else {
        flushList();
        flushTable();
        elements.push(
          <p key={`p-${i}`} className="my-2 leading-relaxed text-gray-800 dark:text-gray-200">
            {parseInlineFormatting(line)}
          </p>
        );
      }
    }

    flushList();
    flushTable();
    return elements;
  };

  // Inline formatting: **bold**, *italic*, `inline code`, [link](url), and $inline math$
  const parseInlineFormatting = (text) => {
    if (typeof text !== 'string') return text;

    // Replace $math$ with rendered KaTeX spans
    const mathPattern = /\$([^\$\n]+)\$/g;
    let parts = [];
    let lastIdx = 0;
    let match;

    while ((match = mathPattern.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.substring(lastIdx, match.index));
      }
      const renderedMath = renderMathString(match[1], false);
      parts.push(
        <span
          key={`inline-math-${match.index}`}
          className="inline-math px-1"
          dangerouslySetInnerHTML={{ __html: renderedMath }}
        />
      );
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      parts.push(text.substring(lastIdx));
    }

    // Now format strings inside parts for bold, italic, code, links
    return parts.map((part, pIdx) => {
      if (typeof part !== 'string') return part;

      // Tokenize formatting tags
      const tokens = part.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
      return tokens.map((token, tIdx) => {
        if (!token) return null;
        if (token.startsWith('**') && token.endsWith('**')) {
          return <strong key={tIdx} className="font-semibold text-gray-900 dark:text-white">{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith('*') && token.endsWith('*')) {
          return <em key={tIdx} className="italic">{token.slice(1, -1)}</em>;
        }
        if (token.startsWith('`') && token.endsWith('`')) {
          return (
            <code key={tIdx} className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-card border border-gray-200 dark:border-gray-800 text-brand-600 dark:text-brand-400">
              {token.slice(1, -1)}
            </code>
          );
        }
        if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
          const lMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (lMatch) {
            return (
              <a
                key={tIdx}
                href={lMatch[2]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-500 hover:text-brand-600 underline underline-offset-2 transition-colors"
              >
                {lMatch[1]}
              </a>
            );
          }
        }
        return token;
      });
    });
  };

  return (
    <div className="prose-custom text-sm md:text-base leading-relaxed break-words">
      {thinking && <ThinkingBlock thinking={thinking} isStreaming={isStreaming && !mainContent} />}
      
      {renderedNodes && renderedNodes.map((node, index) => {
        if (node.type === 'code') {
          return (
            <CodeBlock
              key={`code-${index}`}
              code={node.code}
              language={node.language}
              onOpenInWorkspace={onOpenInWorkspace}
            />
          );
        }
        return <div key={`block-${index}`}>{renderFormattedText(node.content)}</div>;
      })}

      {isStreaming && (
        <span className="blinking-cursor" title="Generating..." />
      )}
    </div>
  );
};

