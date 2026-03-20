import mongoose from "mongoose";

const appearanceSchema = new mongoose.Schema(
  {
    eyeColor: { type: String, trim: true },
    skinTone: { type: String, trim: true },
    hairStyle: { type: String, trim: true },
    hairColor: { type: String, trim: true },
    outfit: { type: String, trim: true },
    accessories: [{ type: String, trim: true }],
    height: { type: Number },
  },
  { _id: false }
);

const avatarSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
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
      type: appearanceSchema,
      default: () => ({}),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

avatarSchema.index({ createdBy: 1 });

const Avatar = mongoose.model("Avatar", avatarSchema);

export default Avatar;
