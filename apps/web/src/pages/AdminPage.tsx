import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Server,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Database,
} from 'lucide-react';
import { api } from '../services/api.js';
import { StatCard } from '../components/StatCard.js';
import { StatusBadge } from '../components/StatusBadge.js';

export const AdminPage: React.FC = () => {
  const [health, setHealth] = useState<any | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    try {
      const [healthData, metricsData, workersData] = await Promise.all([
        api.get<any>('/health/ready'),
        api.get<any>('/metrics'),
        api.get<any[]>('/workers'),
      ]);
      setHealth(healthData);
      setMetrics(metricsData);
      setWorkers(workersData || []);
    } catch (err) {
      console.error('Failed to load admin telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">System Administration</h1>
            <span className="py-0.5 px-2 bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-md">
              Restricted Area
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Global fleet oversight, database connectivity probes, queue engine health, and system diagnostics.
          </p>
        </div>
        <button
          onClick={fetchAdminData}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Cluster Health Probes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400">Database Connection</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-lg font-bold text-white">
              {health?.database || 'CONNECTING'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Prisma ORM SQLite / PostgreSQL engine active</p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400">Queue Engine</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-lg font-bold text-white">{health?.queue || 'INITIALIZING'}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Task distribution & lease reclamation subsystem
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400">Overall System Health</span>
            <ShieldCheck className="w-4 h-4 text-violet-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-lg font-bold text-white">{health?.status || 'UP'}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">WebSocket server & REST API operational</p>
        </div>
      </div>

      {/* Global Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Active Workers"
          value={metrics?.activeWorkers ?? 0}
          icon={Server}
          color="violet"
        />
        <StatCard
          title="Total Tasks Completed"
          value={metrics?.totalTasksExecuted ?? 0}
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Running Jobs"
          value={metrics?.runningJobs ?? 0}
          icon={Activity}
          color="blue"
        />
        <StatCard
          title="Failed Jobs"
          value={metrics?.failedJobs ?? 0}
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      {/* Global Worker Fleet Table with Admin Actions */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-violet-400" />
            Global Worker Nodes ({workers.length})
          </h2>
          <span className="text-xs text-slate-400">Fleet-wide administrative controls</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/40">
                <th className="py-3 pl-4">Node Name</th>
                <th className="py-3">Owner</th>
                <th className="py-3">Status</th>
                <th className="py-3">Platform</th>
                <th className="py-3">Tasks Executed</th>
                <th className="py-3 pr-4 text-right">Heartbeat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {workers.map(w => (
                <tr key={w.id} className="hover:bg-slate-800/20 transition">
                  <td className="py-3 pl-4 font-semibold text-white">
                    {w.name}
                    <div className="text-[10px] text-slate-500 font-mono">{w.id}</div>
                  </td>
                  <td className="py-3 text-slate-300">{w.user?.username || 'System'}</td>
                  <td className="py-3">
                    <StatusBadge status={w.status} size="sm" />
                  </td>
                  <td className="py-3 text-slate-300 font-mono text-[11px]">
                    {w.os} / {w.arch}
                  </td>
                  <td className="py-3 text-emerald-400 font-semibold">{w.tasksCompleted}</td>
                  <td className="py-3 pr-4 text-right text-slate-400">
                    {new Date(w.lastHeartbeatAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
