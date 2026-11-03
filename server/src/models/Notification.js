import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    link_url: {
      type: String,
      default: null
    },
    is_read: {
      type: Boolean,
      default: false,
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

notificationSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
