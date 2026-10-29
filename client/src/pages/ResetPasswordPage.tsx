import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Layers, Lock, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenValid(false);
      setTokenError('No password reset token was provided. Please request a new password recovery link.');
      return;
    }

    const checkToken = async () => {
      try {
        const res = await api.validateResetToken(token);
        if (res.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setTokenError('This password reset link is invalid or has expired.');
        }
      } catch (err: any) {
        setTokenValid(false);
        setTokenError(err.message || 'The password reset link is invalid or has expired.');
      } finally {
        setValidating(false);
      }
    };

    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-xl border border-slate-200">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-civic-800 to-civic-600 flex items-center justify-center text-white mx-auto shadow-md shadow-civic-500/20 mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Set New Password</h2>
          <p className="text-xs text-slate-500 mt-1">Bhimavaram Municipal Infrastructure Management</p>
        </div>

        {validating ? (
          <div className="text-center py-8 text-xs text-slate-500 space-y-2">
            <div className="w-6 h-6 border-2 border-civic-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Validating secure reset token with municipal server...</p>
          </div>
        ) : !tokenValid ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-rose-900">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Invalid or Expired Link</span>
              </div>
              <p>{tokenError}</p>
            </div>
            <div className="pt-2 text-center">
              <Link
                to="/forgot-password"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-civic-600 hover:text-civic-700 hover:underline"
              >
                Request a new password reset link &rarr;
              </Link>
            </div>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Password Successfully Updated</span>
              </div>
              <p>Your password has been changed securely. You can now sign in with your new credentials.</p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-2.5 rounded-xl bg-civic-600 hover:bg-civic-700 text-white font-bold text-xs shadow transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                Sign In Now
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1" htmlFor="new-password">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-700 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1" htmlFor="confirm-password">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-700 transition-colors"
                >
                  {showConfirmPassword ? (
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
              className="w-full py-2.5 rounded-xl bg-civic-600 hover:bg-civic-700 disabled:bg-civic-300 disabled:cursor-not-allowed text-white font-bold text-xs shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 mt-2"
            >
              {loading ? 'Updating Password...' : 'Save New Password'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline"
              >
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
