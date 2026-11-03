import mongoose from 'mongoose';

const passwordResetSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    token_hash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    expires_at: {
      type: Date,
      required: true,
      index: true
    },
    used_at: {
      type: Date,
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

passwordResetSchema.virtual('id').get(function () {
  return this._id.toString();
});

passwordResetSchema.virtual('isUsed').get(function () {
  return this.used_at != null;
});

passwordResetSchema.virtual('isExpired').get(function () {
  return this.expires_at < new Date();
});

export const PasswordReset = mongoose.models.PasswordReset || mongoose.model('PasswordReset', passwordResetSchema);
export default PasswordReset;
