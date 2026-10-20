import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  PlusCircle,
  Server,
  Download,
  ListTodo,
  FileCheck,
  History,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/jobs', label: 'Compute Jobs', icon: Layers },
    { to: '/jobs/new', label: 'Submit Job', icon: PlusCircle },
    { to: '/workers', label: 'Worker Fleet', icon: Server },
    { to: '/workers/onboarding', label: 'Enroll Workers', icon: Download },
    { to: '/tasks', label: 'Task Explorer', icon: ListTodo },
    { to: '/artifacts', label: 'Results & Artifacts', icon: FileCheck },
    { to: '/logs', label: 'Activity & Logs', icon: History },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  if (user?.role === 'ADMIN') {
    links.push({ to: '/admin', label: 'Administration', icon: ShieldCheck });
  }

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#0a0d14]/60 backdrop-blur-md hidden md:flex flex-col shrink-0">
      <div className="p-4 space-y-1.5 flex-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Grid Navigation
        </div>
        {links.map(link => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/jobs' || link.to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-800/80">
        <div className="glass-card rounded-xl p-3 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Grid Core</span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Cloud coordinator online with low-latency event bus.
          </p>
        </div>
      </div>
    </aside>
  );
};
