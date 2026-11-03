import mongoose from 'mongoose';

const citizenVerificationSchema = new mongoose.Schema(
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
    is_effective: {
      type: Boolean,
      required: true
    },
    feedback: {
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

citizenVerificationSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const CitizenVerification = mongoose.models.CitizenVerification || mongoose.model('CitizenVerification', citizenVerificationSchema);
export default CitizenVerification;
