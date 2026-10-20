import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Search,
  Filter,
  PlusCircle,
  RefreshCw,
  XCircle,
  RotateCcw,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { api } from '../services/api.js';
import { socketService } from '../services/socket.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { JobDTO } from '@computegrid/shared';

export const JobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [workloadFilter, setWorkloadFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      let query = '/jobs?limit=50';
      if (statusFilter !== 'ALL') query += `&status=${statusFilter}`;
      if (workloadFilter !== 'ALL') query += `&workloadType=${workloadFilter}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;

      const data = await api.get<JobDTO[]>(query);
      setJobs(data || []);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    const socket = socketService.getSocket();
    if (socket) {
      const onUpdate = () => fetchJobs();
      socket.on('job.created', onUpdate);
      socket.on('job.progress', onUpdate);
      socket.on('job.completed', onUpdate);
      socket.on('job.failed', onUpdate);

      return () => {
        socket.off('job.created', onUpdate);
        socket.off('job.progress', onUpdate);
        socket.off('job.completed', onUpdate);
        socket.off('job.failed', onUpdate);
      };
    }
  }, [statusFilter, workloadFilter]);

  const handleCancel = async (jobId: string) => {
    try {
      await api.post(`/jobs/${jobId}/cancel`);
      fetchJobs();
    } catch (err: any) {
      alert(`Cancel failed: ${err.message}`);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      await api.post(`/jobs/${jobId}/retry`);
      fetchJobs();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    }
  };

  const filteredJobs = jobs.filter(j =>
    j.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Compute Jobs</h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor, inspect, cancel, and retry distributed workloads across the grid.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchJobs}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/jobs/new"
            id="jobs-page-new-job-btn"
            className="py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" /> Submit Job
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search jobs by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="RUNNING">Running</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={workloadFilter}
            onChange={e => setWorkloadFilter(e.target.value)}
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="ALL">All Workloads</option>
            <option value="MATH_PARALLEL">Math Parallel</option>
            <option value="FILE_CHUNK_PROCESSING">File Processing</option>
          </select>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Layers className="w-10 h-10 mx-auto mb-2 text-slate-600 stroke-1" />
            <p className="text-sm font-medium text-slate-300">No compute jobs found</p>
            <p className="text-xs text-slate-500 mt-1">
              Submit a job or change your filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/40">
                  <th className="py-3.5 pl-4">Job Name</th>
                  <th className="py-3.5">Workload Type</th>
                  <th className="py-3.5">Status</th>
                  <th className="py-3.5 w-44">Progress</th>
                  <th className="py-3.5">Tasks</th>
                  <th className="py-3.5">Priority</th>
                  <th className="py-3.5">Created</th>
                  <th className="py-3.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredJobs.map(job => (
                  <tr key={job.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 pl-4 font-semibold text-white">
                      <Link to={`/jobs/${job.id}`} className="hover:text-blue-400">
                        {job.name}
                      </Link>
                      {job.description && (
                        <p className="text-[11px] text-slate-400 font-normal truncate max-w-xs mt-0.5">
                          {job.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 font-mono text-[11px] text-slate-300">
                      {job.workloadType}
                    </td>
                    <td className="py-3.5">
                      <StatusBadge status={job.status} size="sm" />
                    </td>
                    <td className="py-3.5 pr-4">
                      <ProgressBar
                        progress={job.progress}
                        size="sm"
                        status={job.status}
                        showText={true}
                      />
                    </td>
                    <td className="py-3.5 text-slate-300 font-medium">
                      {job.completedTasks} / {job.totalTasks}
                    </td>
                    <td className="py-3.5 text-slate-400 font-mono">
                      P{job.priority}
                    </td>
                    <td className="py-3.5 text-slate-400">
                      {new Date(job.createdAt).toLocaleDateString()} {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 pr-4 text-right space-x-2">
                      <Link
                        to={`/jobs/${job.id}`}
                        className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                      >
                        Inspect
                      </Link>
                      {['QUEUED', 'RUNNING'].includes(job.status) && (
                        <button
                          onClick={() => handleCancel(job.id)}
                          className="py-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Cancel
                        </button>
                      )}
                      {job.status === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          className="py-1 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition"
                        >
                          Retry
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
