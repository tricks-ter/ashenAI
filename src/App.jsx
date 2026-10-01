import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatArea } from './components/ChatArea';
import { ChatInput } from './components/ChatInput';
import { SettingsModal } from './components/SettingsModal';
import { DebugLogsModal } from './components/DebugLogsModal';
import { CodeWorkspace } from './components/CodeWorkspace';
import { ThemeProvider } from './context/ThemeContext';
import { logger } from './services/logger';
import {
  loadSessions,
  saveSessions,
  loadActiveSessionId,
  saveActiveSessionId,
  loadSettings,
  saveSettings,
  createNewSession
} from './services/storage';
import { checkBackendHealth, streamChatCompletions } from './services/api';
import {
  performWebSearch,
  buildGroundingContext,
  shouldAutoSearchWeb,
  extractUrlsFromText
} from './services/webSearch';
import { buildAttachmentsContext } from './services/fileParser';
import { getPersonaById } from './services/personas';
import { agentEngine } from './services/agentEngine';
import { virtualFS } from './services/virtualFS';
import { AgentStepViewer } from './components/AgentStepViewer';

export function AppContent() {
  const [sessions, setSessions] = useState(() => {
    const saved = loadSessions();
    if (saved && saved.length > 0) return saved;
    const initial = createNewSession('Welcome to AshenAI');
    return [initial];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    const savedId = loadActiveSessionId();
    if (savedId) return savedId;
    return sessions[0]?.id || null;
  });

  const [settings, setSettings] = useState(loadSettings);
  const [activePersonaId, setActivePersonaId] = useState('general');
  const [speedometer, setSpeedometer] = useState({ tokensPerSec: 0, totalTokens: 0 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDebugLogsOpen, setIsDebugLogsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWebSearchActive, setIsWebSearchActive] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [agentSteps, setAgentSteps] = useState([]);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  
  // Code Workspace state
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [workspaceCode, setWorkspaceCode] = useState('');
  const [workspaceLanguage, setWorkspaceLanguage] = useState('html');

  const [backendStatus, setBackendStatus] = useState({ online: false, latency: null });
  const abortControllerRef = useRef(null);

  // Active session object
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];

  // Persist sessions
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  // Persist active session id
  useEffect(() => {
    saveActiveSessionId(activeSessionId);
  }, [activeSessionId]);

  // Check backend health on initial load and when settings change
  useEffect(() => {
    let isMounted = true;
    const testHealth = async () => {
      if (settings.backendUrl) {
        const res = await checkBackendHealth(settings.backendUrl, settings.apiKey);
        if (isMounted) {
          setBackendStatus(res);
        }
      }
    };
    testHealth();
    return () => { isMounted = false; };
  }, [settings.backendUrl, settings.apiKey]);

  // Mobile layout auto-close sidebar on small screens
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessions]);

  const handleNewChat = () => {
    const newSession = createNewSession();
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleSelectSession = (id) => {
    setActiveSessionId(id);
  };

  const handleDeleteSession = (id) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (id === activeSessionId) {
        const nextActive = filtered[0] || createNewSession();
        if (filtered.length === 0) {
          setActiveSessionId(nextActive.id);
          return [nextActive];
        } else {
          setActiveSessionId(nextActive.id);
        }
      }
      return filtered;
    });
  };

  const handleRenameSession = (id, newTitle) => {
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s))
    );
  };

  const handleClearAllSessions = () => {
    const fresh = createNewSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  };

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Open specific code inside the Live Workspace Sandbox
  const handleOpenInWorkspace = (code, language = 'html') => {
    setWorkspaceCode(code);
    setWorkspaceLanguage(language);
    setIsWorkspaceOpen(true);
  };

  const handleSendMessage = async (text, attachedFiles = []) => {
    if ((!text && (!attachedFiles || attachedFiles.length === 0)) || isStreaming) return;

    const userMessage = {
      id: 'msg_' + Date.now() + '_u',
      role: 'user',
      content: text || `[Attached ${attachedFiles.length} file(s)]`,
      attachments: attachedFiles,
      timestamp: Date.now()
    };

    const assistantPlaceholder = {
      id: 'msg_' + Date.now() + '_a',
      role: 'assistant',
      content: '',
      sources: [],
      isSearchingWeb: false,
      timestamp: Date.now()
    };

    // Update conversation title if this is the first message
    let updatedTitle = activeSession.title;
    if (activeSession.messages.length === 0 || activeSession.title === 'New Conversation' || activeSession.title === 'Welcome to AshenAI') {
      const titleCandidate = text ? (text.slice(0, 36) + (text.length > 36 ? '...' : '')) : (attachedFiles[0]?.name || 'Document Analysis');
      updatedTitle = titleCandidate;
    }

    const updatedMessages = [...messages, userMessage, assistantPlaceholder];

    setSessions(prev =>
      prev.map(s =>
        s.id === activeSessionId
          ? { ...s, title: updatedTitle, messages: updatedMessages, updatedAt: Date.now() }
          : s
      )
    );

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    // 1. Check if Live Web Search or Direct URL scraping is needed
    let groundingPromptPrefix = '';
    let foundSources = [];

    const needsSearch = isWebSearchActive || shouldAutoSearchWeb(text) || extractUrlsFromText(text).length > 0;
    if (needsSearch) {
      // Indicate searching state on assistant message
      setSessions(prev =>
        prev.map(s => {
          if (s.id !== activeSessionId) return s;
          const msgs = [...s.messages];
          if (msgs.length > 0) {
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], isSearchingWeb: true };
          }
          return { ...s, messages: msgs };
        })
      );

      try {
        foundSources = await performWebSearch(text, settings.tavilyApiKey || '', 5);
        if (foundSources.length > 0) {
          groundingPromptPrefix = buildGroundingContext(foundSources);
        }
      } catch (err) {
        console.warn('Web search error:', err);
      }
    }

    // Attach sources & clear searching flag
    setSessions(prev =>
      prev.map(s => {
        if (s.id !== activeSessionId) return s;
        const msgs = [...s.messages];
        if (msgs.length > 0) {
          msgs[msgs.length - 1] = {
            ...msgs[msgs.length - 1],
            isSearchingWeb: false,
            sources: foundSources
          };
        }
        return { ...s, messages: msgs };
      })
    );

    // 2. Build Attachments Context if files uploaded
    let attachmentsPromptPrefix = '';
    if (attachedFiles && attachedFiles.length > 0) {
      attachmentsPromptPrefix = buildAttachmentsContext(attachedFiles);
    }

    // 3. Prepare messages payload (with persona instructions + attachments + grounding)
    let userFinalContent = text || 'Please review and analyze the attached files.';
    if (attachmentsPromptPrefix) {
      userFinalContent = `${attachmentsPromptPrefix}\nUser Request: ${userFinalContent}`;
    }
    if (groundingPromptPrefix) {
      userFinalContent = `${groundingPromptPrefix}\nUser Query: ${userFinalContent}`;
    }

    const historyPayload = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userFinalContent }
    ];

    const activePersona = getPersonaById(activePersonaId);
    const personaSettings = {
      ...settings,
      systemPrompt: activePersona.systemPrompt || settings.systemPrompt,
      temperature: activePersona.temperature ?? settings.temperature,
      topP: activePersona.topP ?? settings.topP
    };

    // 4. Handle Antigravity Autonomous Agent Mode
    if (isAgentMode) {
      setIsAgentRunning(true);
      setAgentSteps([{ stepNumber: 1, type: 'THINKING', message: 'Antigravity Agent initializing mission & planning...' }]);
      setIsWorkspaceOpen(true);

      let accumulatedAgentText = '';
      const unsubscribeSteps = agentEngine.onStep((step) => {
        setAgentSteps(prev => [...prev, step]);
      });

      try {
        await agentEngine.runAutonomousTask({
          goal: userFinalContent,
          settings,
          onDelta: (delta) => {
            accumulatedAgentText += delta;
            setSessions(prev =>
              prev.map(s => {
                if (s.id !== activeSessionId) return s;
                const msgs = [...s.messages];
                if (msgs.length > 0) {
                  msgs[msgs.length - 1] = {
                    ...msgs[msgs.length - 1],
                    content: accumulatedAgentText,
                    isSearchingWeb: false,
                    sources: foundSources
                  };
                }
                return { ...s, messages: msgs, updatedAt: Date.now() };
              })
            );
          },
          onError: (errMsg) => {
            setIsStreaming(false);
            setIsAgentRunning(false);
            unsubscribeSteps();
          },
          onFinish: () => {
            setIsStreaming(false);
            setIsAgentRunning(false);
            unsubscribeSteps();
          }
        });
      } catch (err) {
        setIsStreaming(false);
        setIsAgentRunning(false);
        unsubscribeSteps();
      }
      return;
    }

    let accumulatedContent = '';
    let hasAutoOpenedWorkspace = false;
    const isBuildingIntent = /(build|create|make|write|develop|generate|design|implement|code|fix|refactor|html|react|game|website|app|script|calculator)/i.test(text);

    const streamStartTime = performance.now();
    let streamTokensCount = 0;

    logger.info('STREAM', `Starting chat completion stream with persona "${activePersona.name}" for prompt: "${(text || '').slice(0, 80)}"`);

    await streamChatCompletions({
      messages: historyPayload,
      settings: personaSettings,
      signal: abortControllerRef.current.signal,
      onDelta: (delta) => {
        accumulatedContent += delta;
        streamTokensCount++;

        // Calculate live tokens per second
        const elapsedSec = (performance.now() - streamStartTime) / 1000;
        if (elapsedSec > 0.4) {
          const tokPerSec = Math.round(streamTokensCount / elapsedSec);
          setSpeedometer({ tokensPerSec: tokPerSec, totalTokens: streamTokensCount });
        }

        // Auto-detect code block generation for live workspace sync
        const codeMatch = accumulatedContent.match(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)(?:```|$)/);
        if (codeMatch && codeMatch[2] && codeMatch[2].length > 20) {
          const lang = codeMatch[1] || 'html';
          setWorkspaceCode(codeMatch[2]);
          setWorkspaceLanguage(lang);

          if (!hasAutoOpenedWorkspace && isBuildingIntent && window.innerWidth >= 768) {
            hasAutoOpenedWorkspace = true;
            setIsWorkspaceOpen(true);
          }
        }

        setSessions(prev =>
          prev.map(s => {
            if (s.id !== activeSessionId) return s;
            const msgs = [...s.messages];
            if (msgs.length > 0) {
              const lastMsg = {
                ...msgs[msgs.length - 1],
                content: accumulatedContent,
                isSearchingWeb: false,
                sources: foundSources
              };
              msgs[msgs.length - 1] = lastMsg;
            }
            return { ...s, messages: msgs, updatedAt: Date.now() };
          })
        );
      },
      onError: (errMsg) => {
        setSessions(prev =>
          prev.map(s => {
            if (s.id !== activeSessionId) return s;
            const msgs = [...s.messages];
            if (msgs.length > 0) {
              const lastMsg = {
                ...msgs[msgs.length - 1],
                content: accumulatedContent || 'Could not complete the response.',
                error: errMsg,
                isSearchingWeb: false,
                sources: foundSources
              };
              msgs[msgs.length - 1] = lastMsg;
            }
            return { ...s, messages: msgs, updatedAt: Date.now() };
          })
        );
        setIsStreaming(false);
      },
      onFinish: () => {
        setIsStreaming(false);
      }
    });
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  const handleRegenerate = () => {
    if (messages.length < 2 || isStreaming) return;
    const lastUserIndex = messages.map(m => m.role).lastIndexOf('user');
    if (lastUserIndex === -1) return;

    const lastUserMsg = messages[lastUserIndex];
    const trimmed = messages.slice(0, lastUserIndex + 1);

    const assistantPlaceholder = {
      id: 'msg_' + Date.now() + '_a',
      role: 'assistant',
      content: '',
      sources: [],
      timestamp: Date.now()
    };

    setSessions(prev =>
      prev.map(s =>
        s.id === activeSessionId
          ? { ...s, messages: [...trimmed, assistantPlaceholder], updatedAt: Date.now() }
          : s
      )
    );

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    let accumulatedContent = '';

    streamChatCompletions({
      messages: trimmed,
      settings,
      signal: abortControllerRef.current.signal,
      onDelta: (delta) => {
        accumulatedContent += delta;
        setSessions(prev =>
          prev.map(s => {
            if (s.id !== activeSessionId) return s;
            const msgs = [...s.messages];
            if (msgs.length > 0) {
              const lastMsg = { ...msgs[msgs.length - 1], content: accumulatedContent };
              msgs[msgs.length - 1] = lastMsg;
            }
            return { ...s, messages: msgs, updatedAt: Date.now() };
          })
        );
      },
      onError: (errMsg) => {
        setSessions(prev =>
          prev.map(s => {
            if (s.id !== activeSessionId) return s;
            const msgs = [...s.messages];
            if (msgs.length > 0) {
              const lastMsg = {
                ...msgs[msgs.length - 1],
                content: accumulatedContent || 'Could not complete response',
                error: errMsg
              };
              msgs[msgs.length - 1] = lastMsg;
            }
            return { ...s, messages: msgs, updatedAt: Date.now() };
          })
        );
        setIsStreaming(false);
      },
      onFinish: () => {
        setIsStreaming(false);
      }
    });
  };

  const handleEditMessage = (msgIndex, newText) => {
    const sliced = messages.slice(0, msgIndex);
    const updatedUserMsg = {
      id: 'msg_' + Date.now() + '_u',
      role: 'user',
      content: newText,
      timestamp: Date.now()
    };
    const assistantPlaceholder = {
      id: 'msg_' + Date.now() + '_a',
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    const newHistory = [...sliced, updatedUserMsg, assistantPlaceholder];

    setSessions(prev =>
      prev.map(s =>
        s.id === activeSessionId
          ? { ...s, messages: newHistory, updatedAt: Date.now() }
          : s
      )
    );

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    let accumulatedContent = '';

    streamChatCompletions({
      messages: [...sliced, updatedUserMsg],
      settings,
      signal: abortControllerRef.current.signal,
      onDelta: (delta) => {
        accumulatedContent += delta;
        setSessions(prev =>
          prev.map(s => {
            if (s.id !== activeSessionId) return s;
            const msgs = [...s.messages];
            if (msgs.length > 0) {
              msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: accumulatedContent };
            }
            return { ...s, messages: msgs, updatedAt: Date.now() };
          })
        );
      },
      onError: (errMsg) => {
        setSessions(prev =>
          prev.map(s => {
            if (s.id !== activeSessionId) return s;
            const msgs = [...s.messages];
            if (msgs.length > 0) {
              msgs[msgs.length - 1] = {
                ...msgs[msgs.length - 1],
                content: accumulatedContent || 'Could not complete response',
                error: errMsg
              };
            }
            return { ...s, messages: msgs, updatedAt: Date.now() };
          })
        );
        setIsStreaming(false);
      },
      onFinish: () => {
        setIsStreaming(false);
      }
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-[#0b0d13] text-gray-900 dark:text-gray-100 antialiased">
      {/* Sidebar (Desktop collapsible & Mobile drawer) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onClearAllSessions={handleClearAllSessions}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenLogs={() => setIsDebugLogsOpen(true)}
      />

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <Header
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenLogs={() => setIsDebugLogsOpen(true)}
          onNewChat={handleNewChat}
          onOpenWorkspace={() => setIsWorkspaceOpen(true)}
          backendStatus={backendStatus}
          currentModelName={settings.modelName}
          activePersonaId={activePersonaId}
          speedometer={speedometer}
        />

        <ChatArea
          messages={messages}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          onRegenerate={handleRegenerate}
          onEditMessage={handleEditMessage}
          onOpenInWorkspace={handleOpenInWorkspace}
          currentModelName={settings.modelName}
        />

        {/* Antigravity Autonomous Agent Step Viewer */}
        <div className="max-w-4xl w-full mx-auto px-3 md:px-6">
          <AgentStepViewer
            steps={agentSteps}
            isAgentRunning={isAgentRunning}
            onStopAgent={() => agentEngine.stop()}
            onOpenWorkspace={() => setIsWorkspaceOpen(true)}
          />
        </div>

        <ChatInput
          onSendMessage={handleSendMessage}
          onStopStreaming={handleStopStreaming}
          isStreaming={isStreaming || isAgentRunning}
          isWebSearchActive={isWebSearchActive}
          onToggleWebSearch={() => setIsWebSearchActive(prev => !prev)}
          onOpenWorkspace={() => setIsWorkspaceOpen(true)}
          activePersonaId={activePersonaId}
          onSelectPersona={setActivePersonaId}
          isAgentMode={isAgentMode}
          onToggleAgentMode={() => setIsAgentMode(prev => !prev)}
        />
      </div>

      {/* Live Code Editor & Sandbox Workspace Panel */}
      <CodeWorkspace
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        initialCode={workspaceCode}
        initialLanguage={workspaceLanguage}
        onSendToChat={handleSendMessage}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onBackendStatusUpdate={setBackendStatus}
      />

      {/* Live Diagnostics & System Logs Modal */}
      <DebugLogsModal
        isOpen={isDebugLogsOpen}
        onClose={() => setIsDebugLogsOpen(false)}
        currentSettings={settings}
        backendStatus={backendStatus}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
