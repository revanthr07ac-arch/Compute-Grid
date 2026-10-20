import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Server,
  Zap,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api.js';

export const WorkerOnboardingPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedOS, setSelectedOS] = useState<'windows' | 'linux' | 'macos' | 'docker'>('windows');

  const generateToken = async () => {
    setLoading(true);
    try {
      const data = await api.post<{ token: string; expiresAt: string }>('/workers/enroll');
      setToken(data.token);
    } catch (err: any) {
      alert(`Token generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getCommand = () => {
    const t = token || 'YOUR_ENROLLMENT_TOKEN';
    const server = window.location.origin;

    switch (selectedOS) {
      case 'windows':
        return `npx @computegrid/worker start --server ${server} --token ${t}`;
      case 'linux':
        return `npx @computegrid/worker start --server ${server} --token ${t}`;
      case 'macos':
        return `npx @computegrid/worker start --server ${server} --token ${t}`;
      case 'docker':
        return `docker run -d --name computegrid-worker \\
  -e COMPUTEGRID_SERVER_URL=${server} \\
  -e COMPUTEGRID_ENROLLMENT_TOKEN=${t} \\
  computegrid/worker:latest`;
      default:
        return '';
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getCommand());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">Worker Node Onboarding</h1>
        <p className="text-xs text-slate-400 mt-1">
          Connect your machines or cloud servers to the compute grid using secure, revocable enrollment tokens.
        </p>
      </div>

      {/* Token Generation Panel */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              1. Generate Scoped Enrollment Token
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Enrollment tokens are single-use credentials that exchange for permanent node keys.
            </p>
          </div>
          <button
            onClick={generateToken}
            id="generate-enroll-token-btn"
            disabled={loading}
            className="py-2.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            {loading ? 'Generating...' : token ? 'Regenerate New Token' : 'Generate Token'}
          </button>
        </div>

        {token && (
          <div className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block">
                Active Enrollment Token (Single-Use, Valid 24h)
              </span>
              <span className="font-mono text-sm text-white font-semibold select-all">
                {token}
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(token);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Copy Token"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Installation Commands by OS */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <Terminal className="w-4 h-4 text-indigo-400" />
          2. Run Worker Daemon on Participating Machine
        </h2>

        {/* OS Selector Tabs */}
        <div className="flex border-b border-slate-800 gap-2 mb-4">
          {(['windows', 'linux', 'macos', 'docker'] as const).map(osKey => (
            <button
              key={osKey}
              onClick={() => setSelectedOS(osKey)}
              className={`py-2 px-4 text-xs font-semibold capitalize border-b-2 transition ${
                selectedOS === osKey
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {osKey}
            </button>
          ))}
        </div>

        {/* Copyable Terminal Command Block */}
        <div className="relative">
          <pre className="p-4 rounded-xl bg-black/70 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto select-all leading-relaxed">
            {getCommand()}
          </pre>
          <button
            onClick={copyToClipboard}
            className="absolute top-3 right-3 py-1.5 px-3 bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy Command
              </>
            )}
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-400 space-y-1.5">
          <p>
            <strong>Prerequisites:</strong> Node.js v18+ installed on the host machine.
          </p>
          <p>
            The agent will connect, verify hardware capabilities (CPU cores & RAM), and enter the polling loop for compatible jobs.
          </p>
        </div>
      </div>

      {/* Verification Steps */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          3. Verification & Heartbeat Confirmation
        </h2>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              1
            </span>
            <div>
              <span className="font-semibold text-white">Enrollment Handshake:</span> The worker exchanges the enrollment token for an isolated HMAC secret credential stored locally in <code className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">.computegrid_worker.json</code>.
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              2
            </span>
            <div>
              <span className="font-semibold text-white">Active Telemetry:</span> The worker sends periodic heartbeats every 8-10 seconds with CPU load and memory usage.
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              3
            </span>
            <div>
              <span className="font-semibold text-white">Automatic Node Discovery:</span> Once online, the node will instantly show up under the{' '}
              <a href="/workers" className="text-blue-400 hover:underline">
                Worker Fleet
              </a>{' '}
              dashboard and begin receiving task chunks.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
