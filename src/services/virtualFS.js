/**
 * Virtual Project Filesystem for Antigravity Autonomous Agent
 * Manages in-memory multi-file project workspaces, surgical code edits, and live synchronization.
 */

class VirtualFileSystem {
  constructor() {
    this.files = new Map();
    this.listeners = new Set();
    this.resetToDefault();
  }

  resetToDefault() {
    this.files.clear();
    this.files.set('index.html', `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AshenAI Project</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center font-sans antialiased">
  <div class="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md">
    <div class="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 mx-auto flex items-center justify-center font-bold text-xl mb-4">
      🤖
    </div>
    <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
      Antigravity Live Workspace
    </h1>
    <p class="text-slate-400 text-sm mb-6">
      Ask the Antigravity Agent to build a complete application, game, or tool!
    </p>
  </div>
  <script src="script.js"></script>
</body>
</html>`);

    this.files.set('style.css', `/* Global Styles */
body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}`);

    this.files.set('script.js', `// Application Logic
console.log("Antigravity Virtual Filesystem Ready!");`);

    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const snapshot = this.getAllFiles();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (e) {
        console.error('VirtualFS listener error:', e);
      }
    }
  }

  writeFile(path, content) {
    const cleanPath = path.trim().replace(/^\/+/, '');
    this.files.set(cleanPath, content);
    this.notify();
    return { success: true, path: cleanPath, size: content.length, lines: content.split('\n').length };
  }

  readFile(path) {
    const cleanPath = path.trim().replace(/^\/+/, '');
    if (this.files.has(cleanPath)) {
      return this.files.get(cleanPath);
    }
    return null;
  }

  replaceContent(path, targetContent, replacementContent) {
    const cleanPath = path.trim().replace(/^\/+/, '');
    if (!this.files.has(cleanPath)) {
      return { success: false, error: `File "${cleanPath}" does not exist in workspace.` };
    }

    const currentContent = this.files.get(cleanPath);
    if (!currentContent.includes(targetContent)) {
      return { success: false, error: `Target snippet not found in "${cleanPath}".` };
    }

    const newContent = currentContent.replace(targetContent, replacementContent);
    this.files.set(cleanPath, newContent);
    this.notify();
    return { success: true, path: cleanPath, updatedLines: newContent.split('\n').length };
  }

  deleteFile(path) {
    const cleanPath = path.trim().replace(/^\/+/, '');
    const existed = this.files.delete(cleanPath);
    if (existed) this.notify();
    return { success: existed, path: cleanPath };
  }

  listFiles() {
    return Array.from(this.files.keys()).map(path => ({
      path,
      size: this.files.get(path).length,
      lines: this.files.get(path).split('\n').length
    }));
  }

  getAllFiles() {
    const obj = {};
    for (const [path, content] of this.files.entries()) {
      obj[path] = content;
    }
    return obj;
  }

  getCombinedPreviewHtml() {
    const html = this.readFile('index.html') || '<!DOCTYPE html><html><body><h1>No index.html</h1></body></html>';
    const css = this.readFile('style.css') || '';
    const js = this.readFile('script.js') || '';

    // Console & Error Interceptor script injected into sandboxed iframe
    const interceptor = `
      <script>
        (function() {
          const sendLog = (level, message) => {
            window.parent.postMessage({ type: 'CONSOLE_LOG', level, message }, '*');
          };

          window.onerror = function(msg, url, line, col, error) {
            window.parent.postMessage({
              type: 'SANDBOX_RUNTIME_ERROR',
              error: {
                message: String(msg),
                line: line,
                column: col,
                stack: error && error.stack ? error.stack : ''
              }
            }, '*');
          };

          window.onunhandledrejection = function(event) {
            window.parent.postMessage({
              type: 'SANDBOX_RUNTIME_ERROR',
              error: {
                message: 'Unhandled Promise Rejection: ' + (event.reason ? event.reason.message || String(event.reason) : 'Unknown error'),
                stack: event.reason && event.reason.stack ? event.reason.stack : ''
              }
            }, '*');
          };

          const origLog = console.log;
          const origWarn = console.warn;
          const origErr = console.error;

          console.log = function(...args) {
            origLog.apply(console, args);
            sendLog('log', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
          };
          console.warn = function(...args) {
            origWarn.apply(console, args);
            sendLog('warn', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
          };
          console.error = function(...args) {
            origErr.apply(console, args);
            sendLog('error', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
          };
        })();
      </script>
    `;

    // Inject styles and scripts
    if (html.includes('</head>')) {
      return html.replace('</head>', `<style>${css}</style>${interceptor}</head>`) + `<script>${js}<\/script>`;
    }
    return `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><style>${css}</style>${interceptor}</head><body>${html}<script>${js}<\/script></body></html>`;
  }
}

export const virtualFS = new VirtualFileSystem();

