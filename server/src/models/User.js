import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    password_hash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: ['citizen', 'admin', 'department_staff', 'staff'],
      default: 'citizen',
      set: (v) => (v === 'staff' ? 'department_staff' : v),
      index: true
    },
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true
    },
    phone: {
      type: String,
      trim: true,
      default: null
    },
    is_active: {
      type: Boolean,
      default: true
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

userSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
