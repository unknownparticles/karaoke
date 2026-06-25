import { ChordItem, LyricLine, Song } from '../types';

// Web Audio API K-Song Engine
export class KSongEngine {
  public ctx: AudioContext | null = null;
  
  // Audio Nodes
  private vocalSource: MediaStreamAudioSourceNode | null = null;
  private vocalGain: GainNode | null = null;
  private vocalReverb: ConvolverNode | null = null;
  private vocalReverbGain: GainNode | null = null;
  private vocalDelay: DelayNode | null = null;
  private vocalDelayFeedback: GainNode | null = null;
  private vocalDelayGain: GainNode | null = null;
  
  // Accompaniment Nodes
  private accompSource: AudioBufferSourceNode | null = null;
  private accompAudioElement: HTMLAudioElement | null = null;
  private accompMediaSource: MediaElementAudioSourceNode | null = null;
  private accompGain: GainNode | null = null;
  
  // Vocal Reduction (Karaoke DSP) nodes
  private splitter: ChannelSplitterNode | null = null;
  private leftGain: GainNode | null = null;
  private rightGain: GainNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private vocalReducerActive: boolean = false;

  // Master output mixed destination (for recording)
  private mixDestination: GainNode | null = null;
  
  // Real-time analyzers for visualizers
  public vocalAnalyser: AnalyserNode | null = null;
  public accompAnalyser: AnalyserNode | null = null;
  
  // Microphone Stream
  private micStream: MediaStream | null = null;
  
  // MIDI Backing Track Synthesizer state
  private isSynthPlaying: boolean = false;
  private currentSong: Song | null = null;
  private synthInterval: any = null;
  private beatCount: number = 0;
  private bpm: number = 90;
  private chordTimeline: { time: number; chord: string }[] = [];
  private lastTriggeredTime: number = -1;
  private synthStartTime: number = 0;
  private synthPauseOffset: number = 0;

  // Recorder State
  private recorderNode: ScriptProcessorNode | null = null;
  private leftChannelBuffer: Float32Array[] = [];
  private rightChannelBuffer: Float32Array[] = [];
  private isRecording: boolean = false;
  private recordingStartTime: number = 0;
  private recordedSeconds: number = 0;
  private recordingInterval: any = null;

  // Callbacks
  public onRecordingProgress: ((seconds: number) => void) | null = null;
  public onSynthChordChange: ((chord: string) => void) | null = null;

  constructor() {}

  async init() {
    if (this.ctx) return;
    
    // Create audio context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass({ sampleRate: 44100 });
    
    // Create master mix destination node (used to record vocal + accompaniment)
    this.mixDestination = this.ctx.createGain();
    this.mixDestination.gain.value = 1.0;
    
    // Setup Vocal Gain node (microphone monitoring to speakers)
    this.vocalGain = this.ctx.createGain();
    this.vocalGain.gain.value = 0.8;
    
    // Setup Reverb Node
    this.vocalReverb = this.ctx.createConvolver();
    this.vocalReverb.buffer = this.createReverbImpulseResponse(this.ctx, 2.5, 2.0);
    this.vocalReverbGain = this.ctx.createGain();
    this.vocalReverbGain.gain.value = 0.35; // Wet volume default
    
    // Setup Delay/Echo Node
    this.vocalDelay = this.ctx.createDelay(1.0);
    this.vocalDelay.delayTime.value = 0.35; // 350ms echo
    this.vocalDelayFeedback = this.ctx.createGain();
    this.vocalDelayFeedback.gain.value = 0.30; // 30% echo feedback
    this.vocalDelayGain = this.ctx.createGain();
    this.vocalDelayGain.gain.value = 0.25; // Echo volume default
    
    // Setup Echo Feedback loop
    this.vocalDelay.connect(this.vocalDelayFeedback);
    this.vocalDelayFeedback.connect(this.vocalDelay);
    
    // Setup Vocal Analyser
    this.vocalAnalyser = this.ctx.createAnalyser();
    this.vocalAnalyser.fftSize = 256;
    
    // Setup Accompaniment Gain & Analyser
    this.accompGain = this.ctx.createGain();
    this.accompGain.gain.value = 0.7;
    
    this.accompAnalyser = this.ctx.createAnalyser();
    this.accompAnalyser.fftSize = 256;
    
    // Connect Accompaniment chain to master output and mix node
    this.accompGain.connect(this.accompAnalyser);
    this.accompAnalyser.connect(this.ctx.destination);
    this.accompAnalyser.connect(this.mixDestination);
    
    // Connect Master mix destination to master speakers (normally, recorder gets the mix, speakers get it naturally)
    // Wait, if we connect mixDestination to ctx.destination, we would duplicate accompaniment sound.
    // So mixDestination acts solely as the RECORDING capture point where vocal + accompaniment are summed.
  }

