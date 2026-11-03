import React, { useState } from 'react';
import { api } from '../services/api';
import { Department } from '../types';
import { UserPlus, Lock, Mail, User, ShieldCheck, Wrench, AlertCircle, CheckCircle2, Eye, EyeOff, X, Building2, Phone } from 'lucide-react';

interface ProvisionUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[];
}

export const ProvisionUserModal: React.FC<ProvisionUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  departments
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'department_staff' | 'admin'>('department_staff');
  const [departmentId, setDepartmentId] = useState<string | number>('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields (Name, Email, and Password).');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (role === 'department_staff' && !departmentId) {
      setError('Please assign a municipal department for this staff member.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.provisionUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        department_id: role === 'department_staff' ? departmentId : null,
        phone: phone.trim() || undefined
      });

      setSuccess(res.message || 'Municipal account provisioned successfully.');
      setTimeout(() => {
        onSuccess();
        onClose();
        setName('');
        setEmail('');
        setPassword('');
        setDepartmentId('');
        setPhone('');
        setSuccess(null);
      }, 1200);
    } catch (err: any) {
      console.error('Provisioning error:', err);
      setError(err?.message || 'Failed to provision municipal account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-xs max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-civic-50 text-civic-600 flex items-center justify-center border border-civic-200 shadow-sm">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Provision Municipal Account</h3>
              <p className="text-[11px] text-slate-500">Authorize new Administrator or Department Staff credentials</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed font-semibold">{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 uppercase text-[10px] tracking-wider">
              Account Authority Level
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('department_staff')}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                  role === 'department_staff'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Wrench className={`w-4 h-4 ${role === 'department_staff' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <p className="font-bold text-xs">Department Staff</p>
                  <p className="text-[10px] text-slate-500">Field works & repair logging</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                  role === 'admin'
                    ? 'border-purple-500 bg-purple-50/70 text-purple-900 ring-2 ring-purple-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 ${role === 'admin' ? 'text-purple-600' : 'text-slate-400'}`} />
                <div>
                  <p className="font-bold text-xs">Administrator</p>
                  <p className="text-[10px] text-slate-500">Governance & issue merging</p>
                </div>
              </button>
            </div>
          </div>

          {/* Department Selection (if Staff) */}
          {role === 'department_staff' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="prov-dept">
                Assigned Municipal Department <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <select
                  id="prov-dept"
                  required
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs"
                >
                  <option value="">-- Select Municipal Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code} • SLA: {d.sla_hours}h)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5" htmlFor="prov-name">
              Full Officer Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                id="prov-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Anand Varma"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5" htmlFor="prov-email">
              Official Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                id="prov-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. anand.varma@civictrack.org"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Accepts any legitimate domain (e.g. @civictrack.org, @bhimavaram.gov.in, @gmail.com)</p>
          </div>

          {/* Initial Password */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5" htmlFor="prov-pass">
              Initial Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                id="prov-pass"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Phone (optional) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5" htmlFor="prov-phone">
              Official Contact Phone (Optional)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                id="prov-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98480 22000"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-civic-600 hover:bg-civic-700 disabled:bg-civic-300 text-white font-bold text-xs shadow-md shadow-civic-600/20 transition-all flex items-center gap-1.5"
            >
              {loading ? 'Provisioning...' : 'Provision Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
