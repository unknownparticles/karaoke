import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  vocalAnalyser: AnalyserNode | null;
  accompAnalyser: AnalyserNode | null;
  isRecording: boolean;
  isPlaying: boolean;
}

export default function Visualizer({
  vocalAnalyser,
  accompAnalyser,
  isRecording,
  isPlaying,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas based on client boundaries
    const handleResize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 400;
      canvas.height = 120;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const vocalDataArray = new Uint8Array(vocalAnalyser ? vocalAnalyser.frequencyBinCount : 128);
    const accompDataArray = new Uint8Array(accompAnalyser ? accompAnalyser.frequencyBinCount : 128);
    
    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;

      // Dark background with slight trail for motion blur
      ctx.fillStyle = 'rgba(15, 15, 15, 0.25)';
      ctx.fillRect(0, 0, width, height);

      // Draw middle dividing line
      ctx.strokeStyle = 'rgba(63, 63, 70, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Draw Accompaniment Waveform (Teal - Bottom Layer)
      if (accompAnalyser && isPlaying) {
        accompAnalyser.getByteTimeDomainData(accompDataArray);
        
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#06b6d4'; // Cyan
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.5)';
        ctx.beginPath();

        const sliceWidth = width / accompDataArray.length;
        let x = 0;

        for (let i = 0; i < accompDataArray.length; i++) {
          const v = accompDataArray[i] / 128.0; // Normalized -1.0 to 1.0
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
      } else {
        // Draw standard idle sine wave for accompaniment
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.03 + Date.now() * 0.003) * 6;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw Vocal Waveform (Pink/Red - Top Layer)
      if (vocalAnalyser) {
        vocalAnalyser.getByteTimeDomainData(vocalDataArray);
        
        ctx.lineWidth = 3.0;
        ctx.strokeStyle = '#ec4899'; // Pink
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(236, 72, 153, 0.6)';
        ctx.beginPath();

        const sliceWidth = width / vocalDataArray.length;
        let x = 0;

        // Check if there is active audio signal (above ambient noise threshold)
        let activeVocal = false;
        for (let i = 0; i < vocalDataArray.length; i++) {
          if (Math.abs(vocalDataArray[i] - 128) > 2) {
            activeVocal = true;
            break;
          }
        }

        for (let i = 0; i < vocalDataArray.length; i++) {
          const v = vocalDataArray[i] / 128.0;
          // Scale vocal waveform slightly so it looks dynamic and impressive
          const multiplier = activeVocal ? 1.4 : 0.02;
          const y = height / 2 + (v - 1.0) * height * multiplier;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
      } else {
        // Draw standard idle sine wave for vocal
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.2)';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.02 - Date.now() * 0.002) * 4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Reset shadows
      ctx.shadowBlur = 0;
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [vocalAnalyser, accompAnalyser, isPlaying, isRecording]);

  return (
    <div className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 shadow-inner flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-2 text-[10px] font-mono tracking-wide text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />
          麦克风人声输入 (LIVE VOCAL)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
          伴奏输出声道 (ACCOMPANIMENT)
        </span>
      </div>
      <canvas 
        ref={canvasRef} 
        className="w-full h-[120px] rounded-lg cursor-pointer bg-zinc-950/80 border border-zinc-900/50"
      />
    </div>
  );
}
