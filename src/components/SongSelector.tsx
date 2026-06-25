import React, { useState, useRef } from 'react';
import { Song } from '../types';
import { PRESET_SONGS } from '../data/presets';
import { Music, Search, Upload, RefreshCw, CheckCircle, Flame, Sparkles, Settings, HelpCircle, Scissors, Disc, FileText, Eye, EyeOff } from 'lucide-react';
import { estimateBPMOffline, parseAndSyncPlainLyrics, DEFAULT_LYRICS_TEMPLATE, parseLyricsFile } from '../utils/offlineAnalyzer';
import { analyzeSongWithGemini } from '../utils/geminiAnalyzer';
import { analyzeSongFree } from '../utils/freeAnalyzer';

interface SongSelectorProps {
  onSongSelect: (song: Song) => void;
  selectedSong: Song;
  onCustomAudioUploaded: (file: File) => void;
  hasCustomAudio: boolean;
  customAudioName: string;
  vocalReducerActive: boolean;
  onToggleVocalReducer: (active: boolean) => void;
  onSongAnalyzed: (song: Song) => void;
  bgmMode: 'synthetic' | 'original';
  onToggleBgmMode: (mode: 'synthetic' | 'original') => void;
  onActiveViewChange?: (view: 'karaoke' | 'studio') => void;
}

