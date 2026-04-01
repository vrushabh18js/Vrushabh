import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sun, 
  Moon, 
  Copy, 
  Volume2, 
  Trash2, 
  ArrowRightLeft, 
  Zap, 
  Share2,
  Check,
  Keyboard,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { decodeMorse, encodeMorse } from './lib/morse';
import { MorseDecoder } from './components/MorseDecoder';

type Mode = 'text-to-morse' | 'morse-to-text';
type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<Mode>('text-to-morse');
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'dark';
    }
    return 'dark';
  });
  const [copied, setCopied] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);

  // Transmission Logic
  const transmitMorse = useCallback(async () => {
    if (!output || isTransmitting) return;
    
    setIsTransmitting(true);
    
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);

    // Flashlight (Torch) setup
    let track: MediaStreamTrack | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      track = stream.getVideoTracks()[0];
    } catch (e) {
      console.log("Flashlight not available or permission denied");
    }

    const dotDuration = 100;
    const dashDuration = 300;
    const symbolSpace = 100;
    const letterSpace = 300;
    const wordSpace = 700;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const toggleOn = async () => {
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      setIsBlinking(true);
      if (track) {
        try {
          await track.applyConstraints({ advanced: [{ torch: true }] } as any);
        } catch (e) {}
      }
    };

    const toggleOff = async () => {
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      setIsBlinking(false);
      if (track) {
        try {
          await track.applyConstraints({ advanced: [{ torch: false }] } as any);
        } catch (e) {}
      }
    };

    const chars = output.split('');
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      if (char === '.') {
        await toggleOn();
        await sleep(dotDuration);
        await toggleOff();
        await sleep(symbolSpace);
      } else if (char === '-') {
        await toggleOn();
        await sleep(dashDuration);
        await toggleOff();
        await sleep(symbolSpace);
      } else if (char === ' ') {
        await sleep(letterSpace);
      } else if (char === '/') {
        await sleep(wordSpace);
      }
    }

    oscillator.stop();
    if (track) track.stop();
    setIsTransmitting(false);
    setIsBlinking(false);
  }, [output, isTransmitting]);

  useEffect(() => {
    if (mode === 'text-to-morse') {
      setOutput(encodeMorse(input));
    } else {
      setOutput(decodeMorse(input));
    }
  }, [input, mode]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleMode = () => {
    setMode(prev => prev === 'text-to-morse' ? 'morse-to-text' : 'text-to-morse');
    setInput(output);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' ? 'bg-[#0a0b0d] text-white' : 'bg-[#f8f9fa] text-[#1a1b1e]'
    }`}>
      {/* Navigation */}
      <nav className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors ${
        theme === 'dark' ? 'bg-[#0a0b0d]/80 border-white/10' : 'bg-white/80 border-black/5'
      }`}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-500 rounded-lg text-black">
              <Zap size={20} fill="currentColor" />
            </div>
            <span className="font-bold tracking-tight text-lg">MorsePro</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowCamera(!showCamera)}
              className={`p-2 rounded-full transition-all ${
                showCamera 
                  ? 'bg-orange-500 text-black' 
                  : theme === 'dark' ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/5 text-black/60'
              }`}
              title="Camera Decoder"
            >
              <Camera size={20} />
            </button>
            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-all ${
                theme === 'dark' ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/5 text-black/60'
              }`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <AnimatePresence mode="wait">
          {showCamera ? (
            <motion.div 
              key="camera"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-[70vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            >
              <MorseDecoder />
            </motion.div>
          ) : (
            <motion.div 
              key="converter"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              {/* Mode Switcher */}
              <div className="flex justify-center">
                <button 
                  onClick={toggleMode}
                  className={`group flex items-center gap-3 px-6 py-3 rounded-full font-bold text-sm transition-all shadow-lg ${
                    theme === 'dark' 
                      ? 'bg-[#1a1b1e] border border-white/10 hover:border-orange-500/50' 
                      : 'bg-white border border-black/5 hover:border-orange-500/50'
                  }`}
                >
                  <span className={mode === 'text-to-morse' ? 'text-orange-500' : 'opacity-40'}>ENGLISH</span>
                  <div className="p-1.5 rounded-full bg-orange-500/10 text-orange-500 group-hover:rotate-180 transition-transform duration-500">
                    <ArrowRightLeft size={16} />
                  </div>
                  <span className={mode === 'morse-to-text' ? 'text-orange-500' : 'opacity-40'}>MORSE</span>
                </button>
              </div>

              {/* Converter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Input Area */}
                <div className={`flex flex-col rounded-3xl border p-6 transition-all ${
                  theme === 'dark' ? 'bg-[#1a1b1e] border-white/10' : 'bg-white border-black/5 shadow-sm'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Input Source</span>
                    <button onClick={clearAll} className="p-1.5 hover:text-red-500 transition-colors opacity-40 hover:opacity-100">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={mode === 'text-to-morse' ? "Type your message here..." : ".... . .-.. .-.. ---"}
                    className={`flex-1 min-h-[200px] bg-transparent resize-none outline-none text-xl font-medium leading-relaxed placeholder:opacity-20 ${
                      mode === 'morse-to-text' ? 'font-mono tracking-widest' : ''
                    }`}
                  />
                  <div className="mt-4 flex items-center gap-2 opacity-40 text-[10px] font-bold uppercase">
                    <Keyboard size={12} />
                    <span>{input.length} Characters</span>
                  </div>
                </div>

                {/* Output Area */}
                <div className={`flex flex-col rounded-3xl border p-6 transition-all relative overflow-hidden ${
                  theme === 'dark' ? 'bg-[#1a1b1e] border-white/10' : 'bg-white border-black/5 shadow-sm'
                } ${isBlinking ? 'ring-4 ring-orange-500 ring-inset' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Output Result</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={transmitMorse}
                        disabled={!output || isTransmitting}
                        className={`p-2 rounded-lg transition-all ${
                          isTransmitting 
                            ? 'bg-orange-500 text-black' 
                            : 'hover:bg-orange-500/10 hover:text-orange-500 disabled:opacity-10'
                        }`}
                        title="Transmit (Audio + Light)"
                      >
                        <Volume2 size={18} />
                      </button>
                      <button 
                        onClick={copyToClipboard}
                        disabled={!output}
                        className="p-2 hover:bg-orange-500/10 hover:text-orange-500 rounded-lg transition-all disabled:opacity-10"
                        title="Copy to Clipboard"
                      >
                        {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className={`flex-1 min-h-[200px] text-xl font-bold leading-relaxed break-words ${
                    mode === 'text-to-morse' ? 'font-mono tracking-widest text-orange-500' : ''
                  }`}>
                    {output || <span className="opacity-10">Translation will appear here...</span>}
                  </div>
                  
                  {/* Decorative Background Element */}
                  <div className="absolute -bottom-10 -right-10 opacity-[0.02] pointer-events-none">
                    <Zap size={200} fill="currentColor" />
                  </div>
                </div>
              </div>

              {/* Quick Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8">
                <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-40">Pro Tip</h3>
                  <p className="text-xs leading-relaxed opacity-60">Use 3 spaces between words when typing Morse code manually.</p>
                </div>
                <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-40">Audio</h3>
                  <p className="text-xs leading-relaxed opacity-60">Click the volume icon to hear the Morse code sequence played back.</p>
                </div>
                <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-40">Camera</h3>
                  <p className="text-xs leading-relaxed opacity-60">Use the camera icon in the nav to decode light signals from LEDs or flashes.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center opacity-20 text-[10px] font-bold uppercase tracking-[0.2em]">
        MorsePro Digital Interface &copy; 2026
      </footer>
    </div>
  );
};

export default App;
