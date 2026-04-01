import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, Trash2, Settings, Play, Square, Activity, Zap } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { decodeMorse } from '../lib/morse';

const UNIT_DURATION_MS = 150; // Base unit for 8 WPM approx
const DOT_THRESHOLD = 1.5; // Multiplier of unit
const DASH_THRESHOLD = 4.5; // Multiplier of unit
const LETTER_SPACE_THRESHOLD = 2.5; // Multiplier of unit
const WORD_SPACE_THRESHOLD = 6.0; // Multiplier of unit

export const MorseDecoder: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [intensity, setIntensity] = useState<number>(0);
  const [history, setHistory] = useState<{ time: number; value: number }[]>([]);
  const [threshold, setThreshold] = useState<number>(128);
  const [isCapturing, setIsCapturing] = useState(false);
  const [morseBuffer, setMorseBuffer] = useState<string>("");
  const [decodedText, setDecodedText] = useState<string>("");
  const [lastState, setLastState] = useState<'ON' | 'OFF'>('OFF');
  const [lastStateChange, setLastStateChange] = useState<number>(Date.now());
  const [isAutoThreshold, setIsAutoThreshold] = useState(true);
  const [minIntensity, setMinIntensity] = useState(255);
  const [maxIntensity, setMaxIntensity] = useState(0);
  const [brightestSpot, setBrightestSpot] = useState({ x: 50, y: 50 });

  const requestRef = useRef<number>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: 640, height: 480 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setIsCapturing(false);
    }
  };

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isCapturing) return;

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Draw video to small canvas for processing
    ctx.drawImage(videoRef.current, 0, 0, 100, 100);
    const imageData = ctx.getImageData(0, 0, 100, 100);
    const data = imageData.data;

    let maxBrightness = 0;
    let brightestX = 50;
    let brightestY = 50;

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (brightness > maxBrightness) {
        maxBrightness = brightness;
        const pixelIndex = i / 4;
        brightestX = pixelIndex % 100;
        brightestY = Math.floor(pixelIndex / 100);
      }
    }

    // Instead of global average, use the maximum brightness found
    // This is much better for detecting a small light source (like an LED)
    const currentIntensity = maxBrightness;
    setIntensity(currentIntensity);
    setBrightestSpot({ x: brightestX, y: brightestY });

    // Update history for graph
    setHistory(prev => {
      const next = [...prev, { time: Date.now(), value: currentIntensity }].slice(-100);
      return next;
    });

    // Auto threshold logic
    if (isAutoThreshold) {
      setMinIntensity(prev => Math.min(prev, currentIntensity));
      setMaxIntensity(prev => Math.max(prev, currentIntensity));
      const newThreshold = (minIntensity + maxIntensity) / 2;
      if (Math.abs(maxIntensity - minIntensity) > 30) {
        setThreshold(newThreshold);
      }
    }

    // Morse Logic
    const currentState = currentIntensity > threshold ? 'ON' : 'OFF';
    const now = Date.now();
    const duration = now - lastStateChange;

    if (currentState !== lastState) {
      if (lastState === 'ON') {
        // Light turned OFF: process the "ON" duration (Dot or Dash)
        if (duration > UNIT_DURATION_MS * 0.5) {
          if (duration < UNIT_DURATION_MS * 2.5) {
            setMorseBuffer(prev => prev + ".");
          } else {
            setMorseBuffer(prev => prev + "-");
          }
        }
      } else {
        // Light turned ON: process the "OFF" duration (Spaces)
        if (duration > UNIT_DURATION_MS * LETTER_SPACE_THRESHOLD) {
          if (duration > UNIT_DURATION_MS * WORD_SPACE_THRESHOLD) {
            setMorseBuffer(prev => prev + "   "); // Word space
          } else {
            setMorseBuffer(prev => prev + " "); // Letter space
          }
        }
      }
      setLastState(currentState);
      setLastStateChange(now);
    }

    requestRef.current = requestAnimationFrame(processFrame);
  }, [isCapturing, lastState, lastStateChange, threshold, isAutoThreshold, minIntensity, maxIntensity]);

  useEffect(() => {
    if (isCapturing) {
      requestRef.current = requestAnimationFrame(processFrame);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isCapturing, processFrame]);

  useEffect(() => {
    // Decode buffer whenever it changes
    setDecodedText(decodeMorse(morseBuffer));
  }, [morseBuffer]);

  const clear = () => {
    setMorseBuffer("");
    setDecodedText("");
    setMinIntensity(255);
    setMaxIntensity(0);
  };

  return (
    <div className="flex flex-col h-full bg-[#151619] text-white font-mono overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#1a1b1e]">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isCapturing ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-white/5 text-white/40'}`}>
            <Zap size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase">Morse Visual Decoder</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-tighter">Hardware Interface v1.0.4</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={clear}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60"
            title="Clear Buffer"
          >
            <Trash2 size={18} />
          </button>
          <button 
            onClick={() => setIsAutoThreshold(!isAutoThreshold)}
            className={`p-2 rounded-lg transition-colors ${isAutoThreshold ? 'bg-orange-500/20 text-orange-500' : 'bg-white/5 text-white/40'}`}
            title="Auto Threshold"
          >
            <Activity size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Camera Feed & Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Video Container */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10 group">
            {!isCapturing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                <button 
                  onClick={startCamera}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-bold rounded-full transition-all transform hover:scale-105"
                >
                  <Camera size={20} />
                  INITIALIZE SENSOR
                </button>
                <p className="mt-4 text-[10px] text-white/40 uppercase tracking-widest">Awaiting optical input signal</p>
              </div>
            )}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover grayscale opacity-60"
            />
            <canvas ref={canvasRef} width="100" height="100" className="hidden" />
            
            {/* Overlay UI */}
            <div className="absolute top-4 left-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded border border-white/10">
                <div className={`w-2 h-2 rounded-full ${lastState === 'ON' ? 'bg-orange-500 shadow-[0_0_10px_#f97316]' : 'bg-white/20'}`} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Signal: {lastState}</span>
              </div>
            </div>

            {/* Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-24 h-24 border border-white/20 border-dashed rounded-full animate-[spin_10s_linear_infinite]" />
              <div className="absolute w-4 h-px bg-white/40" />
              <div className="absolute h-4 w-px bg-white/40" />
            </div>

            {/* Brightest Spot Marker */}
            {isCapturing && (
              <div 
                className="absolute w-6 h-6 border-2 border-orange-500 rounded-full pointer-events-none transition-all duration-75 ease-out"
                style={{ 
                  left: `${brightestSpot.x}%`, 
                  top: `${brightestSpot.y}%`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 15px #f97316'
                }}
              >
                <div className="absolute inset-0 animate-ping bg-orange-500/20 rounded-full" />
              </div>
            )}
          </div>

          {/* Intensity Graph */}
          <div className="bg-[#1a1b1e] rounded-xl border border-white/10 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Intensity Analysis</span>
              <span className="text-xs font-bold text-orange-500">{Math.round(intensity)} LUX</span>
            </div>
            <div className="flex-1 min-h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <YAxis domain={[0, 255]} hide />
                  <ReferenceLine y={threshold} stroke="#f97316" strokeDasharray="3 3" label={{ position: 'right', value: 'THR', fill: '#f97316', fontSize: 10 }} />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#ffffff" 
                    strokeWidth={1} 
                    dot={false} 
                    isAnimationActive={false}
                    strokeOpacity={0.5}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] uppercase tracking-tighter text-white/40">
                <span>Threshold Control</span>
                <span>{Math.round(threshold)}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={threshold} 
                onChange={(e) => {
                  setThreshold(parseInt(e.target.value));
                  setIsAutoThreshold(false);
                }}
                className="w-full accent-orange-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Morse Buffer */}
          <div className="lg:col-span-1 bg-[#1a1b1e] rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Morse Stream</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-white/20" />
                <div className="w-1 h-1 rounded-full bg-white/20" />
              </div>
            </div>
            <div className="h-24 bg-black/40 rounded border border-white/5 p-3 text-orange-500/80 break-all overflow-y-auto text-lg tracking-widest">
              {morseBuffer || <span className="text-white/10">.... . .-.. .-.. ---</span>}
            </div>
          </div>

          {/* Decoded Text */}
          <div className="lg:col-span-2 bg-[#1a1b1e] rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Decoded Output</span>
              <span className="text-[10px] text-white/20">UTF-8 ENCODING</span>
            </div>
            <div className="h-24 bg-black/40 rounded border border-white/5 p-3 text-white break-words overflow-y-auto text-xl font-bold">
              {decodedText || <span className="text-white/10">AWAITING SIGNAL...</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-white/10 bg-[#1a1b1e] flex items-center justify-between">
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-[8px] text-white/40 uppercase tracking-widest">Status</span>
            <span className={`text-[10px] font-bold uppercase ${isCapturing ? 'text-green-500' : 'text-red-500'}`}>
              {isCapturing ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] text-white/40 uppercase tracking-widest">Mode</span>
            <span className="text-[10px] font-bold uppercase text-white/80">Optical Recognition</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          {isCapturing ? (
            <button 
              onClick={stopCamera}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded transition-all text-xs font-bold"
            >
              <Square size={14} fill="currentColor" />
              TERMINATE
            </button>
          ) : (
            <button 
              onClick={startCamera}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500/20 rounded transition-all text-xs font-bold"
            >
              <Play size={14} fill="currentColor" />
              START SENSOR
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
