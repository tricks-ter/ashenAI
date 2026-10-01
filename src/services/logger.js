/**
 * Real-Time Diagnostic & Logging Service for AshenAI
 * Captures network requests, web search operations, streaming tokens, and runtime errors.
 */

class LoggerService {
  constructor() {
    this.logs = [];
    this.maxLogs = 500;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.logs);
      } catch (e) {
        console.error('Logger listener error:', e);
      }
    }
  }

  addLog(level, category, message, data = null) {
    const entry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString(),
      level: level.toUpperCase(), // 'INFO', 'WARN', 'ERROR', 'DEBUG'
      category, // 'SEARCH', 'NETWORK', 'STREAM', 'SYSTEM', 'SANDBOX'
      message,
      data: data ? JSON.parse(JSON.stringify(data, this._getCircularReplacer())) : null
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Also log to browser console
    const consolePrefix = `[AshenAI:${category}]`;
    if (level === 'ERROR') {
      console.error(consolePrefix, message, data || '');
    } else if (level === 'WARN') {
      console.warn(consolePrefix, message, data || '');
    } else {
      console.log(consolePrefix, message, data || '');
    }

    this.notify();
    return entry;
  }

  info(category, message, data = null) {
    return this.addLog('INFO', category, message, data);
  }

  warn(category, message, data = null) {
    return this.addLog('WARN', category, message, data);
  }

  error(category, message, data = null) {
    return this.addLog('ERROR', category, message, data);
  }

  debug(category, message, data = null) {
    return this.addLog('DEBUG', category, message, data);
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
    this.notify();
  }

  exportAsText() {
    return this.logs
      .slice()
      .reverse()
      .map(l => {
        let text = `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message}`;
        if (l.data) {
          text += `\nDATA: ${JSON.stringify(l.data, null, 2)}`;
        }
        return text;
      })
      .join('\n\n');
  }

  _getCircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Ref]';
        }
        seen.add(value);
      }
      return value;
    };
  }
}

export const logger = new LoggerService();

