import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    questionLanguage: {
      type: String,
      default: 'unknown',
    },
    answer: {
      type: String,
      required: true,
    },
    answerLanguage: {
      type: String,
      default: 'en',
    },
    audioUrl: {
      type: String,
    },
    executionTimeMs: {
      type: Number,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

conversationSchema.index({ userId: 1, createdAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
