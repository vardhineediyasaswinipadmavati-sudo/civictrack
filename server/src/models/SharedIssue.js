import mongoose from 'mongoose';

const sharedIssueSchema = new mongoose.Schema(
  {
    issue_code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
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
      required: true,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium'
    },
    priority_score: {
      type: Number,
      required: true,
      default: 50,
      index: true
    },
    is_safety_critical: {
      type: Boolean,
      default: false,
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Approved', 'Rejected', 'Reopened', 'Escalated'],
      default: 'Pending',
      index: true
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
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true
    },
    infrastructure_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InfrastructureAsset',
      default: null,
      index: true
    },
    incident_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InfrastructureIncident',
      default: null
    },
    assigned_to_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    estimated_affected_population: {
      type: Number,
      default: 0
    },
    affected_population_details: {
      type: String,
      default: null
    },
    first_reported_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    latest_reported_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    resolved_at: {
      type: Date,
      default: null
    },
    resolution_notes: {
      type: String,
      default: null
    },
    resolution_type: {
      type: String,
      enum: ['temporary', 'permanent', 'inspection_only', 'no_fault', null],
      default: null
    },
    approved_at: {
      type: Date,
      default: null,
      index: true
    },
    approved_by_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    approval_notes: {
      type: String,
      default: null
    },
    rejected_at: {
      type: Date,
      default: null
    },
    rejected_by_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    rejection_reason: {
      type: String,
      default: null
    },
    is_merged_into_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SharedIssue',
      default: null,
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

sharedIssueSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const SharedIssue = mongoose.models.SharedIssue || mongoose.model('SharedIssue', sharedIssueSchema);
export default SharedIssue;
