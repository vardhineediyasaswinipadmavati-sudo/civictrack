import mongoose from 'mongoose';

const issueFollowSchema = new mongoose.Schema(
  {
    shared_issue_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SharedIssue',
      required: true,
      index: true
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

issueFollowSchema.index({ shared_issue_id: 1, user_id: 1 }, { unique: true });

issueFollowSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const IssueFollow = mongoose.models.IssueFollow || mongoose.model('IssueFollow', issueFollowSchema);
export default IssueFollow;
