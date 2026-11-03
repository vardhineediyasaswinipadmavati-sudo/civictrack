import mongoose from 'mongoose';

const repairRecordSchema = new mongoose.Schema(
  {
    repair_code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    infrastructure_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InfrastructureAsset',
      required: true,
      index: true
    },
    incident_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InfrastructureIncident',
      default: null,
      index: true
    },
    shared_issue_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SharedIssue',
      default: null,
      index: true
    },
    repaired_by_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true
    },
    repair_type: {
      type: String,
      required: true,
      enum: ['temporary', 'permanent', 'inspection_only', 'no_fault'],
      index: true
    },
    cost_amount: {
      type: Number,
      default: null
    },
    cost_unavailable: {
      type: Boolean,
      default: false
    },
    materials_used: {
      type: String,
      default: null
    },
    work_summary: {
      type: String,
      required: true,
      trim: true
    },
    completed_at: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    next_inspection_due: {
      type: Date,
      default: null
    },
    recurrence_observed: {
      type: Boolean,
      default: false,
      index: true
    },
    days_until_next_incident: {
      type: Number,
      default: null
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

repairRecordSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const RepairRecord = mongoose.models.RepairRecord || mongoose.model('RepairRecord', repairRecordSchema);
export default RepairRecord;
