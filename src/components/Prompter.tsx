import React, { useEffect, useRef } from 'react';
import { LyricLine } from '../types';
import { Play, Pause, RotateCcw, ChevronRight } from 'lucide-react';

interface PrompterProps {
  lyrics: LyricLine[];
  currentTime: number;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onReset: () => void;
  duration: number;
  songBpm: number;
  currentChord: string;
}

export default function Prompter({
  lyrics,
  currentTime,
  isPlaying,
  onPlayToggle,
  onReset,
  duration,
  songBpm,
  currentChord,
}: PrompterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Find active line index
  let activeIndex = 0;
  for (let i = 0; i < lyrics.length; i++) {
    if (currentTime >= lyrics[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }

  const activeLine = lyrics[activeIndex];
  const nextLine = lyrics[activeIndex + 1];

  // Calculate percentage of progress for the current active lyric line
  let lineProgress = 0;
  if (activeLine) {
    const currentLineStart = activeLine.time;
    const currentLineEnd = nextLine ? nextLine.time : (duration || currentLineStart + 6);
    const lineDuration = currentLineEnd - currentLineStart;
    if (lineDuration > 0) {
      lineProgress = Math.min(100, Math.max(0, ((currentTime - currentLineStart) / lineDuration) * 100));
    }
  }

  // Smoothly scroll the active lyric into the center of the prompter
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  // Helper to split text into characters while keeping track of actual offsets
  const renderLineWithChords = (line: LyricLine, isActive: boolean) => {
    const chars = Array.from(line.text);
    
    if (line.chords.length === 0) {
      return (
        <p className={`text-xl font-medium tracking-wide transition-all duration-300 ${
          isActive ? 'text-white text-2xl font-bold glow-text' : 'text-zinc-500'
        }`}>
          {line.text}
        </p>
      );
    }

    return (
      <div className="flex flex-wrap gap-x-1.5 gap-y-4 justify-center py-2 select-none">
        {chars.map((char, index) => {
          // Find if there is a chord at this character index
          const chordMatch = line.chords.find(c => c.offset === index);
          
          return (
            <div 
              key={index} 
              className="flex flex-col items-center transition-transform duration-300"
              style={{ transform: isActive ? 'scale(1.05)' : 'scale(1)' }}
            >
              {/* Chord Name Floating Above */}
              <span className={`font-mono text-xs font-black h-5 flex items-end tracking-tight select-none transition-all duration-300 ${
                isActive 
                  ? 'text-cyan-400 text-sm font-extrabold drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' 
                  : 'text-zinc-600'
              }`}>
                {chordMatch ? chordMatch.chord : '\u00A0'}
              </span>
              
              {/* Syllable character */}
              <span className={`text-lg transition-all duration-300 font-medium ${
                isActive 
                  ? 'text-white text-2xl font-bold drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]' 
                  : 'text-zinc-400 font-normal'
              }`}>
                {char === ' ' ? '\u00A0' : char}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md flex flex-col h-[480px]">
      {/* Prompter Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 ${isPlaying ? '' : 'hidden'}`}></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </span>
          <h3 className="text-sm font-semibold tracking-wider uppercase text-zinc-400">
            滚动智能提词器 & 和弦谱
          </h3>
        </div>
        
        {/* Dynamic Chord & Beat Indicator */}
        <div className="flex items-center gap-4">
          {isPlaying && (
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800/80 border border-zinc-700 rounded-lg text-xs font-mono text-cyan-400">
              <span>BPM: <strong className="text-white">{songBpm}</strong></span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-xs font-mono text-cyan-300 animate-pulse">
            <span>当前和弦: <strong className="text-white text-sm">{currentChord || 'C'}</strong></span>
          </div>
        </div>
      </div>

      {/* Lyrics Scroll View Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-8 scrollbar-thin scrollbar-thumb-zinc-800 px-4 py-32 flex flex-col items-center"
        id="prompter-viewport"
      >
        {lyrics.map((line, idx) => {
          const isActive = idx === activeIndex;
          return (
            <div
              key={idx}
              ref={isActive ? activeLineRef : null}
              className={`w-full max-w-xl text-center py-4 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'bg-zinc-800/40 border border-zinc-700/50 shadow-lg px-6 scale-102 ring-1 ring-cyan-500/20' 
                  : 'opacity-40 blur-[0.4px] hover:opacity-75 hover:blur-none'
              }`}
            >
              {/* Syllable layout builder */}
              {renderLineWithChords(line, isActive)}
              
              {/* Timing indicator underneath active line */}
              {isActive && (
                <div className="w-full mt-4 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>{line.time.toFixed(1)}s</span>
                  {/* Bouncing progress bar for the line */}
                  <div className="flex-1 mx-4 bg-zinc-700/50 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-cyan-400 to-purple-500 h-full rounded-full transition-all duration-100 ease-out"
                      style={{ width: `${lineProgress}%` }}
                    />
                  </div>
                  <span>{nextLine ? nextLine.time.toFixed(1) : 'End'}s</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Prompter Controls Bar */}
      <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
        {/* Playback time indicator */}
        <div className="text-xs font-mono text-zinc-400">
          时间: <span className="text-white font-semibold">{currentTime.toFixed(1)}</span>s
          {duration > 0 && <span className="text-zinc-600"> / {duration.toFixed(1)}s</span>}
        </div>

        {/* Center buttons */}
        <div className="flex items-center gap-3">
          <button
            id="reset-playback-btn"
            onClick={onReset}
            className="p-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full text-zinc-300 transition-colors"
            title="重置播放"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          
          <button
            id="play-pause-btn"
            onClick={onPlayToggle}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold transition-all ${
              isPlaying
                ? 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                : 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4 fill-current" />
                <span>暂停伴奏</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>开启唱K</span>
              </>
            )}
          </button>
        </div>

        {/* Up Next Preview */}
        <div className="text-right text-xs max-w-[200px] hidden sm:block">
          <div className="text-zinc-500 font-semibold mb-0.5">下一句:</div>
          <div className="text-zinc-300 truncate">
            {nextLine ? nextLine.text : '最后一句啦!'}
          </div>
        </div>
      </div>
    </div>
  );
}
