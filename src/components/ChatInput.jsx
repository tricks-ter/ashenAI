import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Mic,
  MicOff,
  Sparkles,
  Globe,
  Code2,
  Paperclip,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  ChevronUp,
  Brain,
  Zap
} from 'lucide-react';
import { parseUploadedFile } from '../services/fileParser';
import { voiceService } from '../services/voice';
import { AI_PERSONAS } from '../services/personas';

export const ChatInput = ({
  onSendMessage,
  onStopStreaming,
  isStreaming = false,
  disabled = false,
  isWebSearchActive = false,
  onToggleWebSearch,
  onOpenWorkspace,
  activePersonaId = 'general',
  onSelectPersona,
  isAgentMode = false,
  onToggleAgentMode,
  placeholder = "Ask anything... (Shift + Enter for new line, drag files or paste links)"
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const personaMenuRef = useRef(null);

  const activePersona = AI_PERSONAS.find(p => p.id === activePersonaId) || AI_PERSONAS[0];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Close persona menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (personaMenuRef.current && !personaMenuRef.current.contains(e.target)) {
        setIsPersonaMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleFilesSelected = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const parsedList = [];
    for (const file of Array.from(fileList)) {
      try {
        const parsed = await parseUploadedFile(file);
        parsedList.push(parsed);
      } catch (err) {
        console.warn('File parse error:', err);
      }
    }
    setAttachedFiles(prev => [...prev, ...parsedList]);
  };

  const handleRemoveFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFilesSelected(e.dataTransfer.files);
    }
  };

  const toggleVoiceListening = () => {
    voiceService.toggle(
      (finalText, interimText) => {
        if (finalText) {
          setInput(prev => (prev ? prev + ' ' : '') + finalText);
        }
      },
      (err) => {
        alert(err || 'Microphone error');
        setIsListening(false);
      },
      (listeningState) => {
        setIsListening(listeningState);
      }
    );
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if ((input.trim() || attachedFiles.length > 0) && !isStreaming && !disabled) {
      onSendMessage(input.trim(), attachedFiles);
      setInput('');
      setAttachedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getFileIcon = (category) => {
    switch (category) {
      case 'spreadsheet':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 md:px-6 pb-4 pt-1">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFilesSelected(e.target.files)}
        multiple
        className="hidden"
      />

      {/* Main Input Dock Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col bg-white/90 dark:bg-[#141824]/90 backdrop-blur-xl border rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/25 transition-all ${
          isDragging
            ? 'border-brand-500 ring-2 ring-brand-500/30 bg-brand-50/20 dark:bg-brand-950/20'
            : 'border-gray-200/90 dark:border-gray-800/90 focus-within:border-brand-500/80 focus-within:ring-2 focus-within:ring-brand-500/20'
        }`}
      >
        {/* Attached Files Chips Bar */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-2.5 pb-0 border-b border-gray-100 dark:border-gray-800/60">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-dark-card border border-gray-200/80 dark:border-gray-700/80 text-xs text-gray-800 dark:text-gray-200 animate-in fade-in zoom-in-95 duration-150"
              >
                {getFileIcon(file.category)}
                <span className="max-w-[160px] truncate font-medium">{file.name}</span>
                <span className="text-[10px] text-gray-400 font-mono">({file.sizeFormatted})</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(idx)}
                  className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-dark-hover text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Input Row */}
        <div className="flex items-end gap-1.5 p-2 md:p-3">
          {/* Paperclip File Upload */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors flex-shrink-0"
            title="Attach documents, code, spreadsheets, or images"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Web Search Toggle Button */}
          {onToggleWebSearch && (
            <button
              type="button"
              onClick={onToggleWebSearch}
              className={`p-2 rounded-xl transition-all flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold ${
                isWebSearchActive
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/30'
                  : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-dark-card'
              }`}
              title={isWebSearchActive ? 'Live Web Search & Financial Grounding is ON' : 'Turn ON Live Web Search'}
            >
              <Globe className={`w-4 h-4 ${isWebSearchActive ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
              <span className="hidden sm:inline text-[11px]">{isWebSearchActive ? 'Search ON' : 'Search'}</span>
            </button>
          )}

          {/* Voice Mic Button */}
          <button
            type="button"
            onClick={toggleVoiceListening}
            className={`p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors flex-shrink-0 relative ${
              isListening ? 'text-red-500 bg-red-50 dark:bg-red-950/40 ring-2 ring-red-500/30' : ''
            }`}
            title={isListening ? 'Stop voice recording' : 'Dictate with microphone (Speech-to-Text)'}
          >
            {isListening ? (
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <MicOff className="relative w-4 h-4 text-red-500" />
              </span>
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening to your voice..." : placeholder}
            rows={1}
            disabled={disabled}
            className="flex-1 max-h-[200px] py-1.5 px-2 bg-transparent text-gray-900 dark:text-gray-100 text-sm md:text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none resize-none leading-relaxed"
          />

          {/* Send or Stop Button */}
          <div className="flex-shrink-0 flex items-center">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                className="p-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center"
                title="Stop generating"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={(!input.trim() && attachedFiles.length === 0) || disabled}
                className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                  (input.trim() || attachedFiles.length > 0) && !disabled
                    ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 active:scale-95'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                }`}
                title="Send message (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Capabilities Toolbar & Persona Pill */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/60 dark:bg-[#101420]/60 border-t border-gray-100 dark:border-gray-800/60 rounded-b-2xl text-[11px] text-gray-500">
          {/* Persona Dropdown Pill */}
          <div className="relative" ref={personaMenuRef}>
            <button
              type="button"
              onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-500 transition-colors font-medium text-[11px]"
            >
              <Brain className="w-3 h-3 text-brand-500" />
              <span>{activePersona.badge}</span>
              <ChevronUp className={`w-3 h-3 text-gray-400 transition-transform ${isPersonaMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Persona Dropdown Menu */}
            {isPersonaMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-[#121622] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 p-1.5 z-30 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Select AI Persona
                </div>
                {AI_PERSONAS.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => {
                      if (onSelectPersona) onSelectPersona(persona.id);
                      setIsPersonaMenuOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-start gap-2 transition-colors ${
                      activePersonaId === persona.id
                        ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'hover:bg-gray-50 dark:hover:bg-dark-card text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs">{persona.name}</div>
                      <div className="text-[10px] text-gray-400 font-normal">{persona.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right side shortcuts & live status */}
          <div className="flex items-center gap-2 text-gray-400">
            {/* Antigravity Autonomous Mode Toggle */}
            {onToggleAgentMode && (
              <button
                type="button"
                onClick={onToggleAgentMode}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isAgentMode
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-purple-400/40'
                    : 'bg-white dark:bg-dark-card hover:bg-gray-100 dark:hover:bg-dark-hover border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                }`}
                title={isAgentMode ? 'Antigravity Autonomous Engineer Mode ON' : 'Turn ON Antigravity Autonomous Engineer Mode'}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAgentMode ? 'text-yellow-300 animate-spin' : 'text-purple-500'}`} style={{ animationDuration: '6s' }} />
                <span>{isAgentMode ? '🤖 Antigravity ON' : 'Antigravity Agent'}</span>
              </button>
            )}

            {onOpenWorkspace && (
              <button
                type="button"
                onClick={onOpenWorkspace}
                className="hidden sm:flex items-center gap-1 hover:text-indigo-500 transition-colors"
                title="Launch live interactive code workspace"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Sandbox</span>
              </button>
            )}

            {isWebSearchActive && !isAgentMode ? (
              <span className="text-blue-500 flex items-center gap-1 font-medium hidden md:inline">
                <Zap className="w-3 h-3" /> Live Search
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
