import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Edit2,
  Download,
  Upload,
  X,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Settings,
  FolderDown,
  Terminal
} from 'lucide-react';
import { exportSessionMarkdown, exportAllData } from '../services/storage';

export const Sidebar = ({
  isOpen,
  onClose,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onClearAllSessions,
  onOpenSettings,
  onOpenLogs
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const filtered = sessions.filter(s =>
      (s.title || 'New Chat').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const sevenDaysAgo = today - 86400000 * 7;

    const groups = {
      Today: [],
      Yesterday: [],
      'Previous 7 Days': [],
      Older: []
    };

    filtered.forEach(session => {
      const time = session.updatedAt || session.createdAt || Date.now();
      if (time >= today) {
        groups.Today.push(session);
      } else if (time >= yesterday) {
        groups.Yesterday.push(session);
      } else if (time >= sevenDaysAgo) {
        groups['Previous 7 Days'].push(session);
      } else {
        groups.Older.push(session);
      }
    });

    return groups;
  }, [sessions, searchTerm]);

  const handleStartRename = (e, session) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (sessionId) => {
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden transition-opacity"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 md:w-64 lg:w-72 bg-[#f8fafc] dark:bg-[#0f131d] border-r border-gray-200 dark:border-gray-800/80 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-none md:overflow-hidden'
        }`}
      >
        {/* Top bar: New Chat + Close on mobile */}
        <div className="p-3 border-b border-gray-200/80 dark:border-gray-800/60 flex items-center gap-2">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm shadow-sm shadow-brand-500/20 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-card md:hidden"
            title="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-800 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
          {Object.entries(groupedSessions).map(([groupTitle, list]) => {
            if (list.length === 0) return null;

            return (
              <div key={groupTitle} className="space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase text-gray-400 dark:text-gray-500">
                  {groupTitle}
                </div>

                {list.map((session) => {
                  const isActive = session.id === activeSessionId;

                  return (
                    <div
                      key={session.id}
                      onClick={() => {
                        onSelectSession(session.id);
                        if (window.innerWidth < 768) onClose();
                      }}
                      className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                        isActive
                          ? 'bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-900/40'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-dark-hover'
                      }`}
                    >
                      <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`} />

                      {editingId === session.id ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleSaveRename(session.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(session.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="flex-1 bg-white dark:bg-dark-surface border border-brand-500 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex-1 truncate">{session.title || 'Untitled Chat'}</span>
                      )}

                      {/* Action buttons (Rename, Export MD, Delete) */}
                      {editingId !== session.id && (
                        <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => handleStartRename(e, session)}
                            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-dark-card"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              exportSessionMarkdown(session);
                            }}
                            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-dark-card"
                            title="Export to Markdown"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Delete this conversation?')) {
                                onDeleteSession(session.id);
                              }
                            }}
                            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {sessions.length === 0 && (
            <div className="text-center py-8 px-4 text-xs text-gray-400 dark:text-gray-500">
              <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-40" />
              No conversations yet.<br />Start your first chat above!
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-gray-200/80 dark:border-gray-800/60 bg-white/50 dark:bg-dark-card/20 space-y-1">
          {onOpenLogs && (
            <button
              onClick={onOpenLogs}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors font-medium"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Live Diagnostics & Logs</span>
            </button>
          )}

          <button
            onClick={exportAllData}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
          >
            <FolderDown className="w-3.5 h-3.5" />
            <span>Export All Chats (JSON)</span>
          </button>

          {sessions.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
                  onClearAllSessions();
                }
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

