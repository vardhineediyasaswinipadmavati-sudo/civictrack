import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SharedIssue, CitizenReport, ReportImage, StatusHistoryItem, RepairRecord, CitizenVerification } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { MergeIssuesModal } from '../components/MergeIssuesModal';
import { formatINR } from '../utils/currency';
import {
  MapPin,
  Calendar,
  Users,
  Building2,
  Clock,
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
  AlertTriangle,
  RotateCcw,
  Wrench,
  Camera,
  History,
  GitMerge,
  Split,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  MessageSquare
} from 'lucide-react';

export const IssueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<{
    issue: SharedIssue;
    citizenReports: CitizenReport[];
    images: ReportImage[];
    history: StatusHistoryItem[];
    repairs: RepairRecord[];
    verifications: CitizenVerification[];
    followersCount: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadIssue = async () => {
    if (!id) return;
    try {
      const res = await api.getIssueById(id);
      setData(res);
    } catch (err) {
      console.error('Failed to load issue details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssue();
  }, [id]);

  const handleToggleFollow = async () => {
    if (!id) return;
    try {
      const res = await api.toggleFollowIssue(id);
      setIsFollowing(res.following);
      await loadIssue();
    } catch (err) {
      console.error('Follow error', err);
    }
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !reopenReason) return;
    try {
      await api.reopenIssue(id, reopenReason);
      setShowReopenModal(false);
      setReopenReason('');
      await loadIssue();
    } catch (err: any) {
      alert(err.message || 'Failed to reopen issue');
    }
  };

  const handleVerify = async (isEffective: boolean) => {
    if (!id) return;
    setVerifying(true);
    try {
      await api.verifyResolution(id, isEffective, feedback);
      setFeedback('');
      await loadIssue();
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleSeparateReport = async (reportId: number) => {
    if (!id) return;
    const reason = prompt('Please specify reason for separating this report into an independent issue:');
    if (!reason) return;
    try {
      await api.separateReport(id, reportId, reason);
      await loadIssue();
      alert('Report successfully separated into independent master issue.');
    } catch (err: any) {
      alert(err.message || 'Failed to separate report');
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center text-xs text-slate-500">
        Loading master civic issue records...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center text-xs text-rose-500">
        Civic issue not found.
      </div>
    );
  }

  const { issue, citizenReports, images, history, repairs, verifications, followersCount } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <button
        type="button"
        onClick={() => {
          if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
          } else {
            navigate('/citizen');
          }
        }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to previous page</span>
      </button>

      {/* Top Banner Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-extrabold px-3 py-1 rounded-xl bg-civic-100 text-civic-900 border border-civic-200">
              Master Issue {issue.issue_code}
            </span>
            <StatusBadge status={issue.status} size="lg" />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFollow}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                isFollowing
                  ? 'bg-civic-50 text-civic-700 border-civic-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {isFollowing ? <BookmarkCheck className="w-4 h-4 text-civic-600" /> : <Bookmark className="w-4 h-4 text-slate-400" />}
              {isFollowing ? 'Following Updates' : 'Follow Issue'} ({followersCount})
            </button>

            {/* Reopen Action (Section 3: Citizen or staff can reopen if problem returned) */}
            {issue.status === 'Resolved' && (
              <button
                onClick={() => setShowReopenModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Issue Re-emerged / Reopen
              </button>
            )}

            {/* Admin Merge Action */}
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowMergeModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <GitMerge className="w-4 h-4" /> Merge Issue
              </button>
            )}
          </div>
        </div>

        {/* Title and Category */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {issue.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{issue.category}</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-slate-400" /> {issue.address}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4 text-slate-400" /> {issue.department_name || 'Department Unassigned'}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-slate-400" /> First Reported {new Date(issue.first_reported_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">Linked Citizen Reports</span>
            <p className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-civic-600" />
              {citizenReports.length} independent submissions
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">Computed Priority</span>
            <div className="mt-1">
              <PriorityBadge score={issue.priority_score} isSafetyCritical={issue.is_safety_critical} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">Estimated Affected Population</span>
            <p className="text-xl font-bold text-slate-900 mt-1">
              ~{issue.estimated_affected_population} residents
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{issue.affected_population_details || 'Based on nearby transit & reporter density'}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">Infrastructure Asset</span>
            {issue.asset_code ? (
              <Link to={`/infrastructure/${issue.infrastructure_id}`} className="mt-1 block font-mono font-bold text-civic-700 hover:underline">
                {issue.asset_code} ({issue.asset_name})
              </Link>
            ) : (
              <p className="text-slate-400 italic mt-1">No asset profile attached</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Reports & Resolution, Right = History & Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 5 Feature 1D: Preserved Individual Citizen Reports */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-civic-600" />
                  Linked Citizen Reports ({citizenReports.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every citizen submission retains its original reporter, description, timestamp, and photographs
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                Zero Data Loss
              </span>
            </div>

            <div className="space-y-3">
              {citizenReports.map((report) => (
                <div key={report.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {report.report_code}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {report.reporter_name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {report.link_type === 'confirmed_duplicate' ? 'Confirmed Duplicate' : report.link_type === 'admin_merged' ? 'Admin Merged' : 'Original Report'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(report.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-slate-700 leading-relaxed font-normal">
                    "{report.description}"
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" /> {report.address}
                    </span>

                    {/* Admin option to separate if misclassified (Feature 1D) */}
                    {user?.role === 'admin' && citizenReports.length > 1 && (
                      <button
                        onClick={() => handleSeparateReport(report.id)}
                        className="text-civic-700 hover:text-civic-900 font-semibold hover:underline flex items-center gap-1"
                        title="Separate this report into an independent master issue if physical defect is distinct"
                      >
                        <Split className="w-3.5 h-3.5" /> Separate as New Issue
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Photos Gallery */}
          {images.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-civic-600" />
                Community Photographic Evidence ({images.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img) => (
                  <div key={img.id} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group relative">
                    <img
                      src={img.image_url}
                      alt={img.caption || 'Evidence'}
                      className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="p-2 bg-white text-[11px] text-slate-600 truncate border-t border-slate-100">
                      {img.caption || `Uploaded evidence (${img.image_type})`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Repair & Resolution Evidence Section (Feature 4 & 5) */}
          {repairs.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-600" />
                Recorded Municipal Repairs & Work Logs
              </h2>
              <div className="space-y-3">
                {repairs.map((rep) => (
                  <div key={rep.id} className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                          {rep.repair_code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          rep.repair_type === 'permanent'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {rep.repair_type} repair
                        </span>
                      </div>
                      <span className="text-slate-500 font-medium">
                        Completed {new Date(rep.completed_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-slate-800 font-medium">
                      {rep.work_summary}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
                      <span><strong>Repaired by:</strong> {rep.repaired_by_name} ({rep.department_name})</span>
                      {rep.materials_used && <span><strong>Materials:</strong> {rep.materials_used}</span>}
                      <span>
                        <strong>Cost:</strong>{' '}
                        {rep.cost_unavailable ? 'Cost data unavailable' : formatINR(rep.cost_amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 Col) */}
        <div className="space-y-6">
          {/* Citizen Verification Card (Section 3: Citizens verify whether repairs are effective) */}
          {issue.status === 'Resolved' && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6 shadow-sm space-y-4 text-xs">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Verify Repair Effectiveness
                </h3>
                <p className="text-slate-600 mt-1">
                  Authorities marked this problem as resolved. As a resident in this community, does the repair hold up?
                </p>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Optional comments on pavement smoothness, lighting intensity, etc."
                  className="w-full p-2.5 rounded-xl border border-emerald-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleVerify(true)}
                    disabled={verifying}
                    className="py-2 px-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <ThumbsUp className="w-4 h-4" /> Yes, Repair Works
                  </button>
                  <button
                    onClick={() => handleVerify(false)}
                    disabled={verifying}
                    className="py-2 px-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <ThumbsDown className="w-4 h-4" /> Still Defective
                  </button>
                </div>
              </div>

              {verifications.length > 0 && (
                <div className="pt-3 border-t border-emerald-200/60">
                  <span className="font-semibold text-slate-700 block mb-1.5">
                    Community Feedback ({verifications.length})
                  </span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {verifications.map((v) => (
                      <div key={v.id} className="p-2 rounded-lg bg-white/80 border border-emerald-100 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{v.user_name}</span>
                          <span className={v.is_effective ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                            {v.is_effective ? '✓ Effective' : '✗ Failed'}
                          </span>
                        </div>
                        {v.feedback && <p className="text-slate-600 mt-0.5">{v.feedback}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Audit Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-civic-600" />
              Consolidated Status Timeline
            </h3>

            <div className="relative pl-6 space-y-4 border-l-2 border-slate-100 text-xs">
              {history.map((h, i) => (
                <div key={h.id} className="relative">
                  <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-civic-600 shadow-sm" />
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-slate-900">{h.new_status}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(h.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">{h.comments}</p>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Updated by {h.changed_by_name} ({h.changed_by_role})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Reopen Civic Issue {issue.issue_code}
            </h3>
            <p className="text-slate-500 mb-4">
              Please specify why this issue requires re-investigation or why the repair failed:
            </p>
            <form onSubmit={handleReopen} className="space-y-4">
              <textarea
                required
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Asphalt patch eroded following rainfall, pothole crater expanded..."
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-700 text-white rounded-lg font-bold hover:bg-purple-800"
                >
                  Reopen Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Merge Modal */}
      {showMergeModal && (
        <MergeIssuesModal
          targetIssue={issue}
          onSuccess={async () => {
            setShowMergeModal(false);
            await loadIssue();
          }}
          onClose={() => setShowMergeModal(false)}
        />
      )}
    </div>
  );
};
