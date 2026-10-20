import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cpu, Lock, Mail, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (demEmail: string, demPass: string) => {
    setEmail(demEmail);
    setPassword(demPass);
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 group mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
            <Cpu className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Compute<span className="text-blue-500">Grid</span>
          </span>
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">Sign in to your account</h1>
        <p className="mt-1.5 text-xs text-slate-400">
          Enter credentials to manage jobs, workers, and distributed tasks
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="glass-panel py-8 px-6 sm:px-10 rounded-2xl border border-slate-800 shadow-2xl relative">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  id="login-email-input"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@computegrid.io"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  id="login-password-input"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <span className="text-[11px] font-medium text-slate-500 block mb-2 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Quick Fill Seeded Accounts:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials('admin@computegrid.io', 'AdminGrid123!')}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-medium transition text-left"
              >
                <div className="font-semibold text-white">Admin Account</div>
                <div className="text-[10px] text-slate-400">admin@computegrid.io</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('demo@computegrid.io', 'DemoGrid123!')}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-medium transition text-left"
              >
                <div className="font-semibold text-white">Demo User</div>
                <div className="text-[10px] text-slate-400">demo@computegrid.io</div>
              </button>
            </div>
          </div>

          <div className="mt-5 text-center text-xs text-slate-400">
            Don't have an account yet?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
