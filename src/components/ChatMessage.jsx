import React, { useState } from 'react';
import {
  Bot,
  User,
  Copy,
  Check,
  Volume2,
  VolumeX,
  RotateCcw,
  Edit3,
  AlertCircle,
  Globe,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

export const ChatMessage = ({
  message,
  isLast = false,
  isStreaming = false,
  onRegenerate,
  onEdit,
  onOpenInWorkspace
}) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const toggleSpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      // Clean content for speech (remove markdown code/math and thoughts)
      const cleanText = message.content
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^[\s\S]*?<\/think>/gi, '')
        .replace(/```[\s\S]*?```/g, 'Code block omitted.')
        .replace(/\$+[^\$]+\$+/g, 'Mathematical equation.');

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && onEdit) {
      onEdit(editContent.trim());
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`group w-full py-5 px-3 md:px-6 transition-colors ${
        isUser
          ? 'bg-transparent'
          : 'bg-gray-50/70 dark:bg-[#131722]/60 border-y border-gray-100 dark:border-gray-800/40'
      }`}
    >
      <div className="max-w-4xl mx-auto flex gap-3.5 md:gap-5">
        {/* Avatar */}
        <div className="flex-shrink-0 pt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800 flex items-center justify-center text-white shadow-sm ring-2 ring-gray-200 dark:ring-gray-700">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 ring-2 ring-brand-300 dark:ring-brand-900/60">
              <Bot className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Content & Action Bar */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Header row with role & timestamp */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-200">
              {isUser ? 'You' : 'AshenAI'}
            </span>
            {message.timestamp && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* User File Attachments Preview */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {message.attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-[#1c2232] border border-gray-200 dark:border-gray-700/80 text-xs text-gray-800 dark:text-gray-200"
                >
                  <Sparkles className="w-3 h-3 text-brand-500" />
                  <span className="font-medium max-w-[180px] truncate">{file.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono">({file.sizeFormatted})</span>
                </div>
              ))}
            </div>
          )}

          {/* Web Search Live Progress indicator */}
          {message.isSearchingWeb && (
            <div className="my-2.5 p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 animate-pulse">
              <Globe className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="font-medium">Searching the live web & analyzing resources...</span>
            </div>
          )}

          {/* Web Sources Citations Carousel */}
          {message.sources && message.sources.length > 0 && (
            <div className="mb-3 p-2.5 rounded-xl bg-gray-100/70 dark:bg-[#181d2a] border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-2">
                <Globe className="w-3.5 h-3.5 text-brand-500" />
                <span>Sources Cited ({message.sources.length}):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#202534] border border-gray-200 dark:border-gray-700/70 text-[11px] text-gray-700 dark:text-gray-300 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-all max-w-[260px] truncate"
                    title={src.title}
                  >
                    <span className="w-4 h-4 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate">{src.title}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-60 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Edit user message mode */}
          {isEditing ? (
            <div className="my-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none resize-y min-h-[80px]"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-md shadow-sm transition-colors"
                >
                  Save & Resubmit
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Render message body */
            <div className="text-gray-800 dark:text-gray-200">
              <MarkdownRenderer
                content={message.content}
                isStreaming={isLast && isStreaming && !isUser}
                onOpenInWorkspace={onOpenInWorkspace}
              />
            </div>
          )}

          {/* Error display */}
          {message.error && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-medium">Generation Error</p>
                <p className="opacity-90">{message.error}</p>
              </div>
            </div>
          )}

          {/* Action buttons footer */}
          {!isStreaming && !isEditing && (
            <div className="flex items-center gap-1.5 mt-3 pt-1 text-gray-400 dark:text-gray-500 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
                title="Copy message text"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={toggleSpeech}
                className={`p-1.5 rounded-md hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors ${
                  isSpeaking ? 'text-brand-500 bg-brand-50 dark:bg-brand-950/40' : ''
                }`}
                title={isSpeaking ? 'Stop audio' : 'Read aloud'}
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-brand-500 animate-pulse" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {isUser && onEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-md hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
                  title="Edit prompt"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}

              {!isUser && isLast && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
                  title="Regenerate response"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="text-[11px] hidden sm:inline">Regenerate</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
