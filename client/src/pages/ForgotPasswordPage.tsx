import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Mail, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide your registered email address.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setDevToken(null);

    try {
      const res = await api.forgotPassword(email.trim());
      setSuccessMessage(res.message);
      if (res.dev_reset_token) {
        setDevToken(res.dev_reset_token);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to process your request. Please try again.');
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
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Recover Password</h2>
          <p className="text-xs text-slate-500 mt-1">Bhimavaram Municipal Infrastructure Management</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Instructions Sent</span>
              </div>
              <p>{successMessage}</p>
            </div>

            {devToken && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] space-y-1.5">
                <p className="font-semibold text-amber-900">Local Testing Link (Email Server Emulation):</p>
                <Link
                  to={`/reset-password?token=${devToken}`}
                  className="inline-block text-civic-700 font-bold underline break-all hover:text-civic-800"
                >
                  Proceed to Reset Password Page &rarr;
                </Link>
              </div>
            )}

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-civic-600 hover:text-civic-700 hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <p className="text-slate-600 leading-relaxed text-xs">
              Enter the email address registered with your CivicTrack account. We will dispatch a secure, single-use password reset link.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1" htmlFor="recovery-email">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  id="recovery-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-civic-600 hover:bg-civic-700 disabled:bg-civic-300 disabled:cursor-not-allowed text-white font-bold text-xs shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 mt-2"
            >
              {loading ? 'Processing Recovery Request...' : 'Send Recovery Link'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
