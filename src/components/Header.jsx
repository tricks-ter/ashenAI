import React from 'react';
import {
  Menu,
  Sun,
  Moon,
  Settings,
  Plus,
  Sparkles,
  Server,
  Zap,
  Radio,
  Code2,
  Terminal,
  Activity,
  Brain,
  Gauge
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getPersonaById } from '../services/personas';

export const Header = ({
  onToggleSidebar,
  onOpenSettings,
  onNewChat,
  onOpenWorkspace,
  onOpenLogs,
  backendStatus,
  currentModelName,
  activePersonaId = 'general',
  speedometer = null // { tokensPerSec: 38, totalTokens: 150 }
}) => {
  const { theme, toggleTheme } = useTheme();
  const activePersona = getPersonaById(activePersonaId);

  const getStatusBadge = () => {
    if (backendStatus.online) {
      return (
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
          title={`Connected to ${backendStatus.gpu || 'GPU'}. Latency: ${backendStatus.latency}ms. Click to edit settings.`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:inline font-mono">Colab/GPU Online</span>
          <span className="text-[10px] opacity-75 font-mono">({backendStatus.latency}ms)</span>
        </button>
      );
    } else {
      return (
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer"
          title="Colab backend not connected. Click to enter URL."
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="hidden xs:inline font-medium">Simulation Mode</span>
        </button>
      );
    }
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-3 md:px-5 bg-white/85 dark:bg-[#0b0d13]/85 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800/80 transition-colors">
      {/* Left side: Hamburger + Logo + Active Persona */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
          title="Toggle chat history sidebar"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-brand-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-bold text-base md:text-lg tracking-tight bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 dark:from-brand-400 dark:via-indigo-300 dark:to-purple-400 bg-clip-text text-transparent">
            AshenAI
          </span>
        </div>

        {/* Model Identifier Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-gray-100 dark:bg-dark-card text-xs font-mono text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800">
          <Zap className="w-3 h-3 text-brand-500" />
          <span className="max-w-[140px] truncate">{currentModelName || 'Qwen 3 14B'}</span>
        </div>

        {/* Speedometer Telemetry Pill */}
        {speedometer && speedometer.tokensPerSec > 0 && (
          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 text-[11px] font-mono animate-pulse">
            <Gauge className="w-3 h-3" />
            <span>{speedometer.tokensPerSec} tok/s</span>
          </div>
        )}
      </div>

      {/* Right side: Status pill + Workspace + New Chat + Theme + Logs + Settings */}
      <div className="flex items-center gap-1.5 md:gap-2.5">
        {getStatusBadge()}

        {onOpenWorkspace && (
          <button
            onClick={onOpenWorkspace}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold transition-all shadow-sm active:scale-95"
            title="Open Live Code Sandbox & Editor"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Workspace</span>
          </button>
        )}

        <button
          onClick={onNewChat}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-dark-hover text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-200/60 dark:border-gray-800 transition-colors"
          title="Start a new chat (Ctrl+K)"
        >
          <Plus className="w-3.5 h-3.5 text-brand-500" />
          <span>New Chat</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>

        {/* Diagnostics & Logs Button */}
        {onOpenLogs && (
          <button
            onClick={onOpenLogs}
            className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors relative"
            title="Live Diagnostics & System Logs (View full requests, search sources, and copy logs)"
          >
            <Terminal className="w-4 h-4 text-brand-500" />
          </button>
        )}

        {/* Settings Modal Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
          title="Colab GPU Connection & Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
