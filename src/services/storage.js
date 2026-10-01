/**
 * Local Storage Persistence Layer for AshenAI
 */

const STORAGE_KEYS = {
  SESSIONS: 'ashenai_sessions',
  ACTIVE_SESSION_ID: 'ashenai_active_session',
  SETTINGS: 'ashenai_settings',
  THEME: 'ashenai_theme'
};

export const DEFAULT_SETTINGS = {
  backendUrl: 'http://localhost:8000', // Or Cloudflare/ngrok URL
  apiKey: '',
  modelName: 'huihui-ai/Qwen3-14B-abliterated',
  systemPrompt: `You are AshenAI, an expert AI software engineer, architect, and general assistant running on high-speed GPU inference.

--- YOUR CAPABILITIES & ENVIRONMENT ---
1. 🌐 LIVE WEB SEARCH & REAL-TIME GROUNDING:
   - You have live access to the Internet, search engines, and URL reading.
   - Real-time search results and scraped webpage excerpts are provided to you dynamically whenever needed.
   - Always synthesize and ground your answers with these live web sources and cite URLs using markdown links.

2. 💻 INTEGRATED CODE WORKSPACE & LIVE SANDBOX:
   - You have a native, interactive Code Editor & Live Preview Sandbox attached to this chat interface.
   - Whenever the user asks you to "build", "create", "develop", "code", "design a website", "make a game", "write a script", or "fix a bug":
     * Provide complete, functional, high-quality, self-contained code with modern design (HTML5, Tailwind CSS, modern JavaScript, Canvas, or Python).
     * The web app will automatically detect your code, open the Live Code Workspace, and render the interactive preview side-by-side for the user in real time!
   - Avoid placeholders or incomplete snippets—always provide the full runnable code.

3. 🧮 RICH FORMATTING & REASONING:
   - Use Markdown headers, tables, bold text, and lists.
   - Use KaTeX math ($ for inline, $$ for display equations).
   - If thinking or planning through a difficult problem, you can place your internal thoughts inside <think>...</think> tags.`,
  temperature: 0.6,
  topP: 0.95,
  topK: 20,
  repetitionPenalty: 1.1,
  maxTokens: 2048,
  stream: true,
  tavilyApiKey: '',
  useMockWhenOffline: true,
  autoScroll: true,
  soundEffects: false
};

export const createNewSession = (title = 'New Conversation') => ({
  id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
  title,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  systemPrompt: '',
  messages: []
});

export const loadSessions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load sessions:', e);
    return [];
  }
};

export const saveSessions = (sessions) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save sessions:', e);
  }
};

export const loadActiveSessionId = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
  } catch (e) {
    return null;
  }
};

export const saveActiveSessionId = (id) => {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
    }
  } catch (e) {
    console.error('Failed to save active session ID:', e);
  }
};

export const loadSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // If old short systemPrompt, update to new comprehensive one
    if (!parsed.systemPrompt || parsed.systemPrompt.length < 280) {
      parsed.systemPrompt = DEFAULT_SETTINGS.systemPrompt;
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

export const exportAllData = () => {
  const data = {
    sessions: loadSessions(),
    settings: loadSettings(),
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ashenai-chats-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportSessionMarkdown = (session) => {
  if (!session || !session.messages.length) return;
  let md = `# ${session.title}\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
  for (const msg of session.messages) {
    const roleName = msg.role === 'user' ? '👤 **User**' : '🤖 **AshenAI**';
    md += `${roleName} (${new Date(msg.timestamp || session.createdAt).toLocaleTimeString()}):\n\n${msg.content}\n\n---\n\n`;
  }
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'chat'}.md`;
  a.click();
  URL.revokeObjectURL(url);
};

