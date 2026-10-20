import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ListTodo, Search, Filter, Server, Layers, Clock, RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ProgressBar } from '../components/ProgressBar.js';

export const TaskExplorerPage: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      // Gather tasks across recent jobs
      const jobs = await api.get<any[]>('/jobs?limit=20');
      const allTasks: any[] = [];
      for (const j of jobs || []) {
        if (j.tasks) {
          allTasks.push(
            ...j.tasks.map((t: any) => ({
              ...t,
              jobName: j.name,
              workloadType: j.workloadType,
            }))
          );
        }
      }
      setTasks(allTasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter(
    t =>
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.jobId.toLowerCase().includes(search.toLowerCase()) ||
      t.jobName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Task Explorer</h1>
          <p className="text-xs text-slate-400 mt-1">
            Granular inspection of partitioned execution units, leases, worker claims, and runtimes.
          </p>
        </div>
        <button
          onClick={fetchTasks}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by Task ID, Job ID, or Job Name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tasks Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <ListTodo className="w-10 h-10 mx-auto mb-2 text-slate-600 stroke-1" />
            <p className="text-sm font-medium text-slate-300">No tasks currently recorded</p>
            <p className="text-xs text-slate-500 mt-1">
              Submit a job to see partitioned execution chunks.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/40">
                  <th className="py-3.5 pl-4">Task Chunk ID</th>
                  <th className="py-3.5">Parent Job</th>
                  <th className="py-3.5">Chunk Index</th>
                  <th className="py-3.5">Status</th>
                  <th className="py-3.5">Assigned Worker</th>
                  <th className="py-3.5">Attempts</th>
                  <th className="py-3.5">Runtime</th>
                  <th className="py-3.5 pr-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTasks.map(task => (
                  <tr key={task.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 pl-4 font-mono text-[11px] text-white">
                      {task.id.slice(0, 13)}...
                    </td>
                    <td className="py-3.5">
                      <Link
                        to={`/jobs/${task.jobId}`}
                        className="font-medium text-slate-200 hover:text-blue-400"
                      >
                        {task.jobName || task.jobId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-3.5 text-slate-300">
                      Chunk {task.chunkIndex + 1} of {task.totalChunks}
                    </td>
                    <td className="py-3.5">
                      <StatusBadge status={task.status} size="sm" />
                    </td>
                    <td className="py-3.5 text-slate-400 font-mono text-[11px]">
                      {task.worker ? task.worker.name : 'Unassigned'}
                    </td>
                    <td className="py-3.5 text-slate-400 font-mono">
                      {task.attempts} / {task.maxAttempts}
                    </td>
                    <td className="py-3.5 font-mono text-slate-300">
                      {task.runtimeMs ? `${task.runtimeMs}ms` : '—'}
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      <Link
                        to={`/jobs/${task.jobId}`}
                        className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                      >
                        View Job →
                      </Link>
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
