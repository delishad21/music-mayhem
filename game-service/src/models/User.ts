import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  username: string;
  displayName?: string;
  password: string;
  isGuest?: boolean;
  createdAt: Date;
  sessionHistory: Array<{
    gameMode: string;
    score: number;
    date: Date;
    roomCode: string;
  }>;
}

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },
  displayName: {
    type: String,
    trim: true,
    minlength: 2,
    maxlength: 20,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  isGuest: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  sessionHistory: [{
    gameMode: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    roomCode: {
      type: String,
      required: true,
    },
  }],
});

export default mongoose.model<IUser>('User', UserSchema);
