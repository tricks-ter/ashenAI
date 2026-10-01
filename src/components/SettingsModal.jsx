import React, { useState } from 'react';
import {
  X,
  Server,
  Sliders,
  BookOpen,
  Check,
  Copy,
  AlertCircle,
  ExternalLink,
  Zap,
  Activity,
  Download,
  Terminal,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { checkBackendHealth } from '../services/api';

const PRESET_MODELS = [
  { id: 'huihui-ai/Qwen3-14B-abliterated', name: 'Qwen3 14B Abliterated', desc: '🚀 Your Loaded Kaggle Model (Uncensored, powerful & fast)' },
  { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B Instruct', desc: 'Fast, intelligent, great at coding & reasoning' },
  { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', name: 'DeepSeek R1 Distill 7B', desc: 'Deep reasoning model with thought chains' },
  { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instruct', desc: 'State-of-the-art open weights by Meta' },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B IT', desc: 'Google high-performance lightweight model' }
];

export const SettingsModal = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onBackendStatusUpdate
}) => {
  const [activeTab, setActiveTab] = useState('backend');
  const [formData, setFormData] = useState({ ...settings });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await checkBackendHealth(formData.backendUrl, formData.apiKey);
    setIsTesting(false);
    setTestResult(res);
    if (onBackendStatusUpdate) {
      onBackendStatusUpdate(res);
    }
  };

  const handleSave = () => {
    onSaveSettings(formData);
    onClose();
  };

  const copyColabCode = () => {
    const code = `!pip install -q torch transformers accelerate bitsandbytes fastapi uvicorn pyngrok nest_asyncio
!wget -q -nc https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O ./cloudflared
!chmod +x ./cloudflared

# Download and run AshenAI Colab Server
!wget -q -nc https://raw.githubusercontent.com/ashen-ai/backend/main/colab_server.py -O server.py || cat << 'EOF' > server.py
# (Your server script is ready)
EOF
import subprocess
print("Starting Cloudflare Tunnel...")
proc = subprocess.Popen(["./cloudflared", "tunnel", "--url", "http://127.0.0.1:8000"], stdout=subprocess.PIPE, text=True)
`;
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-[#121622] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Settings & Colab GPU Bridge</h2>
              <p className="text-xs text-gray-500">Configure your local interface and remote GPU backend</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-5 gap-4 text-xs font-medium bg-gray-50/50 dark:bg-dark-card/30">
          <button
            onClick={() => setActiveTab('backend')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'backend'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Remote GPU Backend</span>
          </button>

          <button
            onClick={() => setActiveTab('params')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'params'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Parameters & System</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'guide'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Colab/Kaggle Guide</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
          {/* TAB 1: REMOTE BACKEND */}
          {activeTab === 'backend' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Remote Backend URL (Cloudflare Tunnel / ngrok / localhost)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.backendUrl}
                    onChange={(e) => setFormData({ ...formData, backendUrl: e.target.value })}
                    placeholder="https://random-name.trycloudflare.com"
                    className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 font-mono text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-dark-hover text-gray-700 dark:text-gray-200 text-xs font-medium border border-gray-200 dark:border-gray-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Pinging...' : 'Test Connection'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Paste the <code>.trycloudflare.com</code> or <code>.ngrok-free.app</code> URL generated from your Google Colab / Kaggle notebook cell.
                </p>
              </div>

              {/* Live Test Result Banner */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    testResult.online
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                  }`}
                >
                  {testResult.online ? (
                    <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {testResult.online
                        ? `✅ Connection Successful (${testResult.latency}ms latency)`
                        : `❌ Connection Failed`}
                    </p>
                    <p className="opacity-90 mt-0.5">
                      {testResult.online
                        ? `Model: ${testResult.model} | GPU: ${testResult.gpu || 'CUDA Device'}`
                        : testResult.error}
                    </p>
                  </div>
                </div>
              )}

              {/* Model Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Model Selection / Identifier
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  {PRESET_MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, modelName: model.id })}
                      className={`text-left p-2.5 rounded-xl border transition-all ${
                        formData.modelName === model.id
                          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-dark-card text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="font-medium text-xs">{model.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{model.desc}</div>
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                  placeholder="Custom model ID (e.g. meta-llama/Llama-3.1-8B-Instruct)"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 font-mono text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Authorization Key (Optional)
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Leave empty if no auth token is required on Colab"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Tavily AI Search Key */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-brand-500" />
                    Tavily AI Search API Key (Optional)
                  </span>
                  <a
                    href="https://tavily.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-brand-500 hover:underline flex items-center gap-0.5"
                  >
                    Get free key <ExternalLink className="w-3 h-3 inline" />
                  </a>
                </label>
                <input
                  type="password"
                  value={formData.tavilyApiKey || ''}
                  onChange={(e) => setFormData({ ...formData, tavilyApiKey: e.target.value })}
                  placeholder="tvly-xxxxxxxxxxxxxxxxxxxx (Enables full deep web search)"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Yahoo Finance quotes and Google News RSS work automatically out-of-the-box with no key. Adding a Tavily key unlocks full web scraping.
                </p>
              </div>

              {/* Simulation fallback toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800">
                <div>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">Interactive Preview Fallback</span>
                  <p className="text-[11px] text-gray-500">Auto-simulate responses if remote Colab GPU is offline</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.useMockWhenOffline}
                  onChange={(e) => setFormData({ ...formData, useMockWhenOffline: e.target.checked })}
                  className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: INFERENCE PARAMETERS */}
          {activeTab === 'params' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  System Instructions Prompt
                </label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="Define how the AI should behave..."
                />
              </div>

              {/* Parameter Quick Presets */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Tuning Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, temperature: 0.6, topP: 0.95, topK: 20, repetitionPenalty: 1.1 })}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-xs hover:border-brand-500 text-gray-700 dark:text-gray-300"
                  >
                    🎯 Balanced (0.6)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, temperature: 0.2, topP: 0.85, topK: 10, repetitionPenalty: 1.15 })}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-xs hover:border-brand-500 text-gray-700 dark:text-gray-300"
                  >
                    💻 Precise Code (0.2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, temperature: 0.9, topP: 0.98, topK: 50, repetitionPenalty: 1.05 })}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-xs hover:border-brand-500 text-gray-700 dark:text-gray-300"
                  >
                    🎨 Creative (0.9)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, temperature: 0.0, topP: 0.1, topK: 1, repetitionPenalty: 1.2 })}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-xs hover:border-brand-500 text-gray-700 dark:text-gray-300"
                  >
                    🔬 Deterministic (0.0)
                  </button>
                </div>
              </div>

              {/* Temperature Slider */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800/80">
                <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  <span>Temperature (Randomness / Creativity): {formData.temperature}</span>
                  <span className="text-gray-400 font-mono text-[11px]">0.0 - 2.0</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={formData.temperature ?? 0.6}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  className="w-full accent-brand-600"
                />
                <p className="text-[10px] text-gray-400 mt-1">Lower values make responses more focused and deterministic; higher values make them more creative.</p>
              </div>

              {/* Top P Slider */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800/80">
                <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  <span>Top P (Nucleus Sampling): {formData.topP}</span>
                  <span className="text-gray-400 font-mono text-[11px]">0.05 - 1.0</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={formData.topP ?? 0.95}
                  onChange={(e) => setFormData({ ...formData, topP: parseFloat(e.target.value) })}
                  className="w-full accent-brand-600"
                />
                <p className="text-[10px] text-gray-400 mt-1">Controls the cumulative probability cutoff for token selection (0.95 is optimal for Qwen/Llama).</p>
              </div>

              {/* Top K Slider */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800/80">
                <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  <span>Top K (Vocabulary Pool Filtering): {formData.topK}</span>
                  <span className="text-gray-400 font-mono text-[11px]">1 - 100</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={formData.topK ?? 20}
                  onChange={(e) => setFormData({ ...formData, topK: parseInt(e.target.value) })}
                  className="w-full accent-brand-600"
                />
                <p className="text-[10px] text-gray-400 mt-1">Limits the next-token pool to the K most probable tokens (e.g. 20 eliminates unlikely nonsense tokens).</p>
              </div>

              {/* Repetition Penalty Slider */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800/80">
                <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  <span>Repetition Penalty: {formData.repetitionPenalty}</span>
                  <span className="text-gray-400 font-mono text-[11px]">1.0 - 1.5</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="1.5"
                  step="0.02"
                  value={formData.repetitionPenalty ?? 1.1}
                  onChange={(e) => setFormData({ ...formData, repetitionPenalty: parseFloat(e.target.value) })}
                  className="w-full accent-brand-600"
                />
                <p className="text-[10px] text-gray-400 mt-1">Penalizes repeated words and phrases to prevent model looping (1.10 - 1.15 recommended).</p>
              </div>

              {/* Max Tokens */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-800/80">
                <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  <span>Max New Tokens: {formData.maxTokens}</span>
                  <span className="text-gray-400 font-mono text-[11px]">256 - 8192</span>
                </div>
                <input
                  type="range"
                  min="256"
                  max="8192"
                  step="256"
                  value={formData.maxTokens ?? 2048}
                  onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                  className="w-full accent-brand-600"
                />
              </div>
            </div>
          )}

          {/* TAB 3: COLAB & KAGGLE GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-3.5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-brand-50/60 dark:bg-brand-950/30 border border-brand-200/80 dark:border-brand-900/50">
                <h4 className="font-semibold text-brand-700 dark:text-brand-300 mb-1 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> How to run your LLM on Free Google Colab / Kaggle GPU
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                  You can use Google Colab's free 15GB T4 GPU or Kaggle's 2x T4 GPU to run any 7B or 8B model with 4-bit quantization!
                </p>
              </div>

              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  Open <a href="https://colab.research.google.com" target="_blank" rel="noreferrer" className="text-brand-500 font-semibold underline">Google Colab</a> or <a href="https://www.kaggle.com" target="_blank" rel="noreferrer" className="text-brand-500 font-semibold underline">Kaggle Notebooks</a>.
                </li>
                <li>
                  Ensure GPU hardware accelerator is enabled (In Colab: <code>Runtime &gt; Change runtime type &gt; T4 GPU</code>).
                </li>
                <li>
                  Upload or open the included <code>colab-backend/colab_kaggle_backend.ipynb</code> notebook located in your project folder.
                </li>
                <li>
                  Run all cells. In ~1 minute, the notebook will output a public Cloudflare Tunnel URL (e.g. <code>https://xxxx.trycloudflare.com</code>).
                </li>
                <li>
                  Copy that URL, return here to <strong>Settings &gt; Remote GPU Backend</strong>, paste the URL, and click <strong>Test Connection</strong>!
                </li>
              </ol>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-gray-900 dark:text-gray-200 flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5" /> Python Backend Script Location:
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-900 text-gray-300 font-mono text-[11px] break-all select-all">
                  colab-backend/colab_server.py
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-gray-50 dark:bg-dark-card/40 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/20 active:scale-95 transition-all"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

