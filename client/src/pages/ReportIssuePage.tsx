import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { MapPicker } from '../components/MapPicker';
import { DuplicateSuggestionModal } from '../components/DuplicateSuggestionModal';
import { DuplicateMatchItem } from '../types';
import {
  PlusCircle,
  MapPin,
  Camera,
  AlertTriangle,
  Flame,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

export const ReportIssuePage: React.FC = () => {
  const navigate = useNavigate();

  // Form states
  const [category, setCategory] = useState('Roads and potholes');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const [isSafetyCritical, setIsSafetyCritical] = useState(false);
  const [latitude, setLatitude] = useState(16.5449);
  const [longitude, setLongitude] = useState(81.5212);
  const [address, setAddress] = useState('Main Road, Near Town Railway Station, Bhimavaram, Andhra Pradesh');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Duplicate detection state
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatchItem[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    'Roads and potholes',
    'Streetlights and electrical infrastructure',
    'Water supply and leakage',
    'Drainage and sewage',
    'Solid Waste and Sanitation',
    'Public buildings and facilities',
    'Other civic problems'
  ];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setImageFiles((prev) => [...prev, ...files]);

    const previews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...previews]);
  };

  const executeSubmission = async (confirmedIssueId: number | null = null) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Upload any selected images
      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        try {
          const res = await api.uploadImage(file);
          imageUrls.push(res.imageUrl);
        } catch (e) {
          console.warn('Image upload error', e);
        }
      }

      // If no image uploaded, provide a realistic contextual demo image based on category
      if (imageUrls.length === 0) {
        if (category.includes('Road') || category.includes('pothole')) {
          imageUrls.push('https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80');
        } else if (category.includes('light')) {
          imageUrls.push('https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=800&auto=format&fit=crop&q=80');
        } else if (category.includes('Water')) {
          imageUrls.push('https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=800&auto=format&fit=crop&q=80');
        } else {
          imageUrls.push('https://images.unsplash.com/photo-1584463699047-926c04cf037f?w=800&auto=format&fit=crop&q=80');
        }
      }

      // 2. Submit report
      const res = await api.submitReport({
        title: title.trim(),
        category,
        description: description.trim(),
        severity,
        latitude,
        longitude,
        address: address.trim(),
        confirmedExistingIssueId: confirmedIssueId,
        isSafetyCritical,
        imageUrls
      });

      // 3. Redirect to the shared master issue details page
      navigate(`/issues/${res.sharedIssueId}`);
    } catch (err: any) {
      setError(err.message || 'Submission failed.');
    } finally {
      setLoading(false);
      setShowDuplicateModal(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      setError('Please provide a title and detailed description.');
      return;
    }

    setLoading(true);
    setError(null);

    // Section 5 Feature 1B: Pre-submission Duplicate Check!
    try {
      const checkRes = await api.checkDuplicate({
        category,
        latitude,
        longitude,
        title,
        description
      });

      if (checkRes.hasDuplicates && checkRes.matches.length > 0) {
        setDuplicateMatches(checkRes.matches);
        setShowDuplicateModal(true);
        setLoading(false);
        return;
      }

      // No duplicate found -> proceed directly
      await executeSubmission(null);
    } catch (err: any) {
      // In case check fails, proceed directly
      await executeSubmission(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
        <span>Back to dashboard</span>
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Report a Civic Issue
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Submit community infrastructure observations. CivicTrack detects matching open issues to synchronize repair tickets while preserving your original report.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6 text-xs">
        {/* Category & Title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Infrastructure Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-civic-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Issue Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Deep pothole crater near bus stop"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-civic-500"
            />
          </div>
        </div>

        {/* Location Picker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block font-bold text-slate-700">
              Location & Coordinates <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-slate-500">
              Lat: {latitude.toFixed(4)}, Lon: {longitude.toFixed(4)}
            </span>
          </div>

          <MapPicker
            latitude={latitude}
            longitude={longitude}
            onChange={(lat, lon) => {
              setLatitude(lat);
              setLongitude(lon);
            }}
            height="260px"
          />

          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Street Address / Landmark Details
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 2400 Oak Avenue outside Baker's square"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-civic-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block font-bold text-slate-700 mb-1.5">
            Detailed Description <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={4}
            placeholder="Describe the severity, depth, water accumulation, traffic obstruction, or damage observed..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-civic-500 leading-relaxed"
          />
        </div>

        {/* Severity & Safety Critical */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Observed Severity</label>
            <div className="grid grid-cols-4 gap-2">
              {['Low', 'Medium', 'High', 'Critical'].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`py-2 px-1 rounded-xl text-center font-bold text-xs border transition-all ${
                    severity === s
                      ? s === 'Critical'
                        ? 'bg-red-500 text-white border-red-500 shadow-sm'
                        : s === 'High'
                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                        : 'bg-civic-600 text-white border-civic-600 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors w-full">
              <input
                type="checkbox"
                checked={isSafetyCritical}
                onChange={(e) => setIsSafetyCritical(e.target.checked)}
                className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4"
              />
              <div>
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-red-600" /> Public Safety Hazard
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Check if this poses immediate risk to cyclists, pedestrians, or vehicle crashes for urgent human review.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Photograph Evidence Upload */}
        <div>
          <label className="block font-bold text-slate-700 mb-1.5">
            Photographic Evidence (Optional)
          </label>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-civic-400 transition-colors">
            <Camera className="w-8 h-8 text-slate-400 mx-auto mb-1" />
            <p className="text-xs text-slate-600 font-medium">Upload photos of the problem</p>
            <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP up to 5MB</p>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              className="mt-2 text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-civic-50 file:text-civic-700 file:font-semibold hover:file:bg-civic-100"
            />
          </div>

          {/* Previews */}
          {imagePreviews.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
              {imagePreviews.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Preview ${i}`}
                  className="w-20 h-20 object-cover rounded-xl border border-slate-200 shadow-sm shrink-0"
                />
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            CivicTrack will perform duplicate verification before creating a new ticket.
          </p>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-civic-600 hover:bg-civic-700 text-white font-bold text-xs shadow-md shadow-civic-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
          >
            {loading ? 'Verifying...' : 'Submit Complaint'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Duplicate Suggestion Modal (Section 5 Feature 1B) */}
      {showDuplicateModal && (
        <DuplicateSuggestionModal
          matches={duplicateMatches}
          onConfirmExisting={(issueId) => executeSubmission(issueId)}
          onProceedAsDifferent={() => executeSubmission(null)}
          onCancel={() => setShowDuplicateModal(false)}
        />
      )}
    </div>
  );
};
