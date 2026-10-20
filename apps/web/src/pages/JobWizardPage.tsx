import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Terminal,
  Layers,
  ArrowRight,
  AlertCircle,
  Upload,
  Cpu,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api } from '../services/api.js';
import { WorkloadType } from '@computegrid/shared';

export const JobWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workloadType, setWorkloadType] = useState<WorkloadType>('MATH_PARALLEL');
  const [priority, setPriority] = useState(5);
  const [maxRetries, setMaxRetries] = useState(2);

  // Math Workload Params
  const [mathAlgorithm, setMathAlgorithm] = useState<'prime-count' | 'numerical-integration'>('prime-count');
  const [rangeStart, setRangeStart] = useState(10);
  const [rangeEnd, setRangeEnd] = useState(2000);
  const [mathChunks, setMathChunks] = useState(4);
  const [integrationFunction, setIntegrationFunction] = useState<'polynomial' | 'sinusoid' | 'gaussian'>('polynomial');
  const [integrationSteps, setIntegrationSteps] = useState(10000);

  // File Workload Params
  const [fileOperation, setFileOperation] = useState<'word-count' | 'regex-filter' | 'line-stats'>('word-count');
  const [fileChunks, setFileChunks] = useState(4);
  const [regexPattern, setRegexPattern] = useState('[A-Za-z0-9_-]+');
  const [textContent, setTextContent] = useState(
    'Distributed compute grid systems provide horizontal scalability across heterogeneous nodes.\n'.repeat(
      50
    )
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let parameters: Record<string, unknown> = {};

      if (workloadType === 'MATH_PARALLEL') {
        if (rangeEnd <= rangeStart) {
          throw new Error('Range End must be greater than Range Start');
        }
        parameters = {
          algorithm: mathAlgorithm,
          rangeStart: Number(rangeStart),
          rangeEnd: Number(rangeEnd),
          chunkCount: Number(mathChunks),
          integrationFunction:
            mathAlgorithm === 'numerical-integration' ? integrationFunction : undefined,
          totalSteps:
            mathAlgorithm === 'numerical-integration' ? Number(integrationSteps) : undefined,
        };
      } else {
        parameters = {
          operation: fileOperation,
          filename: `batch_dataset_${Date.now()}.txt`,
          chunkCount: Number(fileChunks),
          content: textContent,
          filterPattern: fileOperation === 'regex-filter' ? regexPattern : undefined,
        };
      }

      const job = await api.post<any>('/jobs', {
        name,
        description,
        workloadType,
        priority: Number(priority),
        maxRetriesPerTask: Number(maxRetries),
        parameters,
      });

      navigate(`/jobs/${job.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit compute job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">Job Creation Wizard</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure computational boundaries, choose distribution partitioning, and launch onto the grid.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Workload Type Selection */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-blue-400" />
            1. Select Workload Partitioning Engine
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setWorkloadType('MATH_PARALLEL')}
              className={`p-4 rounded-xl text-left border transition relative ${
                workloadType === 'MATH_PARALLEL'
                  ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/20'
                  : 'glass-card border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Zap className="w-5 h-5" />
                </div>
                {workloadType === 'MATH_PARALLEL' && (
                  <span className="p-1 rounded-full bg-blue-500 text-white">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white">Workload A: Parallel Mathematics</h3>
              <p className="text-xs text-slate-400 mt-1">
                Deterministic prime distribution or numerical calculus. Verified against single-process reference calculations.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setWorkloadType('FILE_CHUNK_PROCESSING')}
              className={`p-4 rounded-xl text-left border transition relative ${
                workloadType === 'FILE_CHUNK_PROCESSING'
                  ? 'bg-violet-600/15 border-violet-500 shadow-md shadow-violet-500/20'
                  : 'glass-card border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                  <Terminal className="w-5 h-5" />
                </div>
                {workloadType === 'FILE_CHUNK_PROCESSING' && (
                  <span className="p-1 rounded-full bg-violet-500 text-white">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white">Workload B: File Chunk Processing</h3>
              <p className="text-xs text-slate-400 mt-1">
                Line-balanced chunk partitioning for word frequency analysis, regex extraction, or line metrics with SHA-256 validation.
              </p>
            </button>
          </div>
        </div>

        {/* Step 2: Job Metadata */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-indigo-400" />
            2. General Job Metadata & Policies
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Job Name *
              </label>
              <input
                type="text"
                required
                id="wizard-job-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Distributed Prime Search [10 - 50,000]"
                className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Description (Optional)
              </label>
              <input
                type="text"
                id="wizard-job-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief summary of computation intent"
                className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Priority (1 = Lowest, 10 = Highest)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={priority}
                onChange={e => setPriority(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Max Retries Per Task
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={maxRetries}
                onChange={e => setMaxRetries(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Workload Specific Parameters */}
        {workloadType === 'MATH_PARALLEL' ? (
          <div className="glass-panel rounded-2xl p-6 border border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-blue-400" />
              3. Mathematical Parameters & Domain
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Algorithm
                </label>
                <select
                  value={mathAlgorithm}
                  onChange={e => setMathAlgorithm(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="prime-count">Prime Number Counting & Summation</option>
                  <option value="numerical-integration">High-Precision Numerical Integration</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Number of Task Chunks (N)
                </label>
                <input
                  type="number"
                  min={1}
                  max={64}
                  value={mathChunks}
                  onChange={e => setMathChunks(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Range Start (a)
                </label>
                <input
                  type="number"
                  min={0}
                  value={rangeStart}
                  onChange={e => setRangeStart(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Range End (b)
                </label>
                <input
                  type="number"
                  min={1}
                  value={rangeEnd}
                  onChange={e => setRangeEnd(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              {mathAlgorithm === 'numerical-integration' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Target Function
                    </label>
                    <select
                      value={integrationFunction}
                      onChange={e => setIntegrationFunction(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none"
                    >
                      <option value="polynomial">f(x) = 4x³ - 3x² + 2x + 1</option>
                      <option value="sinusoid">f(x) = sin(x) · cos(0.5x)</option>
                      <option value="gaussian">f(x) = exp(-0.5x²)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Approximation Steps
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={1000000}
                      value={integrationSteps}
                      onChange={e => setIntegrationSteps(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl p-6 border border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Terminal className="w-4 h-4 text-violet-400" />
              3. Dataset & Processing Operation
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Operation
                </label>
                <select
                  value={fileOperation}
                  onChange={e => setFileOperation(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="word-count">Word Frequency Map-Reduce</option>
                  <option value="regex-filter">Distributed Regex Pattern Search</option>
                  <option value="line-stats">Line & Character Statistical Summary</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Chunk Count
                </label>
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={fileChunks}
                  onChange={e => setFileChunks(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              {fileOperation === 'regex-filter' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Regex Pattern
                  </label>
                  <input
                    type="text"
                    value={regexPattern}
                    onChange={e => setRegexPattern(e.target.value)}
                    placeholder="e.g. error|warn|critical"
                    className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Dataset Content (Sample or paste lines)
              </label>
              <textarea
                rows={5}
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                className="w-full p-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="py-2.5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            id="wizard-submit-btn"
            disabled={loading}
            className="py-2.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/25 flex items-center gap-2 transition disabled:opacity-50"
          >
            {loading ? (
              <span>Scheduling Across Grid...</span>
            ) : (
              <>
                <span>Launch & Partition Job</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