export default function SongSelector({
  onSongSelect,
  selectedSong,
  onCustomAudioUploaded,
  hasCustomAudio,
  customAudioName,
  vocalReducerActive,
  onToggleVocalReducer,
  onSongAnalyzed,
  bgmMode,
  onToggleBgmMode,
  onActiveViewChange,
}: SongSelectorProps) {
  const [songInput, setSongInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Settings Panel State
  const [showSettings, setShowSettings] = useState(false);
  const [engineMode, setEngineMode] = useState<'ai' | 'free'>(() => {
    return localStorage.getItem('gemini_api_key') ? 'ai' : 'free';
  });
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lyricsFileInputRef = useRef<HTMLInputElement>(null);

  const triggerLyricsFileSelect = () => {
    if (lyricsFileInputRef.current) {
      lyricsFileInputRef.current.click();
    }
  };

  const handleLyricsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();

      setStatusMsg(`正在解析歌词文件 ${file.name}...`);
      setAnalyzeError('');

      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          if (!content) {
            throw new Error('歌词内容为空，请上传有效的 TXT 或 LRC 歌词文件');
          }

          const cleanName = file.name.replace(/\.[^/.]+$/, "");
          const separatorMatch = cleanName.split(/[\-\s_]+/);
          let guessedTitle = cleanName;
          let guessedArtist = '导入歌手';

          if (separatorMatch.length > 1) {
            guessedArtist = separatorMatch[0].trim();
            guessedTitle = separatorMatch.slice(1).join(' ').trim();
          }

          const parsedLyrics = parseLyricsFile(
            content,
            selectedSong.duration || 180,
            selectedSong.key || 'C Major'
          );

          const parsedSong: Song = {
            id: 'lyric_parsed_' + Date.now(),
            title: guessedTitle,
            artist: guessedArtist,
            bpm: selectedSong.bpm || 90,
            key: selectedSong.key || 'C Major',
            lyrics: parsedLyrics,
            type: 'custom',
            hasCustomAudio: hasCustomAudio,
          };

          onSongAnalyzed(parsedSong);
          if (onActiveViewChange) {
            onActiveViewChange('karaoke');
          }
          setStatusMsg(`✍️ 歌词文件 (${file.name}) 导入解析成功！`);
          setTimeout(() => setStatusMsg(''), 5000);
        } catch (err: any) {
          console.error(err);
          setAnalyzeError(err.message || '歌词文件解析失败');
        }
      };

      reader.readAsText(file);
    }
  };

  // Trigger Unified Song Analysis (Handles both Gemini AI & Free LRCLib API depending on settings)
  const handleAnalyze = async () => {
    if (!songInput.trim()) {
      setAnalyzeError('请输入歌名、歌手或相关网页链接');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError('');
    setStatusMsg('');

    try {
      let data;
      if (engineMode === 'ai') {
        if (!apiKey.trim()) {
          // Open settings panel and highlight key field
          setShowSettings(true);
          throw new Error('使用 AI 智能解析模式必须提供 Gemini API Key。请在下方设置面板中配置，或切换至“免费模式”。');
        }
        setStatusMsg('正在连接云端 AI 进行智能声学及歌词解析...');
        data = await analyzeSongWithGemini(songInput, apiKey);
      } else {
        setStatusMsg('正在调用免费音乐接口提取歌词并智能配比和弦...');
        data = await analyzeSongFree(songInput);
      }

      // Parse bracketed lyrics on client-side
      const parsedLyrics = data.lyrics.map((line: any) => {
        let cleanText = '';
        const chords = [];
        const regex = /\[([^\]]+)\]/g;
        let match;
        let lastIndex = 0;

        const rawText = line.text;
        while ((match = regex.exec(rawText)) !== null) {
          cleanText += rawText.slice(lastIndex, match.index);
          chords.push({
            offset: cleanText.length,
            chord: match[1],
          });
          lastIndex = regex.lastIndex;
        }
        cleanText += rawText.slice(lastIndex);

        return {
          time: line.time,
          text: cleanText || ' ',
          originalText: rawText,
          chords,
        };
      });

      const parsedSong: Song = {
        id: 'parsed_' + Date.now(),
        title: data.title || songInput,
        artist: data.artist || '未知艺术家',
        bpm: data.bpm || 90,
        key: data.key || 'C Major',
        lyrics: parsedLyrics,
        type: 'custom',
        hasCustomAudio: hasCustomAudio,
      };

      onSongAnalyzed(parsedSong);
      setSongInput('');
      setStatusMsg('智能解析与同步成功！已载入播放提词板！');
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setAnalyzeError(err.message || '解析失败，请尝试切换至"免费模式 (离线解析)"继续。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Drag and drop or manual audio upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onCustomAudioUploaded(file);
      
      // Auto-extract artist & title from filename
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      const separatorMatch = cleanName.split(/[\-\s_]+/);
      let guessedTitle = cleanName;
      let guessedArtist = '本地歌手';

      if (separatorMatch.length > 1) {
        guessedArtist = separatorMatch[0].trim();
        guessedTitle = separatorMatch.slice(1).join(' ').trim();
      }

      setStatusMsg('正在本地提取音频特征 (估算BPM & 调性)...');
      try {
        const est = await estimateBPMOffline(file);
        
        // Auto synthesize a local offline song to play instantly!
        const parsedLyrics = parseAndSyncPlainLyrics(DEFAULT_LYRICS_TEMPLATE, 180, est.key);
        const autoSong: Song = {
          id: 'offline_' + Date.now(),
          title: guessedTitle,
          artist: guessedArtist,
          bpm: est.bpm,
          key: est.key,
          lyrics: parsedLyrics,
          type: 'custom',
          hasCustomAudio: true,
        };
        onSongAnalyzed(autoSong);

        setStatusMsg(`音频伴奏导入成功! (BPM: ${est.bpm}, 推荐调性: ${est.key})`);
        onToggleBgmMode('original'); // Switch BGM Mode to original audio for high-fidelity experience
        setTimeout(() => setStatusMsg(''), 5000);
      } catch (err) {
        console.warn('Auto BPM detection failed, using fallback', err);
        setStatusMsg('音频伴奏已导入成功！');
        setTimeout(() => setStatusMsg(''), 4000);
      }
    }
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. UNIFIED PORTAL: Single Entry Point Card */}
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        
        {/* Subtle glowing accent */}
        <div className="absolute -right-12 -top-12 w-24 h-24 bg-cyan-500/10 blur-2xl rounded-full" />
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-zinc-100">一键导入 & 伴奏解析</h3>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            {engineMode === 'ai' ? 'AI 智能引擎' : '免费/离线引擎'}
          </span>
        </div>

        {/* The Unified Interactive Area: Drag/Click or Text input */}
        <div className="space-y-3">
          
          {/* File drag area at the top of the box */}
          <div
            onClick={triggerFileSelect}
            className="group border border-dashed border-zinc-800 hover:border-cyan-500/40 bg-zinc-950/40 hover:bg-zinc-900/30 rounded-2xl p-4 text-center cursor-pointer transition-all duration-300 relative"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.caf"
              onChange={handleFileChange}
              className="hidden"
            />
            
            {hasCustomAudio ? (
              <div className="flex items-center justify-center gap-3">
                <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="text-left max-w-[200px]">
                  <p className="text-xs font-semibold text-white truncate">{customAudioName}</p>
                  <p className="text-[9px] text-zinc-500">点击更换音频伴奏文件</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-5 w-5 text-zinc-500 group-hover:text-cyan-400 mx-auto transition-colors" />
                <p className="text-xs font-medium text-zinc-300">拖拽或点击上传本地音频伴奏</p>
                <p className="text-[9px] text-zinc-600">支持 MP3, WAV, M4A 及无后缀音频等 | 自动提取BPM调性</p>
              </div>
            )}
          </div>

          {/* Lyrics file upload section */}
          <div className="relative">
            <button
              type="button"
              id="lyrics-file-upload-btn"
              onClick={triggerLyricsFileSelect}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-purple-500/30 shadow-inner"
            >
              <FileText className="h-4 w-4 text-purple-400" />
              <span>导入本地歌词 (.lrc / .txt)</span>
            </button>
            <input
              ref={lyricsFileInputRef}
              type="file"
              accept=".txt,.lrc,text/plain,text/*,application/octet-stream"
              onChange={handleLyricsFileChange}
              className="hidden"
            />
          </div>

          {/* Core Feature: Prominent One-Click Separation (一键分离) for imported track */}
          {hasCustomAudio && (
            <button
              type="button"
              id="one-click-vocal-sep-btn"
              onClick={() => {
                onToggleVocalReducer(!vocalReducerActive);
                setStatusMsg(vocalReducerActive ? '已还原原始立体声音轨！' : '🔮 一键伴奏分离成功！已智能过滤中心人声，保留背景伴奏。');
                setTimeout(() => setStatusMsg(''), 4000);
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                vocalReducerActive
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
              }`}
            >
              <Scissors className={`h-4.5 w-4.5 ${vocalReducerActive ? 'animate-pulse text-emerald-400' : 'text-zinc-400'}`} />
              <span>{vocalReducerActive ? '🔊 纯伴奏模式 (已分离原唱人声)' : '✂️ 一键人声分离 (提取纯背景伴奏)'}</span>
            </button>
          )}

          <div className="text-center py-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">OR 或</span>
          </div>

          {/* Text search & link input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="song-search-input"
                type="text"
                value={songInput}
                onChange={(e) => setSongInput(e.target.value)}
                placeholder="输入歌名/歌手 (例如: 凄美地 郭顶)"
                className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              />
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600" />
            </div>

            {/* Analysis Settings Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              title="一键分析设置"
              className={`p-2 rounded-xl border transition-all ${
                showSettings 
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' 
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Settings className="h-4 w-4 animate-hover-spin" />
            </button>
          </div>

          {/* Feedback messages */}
          {analyzeError && (
            <p className="text-[10px] text-red-400 bg-red-950/20 border border-red-900/30 px-3 py-2 rounded-xl">
              {analyzeError}
            </p>
          )}

          {statusMsg && (
            <p className="text-[10px] text-cyan-300 bg-cyan-950/20 border border-cyan-900/30 px-3 py-2 rounded-xl animate-pulse">
              {statusMsg}
            </p>
          )}

          {/* Analysis Action Button */}
          <button
            id="analyze-song-btn"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !songInput.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-all shadow-lg"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>智能引擎处理中...</span>
              </>
            ) : (
              <>
                <Flame className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
                <span>一键智能分析 (获取歌词与和弦)</span>
              </>
            )}
          </button>
        </div>

        {/* 2. ADVANCED SETTINGS PANEL: Shown inside the unified component */}
        {showSettings && (
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4 animate-fadeIn">
            
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-zinc-400">分析与伴奏设置 (Settings)</h4>
              <span className="text-[9px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono">微调专区</span>
            </div>

            {/* Toggle 1: Analysis Engine (AI vs Free API) */}
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 block">分析引擎 (Analysis Engine)</span>
              <div className="grid grid-cols-2 gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-900">
                <button
                  type="button"
                  onClick={() => setEngineMode('ai')}
                  className={`py-1 text-[10px] font-semibold rounded transition-all ${
                    engineMode === 'ai'
                      ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  AI 智能解析 (Gemini)
                </button>
                <button
                  type="button"
                  onClick={() => setEngineMode('free')}
                  className={`py-1 text-[10px] font-semibold rounded transition-all ${
                    engineMode === 'free'
                      ? 'bg-zinc-800 text-purple-400 border border-zinc-700'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  免费模式 (LRCLib 接口)
                </button>
              </div>
            </div>

            {/* API Key Input Panel (Shown when AI engine is selected) */}
            {engineMode === 'ai' && (
              <div className="space-y-1.5 p-3 bg-zinc-950/80 border border-zinc-800/60 rounded-xl animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 block font-semibold">Gemini API Key</span>
                  <span className="text-[9px] text-cyan-400">本地安全保存</span>
                </div>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="AIStudio API Key (AIza...)"
                    className="w-full pl-3 pr-9 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-[9px] text-zinc-500 leading-relaxed">
                  您的 API Key 安全保存在您本机的浏览器 LocalStorage 中，每次分析时直接由前端与谷歌官方接口通信，不会泄露给第三方。
                </p>
              </div>
            )}

            {/* Toggle 2: BGM Mode (Intelligent Synthesizer adapts chords VS original track) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">伴奏播放模式 (BGM Mode)</span>
                <HelpCircle className="h-3 w-3 text-zinc-600" title="和弦合成器会自动播放完美适配的和弦器乐伴奏！" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-900">
                <button
                  type="button"
                  onClick={() => onToggleBgmMode('synthetic')}
                  className={`py-1 text-[10px] font-semibold rounded transition-all ${
                    bgmMode === 'synthetic'
                      ? 'bg-zinc-800 text-cyan-400 border border-zinc-700'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  智能合成器伴奏 (适配和弦)
                </button>
                <button
                  type="button"
                  disabled={!hasCustomAudio}
                  onClick={() => onToggleBgmMode('original')}
                  className={`py-1 text-[10px] font-semibold rounded transition-all disabled:opacity-30 ${
                    bgmMode === 'original'
                      ? 'bg-zinc-800 text-emerald-400 border border-zinc-700'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  原始音频伴奏轨
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* 2. PRESET SONG LIST: Compact & Beautiful */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2 mb-3">
          <Music className="h-4 w-4 text-purple-400" />
          <h3 className="font-bold text-xs text-zinc-200">标准经典 K 歌曲库</h3>
        </div>
        <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 pr-1">
          {PRESET_SONGS.map((song) => {
            const isSelected = song.id === selectedSong.id;
            return (
              <button
                key={song.id}
                id={`song-select-btn-${song.id}`}
                onClick={() => onSongSelect(song)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-purple-950/20 border-purple-500/50 text-white shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                    : 'bg-zinc-950 border-zinc-800/40 text-zinc-400 hover:bg-zinc-900'
                }`}
              >
                <div>
                  <h4 className="font-bold text-[11px] text-white">{song.title}</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5">{song.artist}</p>
                </div>
                <div className="text-right font-mono text-[9px] flex items-center gap-2">
                  <span className="text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">{song.key}</span>
                  <span className="text-zinc-500">{song.bpm} BPM</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
