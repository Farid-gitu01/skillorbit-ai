import mongoose, { type Document, Schema } from 'mongoose';

export type AiChatTopic = 'general' | 'resume' | 'skills' | 'interview' | 'job_search';

export interface IAiChatMessageEntry {
  _id?: mongoose.Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface IAiConversation extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  topic: AiChatTopic;
  messages: IAiChatMessageEntry[];
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const aiChatMessageSchema = new Schema<IAiChatMessageEntry>(
  {
    role: { type: String, enum: ['user', 'assistant'] as const, required: true },
    content: { type: String, required: true, maxlength: 6000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const aiConversationSchema = new Schema<IAiConversation>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    topic: {
      type: String,
      enum: ['general', 'resume', 'skills', 'interview', 'job_search'] as const,
      default: 'general',
    },
    messages: { type: [aiChatMessageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

aiConversationSchema.index({ user: 1, lastMessageAt: -1 });
aiConversationSchema.index({ user: 1, createdAt: -1 });

export const AiConversation = mongoose.model<IAiConversation>(
  'AiConversation',
  aiConversationSchema
);
