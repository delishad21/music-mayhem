import mongoose, { Document, Schema } from 'mongoose';

export interface ILyricLine {
  time: number;
  text: string;
}

export interface ISong extends Document {
  title: string;
  artist: string;
  audioPath: string;
  lyricsPath?: string;
  duration: number;
  lyricLines: ILyricLine[];
  lyricsSource?: string;
  albumArtUrl?: string;
  sourceUrl: string;
  createdAt: Date;
}

const SongSchema = new Schema<ISong>({
  title: {
    type: String,
    required: true,
  },
  artist: {
    type: String,
    required: true,
  },
  audioPath: {
    type: String,
    required: true,
  },
  lyricsPath: {
    type: String,
  },
  duration: {
    type: Number,
    required: true,
  },
  lyricLines: [{
    time: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
  }],
  lyricsSource: {
    type: String,
  },
  albumArtUrl: {
    type: String,
  },
  sourceUrl: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model<ISong>('Song', SongSchema);
