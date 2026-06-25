import React, { useState } from 'react';
import { Mic, MicOff, Video, Circle, Square, Download, Volume2, Music, Waves, Disc } from 'lucide-react';
import { RecordingSession } from '../types';

interface RecordingConsoleProps {
  isRecording: boolean;
  recordingSeconds: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isMicActive: boolean;
  onToggleMic: () => void;
  micError?: string | null;
  
  // Audio parameters
  vocalVol: number;
  setVocalVol: (v: number) => void;
  accompVol: number;
  setAccompVol: (v: number) => void;
  reverbVol: number;
  setReverbVol: (v: number) => void;
  delayVol: number;
  setDelayVol: (v: number) => void;

  // Stored tracks
  recordings: RecordingSession[];
  onPlayRecording: (session: RecordingSession) => void;
  playingRecordingId: string | null;
}

export default function RecordingConsole({
  isRecording,
  recordingSeconds,
  onStartRecording,
  onStopRecording,
  isMicActive,
  onToggleMic,
  micError,
  
  vocalVol,
  setVocalVol,
  accompVol,
  setAccompVol,
  reverbVol,
  setReverbVol,
  delayVol,
  setDelayVol,

  recordings,
  onPlayRecording,
  playingRecordingId,
}: RecordingConsoleProps) {
  
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-xl backdrop-blur-md space-y-6">
      {/* Mic Activation & Record triggers */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-zinc-800/40 border border-zinc-700/30 rounded-xl">
        <div className="flex items-center gap-3">
          <button
            id="mic-toggle-btn"
            onClick={onToggleMic}
            className={`p-3 rounded-full transition-all ${
              isMicActive
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-700/50 border border-zinc-600/30 text-zinc-400 hover:bg-zinc-700'
            }`}
            title={isMicActive ? "关闭麦克风" : "授权麦克风"}
          >
            {isMicActive ? <Mic className="h-5 w-5 animate-pulse" /> : <MicOff className="h-5 w-5" />}
          </button>
          
          <div className="text-left">
            <h4 className="text-xs font-semibold text-white">
              {isMicActive ? "麦克风已就绪" : "麦克风未开启"}
            </h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              {isMicActive ? "戴上耳机开始唱歌录制音效更佳" : "请先授权开启麦克风监听"}
            </p>
          </div>
        </div>

        {/* Record trigger buttons */}
        <div className="flex items-center gap-2">
          {isRecording ? (
            <button
              id="stop-recording-btn"
              onClick={onStopRecording}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)]"
            >
              <Square className="h-4 w-4 fill-current" />
              <span>停止并生成录音</span>
            </button>
          ) : (
            <button
              id="start-recording-btn"
              onClick={onStartRecording}
              disabled={!isMicActive}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-pink-600 hover:opacity-95 disabled:opacity-40 text-white font-semibold rounded-lg text-xs transition-all shadow-md"
            >
              <Circle className="h-4 w-4 fill-current text-white animate-ping" />
              <span>开启K歌录音</span>
            </button>
          )}

          {/* Recording Timer */}
          {isRecording && (
            <div className="px-3 py-2 bg-red-950/20 border border-red-900/30 rounded-lg text-red-400 font-mono text-xs animate-pulse">
              {formatTime(recordingSeconds)}
            </div>
          )}
        </div>
      </div>

      {micError && (
        <div className="p-4 bg-red-950/25 border border-red-900/40 rounded-xl text-xs text-red-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-red-400">
            <span>🔒 浏览器或系统麦克风权限受限</span>
          </div>
          <p className="leading-relaxed text-[11px] text-zinc-300">
            检测到错误：<code className="text-red-400 bg-black/30 px-1 py-0.5 rounded font-mono">{micError}</code>。
            由于浏览器安全策略，网页内嵌预览窗口（iframe）可能无法直接启用麦克风。
          </p>
          <div className="bg-black/20 p-2.5 rounded-lg space-y-1 text-[11px] text-zinc-400">
            <p className="font-semibold text-zinc-300">💡 解决步骤：</p>
            <p>1. 点击页面右上角的 <strong className="text-purple-400">在新标签页中打开 (Open in new tab)</strong> 按钮。</p>
            <p>2. 在打开的独立安全 HTTPS 页面中，再次点击开启麦克风。</p>
            <p>3. 在浏览器弹出的权限提示中选择 <strong className="text-emerald-400">允许 (Allow)</strong>。</p>
          </div>
        </div>
      )}

      {!isMicActive && !micError && (
        <div className="px-4 py-2 bg-zinc-950/50 border border-zinc-800/40 rounded-xl flex items-center justify-between gap-2">
          <span className="text-[10px] text-zinc-500 leading-normal">
            ℹ️ 若麦克风无法授权开启，可点击右上角「在新标签页中打开」在独立的 HTTPS 页面中运行。
          </span>
        </div>
      )}

      {/* DSP Effects mixing board */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          <Waves className="h-4 w-4 text-cyan-400" />
          <span>KTV 调音台特效</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vocal Volume slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1">
                <Mic className="h-3.5 w-3.5 text-zinc-400" /> 麦克风人声
              </span>
              <span className="font-mono text-cyan-400">{(vocalVol * 100).toFixed(0)}%</span>
            </div>
            <input
              id="vocal-volume-slider"
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={vocalVol}
              onChange={(e) => setVocalVol(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Accompaniment Volume slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1">
                <Music className="h-3.5 w-3.5 text-zinc-400" /> 伴奏音量
              </span>
              <span className="font-mono text-cyan-400">{(accompVol * 100).toFixed(0)}%</span>
            </div>
            <input
              id="accomp-volume-slider"
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={accompVol}
              onChange={(e) => setAccompVol(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Reverb Delay slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">🌌 空间混响 (KTV 大厅)</span>
              <span className="font-mono text-purple-400">{(reverbVol * 100).toFixed(0)}%</span>
            </div>
            <input
              id="reverb-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={reverbVol}
              onChange={(e) => setReverbVol(parseFloat(e.target.value))}
              className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Echo Delay slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">🔄 回音延迟 (体育馆回声)</span>
              <span className="font-mono text-purple-400">{(delayVol * 100).toFixed(0)}%</span>
            </div>
            <input
              id="delay-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={delayVol}
              onChange={(e) => setDelayVol(parseFloat(e.target.value))}
              className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Recorded track history outputs */}
      {recordings.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-zinc-800">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Disc className="h-4 w-4 text-emerald-400" />
            <span>我的录音库 (CD质量 16-bit WAV)</span>
          </h4>

          <div className="space-y-2">
            {recordings.map((rec) => {
              const isPlaying = rec.id === playingRecordingId;
              return (
                <div
                  key={rec.id}
                  className="bg-zinc-800/30 border border-zinc-700/20 p-3 rounded-lg flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-semibold text-white truncate">{rec.songTitle}</h5>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {rec.timestamp} • 录制时长: {formatTime(rec.duration)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Play track */}
                    <button
                      id={`play-recording-btn-${rec.id}`}
                      onClick={() => onPlayRecording(rec)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        isPlaying
                          ? 'bg-cyan-500 text-white'
                          : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                      }`}
                    >
                      {isPlaying ? '正播放' : '播放试听'}
                    </button>

                    {/* Download link */}
                    <a
                      id={`download-recording-link-${rec.id}`}
                      href={rec.audioUrl}
                      download={`KSong_${rec.songTitle.replace(/\s+/g, '')}_${Date.now()}.wav`}
                      className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg transition-all"
                      title="下载高品質 WAV"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
