import React, { useState, useEffect, useRef } from 'react';
import { Song, RecordingSession } from './types';
import { PRESET_SONGS } from './data/presets';
import { KSongEngine } from './utils/audioEngine';
import SongSelector from './components/SongSelector';
import Prompter from './components/Prompter';
import RecordingConsole from './components/RecordingConsole';
import Visualizer from './components/Visualizer';
import InstrumentStudio from './components/InstrumentStudio';
import { Disc, HelpCircle, Info, Sparkles, Mic2, Sliders, Radio } from 'lucide-react';

export default function App() {
  const [songs, setSongs] = useState<Song[]>(PRESET_SONGS);
  const [selectedSong, setSelectedSong] = useState<Song>(PRESET_SONGS.find(s => s.id === '4') || PRESET_SONGS[0]);
  
  // Dashboard view toggle: 'karaoke' vs 'studio'
  const [activeView, setActiveView] = useState<'karaoke' | 'studio'>('studio'); // Default to studio to highlight user's new custom feature!
  
  // Audio state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChord, setCurrentChord] = useState('C');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  
  // Custom audio file states
  const [hasCustomAudio, setHasCustomAudio] = useState(false);
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioName, setCustomAudioName] = useState('');
  const [vocalReducerActive, setVocalReducerActive] = useState(false);
  const [bgmMode, setBgmMode] = useState<'synthetic' | 'original'>('synthetic');

  // Audio Mixer parameters
  const [vocalVol, setVocalVol] = useState(0.8);
  const [accompVol, setAccompVol] = useState(0.7);
  const [reverbVol, setReverbVol] = useState(0.3);
  const [delayVol, setDelayVol] = useState(0.2);

  // Recordings Library
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);

  // Analyser nodes for Canvas visualizer
  const [vocalAnalyser, setVocalAnalyser] = useState<AnalyserNode | null>(null);
  const [accompAnalyser, setAccompAnalyser] = useState<AnalyserNode | null>(null);

  // Audio Engine Ref
  const engineRef = useRef<KSongEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Refs to prevent stale closure issues in requestAnimationFrame loop
  const isPlayingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const selectedSongRef = useRef(selectedSong);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    selectedSongRef.current = selectedSong;
  }, [selectedSong]);

  // Create & initialize engine on mount
  useEffect(() => {
    const engine = new KSongEngine();
    engineRef.current = engine;

    // Connect chord changes from backing synth to UI state
    engine.onSynthChordChange = (chord) => {
      setCurrentChord(chord);
    };

    // Connect recording stopwatch
    engine.onRecordingProgress = (seconds) => {
      setRecordingSeconds(seconds);
    };

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      engine.destroy();
    };
  }, []);

  // Sync mixing controls with Audio Engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setVocalVolume(vocalVol);
    }
  }, [vocalVol]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setAccompVolume(accompVol);
    }
  }, [accompVol]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setReverbVolume(reverbVol);
    }
  }, [reverbVol]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setDelayVolume(delayVol);
    }
  }, [delayVol]);

  // Synchronize dynamic scrolling animation when playing or recording
  const updatePlaybackProgress = () => {
    if (!engineRef.current) return;
    
    const curr = engineRef.current.getCurrentTime();
    setCurrentTime(curr);

    // End playback when reaching song limit
    const lastLyricLine = selectedSongRef.current.lyrics[selectedSongRef.current.lyrics.length - 1];
    const duration = selectedSongRef.current.duration || (lastLyricLine ? lastLyricLine.time + 10 : 120);
    
    if (curr >= duration) {
      handleResetPlayback();
      return;
    }

    if (isPlayingRef.current || isRecordingRef.current) {
      animationFrameRef.current = requestAnimationFrame(updatePlaybackProgress);
    }
  };

  // Toggle Play / Pause Accompaniment
  const handlePlayToggle = async () => {
    if (!engineRef.current) return;

    if (isPlayingRef.current) {
      // Pause
      engineRef.current.pauseAccompaniment();
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      // Start/Resume
      await engineRef.current.init();
      
      // Setup Analysers for Visualizer
      setVocalAnalyser(engineRef.current.vocalAnalyser);
      setAccompAnalyser(engineRef.current.accompAnalyser);

      if (bgmMode === 'original' && hasCustomAudio && customAudioFile) {
        // If there's an uploaded file and BGM mode is set to original audio
        if (!engineRef.current.getCurrentTime()) {
          engineRef.current.playAudioFile(customAudioFile);
        } else {
          engineRef.current.resumeAccompaniment();
        }
      } else {
        // Play synthetic backing chord synthesizer! (Intelligently adapts to chords)
        engineRef.current.startBackingSynth(selectedSong);
      }

      setIsPlaying(true);
      isPlayingRef.current = true;
      animationFrameRef.current = requestAnimationFrame(updatePlaybackProgress);
    }
  };

  // Reset current playback back to 0
  const handleResetPlayback = () => {
    if (!engineRef.current) return;

    engineRef.current.stopAccompaniment();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentTime(0);
    setCurrentChord('C');

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // Microphone toggle permission flow
  const handleToggleMic = async () => {
    if (!engineRef.current) return;

    if (isMicActive) {
      engineRef.current.stopMicrophone();
      setIsMicActive(false);
      setVocalAnalyser(null);
      setMicError(null);
    } else {
      try {
        setMicError(null);
        await engineRef.current.startMicrophone();
        setIsMicActive(true);
        setVocalAnalyser(engineRef.current.vocalAnalyser);
      } catch (err: any) {
        console.error('Microphone error:', err);
        setMicError(err.message || 'Permission denied by system');
      }
    }
  };

  // Start K-Song Recording session
  const handleStartRecording = async () => {
    if (!engineRef.current) return;
    if (!isMicActive) {
      alert('请先开启麦克风监听！');
      return;
    }

    // Reset playback first to align timing from start
    handleResetPlayback();

    await engineRef.current.init();
    
    // Start recording audio stream
    await engineRef.current.startRecording();
    setIsRecording(true);
    isRecordingRef.current = true;

    // Also trigger accompaniment backing track
    if (bgmMode === 'original' && hasCustomAudio && customAudioFile) {
      engineRef.current.playAudioFile(customAudioFile);
    } else {
      engineRef.current.startBackingSynth(selectedSong);
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    animationFrameRef.current = requestAnimationFrame(updatePlaybackProgress);
  };

  // Stop K-Song Recording, compile & mixed output saving
  const handleStopRecording = () => {
    if (!engineRef.current) return;

    // Stop playback
    engineRef.current.stopAccompaniment();
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Stop recording and get WAV output
    const recordedResult = engineRef.current.stopRecording();
    setIsRecording(false);
    isRecordingRef.current = false;

    if (recordedResult) {
      const newSession: RecordingSession = {
        id: 'rec_' + Date.now(),
        songId: selectedSong.id,
        songTitle: selectedSong.title,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: recordedResult.duration,
        audioUrl: recordedResult.url,
        blob: recordedResult.blob,
      };

      setRecordings((prev) => [newSession, ...prev]);
    }
  };

  // Playback recorded tracks
  const handlePlayRecording = (session: RecordingSession) => {
    if (playingRecordingId === session.id) {
      // Pause
      setPlayingRecordingId(null);
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach((el) => el.pause());
    } else {
      setPlayingRecordingId(session.id);
      const audio = new Audio(session.audioUrl);
      audio.onended = () => setPlayingRecordingId(null);
      audio.play();
    }
  };

  // Custom song selection handler
  const handleSongSelect = (song: Song) => {
    handleResetPlayback();
    setSelectedSong(song);
    
    // Clear custom audio if preset song selected and it wasn't uploaded for it
    if (song.type === 'preset') {
      setHasCustomAudio(false);
      setCustomAudioFile(null);
      setCustomAudioName('');
    }
  };

  // Custom audio upload handler
  const handleCustomAudioUploaded = (file: File) => {
    handleResetPlayback();
    setCustomAudioFile(file);
    setCustomAudioName(file.name);
    setHasCustomAudio(true);
    
    // Attempt to parse duration using Audio object
    const audioObj = new Audio(URL.createObjectURL(file));
    audioObj.onloadedmetadata = () => {
      setSelectedSong((prev) => ({
        ...prev,
        duration: audioObj.duration,
        hasCustomAudio: true,
      }));
    };
  };

  // Vocal Reducer toggle handler
  const handleToggleVocalReducer = (active: boolean) => {
    setVocalReducerActive(active);
    if (engineRef.current) {
      engineRef.current.toggleVocalReducer(active);
    }
  };

  // Callback when server-side AI analyzes a song details
  const handleSongAnalyzed = (parsedSong: Song) => {
    setSongs((prev) => [parsedSong, ...prev]);
    setSelectedSong(parsedSong);
    handleResetPlayback();
  };

  // Calculate duration limit
  const lastLyricLine = selectedSong.lyrics[selectedSong.lyrics.length - 1];
  const totalDuration = selectedSong.duration || (lastLyricLine ? lastLyricLine.time + 10 : 120);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/70 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-purple-600 p-2.5 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Mic2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">K歌提词录音伴奏机</h1>
            <p className="text-[10px] text-zinc-500 font-medium">智能和弦歌词解析 • 专业人声调音台混响 • CD级WAV导出</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-[10px] text-zinc-400">
            <Sparkles className="h-3 w-3 text-cyan-400" />
            <span>Google Gemini 3.5 强力支持</span>
          </div>
        </div>
      </header>

      {/* Workspace View Mode Toggle */}
      <div className="bg-zinc-950 border-b border-zinc-900 px-6 py-2.5 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('studio')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeView === 'studio' 
                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/15' 
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Sliders className="h-3.5 w-3.5 animate-pulse" />
            <span>🎹 智能乐器与曲谱重组工作站 (Instrument Studio)</span>
          </button>
          <button
            onClick={() => setActiveView('karaoke')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeView === 'karaoke' 
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/15' 
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Mic2 className="h-3.5 w-3.5" />
            <span>🎙️ K歌提词练歌房 (Karaoke Room)</span>
          </button>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono hidden sm:block">
          当前模式: {activeView === 'studio' ? '音源分离 & 谱面编辑重新合成' : '实时提词演唱麦克风录制'}
        </div>
      </div>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: Song selector & custom uploading - 4 spans */}
        <div className="lg:col-span-4 space-y-6">
          <SongSelector
            onSongSelect={handleSongSelect}
            selectedSong={selectedSong}
            onCustomAudioUploaded={handleCustomAudioUploaded}
            hasCustomAudio={hasCustomAudio}
            customAudioName={customAudioName}
            vocalReducerActive={vocalReducerActive}
            onToggleVocalReducer={handleToggleVocalReducer}
            onSongAnalyzed={handleSongAnalyzed}
            bgmMode={bgmMode}
            onToggleBgmMode={setBgmMode}
            onActiveViewChange={setActiveView}
          />

          {/* Quick instructions guide box */}
          <div className="bg-zinc-900/50 border border-zinc-900 p-4 rounded-2xl">
            <h4 className="text-xs font-bold text-zinc-400 flex items-center gap-1.5 mb-2">
              <Info className="h-3.5 w-3.5 text-purple-400" />
              <span>智能工作站指南</span>
            </h4>
            <ol className="text-[10px] text-zinc-500 space-y-1.5 pl-3 list-decimal leading-relaxed">
              <li>
                <b>上传或选歌</b>：在上方上传本地音频或选择经典K歌。
              </li>
              <li>
                <b>乐器分离</b>：切换到乐器工作站一键分离伴奏的 Drums/Bass/Vocal 轨道。
              </li>
              <li>
                <b>曲谱提取</b>：一键高精度识别并提取旋律与和弦曲谱。
              </li>
              <li>
                <b>音色重组</b>：在 Piano Roll 编辑曲谱，重新合成个性化乐器伴奏并混音合并导出！
              </li>
            </ol>
          </div>
        </div>

        {/* Right column: Render Active View - 8 spans */}
        <div className="lg:col-span-8 space-y-6">
          
          {activeView === 'studio' ? (
            <InstrumentStudio
              selectedSong={selectedSong}
              customAudioFile={customAudioFile}
              hasCustomAudio={hasCustomAudio}
              onSongAnalyzed={handleSongAnalyzed}
            />
          ) : (
            <>
              {/* Active Song Billboard heading */}
              <div className="bg-gradient-to-r from-zinc-900 to-black border border-zinc-900 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] bg-cyan-500/10 text-cyan-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    当前曲目 • {selectedSong.type === 'preset' ? '标准库' : '自定义/AI解析'}
                  </span>
                  <h2 className="text-lg font-bold text-white mt-1">{selectedSong.title}</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">{selectedSong.artist}</p>
                </div>
                
                <div className="text-right font-mono text-xs">
                  <span className="text-zinc-500 block">调性: <strong className="text-zinc-300">{selectedSong.key}</strong></span>
                  <span className="text-zinc-500 block mt-0.5">速度: <strong className="text-zinc-300">{selectedSong.bpm} BPM</strong></span>
                </div>
              </div>

              {/* Scrolling Prompter Card with Chords floating */}
              <Prompter
                lyrics={selectedSong.lyrics}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onPlayToggle={handlePlayToggle}
                onReset={handleResetPlayback}
                duration={totalDuration}
                songBpm={selectedSong.bpm}
                currentChord={currentChord}
              />

              {/* Waveforms Visualizer */}
              <Visualizer
                vocalAnalyser={vocalAnalyser}
                accompAnalyser={accompAnalyser}
                isRecording={isRecording}
                isPlaying={isPlaying}
              />

              {/* Recording & Mixer control board */}
              <RecordingConsole
                isRecording={isRecording}
                recordingSeconds={recordingSeconds}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                isMicActive={isMicActive}
                onToggleMic={handleToggleMic}
                micError={micError}
                vocalVol={vocalVol}
                setVocalVol={setVocalVol}
                accompVol={accompVol}
                setAccompVol={setAccompVol}
                reverbVol={reverbVol}
                setReverbVol={setReverbVol}
                delayVol={delayVol}
                setDelayVol={setDelayVol}
                recordings={recordings}
                onPlayRecording={handlePlayRecording}
                playingRecordingId={playingRecordingId}
              />
            </>
          )}
        </div>

      </main>

      {/* Footer copyright */}
      <footer className="mt-12 border-t border-zinc-900 py-6 text-center text-[10px] text-zinc-600">
        <p>© 2026 K-Song Partner Studio. Code crafted with high fidelity client DSP & Google Gemini.</p>
      </footer>
    </div>
  );
}