  // Set Vocal Effect volumes (0.0 to 1.0)
  setVocalVolume(volume: number) {
    if (this.vocalGain) this.vocalGain.gain.value = volume;
  }

  setAccompVolume(volume: number) {
    if (this.accompGain) this.accompGain.gain.value = volume;
  }

  setReverbVolume(volume: number) {
    if (this.vocalReverbGain) this.vocalReverbGain.gain.value = volume;
  }

  setDelayVolume(volume: number) {
    if (this.vocalDelayGain) this.vocalDelayGain.gain.value = volume;
  }

  toggleVocalReducer(active: boolean) {
    this.vocalReducerActive = active;
    if (this.accompAudioElement && this.accompMediaSource && this.ctx) {
      this.setupVocalCancellationGraph();
    }
  }

  // Generate an algorithmic reverb buffer
  private createReverbImpulseResponse(ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    
    for (let i = 0; i < length; i++) {
      const percent = i / length;
      const val = (Math.random() * 2 - 1) * Math.pow(1 - percent, decay);
      left[i] = val;
      // Slightly decorrelate right channel for lush stereophonic spaciousness
      right[i] = val * (Math.random() > 0.45 ? 1 : -1) * 0.95;
    }
    return impulse;
  }

  // Setup Microphone input stream & monitoring
  async startMicrophone() {
    await this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.vocalSource = this.ctx.createMediaStreamSource(this.micStream);
      
      // Connect Microphone to vocal analyser and gains
      this.vocalSource.connect(this.vocalAnalyser!);
      
      // Setup Vocal monitor route: Mic -> VocalGain -> Vocal Analyser -> Speakers
      // Reverb routing: Mic -> Reverb -> ReverbGain -> Speakers & Mix
      this.vocalSource.connect(this.vocalGain!);
      this.vocalGain.connect(this.ctx.destination);
      this.vocalGain.connect(this.mixDestination!);
      
      // Delay routing
      this.vocalSource.connect(this.vocalDelay!);
      this.vocalDelay.connect(this.vocalDelayGain!);
      this.vocalDelayGain.connect(this.ctx.destination);
      this.vocalDelayGain.connect(this.mixDestination!);
      
      // Reverb routing
      this.vocalSource.connect(this.vocalReverb!);
      this.vocalReverb.connect(this.vocalReverbGain!);
      this.vocalReverbGain.connect(this.ctx.destination);
      this.vocalReverbGain.connect(this.mixDestination!);
      
    } catch (err) {
      console.error('Error opening microphone:', err);
      throw err;
    }
  }

  stopMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.vocalSource) {
      this.vocalSource.disconnect();
      this.vocalSource = null;
    }
  }

  // Accompaniment Playback (for custom uploaded audio file)
  playAudioFile(file: File) {
    this.stopAccompaniment();
    const url = URL.createObjectURL(file);
    
    this.accompAudioElement = new Audio(url);
    this.accompAudioElement.loop = false;
    
    this.accompAudioElement.onplay = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    };

    if (this.ctx) {
      this.accompMediaSource = this.ctx.createMediaElementSource(this.accompAudioElement);
      this.setupVocalCancellationGraph();
    }
    
    this.accompAudioElement.play();
  }

  // Setup the audio routing graph, implementing direct DSP center-vocal cancellation if active
  private setupVocalCancellationGraph() {
    if (!this.ctx || !this.accompMediaSource || !this.accompGain) return;

    // Disconnect existing
    try {
      this.accompMediaSource.disconnect();
      if (this.leftGain) this.leftGain.disconnect();
      if (this.rightGain) this.rightGain.disconnect();
      if (this.splitter) this.splitter.disconnect();
      if (this.merger) this.merger.disconnect();
    } catch (e) {}

    if (this.vocalReducerActive) {
      // Core DSP Mid-Side processing: L - R cancels center (vocals)
      this.splitter = this.ctx.createChannelSplitter(2);
      this.leftGain = this.ctx.createGain();
      this.rightGain = this.ctx.createGain();
      this.merger = this.ctx.createChannelMerger(2);

      // Left gain keeps phase normal
      this.leftGain.gain.value = 1.0;
      // Right gain inverts phase!
      this.rightGain.gain.value = -1.0;

      // Connect source to splitter
      this.accompMediaSource.connect(this.splitter);

      // L channel to leftGain, R channel to rightGain
      this.splitter.connect(this.leftGain, 0); // L
      this.splitter.connect(this.rightGain, 1); // R

      // Mix L and inverted R back to both Left and Right output channels to make mono L-R
      this.leftGain.connect(this.merger, 0, 0); // L -> L Output
      this.leftGain.connect(this.merger, 0, 1); // L -> R Output
      this.rightGain.connect(this.merger, 0, 0); // -R -> L Output
      this.rightGain.connect(this.merger, 0, 1); // -R -> R Output

      // Connect merger output to master accompaniment gain
      this.merger.connect(this.accompGain);
    } else {
      // Standard stereo connection
      this.accompMediaSource.connect(this.accompGain);
    }
  }

  // Get current play timestamp
  getCurrentTime(): number {
    if (this.accompAudioElement) {
      return this.accompAudioElement.currentTime;
    }
    if (this.isSynthPlaying) {
      return (Date.now() - this.synthStartTime) / 1000;
    }
    if (this.isRecording) {
      return (Date.now() - this.recordingStartTime) / 1000;
    }
    return 0;
  }

  pauseAccompaniment() {
    if (this.accompAudioElement) {
      this.accompAudioElement.pause();
    }
    if (this.isSynthPlaying) {
      this.synthPauseOffset = (Date.now() - this.synthStartTime) / 1000;
      this.stopBackingSynth();
    }
  }

  resumeAccompaniment() {
    if (this.accompAudioElement) {
      this.accompAudioElement.play();
    }
    if (this.currentSong && !this.isSynthPlaying) {
      this.startBackingSynth(this.currentSong);
    }
  }

  seekAccompaniment(seconds: number) {
    if (this.accompAudioElement) {
      this.accompAudioElement.currentTime = seconds;
    }
    if (this.isSynthPlaying) {
      this.synthStartTime = Date.now() - (seconds * 1000);
      this.synthPauseOffset = seconds;
    }
  }

  stopAccompaniment() {
    if (this.accompAudioElement) {
      this.accompAudioElement.pause();
      this.accompAudioElement.src = '';
      this.accompAudioElement = null;
    }
    if (this.accompMediaSource) {
      this.accompMediaSource.disconnect();
      this.accompMediaSource = null;
    }
    this.synthPauseOffset = 0;
    this.stopBackingSynth();
  }

  // Dynamic Synthesizer Backing Band Playback Engine (for songs without files or for live performance!)
  startBackingSynth(song: Song) {
    this.currentSong = song;
    this.bpm = song.bpm || 90;
    this.isSynthPlaying = true;
    this.beatCount = 0;
    this.lastTriggeredTime = -1;
    
    if (this.synthPauseOffset > 0) {
      this.synthStartTime = Date.now() - (this.synthPauseOffset * 1000);
    } else {
      this.synthStartTime = Date.now();
    }
    
    // Compile chord timeline based on synchronized lyrics
    const timeline: { time: number; chord: string }[] = [];
    song.lyrics.forEach(line => {
      line.chords.forEach(c => {
        timeline.push({
          time: line.time, // Wait, chord is linked to line's absolute timestamp
          chord: c.chord,
        });
      });
    });
    
    // Sort timeline by timestamp
    this.chordTimeline = timeline.sort((a, b) => a.time - b.time);

    // Dynamic scheduler interval (ticks every 1/16th note, or simple beat tick)
    const intervalSec = 60 / this.bpm / 4; // 16th note tick duration
    const intervalMs = intervalSec * 1000;
    
    if (this.synthInterval) clearInterval(this.synthInterval);
    
    const startTime = this.ctx?.currentTime || 0;
    
    this.synthInterval = setInterval(() => {
      if (!this.ctx || !this.isSynthPlaying) return;
      
      const currentTime = this.getCurrentTime();
      
      // Determine what chord to play at this time
      let activeChord = 'C';
      for (const item of this.chordTimeline) {
        if (currentTime >= item.time) {
          activeChord = item.chord;
        } else {
          break;
        }
      }

      // Check if beat has changed (quarter notes)
      const beatInterval = 60 / this.bpm;
      const currentBeatIdx = Math.floor(currentTime / beatInterval);
      
      if (currentBeatIdx !== this.lastTriggeredTime) {
        this.lastTriggeredTime = currentBeatIdx;
        this.playSynthBeat(activeChord, currentBeatIdx);
        if (this.onSynthChordChange) {
          this.onSynthChordChange(activeChord);
        }
      }
    }, 50);
  }

  stopBackingSynth() {
    this.isSynthPlaying = false;
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }

  // Play a single rhythmic beat of the selected chord using Web Audio oscillators
  private playSynthBeat(chord: string, beatIdx: number) {
    if (!this.ctx || !this.accompGain) return;
    
    const time = this.ctx.currentTime;
    const chordNotes = this.getNotesForChord(chord);
    
    // PIANO CHORD SYNTHESIS (Warm triangle pads)
    // Plays chord notes on Beat 1 (long sustain) or Beat 1, 2, 3, 4 (soft rhythmic pulses)
    const isMainBeat = beatIdx % 4 === 0;
    const isQuarterBeat = beatIdx % 2 === 0;
    
    if (isQuarterBeat) {
      chordNotes.piano.forEach((midi, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.type = 'triangle';
        osc.frequency.value = this.midiToFreq(midi);
        
        const sustain = isMainBeat ? 1.2 : 0.45;
        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.08, time + 0.05); // Attack
        gain.gain.exponentialRampToValueAtTime(0.0001, time + sustain); // Decay/Release
        
        osc.connect(gain);
        gain.connect(this.accompGain!);
        
        osc.start(time);
        osc.stop(time + sustain);
      });
    }

    // BASS SYNTHESIS (Deep sine waves on beats 1 and 3)
    if (beatIdx % 2 === 0) {
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      
      bassOsc.type = 'sine';
      bassOsc.frequency.value = this.midiToFreq(chordNotes.bass);
      
      bassGain.gain.setValueAtTime(0.0, time);
      bassGain.gain.linearRampToValueAtTime(0.25, time + 0.02);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.8);
      
      bassOsc.connect(bassGain);
      bassGain.connect(this.accompGain!);
      
      bassOsc.start(time);
      bassOsc.stop(time + 0.8);
    }

    // SYNTHETIC DRUM GROOVE
    // Kick on Beat 1 and 3
    if (beatIdx % 2 === 0) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      
      kickOsc.frequency.setValueAtTime(150, time);
      kickOsc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
      
      kickGain.gain.setValueAtTime(0.4, time);
      kickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
      
      kickOsc.connect(kickGain);
      kickGain.connect(this.accompGain!);
      
      kickOsc.start(time);
      kickOsc.stop(time + 0.15);
    }

    // Snare on Beat 2 and 4
    if (beatIdx % 4 === 1 || beatIdx % 4 === 3) {
      // Noise buffer for snare snap
      const bufferSize = this.ctx.sampleRate * 0.15;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      
      const snareNoise = this.ctx.createBufferSource();
      snareNoise.buffer = noiseBuffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;
      
      const snareGain = this.ctx.createGain();
      snareGain.gain.setValueAtTime(0.18, time);
      snareGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
      
      snareNoise.connect(filter);
      filter.connect(snareGain);
      snareGain.connect(this.accompGain!);
      
      snareNoise.start(time);
      snareNoise.stop(time + 0.15);
    }
  }

  // Map chord name to specific Bass and Piano MIDI notes
  private getNotesForChord(chord: string): { bass: number; piano: number[] } {
    const clean = chord.trim().split('/')[0].replace(/7|maj7|add9|m7|sus4/g, '');
    
    // Root MIDI maps
    const roots: { [key: string]: number } = {
      'C': 36, 'C#': 37, 'Db': 37, 'D': 38, 'D#': 39, 'Eb': 39,
      'E': 40, 'F': 41, 'F#': 42, 'Gb': 42, 'G': 43, 'G#': 44,
      'Ab': 44, 'A': 45, 'A#': 46, 'Bb': 46, 'B': 47,
      'Cm': 36, 'C#m': 37, 'Dbm': 37, 'Dm': 38, 'D#m': 39, 'Ebm': 39,
      'Em': 40, 'Fm': 41, 'F#m': 42, 'Gbm': 42, 'Gm': 43, 'G#m': 44,
      'Am': 45, 'A#m': 46, 'Bbm': 46, 'Bm': 47
    };

    const root = roots[clean] || 48; // Default C
    const isMinor = clean.endsWith('m') || chord.includes('m7') || chord.includes('Am');
    
    // Triad offsets
    const pianoNotes = [
      root + 12 + 12, // Root octave up
      root + 12 + 12 + (isMinor ? 3 : 4), // Third
      root + 12 + 12 + 7, // Fifth
    ];

    return {
      bass: root, // Low root note
      piano: pianoNotes,
    };
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // HIGH-QUALITY WAV RECORDING ENGINE (Via ScriptProcessorNode)
  async startRecording() {
    await this.init();
    if (!this.ctx || !this.mixDestination) return;

    // Reset buffers
    this.leftChannelBuffer = [];
    this.rightChannelBuffer = [];
    this.isRecording = true;
    this.recordedSeconds = 0;
    this.recordingStartTime = Date.now();

    // Create a script processor to intercept the audio mixed buffer
    this.recorderNode = this.ctx.createScriptProcessor(4096, 2, 2);
    
    // Capture from mixDestination (which mixes vocal & accompaniment)
    this.mixDestination.connect(this.recorderNode);
    // Connect processor to destination so it gets processed, but mute the direct output of processor so it doesn't feed back
    const muteNode = this.ctx.createGain();
    muteNode.gain.value = 0.0;
    this.recorderNode.connect(muteNode);
    muteNode.connect(this.ctx.destination);

    this.recorderNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const left = e.inputBuffer.getChannelData(0);
      const right = e.inputBuffer.getChannelData(1);
      
      // Store samples clone
      this.leftChannelBuffer.push(new Float32Array(left));
      this.rightChannelBuffer.push(new Float32Array(right));
    };

    // Update duration timer
    this.recordingInterval = setInterval(() => {
      this.recordedSeconds = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      if (this.onRecordingProgress) {
        this.onRecordingProgress(this.recordedSeconds);
      }
    }, 1000);
  }

  stopRecording(): { blob: Blob; url: string; duration: number } | null {
    this.isRecording = false;
    
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    if (this.recorderNode && this.mixDestination) {
      try {
        this.mixDestination.disconnect(this.recorderNode);
        this.recorderNode.disconnect();
      } catch (e) {}
      this.recorderNode = null;
    }

    if (this.leftChannelBuffer.length === 0) return null;

    // Flatten channels
    const leftFlat = this.mergeBuffers(this.leftChannelBuffer);
    const rightFlat = this.mergeBuffers(this.rightChannelBuffer);
    
    // Encode to uncompressed high-quality 16-bit PCM Stereo WAV
    const wavBlob = this.encodeWAV(leftFlat, rightFlat, 44100);
    const wavUrl = URL.createObjectURL(wavBlob);
    const duration = this.recordedSeconds;

    return {
      blob: wavBlob,
      url: wavUrl,
      duration,
    };
  }

  private mergeBuffers(channelBuffer: Float32Array[]): Float32Array {
    let resultLength = 0;
    channelBuffer.forEach(buf => resultLength += buf.length);
    const result = new Float32Array(resultLength);
    let offset = 0;
    channelBuffer.forEach(buf => {
      result.set(buf, offset);
      offset += buf.length;
    });
    return result;
  }

  // Create a proper CD-Quality 16-bit PCM WAV File Blob
  private encodeWAV(leftChannel: Float32Array, rightChannel: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + leftChannel.length * 2 * 2);
    const view = new DataView(buffer);

    /* RIFF identifier */
    this.writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + leftChannel.length * 2 * 2, true);
    /* RIFF type */
    this.writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    this.writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw PCM) */
    view.setUint16(20, 1, true);
    /* channel count (stereo) */
    view.setUint16(22, 2, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 4, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 4, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    this.writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, leftChannel.length * 2 * 2, true);

    // Write interleaved PCM samples
    let offset = 44;
    for (let i = 0; i < leftChannel.length; i++) {
      // Left channel clip & scale
      let lSample = leftChannel[i];
      if (lSample > 1) lSample = 1;
      else if (lSample < -1) lSample = -1;
      view.setInt16(offset, lSample < 0 ? lSample * 0x8000 : lSample * 0x7FFF, true);
      offset += 2;

      // Right channel clip & scale
      let rSample = rightChannel[i];
      if (rSample > 1) rSample = 1;
      else if (rSample < -1) rSample = -1;
      view.setInt16(offset, rSample < 0 ? rSample * 0x8000 : rSample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // Cleanup completely on component unmount
  destroy() {
    this.stopAccompaniment();
    this.stopMicrophone();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
