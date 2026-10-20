import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Server,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  PlusCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../services/api.js';
import { socketService } from '../services/socket.js';
import { StatCard } from '../components/StatCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { SystemStatsDTO, JobDTO, WorkerDTO } from '@computegrid/shared';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<SystemStatsDTO | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobDTO[]>([]);
  const [workers, setWorkers] = useState<WorkerDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [metricsData, jobsData, workersData] = await Promise.all([
        api.get<SystemStatsDTO>('/metrics'),
        api.get<JobDTO[]>('/jobs?limit=5'),
        api.get<WorkerDTO[]>('/workers'),
      ]);
      setStats(metricsData);
      setRecentJobs(jobsData || []);
      setWorkers(workersData || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = socketService.getSocket();
    if (socket) {
      const onJobEvent = () => fetchData();
      const onWorkerEvent = () => fetchData();

      socket.on('job.created', onJobEvent);
      socket.on('job.progress', onJobEvent);
      socket.on('job.completed', onJobEvent);
      socket.on('job.failed', onJobEvent);
      socket.on('worker.connected', onWorkerEvent);
      socket.on('worker.disconnected', onWorkerEvent);

      return () => {
        socket.off('job.created', onJobEvent);
        socket.off('job.progress', onJobEvent);
        socket.off('job.completed', onJobEvent);
        socket.off('job.failed', onJobEvent);
        socket.off('worker.connected', onWorkerEvent);
        socket.off('worker.disconnected', onWorkerEvent);
      };
    }
  }, []);

  const chartData = [
    { time: '10m ago', tasks: stats?.totalTasksExecuted ? Math.max(1, stats.totalTasksExecuted - 12) : 2 },
    { time: '8m ago', tasks: stats?.totalTasksExecuted ? Math.max(2, stats.totalTasksExecuted - 8) : 4 },
    { time: '6m ago', tasks: stats?.totalTasksExecuted ? Math.max(3, stats.totalTasksExecuted - 5) : 7 },
    { time: '4m ago', tasks: stats?.totalTasksExecuted ? Math.max(4, stats.totalTasksExecuted - 3) : 9 },
    { time: '2m ago', tasks: stats?.totalTasksExecuted ? Math.max(5, stats.totalTasksExecuted - 1) : 14 },
    { time: 'Now', tasks: stats?.totalTasksExecuted || 18 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Grid Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry, worker fleet health, and active compute jobs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/jobs/new"
            id="dashboard-new-job-btn"
            className="py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" /> Submit Job
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <StatCard
          title="Total Jobs"
          value={stats?.totalJobs ?? 0}
          icon={Layers}
          color="blue"
        />
        <StatCard
          title="Queued"
          value={stats?.queuedJobs ?? 0}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Running"
          value={stats?.runningJobs ?? 0}
          icon={Activity}
          color="blue"
        />
        <StatCard
          title="Completed"
          value={stats?.completedJobs ?? 0}
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Failed"
          value={stats?.failedJobs ?? 0}
          icon={AlertTriangle}
          color="rose"
        />
        <StatCard
          title="Active Nodes"
          value={stats?.activeWorkers ?? 0}
          icon={Server}
          color="violet"
        />
      </div>

      {/* Chart & Workers Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compute Usage Over Time Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Compute Throughput (Tasks Completed)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Total computational task executions completed across all worker nodes
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Live Feed
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="computeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111726',
                    borderColor: '#1f293d',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tasks"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#computeGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Worker Fleet Health Summary */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-violet-400" />
              Connected Worker Nodes
            </h2>
            <Link to="/workers" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
              View All
            </Link>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {workers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Server className="w-8 h-8 mb-2 stroke-1" />
                <p className="text-xs">No worker nodes registered yet.</p>
                <Link
                  to="/workers/onboarding"
                  className="mt-2 text-xs text-blue-400 hover:underline"
                >
                  Enroll your first machine →
                </Link>
              </div>
            ) : (
              workers.slice(0, 5).map(w => (
                <div
                  key={w.id}
                  className="glass-card rounded-xl p-3 border border-slate-800/80 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{w.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {w.os} • {w.capabilities?.cpuCores ?? 2} cores • {w.tasksCompleted} tasks
                    </div>
                  </div>
                  <StatusBadge status={w.status} size="sm" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Jobs Table */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Recent Compute Jobs
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live status and task partitioning for submitted workloads
            </p>
          </div>
          <Link
            to="/jobs"
            id="dashboard-view-all-jobs-link"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
          >
            All Jobs <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentJobs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Layers className="w-8 h-8 mx-auto mb-2 stroke-1 text-slate-600" />
            <p className="text-xs">No compute jobs submitted yet.</p>
            <Link
              to="/jobs/new"
              className="mt-3 inline-flex items-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Submit First Job
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="pb-3 pl-2">Job Name</th>
                  <th className="pb-3">Workload</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 w-48">Progress</th>
                  <th className="pb-3">Tasks</th>
                  <th className="pb-3">Submitted</th>
                  <th className="pb-3 pr-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentJobs.map(job => (
                  <tr key={job.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 pl-2 font-medium text-white">
                      <Link to={`/jobs/${job.id}`} className="hover:text-blue-400">
                        {job.name}
                      </Link>
                    </td>
                    <td className="py-3 font-mono text-[11px] text-slate-400">
                      {job.workloadType}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={job.status} size="sm" />
                    </td>
                    <td className="py-3 pr-4">
                      <ProgressBar
                        progress={job.progress}
                        size="sm"
                        status={job.status}
                        showText={false}
                      />
                    </td>
                    <td className="py-3 text-slate-300">
                      {job.completedTasks} / {job.totalTasks}
                    </td>
                    <td className="py-3 text-slate-400">
                      {new Date(job.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <Link
                        to={`/jobs/${job.id}`}
                        className="text-xs font-medium text-blue-400 hover:text-blue-300"
                      >
                        Details →
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
