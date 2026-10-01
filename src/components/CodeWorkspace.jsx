import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Download,
  Copy,
  Check,
  RotateCcw,
  Smartphone,
  Tablet,
  Monitor,
  Code2,
  Eye,
  Terminal,
  Sparkles,
  Maximize2,
  Minimize2,
  FileCode,
  SendHorizontal,
  FolderArchive,
  Plus,
  Trash2
} from 'lucide-react';
import { exportProjectAsZip } from '../services/zipExporter';
import { virtualFS } from '../services/virtualFS';

export const CodeWorkspace = ({
  isOpen,
  onClose,
  initialCode = '',
  initialLanguage = 'html',
  onSendToChat
}) => {
  const [activeTab, setActiveTab] = useState('preview'); // 'code', 'preview', 'split', 'console'
  const [viewport, setViewport] = useState('desktop'); // 'desktop', 'tablet', 'mobile'
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isAddingFile, setIsAddingFile] = useState(false);
  
  // Files state synchronized with VirtualFS
  const [files, setFiles] = useState(() => virtualFS.getAllFiles());
  const [activeFileName, setActiveFileName] = useState('index.html');
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [copied, setCopied] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const iframeRef = useRef(null);

  // Subscribe to VirtualFS live updates (Antigravity Agent writes)
  useEffect(() => {
    const unsubscribe = virtualFS.subscribe((updatedFiles) => {
      setFiles({ ...updatedFiles });
      setRunKey(k => k + 1);
    });
    return unsubscribe;
  }, []);

  // Update file when initialCode changes
  useEffect(() => {
    if (initialCode) {
      if (initialLanguage === 'python') {
        virtualFS.writeFile('app.py', initialCode);
        setActiveFileName('app.py');
        setActiveTab('code');
      } else if (initialLanguage === 'css') {
        virtualFS.writeFile('style.css', initialCode);
        setActiveFileName('style.css');
        setActiveTab('split');
      } else if (initialLanguage === 'javascript' || initialLanguage === 'js') {
        virtualFS.writeFile('script.js', initialCode);
        setActiveFileName('script.js');
        setActiveTab('split');
      } else {
        virtualFS.writeFile('index.html', initialCode);
        setActiveFileName('index.html');
        setActiveTab('split');
      }
    }
  }, [initialCode, initialLanguage]);

  // Construct iframe preview document
  const getCombinedHtml = () => {
    if (activeFileName.endsWith('.py')) {
      const escapedPy = encodeURIComponent(files[activeFileName] || '');
      return `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"></script>
</head>
<body class="bg-slate-950 text-slate-100 p-4 font-mono text-xs antialiased">
  <div class="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
    <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
      <span class="text-indigo-400 font-bold flex items-center gap-1.5">🐍 In-Browser Python Runner (Pyodide WebAssembly)</span>
      <span id="py-status" class="text-[11px] text-amber-400">Initializing Python Engine...</span>
    </div>
    <div id="output" class="whitespace-pre-wrap font-mono text-emerald-400 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800 min-h-[140px]">Running...</div>
  </div>

  <script>
    async function runPython() {
      const outDiv = document.getElementById('output');
      const statusSpan = document.getElementById('py-status');
      try {
        statusSpan.innerText = 'Loading Pyodide WASM...';
        const pyodide = await loadPyodide();
        statusSpan.innerText = 'Executing Python...';
        
        let outputText = '';
        pyodide.setStdout({ batched: (msg) => {
          outputText += msg + '\\n';
          outDiv.innerText = outputText;
          window.parent.postMessage({ type: 'CONSOLE_LOG', level: 'log', message: '[Python stdout] ' + msg }, '*');
        }});
        
        const code = decodeURIComponent("${escapedPy}");
        await pyodide.runPythonAsync(code);
        statusSpan.innerText = 'Execution Complete (OK)';
        statusSpan.className = 'text-[11px] text-emerald-400 font-semibold';
        if (!outputText) {
          outDiv.innerText = '(Python script executed successfully with no print output)';
        }
      } catch (err) {
        statusSpan.innerText = 'Runtime Error';
        statusSpan.className = 'text-[11px] text-red-400 font-semibold';
        outDiv.innerText = 'Traceback (most recent call last):\\n' + err.message;
        window.parent.postMessage({ type: 'CONSOLE_LOG', level: 'error', message: '[Python Error] ' + err.message }, '*');
      }
    }
    runPython();
  </script>
</body>
</html>`;
    }

    const html = files['index.html'] || '';
    const css = files['style.css'] || '';
    const js = files['script.js'] || '';

    // Inject console interceptor
    const interceptor = `
      <script>
        (function() {
          const originalLog = console.log;
          const originalError = console.error;
          const originalWarn = console.warn;

          window.addEventListener('error', function(e) {
            window.parent.postMessage({ type: 'CONSOLE_LOG', level: 'error', message: e.message + ' at line ' + e.lineno }, '*');
          });

          console.log = function(...args) {
            originalLog.apply(console, args);
            window.parent.postMessage({ type: 'CONSOLE_LOG', level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
          };
          console.warn = function(...args) {
            originalWarn.apply(console, args);
            window.parent.postMessage({ type: 'CONSOLE_LOG', level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
          };
          console.error = function(...args) {
            originalError.apply(console, args);
            window.parent.postMessage({ type: 'CONSOLE_LOG', level: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
          };
        })();
      </script>
    `;

    // Combine HTML with CSS & JS
    if (html.includes('</head>')) {
      return html.replace('</head>', `<style>${css}</style>${interceptor}</head>`) + `<script>${js}<\/script>`;
    }
    return `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><style>${css}</style>${interceptor}</head><body>${html}<script>${js}<\/script></body></html>`;
  };

  // Listen to iframe console messages
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'CONSOLE_LOG') {
        setConsoleLogs(prev => [
          ...prev.slice(-49),
          { level: event.data.level, message: event.data.message, time: new Date().toLocaleTimeString() }
        ]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleExportZip = async () => {
    setIsExportingZip(true);
    try {
      await exportProjectAsZip(files, 'ashenai-project');
    } catch (e) {
      console.error('ZIP export error:', e);
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleDownloadSingle = () => {
    const content = files[activeFileName];
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(files[activeFileName]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handleAddCustomFile = () => {
    if (newFileName.trim()) {
      const cleanName = newFileName.trim();
      virtualFS.writeFile(cleanName, '');
      setActiveFileName(cleanName);
      setNewFileName('');
      setIsAddingFile(false);
    }
  };

  const handleDeleteFile = (fileName) => {
    if (Object.keys(files).length <= 1) return;
    virtualFS.deleteFile(fileName);
    const remaining = Object.keys(virtualFS.getAllFiles()).filter(f => f !== fileName);
    if (remaining.length > 0) {
      setActiveFileName(remaining[0]);
    }
  };

  const handleAskAIToRefactor = () => {
    if (onSendToChat) {
      const prompt = `Please review and refactor the following code from the workspace (${activeFileName}):\n\n\`\`\`${activeFileName.split('.').pop()}\n${files[activeFileName]}\n\`\`\`\n\nCan you optimize it, fix any bugs, and improve the styling/functionality?`;
      onSendToChat(prompt);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 bg-[#0f111a] text-gray-200 border-l border-gray-800 shadow-2xl flex flex-col transition-all duration-300 ${
        isFullScreen
          ? 'inset-0'
          : 'inset-y-0 right-0 w-full md:w-[720px] lg:w-[880px]'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#141824] border-b border-gray-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
            <Code2 className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-gray-200">AshenAI Code Workspace</span>
          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
            Live Sandbox
          </span>
        </div>

        {/* View mode buttons & Window controls */}
        <div className="flex items-center gap-1.5">
          {/* Viewport Toggles for Preview */}
          {(activeTab === 'preview' || activeTab === 'split') && (
            <div className="hidden sm:flex items-center bg-gray-900 rounded-lg p-0.5 border border-gray-800 mr-2">
              <button
                onClick={() => setViewport('desktop')}
                className={`p-1 rounded ${viewport === 'desktop' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                title="Desktop View (100%)"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewport('tablet')}
                className={`p-1 rounded ${viewport === 'tablet' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                title="Tablet View (768px)"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewport('mobile')}
                className={`p-1 rounded ${viewport === 'mobile' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                title="Mobile View (375px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Tab View Switcher */}
          <div className="flex items-center bg-gray-900 rounded-lg p-0.5 border border-gray-800 text-[11px]">
            <button
              onClick={() => setActiveTab('code')}
              className={`px-2 py-1 rounded ${activeTab === 'code' ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Editor
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-2 py-1 rounded ${activeTab === 'preview' ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab('split')}
              className={`hidden md:block px-2 py-1 rounded ${activeTab === 'split' ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Split
            </button>
            <button
              onClick={() => setActiveTab('console')}
              className={`px-2 py-1 rounded relative ${activeTab === 'console' ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Console
              {consoleLogs.length > 0 && (
                <span className="ml-1 px-1 py-0.2 rounded-full bg-red-500 text-white text-[9px]">
                  {consoleLogs.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* File Tabs & Actions Sub-bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#181d2a] border-b border-gray-800 text-xs">
        {/* File Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {Object.keys(files).map((fileName) => (
            <div
              key={fileName}
              className={`flex items-center rounded-md border text-[11px] font-mono transition-all ${
                activeFileName === fileName
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 font-semibold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border-transparent'
              }`}
            >
              <button
                onClick={() => setActiveFileName(fileName)}
                className="flex items-center gap-1.5 px-2.5 py-1"
              >
                <FileCode className="w-3 h-3 text-indigo-400" />
                <span>{fileName}</span>
              </button>
              {Object.keys(files).length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteFile(fileName)}
                  className="pr-1.5 pl-0.5 text-gray-500 hover:text-red-400"
                  title="Remove file"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {/* Add file inline input */}
          {isAddingFile ? (
            <div className="flex items-center gap-1 bg-gray-900 px-2 py-0.5 rounded border border-gray-700">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="filename.js"
                className="w-24 bg-transparent text-white text-[11px] font-mono focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomFile()}
                autoFocus
              />
              <button onClick={handleAddCustomFile} className="text-emerald-400 hover:underline text-[10px]">Add</button>
              <button onClick={() => setIsAddingFile(false)} className="text-gray-400 hover:text-red-400 text-[10px]">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingFile(true)}
              className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-800 text-[11px]"
              title="Add new file"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Run button */}
          <button
            onClick={() => setRunKey(k => k + 1)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium transition-colors"
            title="Reload & Run code"
          >
            <Play className="w-3 h-3 fill-emerald-400" />
            <span>Run</span>
          </button>

          {/* 1-Click ZIP Exporter */}
          <button
            onClick={handleExportZip}
            disabled={isExportingZip}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-medium shadow-sm transition-all"
            title="Download full project as a .ZIP archive"
          >
            <FolderArchive className="w-3 h-3" />
            <span className="hidden sm:inline">{isExportingZip ? 'Zipping...' : 'Download ZIP'}</span>
          </button>

          {/* Refactor with AI */}
          <button
            onClick={handleAskAIToRefactor}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium transition-colors"
            title="Send code to AI for refactor & suggestions"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">Refactor</span>
          </button>

          {/* Copy Single */}
          <button
            onClick={handleCopy}
            className="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            title="Copy current file"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download Single */}
          <button
            onClick={handleDownloadSingle}
            className="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            title="Download current file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden bg-[#0d0f17]">
        {/* CODE EDITOR PANEL */}
        {(activeTab === 'code' || activeTab === 'split') && (
          <div className={`flex-1 flex flex-col border-r border-gray-800 ${activeTab === 'split' ? 'w-1/2' : 'w-full'}`}>
            <textarea
              value={files[activeFileName] || ''}
              onChange={(e) => {
                const val = e.target.value;
                setFiles({ ...files, [activeFileName]: val });
                virtualFS.writeFile(activeFileName, val);
              }}
              onKeyDown={(e) => {
                // Support Tab key indentation
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const start = e.target.selectionStart;
                  const end = e.target.selectionEnd;
                  const val = e.target.value;
                  const updated = val.substring(0, start) + '  ' + val.substring(end);
                  setFiles({ ...files, [activeFileName]: updated });
                  virtualFS.writeFile(activeFileName, updated);
                  setTimeout(() => {
                    e.target.selectionStart = e.target.selectionEnd = start + 2;
                  }, 0);
                }
              }}
              spellCheck={false}
              className="flex-1 w-full p-4 bg-[#0d1017] text-gray-100 font-mono text-xs sm:text-sm leading-relaxed focus:outline-none resize-none selection:bg-indigo-600/40"
              placeholder="// Type your code here..."
            />
          </div>
        )}

        {/* LIVE SANDBOX PREVIEW PANEL */}
        {(activeTab === 'preview' || activeTab === 'split') && (
          <div className={`flex-1 flex flex-col items-center justify-center bg-[#131722] p-2 overflow-hidden ${activeTab === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div
              className={`h-full bg-white rounded-xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col ${
                viewport === 'mobile'
                  ? 'w-[375px] max-w-full border-4 border-gray-700'
                  : viewport === 'tablet'
                  ? 'w-[768px] max-w-full border-4 border-gray-700'
                  : 'w-full'
              }`}
            >
              <iframe
                key={runKey}
                ref={iframeRef}
                title="Sandbox Preview"
                srcDoc={getCombinedHtml()}
                sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                className="w-full h-full border-none bg-white"
              />
            </div>
          </div>
        )}

        {/* DEVELOPER CONSOLE PANEL */}
        {activeTab === 'console' && (
          <div className="flex-1 flex flex-col bg-[#0b0d13] p-4 font-mono text-xs overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800 mb-2">
              <span className="text-gray-400 font-semibold flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" /> Sandboxed Console Output
              </span>
              <button
                onClick={() => setConsoleLogs([])}
                className="text-[11px] text-gray-500 hover:text-red-400 transition-colors"
              >
                Clear Console
              </button>
            </div>

            {consoleLogs.length === 0 ? (
              <div className="text-gray-500 py-8 text-center italic">
                No logs or errors recorded. Use <code>console.log()</code> in your script!
              </div>
            ) : (
              <div className="space-y-1.5">
                {consoleLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg flex items-start justify-between ${
                      log.level === 'error'
                        ? 'bg-red-950/40 text-red-300 border border-red-900/40'
                        : log.level === 'warn'
                        ? 'bg-amber-950/40 text-amber-300 border border-amber-900/40'
                        : 'bg-gray-900/60 text-gray-200 border border-gray-800/60'
                    }`}
                  >
                    <span className="break-all whitespace-pre-wrap">{log.message}</span>
                    <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">{log.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
