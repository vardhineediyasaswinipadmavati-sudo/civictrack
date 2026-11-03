import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    contact_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    sla_hours: {
      type: Number,
      required: true,
      default: 72
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

departmentSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const Department = mongoose.models.Department || mongoose.model('Department', departmentSchema);
export default Department;
