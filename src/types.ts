export interface ChordItem {
  offset: number; // Character index in the lyric line where this chord starts
  chord: string;  // e.g., "C", "G/B", "Am7"
}

export interface LyricLine {
  time: number;       // Timestamp in seconds
  text: string;       // Clean text without chord brackets
  originalText?: string; // Text containing brackets like [C]
  chords: ChordItem[]; // Chords extracted with their offsets
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  lyrics: LyricLine[];
  type: 'preset' | 'custom';
  audioUrl?: string; // URL or blob URL if custom file uploaded
  duration?: number;
  hasCustomAudio?: boolean;
}

export interface RecordingSession {
  id: string;
  songId: string;
  songTitle: string;
  timestamp: string;
  duration: number;
  audioUrl: string; // Blob URL to recorded WAV
  blob: Blob;
}
