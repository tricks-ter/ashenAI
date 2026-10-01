import React from 'react';
import {
  Brain,
  FileCode,
  FileEdit,
  Globe,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Square,
  Sparkles,
  Layers
} from 'lucide-react';

export const AgentStepViewer = ({
  steps = [],
  isAgentRunning = false,
  onStopAgent,
  onOpenWorkspace
}) => {
  if (!isAgentRunning && steps.length === 0) return null;

  const getStepIcon = (type) => {
    switch (type) {
      case 'THINKING':
        return <Brain className="w-4 h-4 text-purple-400 animate-pulse" />;
      case 'WRITE_FILE':
        return <FileCode className="w-4 h-4 text-emerald-400" />;
      case 'EDIT_FILE':
        return <FileEdit className="w-4 h-4 text-amber-400" />;
      case 'SEARCH_WEB':
        return <Globe className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />;
      case 'RUN_SANDBOX':
        return <Play className="w-4 h-4 text-blue-400" />;
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'ERROR':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Layers className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="my-3 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 dark:bg-[#111422] p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Agent Header */}
      <div className="flex items-center justify-between pb-3 border-b border-indigo-500/20 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30">
            {isAgentRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                Antigravity Autonomous Agent
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                isAgentRunning
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30 animate-pulse'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}>
                {isAgentRunning ? 'Autonomous Loop Active' : 'Task Finished'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Multi-file planning, autonomous code synthesis & live sandbox execution
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onOpenWorkspace && (
            <button
              type="button"
              onClick={onOpenWorkspace}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
            >
              View Live Code
            </button>
          )}

          {isAgentRunning && onStopAgent && (
            <button
              type="button"
              onClick={onStopAgent}
              className="px-2.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Square className="w-3 h-3 fill-red-400" />
              <span>Stop Agent</span>
            </button>
          )}
        </div>
      </div>

      {/* Step Timeline */}
      <div className="space-y-2 font-mono text-xs">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2.5 p-2 rounded-xl bg-white/60 dark:bg-black/30 border border-gray-100 dark:border-gray-800/80"
          >
            <div className="mt-0.5 flex-shrink-0">
              {getStepIcon(step.type)}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {step.message}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

