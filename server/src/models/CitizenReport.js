import mongoose from 'mongoose';

const citizenReportSchema = new mongoose.Schema(
  {
    report_code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    shared_issue_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SharedIssue',
      default: null,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    severity: {
      type: String,
      default: 'Medium'
    },
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      default: 'Pending',
      index: true
    },
    similarity_match_score: {
      type: Number,
      default: null
    },
    link_type: {
      type: String,
      required: true,
      enum: ['original', 'confirmed_duplicate', 'admin_merged'],
      default: 'original',
      index: true
    },
    legacy_id: {
      type: Number,
      index: true
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

citizenReportSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const CitizenReport = mongoose.models.CitizenReport || mongoose.model('CitizenReport', citizenReportSchema);
export default CitizenReport;
