import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Square, Activity, Cpu, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '../services/api.js';
import { isPrime, evaluateFunction } from '@computegrid/shared';

interface BrowserWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BrowserWorkerModal: React.FC<BrowserWorkerModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [workerSecret, setWorkerSecret] = useState<string | null>(null);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const isRunningRef = useRef(false);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 40)]);
  };

  const startWorker = async () => {
    try {
      addLog('Requesting browser worker enrollment token...');
      const enroll = await api.post<{ token: string }>('/workers/enroll');

      addLog('Registering browser worker with sandbox limits...');
      const reg = await api.post<{ workerId: string; workerSecret: string }>('/workers/register', {
        name: `BrowserNode-${navigator.platform.replace(/[^a-zA-Z]/g, '')}`,
        enrollmentToken: enroll.token,
        hostname: window.location.hostname,
        os: 'Browser-Sandbox',
        arch: 'web',
        agentVersion: '1.0.0-browser',
        capabilities: {
          supportedWorkloads: ['MATH_PARALLEL'],
          maxConcurrency: 1,
          cpuCores: navigator.hardwareConcurrency || 2,
          totalMemoryMb: 512,
          tags: ['browser-restricted'],
        },
      });

      setWorkerId(reg.workerId);
      setWorkerSecret(reg.workerSecret);
      setIsRunning(true);
      isRunningRef.current = true;
      addLog(`Browser worker activated. Worker ID: ${reg.workerId.slice(0, 8)}...`);
    } catch (err: any) {
      addLog(`Worker registration error: ${err.message}`);
    }
  };

  const stopWorker = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    setCurrentTask(null);
    addLog('Browser worker stopped.');
  };

  useEffect(() => {
    if (!isRunning || !workerId || !workerSecret) return;

    // Heartbeat loop
    const hbInterval = setInterval(async () => {
      try {
        await fetch('/api/v1/workers/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-id': workerId,
            'x-worker-secret': workerSecret,
          },
          body: JSON.stringify({
            cpuUsagePercent: 12,
            memoryUsedMb: 128,
            memoryTotalMb: 512,
            tasksActive: currentTask ? 1 : 0,
            tasksCompleted,
          }),
        });
      } catch {
        // Suppress heartbeat network warning
      }
    }, 10000);

    // Task polling loop
    const pollInterval = setInterval(async () => {
      if (!isRunningRef.current || currentTask) return;

      try {
        const res = await fetch('/api/v1/worker/tasks/claim', {
          headers: {
            'x-worker-id': workerId,
            'x-worker-secret': workerSecret,
          },
        });

        if (res.status === 200) {
          const json = await res.json();
          const task = json.data;
          if (task) {
            setCurrentTask(task.taskId);
            addLog(`Claimed chunk ${task.chunkIndex + 1}/${task.totalChunks} (Job: ${task.jobId.slice(0, 8)})`);

            // Execute math in browser thread
            const input = task.inputPayload;
            const startTime = Date.now();
            let count = 0;
            let sum = 0;
            let maxPrime = 0;

            if (input.algorithm === 'prime-count') {
              for (let i = input.rangeStart; i <= input.rangeEnd; i++) {
                if (isPrime(i)) {
                  count++;
                  sum += i;
                  if (i > maxPrime) maxPrime = i;
                }
              }
            } else if (input.algorithm === 'numerical-integration') {
              const steps = input.steps || 1000;
              const fnName = input.integrationFunction || 'polynomial';
              const dx = (input.rangeEnd - input.rangeStart) / steps;
              let s = 0.5 * (evaluateFunction(fnName, input.rangeStart) + evaluateFunction(fnName, input.rangeEnd));
              for (let step = 1; step < steps; step++) {
                s += evaluateFunction(fnName, input.rangeStart + step * dx);
              }
              sum = s * dx;
            }

            const runtimeMs = Date.now() - startTime;

            // Submit completion
            await fetch(`/api/v1/worker/tasks/${task.taskId}/complete`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-worker-id': workerId,
                'x-worker-secret': workerSecret,
              },
              body: JSON.stringify({
                outputPayload: {
                  chunkIndex: input.chunkIndex,
                  rangeStart: input.rangeStart,
                  rangeEnd: input.rangeEnd,
                  algorithm: input.algorithm,
                  count,
                  sum,
                  maxPrime,
                  executionTimeMs: runtimeMs,
                  checksum: 'browser-chk',
                },
                runtimeMs,
              }),
            });

            setTasksCompleted(prev => prev + 1);
            setCurrentTask(null);
            addLog(`✔ Chunk ${task.chunkIndex + 1} finished in ${runtimeMs}ms!`);
          }
        }
      } catch (err: any) {
        addLog(`Task execution error: ${err.message}`);
        setCurrentTask(null);
      }
    }, 2500);

    return () => {
      clearInterval(hbInterval);
      clearInterval(pollInterval);
    };
  }, [isRunning, workerId, workerSecret, currentTask, tasksCompleted]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700/60 p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Browser Compute Worker</h3>
            <p className="text-xs text-slate-400">
              Contribute computational power directly from this browser tab
            </p>
          </div>
        </div>

        <div className="p-3.5 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/90 leading-relaxed">
            <strong>Restricted Workload Sandbox:</strong> Browser workers run purely in Web
            threads and are restricted to safe mathematical tasks. For file processing, native worker daemons are recommended.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="glass-card rounded-xl p-3 border border-slate-800">
            <span className="text-xs text-slate-400">Worker Status</span>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span className="text-sm font-semibold text-white">
                {isRunning ? (currentTask ? 'Executing Task' : 'Idle / Polling') : 'Stopped'}
              </span>
            </div>
          </div>
          <div className="glass-card rounded-xl p-3 border border-slate-800">
            <span className="text-xs text-slate-400">Chunks Processed</span>
            <div className="mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">{tasksCompleted}</span>
            </div>
          </div>
        </div>

        {/* Live Terminal Log */}
        <div className="mb-5">
          <span className="text-xs font-medium text-slate-400 mb-1.5 block">Execution Log</span>
          <div className="h-36 bg-black/60 rounded-xl p-3 border border-slate-800 font-mono text-xs text-slate-300 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <span className="text-slate-500">Ready to start. Click Start Worker below.</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="leading-tight">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {!isRunning ? (
            <button
              onClick={startWorker}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition"
            >
              <Play className="w-4 h-4" /> Start In-Browser Worker
            </button>
          ) : (
            <button
              onClick={stopWorker}
              className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Square className="w-4 h-4" /> Stop Worker
            </button>
          )}
          <button
            onClick={onClose}
            className="py-2.5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
