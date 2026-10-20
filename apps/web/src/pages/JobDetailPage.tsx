import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Layers,
  Server,
  Download,
  AlertCircle,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Terminal,
  Activity,
  FileCheck,
} from 'lucide-react';
import { api } from '../services/api.js';
import { socketService } from '../services/socket.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ProgressBar } from '../components/ProgressBar.js';

export const JobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = async () => {
    if (!jobId) return;
    try {
      const data = await api.get<any>(`/jobs/${jobId}`);
      setJob(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();

    if (jobId) {
      socketService.subscribeJob(jobId);
    }

    const socket = socketService.getSocket();
    if (socket) {
      const onProgress = () => fetchJob();
      const onTaskComplete = () => fetchJob();
      const onJobDone = () => fetchJob();

      socket.on('job.progress', onProgress);
      socket.on('task.assigned', onProgress);
      socket.on('task.completed', onTaskComplete);
      socket.on('job.completed', onJobDone);
      socket.on('job.failed', onJobDone);

      return () => {
        if (jobId) socketService.unsubscribeJob(jobId);
        socket.off('job.progress', onProgress);
        socket.off('task.assigned', onProgress);
        socket.off('task.completed', onTaskComplete);
        socket.off('job.completed', onJobDone);
        socket.off('job.failed', onJobDone);
      };
    }
  }, [jobId]);

  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await api.post(`/jobs/${jobId}/cancel`);
      fetchJob();
    } catch (err: any) {
      alert(`Cancel failed: ${err.message}`);
    }
  };

  const handleRetry = async () => {
    if (!jobId) return;
    try {
      await api.post(`/jobs/${jobId}/retry`);
      fetchJob();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Activity className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
        <p className="text-xs">Fetching job telemetry and task status...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-6 glass-panel rounded-2xl border border-rose-500/30 text-rose-300 text-xs">
        <p className="font-semibold text-sm mb-1">Failed to load job</p>
        <p>{error || 'Job not found.'}</p>
        <Link to="/jobs" className="mt-3 inline-block text-blue-400 hover:underline">
          ← Back to Compute Jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Jobs
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{job.name}</h1>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              ID: {job.id} • Workload: {job.workloadType} • Submitted by {job.user?.username || 'You'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {['QUEUED', 'RUNNING'].includes(job.status) && (
              <button
                onClick={handleCancel}
                id="job-cancel-btn"
                className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel Job
              </button>
            )}
            {job.status === 'FAILED' && (
              <button
                onClick={handleRetry}
                id="job-retry-btn"
                className="py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Retry Job
              </button>
            )}
            {job.outputArtifactId && (
              <a
                href={`/api/v1/artifacts/${job.outputArtifactId}/download`}
                id="job-download-result-btn"
                target="_blank"
                rel="noreferrer"
                className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition"
              >
                <Download className="w-3.5 h-3.5" /> Download Results
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Progress & Highlights Card */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400 font-medium">Job Completion Status</span>
            <div className="text-2xl font-extrabold text-white mt-0.5">{job.progress}%</div>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-300">
            <div>
              <span className="text-slate-500 block">Total Chunks</span>
              <span className="font-semibold text-white">{job.totalTasks}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Completed</span>
              <span className="font-semibold text-emerald-400">{job.completedTasks}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Failed / Retried</span>
              <span className="font-semibold text-rose-400">{job.failedTasks}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Duration</span>
              <span className="font-semibold text-white">
                {job.durationMs ? `${(job.durationMs / 1000).toFixed(2)}s` : 'Active'}
              </span>
            </div>
          </div>
        </div>

        <ProgressBar progress={job.progress} status={job.status} size="lg" showText={false} />
      </div>

      {/* Verified Results Banner (When Completed) */}
      {job.outputSummary && (
        <div className="glass-panel rounded-2xl p-5 border border-emerald-500/30 bg-emerald-950/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Verified Aggregated Result</span>
            </div>
            {job.outputSummary.verifiedAgainstReference && (
              <span className="py-0.5 px-2 bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold rounded-full border border-emerald-500/40">
                ✔ 100% Match with Reference Engine
              </span>
            )}
          </div>
          <pre className="p-3 bg-black/60 rounded-xl font-mono text-xs text-slate-200 overflow-x-auto border border-emerald-500/20">
            {JSON.stringify(job.outputSummary, null, 2)}
          </pre>
        </div>
      )}

      {/* Task Chunks Breakdown Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            Task Chunks Breakdown ({job.tasks?.length || 0})
          </h2>
          <span className="text-xs text-slate-400">Atomic assignments & leases</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/40">
                <th className="py-3 pl-4">Chunk</th>
                <th className="py-3">Sub-Range / Input</th>
                <th className="py-3">Assigned Worker</th>
                <th className="py-3">Status</th>
                <th className="py-3">Progress</th>
                <th className="py-3">Attempts</th>
                <th className="py-3 pr-4 text-right">Runtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {job.tasks?.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-800/20 transition">
                  <td className="py-3 pl-4 font-mono font-semibold text-white">
                    Chunk #{t.chunkIndex + 1}
                  </td>
                  <td className="py-3 font-mono text-[11px] text-slate-300">
                    {t.inputPayload?.rangeStart !== undefined
                      ? `[${t.inputPayload.rangeStart} - ${t.inputPayload.rangeEnd}]`
                      : `Lines ${t.inputPayload?.startLine || 0} - ${t.inputPayload?.endLine || 0}`}
                  </td>
                  <td className="py-3">
                    {t.worker ? (
                      <span className="inline-flex items-center gap-1.5 text-slate-200">
                        <Server className="w-3.5 h-3.5 text-violet-400" />
                        {t.worker.name}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Unassigned (Queued)</span>
                    )}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={t.status} size="sm" />
                  </td>
                  <td className="py-3 w-28">
                    <ProgressBar progress={t.progress} size="sm" status={t.status} showText={false} />
                  </td>
                  <td className="py-3 text-slate-400 font-mono">
                    {t.attempts} / {t.maxAttempts}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-slate-300">
                    {t.runtimeMs ? `${t.runtimeMs}ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Event Stream / Audit Logs */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-slate-400" />
          Live Event History & Logs ({job.events?.length || 0})
        </h2>

        <div className="space-y-2 max-h-56 overflow-y-auto">
          {job.events?.map((e: any) => (
            <div
              key={e.id}
              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    e.severity === 'ERROR'
                      ? 'bg-rose-400'
                      : e.severity === 'WARN'
                      ? 'bg-amber-400'
                      : 'bg-blue-400'
                  }`}
                />
                <span className="font-mono text-slate-400 text-[11px]">{e.type}:</span>
                <span className="text-slate-200">{e.message}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
