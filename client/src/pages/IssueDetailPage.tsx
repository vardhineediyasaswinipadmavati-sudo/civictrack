import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SharedIssue, CitizenReport, ReportImage, StatusHistoryItem, RepairRecord, CitizenVerification } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { MergeIssuesModal } from '../components/MergeIssuesModal';
import { AssociateAssetModal } from '../components/AssociateAssetModal';
import { RecordRepairModal } from '../components/RecordRepairModal';
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
  MessageSquare,
  ShieldCheck,
  XCircle
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
  const [showAssociateModal, setShowAssociateModal] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
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

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setApproving(true);
    try {
      await api.approveIssue(id, approvalNotes);
      setShowApproveModal(false);
      setApprovalNotes('');
      await loadIssue();
    } catch (err: any) {
      alert(err.message || 'Failed to approve issue');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !rejectionReason.trim()) return;
    setRejecting(true);
    try {
      await api.rejectIssue(id, rejectionReason.trim());
      setShowRejectModal(false);
      setRejectionReason('');
      await loadIssue();
    } catch (err: any) {
      alert(err.message || 'Failed to reject issue');
    } finally {
      setRejecting(false);
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

  const handleSeparateReport = async (reportId: number | string) => {
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
            {(issue.status === 'Resolved' || issue.status === 'Approved') && (
              <button
                onClick={() => setShowReopenModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Issue Re-emerged / Reopen
              </button>
            )}

            {/* Admin Direct Approve / Reject Actions */}
            {user?.role === 'admin' && issue.status === 'Resolved' && (
              <>
                <button
                  onClick={() => { setApprovalNotes(''); setShowApproveModal(true); }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" /> Approve Resolution
                </button>
                <button
                  onClick={() => { setRejectionReason(''); setShowRejectModal(true); }}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Reject (Rework)
                </button>
              </>
            )}

            {/* Staff / Admin Complete Repair Action */}
            {(user?.role === 'admin' || user?.role === 'department_staff') && issue.status !== 'Resolved' && issue.status !== 'Approved' && (
              <button
                onClick={() => setShowRepairModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-civic-600 hover:bg-civic-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                <Wrench className="w-4 h-4" /> {issue.status === 'Rejected' ? 'Submit Rework' : 'Complete Repair'}
              </button>
            )}

            {/* Admin Associate Asset Action */}
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowAssociateModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 text-xs font-bold transition-colors flex items-center gap-1.5"
                title="Associate or reassign infrastructure asset"
              >
                <Building2 className="w-4 h-4" /> {issue.infrastructure_id ? 'Change Asset' : 'Associate Asset'}
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
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Infrastructure Asset</span>
              {user?.role === 'admin' && (
                <button
                  onClick={() => setShowAssociateModal(true)}
                  className="text-[11px] font-bold text-civic-600 hover:text-civic-800 hover:underline"
                >
                  {issue.asset_code ? 'Change' : '+ Link Asset'}
                </button>
              )}
            </div>
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

      {/* Admin Approved Verification Banner */}
      {issue.status === 'Approved' && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-emerald-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Administrator Verified & Closed
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Verified Closure
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Municipal administration verified that field remediation satisfies civic infrastructure standards.
                </p>
              </div>
            </div>
            {issue.approved_at && (
              <span className="text-[11px] font-medium text-emerald-800 bg-white/80 px-3 py-1 rounded-xl border border-emerald-200 self-start sm:self-auto shrink-0">
                Approved: {new Date(issue.approved_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-emerald-200/60 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">Approving Administrator</span>
              <span className="font-bold text-slate-800">{issue.approved_by_name || 'Municipal Administrator'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">Staff Repair Completed</span>
              <span className="font-bold text-slate-800">
                {issue.resolved_at ? new Date(issue.resolved_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : 'Logged on resolution'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">Administrative Remarks</span>
              <span className="font-medium text-slate-700 italic">
                {issue.approval_notes ? `"${issue.approval_notes}"` : 'Repairs verified against municipal quality guidelines.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Admin Rejected / Rework Banner */}
      {issue.status === 'Rejected' && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50/40 to-rose-50 border border-rose-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-rose-900 text-sm sm:text-base">
                    Repair Rejected — Returned for Department Rework
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    Rework Required
                  </span>
                </div>
                <p className="text-xs text-rose-700 mt-0.5">
                  Administrative review identified defects in the repair. Field crews must perform corrective action and resubmit.
                </p>
              </div>
            </div>
            {issue.rejected_at && (
              <span className="text-[11px] font-medium text-rose-800 bg-white/80 px-3 py-1 rounded-xl border border-rose-200 self-start sm:self-auto shrink-0">
                Rejected: {new Date(issue.rejected_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-rose-200/60 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">Reviewing Administrator</span>
              <span className="font-bold text-slate-800">{issue.rejected_by_name || 'Municipal Operations Reviewer'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">Rejection Feedback & Required Remediation</span>
              <span className="font-bold text-rose-800 block mt-0.5 bg-rose-100/60 p-2 rounded-lg border border-rose-200/80">
                "{issue.rejection_reason || 'Remediation does not meet municipal standards; further work required.'}"
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Staff Resolved (Awaiting Approval) Notice for Admin */}
      {issue.status === 'Resolved' && user?.role === 'admin' && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border border-blue-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Staff Completed Repair — Awaiting Administrator Approval
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Department field staff have submitted repair evidence. Review the work summary and photos below, then approve or reject closure.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setApprovalNotes(''); setShowApproveModal(true); }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" /> Approve Resolution
            </button>
            <button
              onClick={() => { setRejectionReason(''); setShowRejectModal(true); }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" /> Reject (Rework)
            </button>
          </div>
        </div>
      )}

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

                  {/* Citizen's specific uploaded evidence photograph */}
                  {report.evidence_image && (
                    <div className="mt-2.5">
                      <a
                        href={report.evidence_image}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block group relative rounded-xl overflow-hidden border border-slate-200 hover:border-civic-500 shadow-xs transition-all"
                        title="Click to view full photograph"
                      >
                        <img
                          src={report.evidence_image}
                          alt={`Evidence submitted for ${report.report_code}`}
                          className="w-32 h-24 object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </a>
                    </div>
                  )}

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
          {(issue.status === 'Resolved' || issue.status === 'Approved') && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6 shadow-sm space-y-4 text-xs">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Verify Repair Effectiveness
                </h3>
                <p className="text-slate-600 mt-1">
                  Authorities marked this problem as repaired. As a resident in this community, does the repair hold up?
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

      {/* Admin Approve Resolution Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 mb-2 text-emerald-700">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Approve & Close Issue {issue.issue_code}
              </h3>
            </div>
            <p className="text-slate-600 mb-3">
              Confirm that the physical remediation submitted by staff meets municipal standards. This will officially verify closure and notify all citizen reporters and followers.
            </p>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 space-y-1">
              <p className="font-semibold text-slate-900">{issue.title}</p>
              <p className="text-slate-500 text-[11px]">{issue.address}</p>
            </div>
            <form onSubmit={handleApprove} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Administrative Approval Remarks (Optional)
                </label>
                <textarea
                  rows={3}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="e.g. Field inspection verified road repaving meets quality guidelines. Closure approved."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{approving ? 'Approving...' : 'Confirm Approval & Close'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reject Resolution Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 mb-2 text-rose-700">
              <XCircle className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Reject Repair & Request Rework ({issue.issue_code})
              </h3>
            </div>
            <p className="text-slate-600 mb-3">
              Return this complaint to the assigned department staff for further remediation. The previously submitted repair records and evidence are preserved.
            </p>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 space-y-1">
              <p className="font-semibold text-slate-900">{issue.title}</p>
              <p className="text-slate-500 text-[11px]">{issue.address}</p>
            </div>
            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Rejection <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Surface patch uneven; asphalt layer washed out; drain grate not properly fastened..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Minimum 5 characters required explaining the defect to staff.
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejecting || rejectionReason.trim().length < 5}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{rejecting ? 'Rejecting...' : 'Return for Rework'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Admin Associate Asset Modal */}
      {showAssociateModal && (
        <AssociateAssetModal
          issue={issue}
          onSuccess={async () => {
            setShowAssociateModal(false);
            await loadIssue();
          }}
          onClose={() => setShowAssociateModal(false)}
        />
      )}

      {/* Staff / Admin Record Repair Modal */}
      {showRepairModal && (
        <RecordRepairModal
          assetId={issue.infrastructure_id || null}
          assetName={issue.asset_name || issue.title}
          sharedIssueId={issue.id}
          incidentId={issue.incident_id || null}
          onSuccess={async () => {
            setShowRepairModal(false);
            await loadIssue();
          }}
          onClose={() => setShowRepairModal(false)}
        />
      )}
    </div>
  );
};
