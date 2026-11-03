import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  User,
  Wrench,
  ShieldCheck,
  Info
} from 'lucide-react';

type SelectedRole = 'citizen' | 'department_staff' | 'admin';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState<SelectedRole>('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleConfigs = {
    citizen: {
      title: 'Citizen Resident Portal',
      subtitle: 'Sign in to report civic problems, follow repair progress, and verify municipal work across Bhimavaram.',
      icon: User,
      badge: 'Public Resident Access',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    department_staff: {
      title: 'Department Operations Portal',
      subtitle: 'Authorized access for municipal field engineers, road crews, and sanitation supervisors to manage assigned work orders.',
      icon: Wrench,
      badge: 'Field Engineering Access',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    admin: {
      title: 'Operations Command Center',
      subtitle: 'Restricted administrative access for municipal commissioners and supervisors to manage infrastructure governance and SLAs.',
      icon: ShieldCheck,
      badge: 'Privileged Municipal Governance',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200'
    }
  };

  const currentConfig = roleConfigs[selectedRole];

  const handleRoleChange = (role: SelectedRole) => {
    setSelectedRole(role);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both your registered email address and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Pass selectedRole so backend verifies the account's actual stored role matches the selected portal
      const authenticatedUser = await login(email.trim(), password, selectedRole);

      // Route strictly according to server-verified role
      if (authenticatedUser.role === 'admin') {
        navigate('/admin');
      } else if (authenticatedUser.role === 'department_staff') {
        navigate('/staff');
      } else {
        navigate('/citizen');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials and selected role portal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[88vh] flex items-center justify-center p-4 sm:p-6 bg-slate-50/60">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-9 shadow-xl border border-slate-200/80 transition-all">
        {/* Branding header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-civic-800 to-civic-600 flex items-center justify-center text-white mx-auto shadow-md shadow-civic-500/20 mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign In to CivicTrack</h2>
          <p className="text-xs text-slate-500 mt-1">
            Infrastructure Lifecycle Management • Bhimavaram Platform
          </p>
        </div>

        {/* PROMINENT ROLE SELECTOR AT TOP (Phase 5 Requirement) */}
        <div className="mb-6">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 text-center">
            Select Your Role Portal
          </label>
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200">
            {(['citizen', 'department_staff', 'admin'] as SelectedRole[]).map((role) => {
              const cfg = roleConfigs[role];
              const Icon = cfg.icon;
              const isSelected = selectedRole === role;
              const label = role === 'citizen' ? 'Citizen' : role === 'department_staff' ? 'Staff' : 'Admin';

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleChange(role)}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all duration-200 text-xs font-bold ${
                    isSelected
                      ? 'bg-white text-civic-700 shadow-sm border border-slate-200 scale-[1.02]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                  aria-pressed={isSelected}
                >
                  <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-civic-600' : 'text-slate-400'}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Contextual Banner for Selected Role */}
        <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <span>{currentConfig.title}</span>
            </h3>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${currentConfig.badgeClass}`}>
              {currentConfig.badge}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {currentConfig.subtitle}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold block mb-0.5">Authentication Error</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5" htmlFor="login-email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs transition-shadow"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700" htmlFor="login-password">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-[11px] font-semibold text-civic-600 hover:text-civic-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs transition-shadow"
              />
              {/* PASSWORD VISIBILITY TOGGLE (Phase 4 Requirement) */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-700 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-civic-600 hover:bg-civic-700 disabled:bg-civic-300 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-civic-600/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
          >
            {loading ? 'Authenticating with Municipal Server...' : `Sign In as ${selectedRole === 'citizen' ? 'Citizen' : selectedRole === 'department_staff' ? 'Staff' : 'Administrator'}`}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
          {/* Registration Notice / Scoping */}
          {selectedRole === 'citizen' ? (
            <p className="text-center text-xs text-slate-500 pt-1">
              New citizen resident in Bhimavaram?{' '}
              <Link to="/register" className="font-bold text-civic-600 hover:underline">
                Register citizen account
              </Link>
            </p>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Staff and administrator accounts cannot be created via public registration and must be provisioned by municipal authorities.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
