import React, { useState, useEffect } from 'react';
import { History, Search, Filter, RefreshCw, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { api } from '../services/api.js';

export const ActivityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const jobs = await api.get<any[]>('/jobs?limit=20');
      const allEvents: any[] = [];
      for (const j of jobs || []) {
        if (j.events) {
          allEvents.push(
            ...j.events.map((e: any) => ({
              ...e,
              jobName: j.name,
            }))
          );
        }
      }
      allEvents.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setLogs(allEvents);
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter(l => {
    const matchesSeverity = severityFilter === 'ALL' || l.severity === severityFilter;
    const matchesSearch =
      l.message.toLowerCase().includes(search.toLowerCase()) ||
      l.type.toLowerCase().includes(search.toLowerCase()) ||
      l.jobName?.toLowerCase().includes(search.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Activity & Logs</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time audit trails, distributed scheduling events, lease expirations, and failure diagnostics.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search event logs by message or type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Severity:</span>
          </div>
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">Info</option>
            <option value="WARN">Warning</option>
            <option value="ERROR">Error</option>
          </select>
        </div>
      </div>

      {/* Logs Feed */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <History className="w-10 h-10 mx-auto mb-2 text-slate-600 stroke-1" />
            <p className="text-sm font-medium text-slate-300">No events matched your filter</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 font-mono text-xs">
            {filtered.map(e => (
              <div key={e.id} className="p-4 hover:bg-slate-800/20 transition flex items-start gap-3">
                <div className="mt-0.5">
                  {e.severity === 'ERROR' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  ) : e.severity === 'WARN' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`font-semibold ${
                        e.severity === 'ERROR'
                          ? 'text-rose-400'
                          : e.severity === 'WARN'
                          ? 'text-amber-400'
                          : 'text-blue-400'
                      }`}
                    >
                      [{e.type}]
                    </span>
                    <span className="text-slate-400 font-sans text-xs">Job: {e.jobName}</span>
                  </div>
                  <p className="text-slate-200 font-sans leading-relaxed">{e.message}</p>
                </div>

                <span className="text-[11px] text-slate-500 whitespace-nowrap">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
