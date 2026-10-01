import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Trash2,
  Terminal,
  Search,
  Filter,
  AlertCircle,
  Zap,
  Globe,
  ChevronDown,
  ChevronRight,
  Code,
  RefreshCw
} from 'lucide-react';
import { logger } from '../services/logger';

export const DebugLogsModal = ({ isOpen, onClose, currentSettings, backendStatus }) => {
  const [logs, setLogs] = useState([]);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogIds, setExpandedLogIds] = useState(new Set());
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    setLogs([...logger.getLogs()]);
    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs([...newLogs]);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const toggleExpand = (id) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopySingle = (entry) => {
    const text = `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}\n` +
      (entry.data ? `DATA: ${JSON.stringify(entry.data, null, 2)}` : '');
    navigator.clipboard.writeText(text);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyAllLogs = () => {
    const systemSummary = `=====================================================
ASHEN AI SYSTEM DIAGNOSTICS LOG
Generated at: ${new Date().toISOString()}
Backend URL: ${currentSettings?.backendUrl || 'None (Using Mock)'}
Model ID: ${currentSettings?.modelName || 'Unknown'}
Backend Status: ${backendStatus?.online ? `Online (${backendStatus.latency}ms)` : `Offline (${backendStatus?.error || 'Unreachable'})`}
Tavily Search Key Configured: ${currentSettings?.tavilyApiKey ? 'Yes' : 'No'}
=====================================================

` + logger.exportAsText();

    navigator.clipboard.writeText(systemSummary);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadLogs = (format = 'txt') => {
    let content = '';
    let mimeType = 'text/plain';
    let filename = `ashenai-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;

    if (format === 'json') {
      content = JSON.stringify({
        metadata: {
          exportedAt: new Date().toISOString(),
          settings: currentSettings,
          backendStatus
        },
        logs
      }, null, 2);
      mimeType = 'application/json';
      filename += '.json';
    } else {
      content = `=====================================================
ASHEN AI SYSTEM DIAGNOSTICS LOG
Generated at: ${new Date().toISOString()}
Backend URL: ${currentSettings?.backendUrl || 'None'}
Model: ${currentSettings?.modelName || 'Unknown'}
=====================================================\n\n` + logger.exportAsText();
      filename += '.txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter logs
  const filteredLogs = logs.filter(entry => {
    if (filterCategory !== 'ALL' && entry.category !== filterCategory) return false;
    if (filterLevel !== 'ALL' && entry.level !== filterLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = entry.message.toLowerCase().includes(q);
      const matchCat = entry.category.toLowerCase().includes(q);
      const matchData = entry.data ? JSON.stringify(entry.data).toLowerCase().includes(q) : false;
      return matchMsg || matchCat || matchData;
    }
    return true;
  });

  const getLevelBadgeClass = (level) => {
    switch (level) {
      case 'ERROR':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'WARN':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'INFO':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'DEBUG':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'SEARCH':
        return <Globe className="w-3 h-3 text-cyan-400" />;
      case 'NETWORK':
      case 'STREAM':
        return <Zap className="w-3 h-3 text-amber-400" />;
      case 'SANDBOX':
        return <Code className="w-3 h-3 text-purple-400" />;
      default:
        return <Terminal className="w-3 h-3 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-5xl h-[90vh] bg-white dark:bg-[#121622] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-dark-card/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Live Diagnostics & Event Logs</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {logs.length} events
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Inspect web searches, HTTP payloads, token streams, and remote GPU communications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy All Logs Button */}
            <button
              type="button"
              onClick={handleCopyAllLogs}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                copiedAll
                  ? 'bg-emerald-600 text-white'
                  : 'bg-brand-600 hover:bg-brand-700 text-white active:scale-95 shadow-brand-500/20'
              }`}
            >
              {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Copied Full Diagnostics!' : 'Copy All Logs'}</span>
            </button>

            {/* Export Menu */}
            <div className="flex items-center rounded-xl bg-gray-100 dark:bg-dark-card border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                type="button"
                onClick={() => handleDownloadLogs('txt')}
                title="Download as TXT"
                className="px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>TXT</span>
              </button>
              <div className="w-[1px] h-4 bg-gray-300 dark:bg-gray-700" />
              <button
                type="button"
                onClick={() => handleDownloadLogs('json')}
                title="Download as JSON"
                className="px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover"
              >
                JSON
              </button>
            </div>

            {/* Clear Logs */}
            <button
              type="button"
              onClick={() => logger.clear()}
              title="Clear log history"
              className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#10131d]">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            {['ALL', 'SEARCH', 'NETWORK', 'STREAM', 'ERROR', 'SYSTEM'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  if (cat === 'ERROR') {
                    setFilterLevel(filterLevel === 'ERROR' ? 'ALL' : 'ERROR');
                  } else {
                    setFilterCategory(cat);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  (cat === 'ERROR' && filterLevel === 'ERROR') || (cat !== 'ERROR' && filterCategory === cat && filterLevel !== 'ERROR')
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-dark-card text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-hover'
                }`}
              >
                {cat === 'ALL' && 'All Categories'}
                {cat === 'SEARCH' && '🌐 Web Search'}
                {cat === 'NETWORK' && '⚡ Network/HTTP'}
                {cat === 'STREAM' && '🔄 Token Stream'}
                {cat === 'ERROR' && '❌ Errors Only'}
                {cat === 'SYSTEM' && '⚙️ System'}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs & payloads..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Log Viewer List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs bg-gray-50/50 dark:bg-[#0c0e14]">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
              <Terminal className="w-12 h-12 mb-3 opacity-30 text-brand-500" />
              <p className="font-semibold text-gray-600 dark:text-gray-300">No matching log entries found</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Interact with the chat, search the web, or trigger code generation to view real-time diagnostics here.
              </p>
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const isExpanded = expandedLogIds.has(entry.id);
              const hasData = entry.data !== null && entry.data !== undefined;

              return (
                <div
                  key={entry.id}
                  className={`rounded-xl border transition-all ${
                    entry.level === 'ERROR'
                      ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                      : entry.category === 'SEARCH'
                      ? 'bg-cyan-50/30 dark:bg-cyan-950/10 border-cyan-200 dark:border-cyan-900/40'
                      : 'bg-white dark:bg-[#141824] border-gray-200 dark:border-gray-800/80 shadow-sm'
                  }`}
                >
                  <div
                    onClick={() => hasData && toggleExpand(entry.id)}
                    className={`p-2.5 flex items-start gap-2.5 select-text ${
                      hasData ? 'cursor-pointer hover:bg-gray-50/80 dark:hover:bg-dark-hover/40' : ''
                    }`}
                  >
                    {/* Expand Chevron if has data */}
                    {hasData ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(entry.id);
                        }}
                        className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mt-0.5"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-brand-500" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ) : (
                      <div className="w-4 h-4 flex-shrink-0" />
                    )}

                    {/* Timestamp */}
                    <span className="text-[11px] text-gray-400 font-mono whitespace-nowrap mt-0.5">
                      {entry.timeFormatted}
                    </span>

                    {/* Level Badge */}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getLevelBadgeClass(
                        entry.level
                      )}`}
                    >
                      {entry.level}
                    </span>

                    {/* Category Badge */}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 flex items-center gap-1 border border-gray-200 dark:border-gray-700">
                      {getCategoryIcon(entry.category)}
                      <span>{entry.category}</span>
                    </span>

                    {/* Message */}
                    <div className="flex-1 min-w-0 font-sans text-xs text-gray-800 dark:text-gray-200 break-words mt-0.5">
                      {entry.message}
                    </div>

                    {/* Single Item Copy */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopySingle(entry);
                      }}
                      title="Copy this entry"
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors flex-shrink-0"
                    >
                      {copiedId === entry.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Data Payload */}
                  {isExpanded && hasData && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800/80">
                      <div className="p-2.5 rounded-lg bg-gray-900 text-gray-200 font-mono text-[11px] overflow-x-auto max-h-80 select-all border border-gray-800">
                        <pre className="whitespace-pre-wrap break-all">
                          {typeof entry.data === 'string'
                            ? entry.data
                            : JSON.stringify(entry.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer with quick summary */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-dark-card/40 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>
              Target URL: <code className="text-brand-500 font-mono">{currentSettings?.backendUrl || 'Mock Simulation'}</code>
            </span>
            <span>
              Model: <code className="font-mono text-gray-700 dark:text-gray-300">{currentSettings?.modelName}</code>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium bg-gray-200 dark:bg-dark-card hover:bg-gray-300 dark:hover:bg-dark-hover text-gray-700 dark:text-gray-300 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};

