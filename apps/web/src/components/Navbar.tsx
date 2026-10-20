import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cpu, LogOut, User, Globe, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { BrowserWorkerModal } from './BrowserWorkerModal.js';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showBrowserWorker, setShowBrowserWorker] = useState(false);

  return (
    <>
      <header className="h-16 border-b border-slate-800 bg-[#0a0d14]/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              Compute<span className="text-blue-500">Grid</span>
              <span className="text-[10px] font-mono py-0.5 px-1.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v1.0
              </span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Quick Action: New Job */}
              <Link
                to="/jobs/new"
                id="navbar-submit-job-btn"
                className="hidden sm:flex items-center gap-2 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                <PlusCircle className="w-4 h-4" />
                Submit Job
              </Link>

              {/* In-Browser Worker Trigger */}
              <button
                onClick={() => setShowBrowserWorker(true)}
                id="navbar-browser-worker-btn"
                className="flex items-center gap-2 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
              >
                <Globe className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Browser Node</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </button>

              {/* User Dropdown / Profile */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="text-right hidden md:block">
                  <div className="text-xs font-semibold text-white">{user.username}</div>
                  <div className="text-[10px] text-slate-400">{user.role}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <User className="w-4 h-4" />
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  id="navbar-logout-btn"
                  title="Logout"
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/80 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                id="navbar-login-btn"
                className="py-1.5 px-3.5 text-xs font-medium text-slate-300 hover:text-white transition"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                id="navbar-register-btn"
                className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </header>

      <BrowserWorkerModal
        isOpen={showBrowserWorker}
        onClose={() => setShowBrowserWorker(false)}
      />
    </>
  );
};
