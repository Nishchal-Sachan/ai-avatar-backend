import mongoose from "mongoose";

const avatarSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    persona: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    defaultLanguage: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    voiceId: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    appearance: {
      type: Object,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false },
);

avatarSchema.index({ createdBy: 1 });

const Avatar = mongoose.model("Avatar", avatarSchema);

export default Avatar;
