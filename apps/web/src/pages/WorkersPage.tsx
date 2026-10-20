import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Server,
  RefreshCw,
  PlusCircle,
  PauseCircle,
  PlayCircle,
  Trash2,
  Cpu,
  Activity,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';
import { api } from '../services/api.js';
import { socketService } from '../services/socket.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { WorkerDTO } from '@computegrid/shared';

export const WorkersPage: React.FC = () => {
  const [workers, setWorkers] = useState<WorkerDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkers = async () => {
    try {
      const data = await api.get<WorkerDTO[]>('/workers');
      setWorkers(data || []);
    } catch (err) {
      console.error('Failed to fetch workers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();

    const socket = socketService.getSocket();
    if (socket) {
      const onWorkerChange = () => fetchWorkers();
      socket.on('worker.connected', onWorkerChange);
      socket.on('worker.disconnected', onWorkerChange);
      socket.on('worker.status_changed', onWorkerChange);

      return () => {
        socket.off('worker.connected', onWorkerChange);
        socket.off('worker.disconnected', onWorkerChange);
        socket.off('worker.status_changed', onWorkerChange);
      };
    }
  }, []);

  const handlePause = async (workerId: string) => {
    try {
      await api.post(`/workers/${workerId}/pause`);
      fetchWorkers();
    } catch (err: any) {
      alert(`Pause failed: ${err.message}`);
    }
  };

  const handleResume = async (workerId: string) => {
    try {
      await api.post(`/workers/${workerId}/resume`);
      fetchWorkers();
    } catch (err: any) {
      alert(`Resume failed: ${err.message}`);
    }
  };

  const handleRevoke = async (workerId: string) => {
    if (!confirm('Are you sure you want to permanently revoke this worker node credentials?')) {
      return;
    }
    try {
      await api.post(`/workers/${workerId}/revoke`);
      fetchWorkers();
    } catch (err: any) {
      alert(`Revocation failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Worker Fleet</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage connected distributed worker nodes, check health, and enforce node controls.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchWorkers}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/workers/onboarding"
            id="workers-enroll-new-btn"
            className="py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" /> Enroll New Worker
          </Link>
        </div>
      </div>

      {/* Workers Cards / Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {workers.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Server className="w-10 h-10 mx-auto mb-2 text-slate-600 stroke-1" />
            <p className="text-sm font-semibold text-slate-300">No worker nodes registered</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Enroll machines running Windows, macOS, or Linux using our scoped enrollment tokens.
            </p>
            <Link
              to="/workers/onboarding"
              className="mt-4 inline-flex items-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-blue-500/20"
            >
              <PlusCircle className="w-4 h-4" /> Onboard First Node
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/40">
                  <th className="py-3.5 pl-4">Node Name & Host</th>
                  <th className="py-3.5">Status</th>
                  <th className="py-3.5">OS / Arch</th>
                  <th className="py-3.5">Hardware / Capabilities</th>
                  <th className="py-3.5">Tasks Done</th>
                  <th className="py-3.5">Last Heartbeat</th>
                  <th className="py-3.5 pr-4 text-right">Node Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {workers.map(worker => (
                  <tr key={worker.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 pl-4">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <Server className="w-4 h-4 text-violet-400" />
                        {worker.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {worker.hostname} • v{worker.agentVersion}
                      </div>
                    </td>
                    <td className="py-3.5">
                      <StatusBadge status={worker.status} size="sm" />
                    </td>
                    <td className="py-3.5 font-mono text-[11px] text-slate-300">
                      {worker.os} / {worker.arch}
                    </td>
                    <td className="py-3.5 text-slate-300">
                      <div className="flex items-center gap-2">
                        <span>{worker.capabilities?.cpuCores ?? 2} Cores</span>
                        <span>•</span>
                        <span>{worker.capabilities?.totalMemoryMb ?? 1024} MB RAM</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Max Concurrency: {worker.capabilities?.maxConcurrency ?? 1}
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className="font-semibold text-emerald-400">
                        {worker.tasksCompleted}
                      </span>{' '}
                      <span className="text-slate-500">completed</span>
                    </td>
                    <td className="py-3.5 text-slate-400">
                      {new Date(worker.lastHeartbeatAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3.5 pr-4 text-right space-x-1.5">
                      {worker.status === 'PAUSED' ? (
                        <button
                          onClick={() => handleResume(worker.id)}
                          title="Resume Worker"
                          className="py-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Resume
                        </button>
                      ) : worker.status !== 'REVOKED' ? (
                        <button
                          onClick={() => handlePause(worker.id)}
                          title="Pause Worker (Stop receiving tasks)"
                          className="py-1 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Pause
                        </button>
                      ) : null}

                      {worker.status !== 'REVOKED' && (
                        <button
                          onClick={() => handleRevoke(worker.id)}
                          title="Revoke Node Credentials"
                          className="py-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
