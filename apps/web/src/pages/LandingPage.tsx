import React from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  Server,
  Zap,
  ShieldCheck,
  ArrowRight,
  Layers,
  Terminal,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col">
      {/* Top Hero Section */}
      <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex-1 flex flex-col items-center text-center overflow-hidden">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/20 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-violet-600/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Next-Gen Cloud-Coordinated Decentralized Compute Grid
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-tight">
          Harness Distributed Compute <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
            Across Any Connected Node.
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl leading-relaxed">
          ComputeGrid partitions heavy computational workloads into discrete tasks, coordinates assignment to heterogeneous worker nodes, verifies deterministic results, and streams live progress in real time.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/register"
            id="landing-hero-register-btn"
            className="py-3.5 px-7 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-xl shadow-blue-500/25 flex items-center gap-2 group transition"
          >
            Launch Compute Job
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </Link>
          <Link
            to="/login"
            id="landing-hero-login-btn"
            className="py-3.5 px-7 glass-panel hover:bg-slate-800/60 text-slate-200 font-semibold text-sm rounded-xl transition"
          >
            Sign In to Dashboard
          </Link>
        </div>

        {/* Live Architecture Grid Preview */}
        <div className="mt-16 w-full max-w-5xl glass-panel rounded-2xl border border-slate-800 p-6 shadow-2xl relative">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="font-mono text-slate-500 ml-2">computegrid.coordinator.live</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-medium">Cluster Healthy</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-left">
            <div className="glass-card rounded-xl p-5 border border-slate-800/80">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 w-fit mb-3">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-white">1. Partitioning Engine</h2>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Workloads are split into contiguous intervals or file chunks with cryptographic checksums and assigned to queues.
              </p>
            </div>

            <div className="glass-card rounded-xl p-5 border border-slate-800/80">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 w-fit mb-3">
                <Server className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-white">2. Heterogeneous Nodes</h2>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Cross-platform Node.js worker daemons on Linux, Windows, macOS, or in-browser tabs claim tasks with secure time-limited leases.
              </p>
            </div>

            <div className="glass-card rounded-xl p-5 border border-slate-800/80">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-white">3. Result Verification</h2>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Outputs are assembled, validated against reference calculations, and persisted to object storage with SHA-256 integrity proofs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Workloads Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Supported Distributed Workloads
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Explicitly engineered input and output contracts for mathematically verifiable distributed execution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Workload A: Parallel Mathematics</h3>
                <span className="text-xs text-blue-400 font-mono">MATH_PARALLEL</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Splits numerical domains (prime number search and high-order numerical integration) into contiguous independent sub-intervals. Distributed workers compute chunk results, and the cloud coordinator sums the totals and verifies against single-process reference algorithms.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap gap-2 text-[11px] font-mono text-slate-400">
              <span className="px-2 py-1 rounded bg-slate-800/80">prime-count</span>
              <span className="px-2 py-1 rounded bg-slate-800/80">numerical-integration</span>
              <span className="px-2 py-1 rounded bg-slate-800/80">deterministic-validation</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 border border-slate-800 relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <Terminal className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Workload B: File Chunk Processing</h3>
                <span className="text-xs text-violet-400 font-mono">FILE_CHUNK_PROCESSING</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Partitions large text and structured datasets into line-balanced chunk blocks with SHA-256 checksums. Distributed nodes perform map-reduce word frequencies, pattern extractions, and statistical metrics with zero loss or chunk duplication.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap gap-2 text-[11px] font-mono text-slate-400">
              <span className="px-2 py-1 rounded bg-slate-800/80">word-count</span>
              <span className="px-2 py-1 rounded bg-slate-800/80">regex-filter</span>
              <span className="px-2 py-1 rounded bg-slate-800/80">line-stats</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-8 px-4 text-center text-xs text-slate-500">
        <p>ComputeGrid Distributed Platform — Cloud Orchestrated & Cryptographically Verified</p>
      </footer>
    </div>
  );
};
