import React, { useState } from 'react';
import { Settings, User, Server, Bell, Shield, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  // Preferences state
  const [defaultPriority, setDefaultPriority] = useState(5);
  const [defaultRetries, setDefaultRetries] = useState(2);
  const [defaultTimeout, setDefaultTimeout] = useState(60);
  const [browserWorkerAutoStart, setBrowserWorkerAutoStart] = useState(false);
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings & Policies</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure account parameters, default job execution policies, and telemetry notifications.
        </p>
      </div>

      {saved && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Preferences saved successfully to local session.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Account Profile Card */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-blue-400" />
            Account Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Email Address</span>
              <input
                type="text"
                disabled
                value={user?.email || ''}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Username</span>
              <input
                type="text"
                disabled
                value={user?.username || ''}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Access Role</span>
              <span className="inline-block px-2.5 py-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 font-semibold rounded-lg">
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Distributed Compute Defaults */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Server className="w-4 h-4 text-indigo-400" />
            Compute & Scheduler Defaults
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Default Job Priority
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={defaultPriority}
                onChange={e => setDefaultPriority(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Default Retry Limit
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={defaultRetries}
                onChange={e => setDefaultRetries(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Lease Expiry (Sec)
              </label>
              <input
                type="number"
                min={15}
                max={300}
                value={defaultTimeout}
                onChange={e => setDefaultTimeout(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Notifications & Toggles */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-violet-400" />
            Telemetry & Preferences
          </h2>

          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-white block">Job Completion Notifications</span>
              <span className="text-slate-400">Play audio chime and emit desktop notifications on job finish.</span>
            </div>
            <input
              type="checkbox"
              checked={notifyOnComplete}
              onChange={e => setNotifyOnComplete(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800/80">
            <div>
              <span className="font-semibold text-white block">Automatic Browser Node Participation</span>
              <span className="text-slate-400">Automatically activate in-browser worker when dashboard is open.</span>
            </div>
            <input
              type="checkbox"
              checked={browserWorkerAutoStart}
              onChange={e => setBrowserWorkerAutoStart(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="py-2.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/25 transition"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
};
