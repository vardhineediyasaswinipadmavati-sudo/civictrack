import mongoose from 'mongoose';

const reportImageSchema = new mongoose.Schema(
  {
    report_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CitizenReport',
      default: null,
      index: true
    },
    shared_issue_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SharedIssue',
      default: null,
      index: true
    },
    repair_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RepairRecord',
      default: null,
      index: true
    },
    image_url: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      default: null
    },
    image_type: {
      type: String,
      required: true,
      enum: ['evidence', 'before_repair', 'after_repair'],
      default: 'evidence',
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

reportImageSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const ReportImage = mongoose.models.ReportImage || mongoose.model('ReportImage', reportImageSchema);
export default ReportImage;
