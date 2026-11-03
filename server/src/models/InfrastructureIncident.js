import mongoose from 'mongoose';

const infrastructureIncidentSchema = new mongoose.Schema(
  {
    incident_code: {
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
    shared_issue_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SharedIssue',
      default: null,
      index: true
    },
    incident_type: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    started_at: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    resolved_at: {
      type: Date,
      default: null
    },
    recurrence_sequence: {
      type: Number,
      required: true,
      default: 1
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

infrastructureIncidentSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const InfrastructureIncident = mongoose.models.InfrastructureIncident || mongoose.model('InfrastructureIncident', infrastructureIncidentSchema);
export default InfrastructureIncident;
