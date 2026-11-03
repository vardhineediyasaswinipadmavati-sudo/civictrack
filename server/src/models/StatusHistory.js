import mongoose from 'mongoose';

const statusHistorySchema = new mongoose.Schema(
  {
    shared_issue_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SharedIssue',
      required: true,
      index: true
    },
    old_status: {
      type: String,
      required: true
    },
    new_status: {
      type: String,
      required: true
    },
    changed_by_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    comments: {
      type: String,
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

statusHistorySchema.virtual('id').get(function () {
  return this._id.toString();
});

export const StatusHistory = mongoose.models.StatusHistory || mongoose.model('StatusHistory', statusHistorySchema);
export default StatusHistory;
