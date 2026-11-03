import mongoose from 'mongoose';

const infrastructureAssetSchema = new mongoose.Schema(
  {
    asset_code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    installation_date: {
      type: String,
      default: null
    },
    last_inspected_at: {
      type: Date,
      default: null
    },
    current_health_status: {
      type: String,
      required: true,
      enum: ['good', 'monitoring', 'warning', 'critical'],
      default: 'good',
      index: true
    },
    risk_score: {
      type: Number,
      required: true,
      default: 10,
      index: true
    },
    risk_level: {
      type: String,
      required: true,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Low',
      index: true
    },
    risk_reasons: {
      type: [String],
      default: []
    },
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true
    },
    is_demo: {
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

infrastructureAssetSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const InfrastructureAsset = mongoose.models.InfrastructureAsset || mongoose.model('InfrastructureAsset', infrastructureAssetSchema);
export default InfrastructureAsset;
