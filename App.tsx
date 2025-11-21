import React, { useState, useEffect, useRef } from 'react';
import { AppView, UserProfile, DreamContext, DreamHistoryItem } from './types';
import { Header } from './components/Header';
import { Button } from './components/Button';
import { analyzeDream, chatWithPsychoanalyst, generateSpeech, generateDreamImage, editDreamImage, searchSymbolism } from './services/geminiService';
import Markdown from 'react-markdown';

// Sub-components defined here for simplicity due to file limit constraints, 
// but ideally would be separate files.

// --- ONBOARDING COMPONENT ---
const Onboarding: React.FC<{ onComplete: (p: UserProfile) => void }> = ({ onComplete }) => {
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    age: 18,
    birthCity: '',
    currentDate: new Date().toLocaleDateString(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.fullName && profile.birthCity) {
      onComplete(profile);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[url('https://picsum.photos/1920/1080?grayscale&blur=2')] bg-cover bg-center">
      <div className="bg-black/80 backdrop-blur-xl border border-purple-500/20 p-8 rounded-2xl max-w-md w-full shadow-2xl">
        <h2 className="text-3xl font-serif text-center mb-6 bg-gradient-to-r from-purple-400 to-pink-300 bg-clip-text text-transparent">Identidad Onírica</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-purple-300 mb-1">Nombre y Apellido</label>
            <input 
              type="text" 
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none text-white"
              value={profile.fullName}
              onChange={e => setProfile({...profile, fullName: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-purple-300 mb-1">Edad</label>
              <input 
                type="number" 
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none text-white"
                value={profile.age}
                onChange={e => setProfile({...profile, age: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm text-purple-300 mb-1">Ciudad Natal</label>
              <input 
                type="text" 
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none text-white"
                value={profile.birthCity}
                onChange={e => setProfile({...profile, birthCity: e.target.value})}
              />
            </div>
          </div>
          <div className="pt-4">
             <Button type="submit" className="w-full">Entrar al Reino de los Sueños</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- DREAM INPUT & ANALYSIS COMPONENT ---
const DreamJournal: React.FC<{ user: UserProfile }> = ({ user }) => {
  const [dream, setDream] = useState<DreamContext>({
    dreamText: '',
    dreamDate: new Date().toISOString().split('T')[0],
    dreamTime: '03:00',
    additionalNotes: '',
  });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [symbolResult, setSymbolResult] = useState<{text: string, sources: any[]} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // History State
  const [history, setHistory] = useState<DreamHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta la narración por voz.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error", event);
        setIsListening(false);
    };

    let initialText = dream.dreamText; 

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      // Append transcript to what was there when we started listening
      // To avoid overwriting manual edits made *during* speech (though rare), 
      // we use the captured initialText.
      const newText = initialText + (initialText && transcript ? ' ' : '') + transcript;
      setDream(prev => ({ ...prev, dreamText: newText }));
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleAnalyze = async () => {
    if (!dream.dreamText) return;
    setLoading(true);
    setAnalysis(null);
    setLoadingProgress(0);
    setLoadingStatus("Iniciando conexión onírica...");

    // Stop any playing audio
    if (isPlaying && audioSourceRef.current) {
        audioSourceRef.current.stop();
        setIsPlaying(false);
    }

    // Simulation logic for progress bar
    const phases = [
      "Sintonizando frecuencia cerebral...",
      "Navegando el mar del subconsciente...",
      "Decodificando símbolos ancestrales...",
      "Consultando a los arquetipos universales...",
      "Tejiendo la profecía...",
      "Materializando la revelación..."
    ];

    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        const increment = Math.random() * 4;
        const next = prev + increment;
        
        if (next > 90) return 90; 

        const totalPhases = phases.length;
        const phaseIndex = Math.floor((next / 90) * totalPhases);
        setLoadingStatus(phases[Math.min(phaseIndex, totalPhases - 1)]);

        return next;
      });
    }, 600);

    try {
      const result = await analyzeDream(user, dream);
      
      clearInterval(progressInterval);
      setLoadingProgress(100);
      setLoadingStatus("Revelación concedida.");

      setTimeout(() => {
        setAnalysis(result);
        setLoading(false);
        
        // Save to History
        const newHistoryItem: DreamHistoryItem = {
            id: Date.now().toString(),
            dream: { ...dream },
            analysis: result,
            timestamp: Date.now()
        };
        setHistory(prev => [newHistoryItem, ...prev]);
        setSelectedHistoryId(newHistoryItem.id);
      }, 600);

    } catch (e) {
      clearInterval(progressInterval);
      setLoading(false);
      alert("El oráculo está nublado. Intenta de nuevo.");
    }
  };

  const handlePlayAudio = async () => {
    if (!analysis) return;

    if (isPlaying) {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }
        setIsPlaying(false);
        return;
    }

    setIsAudioLoading(true);
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        const textToSpeak = analysis.length > 1500 ? analysis.substring(0, 1500) + "..." : analysis;
        const audioBuffer = await generateSpeech(textToSpeak);
        
        if (audioBuffer) {
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => setIsPlaying(false);
            
            audioSourceRef.current = source;
            source.start(0);
            setIsPlaying(true);
        }
    } catch (e) {
        console.error("Error playing audio", e);
        alert("No se pudo invocar la voz del oráculo.");
    } finally {
        setIsAudioLoading(false);
    }
  };

  const handleSearchSymbol = async () => {
    if(!searchQuery) return;
    const res = await searchSymbolism(searchQuery);
    setSymbolResult(res);
  }

  const loadHistoryItem = (item: DreamHistoryItem) => {
      setDream(item.dream);
      setAnalysis(item.analysis);
      setSelectedHistoryId(item.id);
      if (isPlaying && audioSourceRef.current) {
          audioSourceRef.current.stop();
          setIsPlaying(false);
      }
      // Scroll to top on mobile
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
      setDream({
        dreamText: '',
        dreamDate: new Date().toISOString().split('T')[0],
        dreamTime: '03:00',
        additionalNotes: '',
      });
      setAnalysis(null);
      setSelectedHistoryId(null);
      if (isPlaying && audioSourceRef.current) {
          audioSourceRef.current.stop();
          setIsPlaying(false);
      }
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 lg:p-6 grid lg:grid-cols-[300px_1fr_1fr] gap-8 relative z-10 min-h-[calc(100vh-100px)]">
      {/* Decorative background for component */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-purple-900/10 to-indigo-900/10 rounded-3xl blur-3xl -z-10"></div>

      {/* HISTORY COLUMN (Sidebar) */}
      <div className="order-3 lg:order-1 flex flex-col h-full max-h-[800px]">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <h3 className="text-lg font-serif text-purple-200">Archivos Akáshicos</h3>
                <button onClick={resetForm} className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white transition-colors" title="Nuevo Sueño">
                   + Nuevo
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                {history.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm italic mt-10">
                        Sin memorias guardadas...
                    </div>
                ) : (
                    history.map(item => (
                        <div 
                            key={item.id}
                            onClick={() => loadHistoryItem(item)}
                            className={`p-3 rounded-lg cursor-pointer border transition-all duration-300 group ${
                                selectedHistoryId === item.id 
                                ? 'bg-purple-900/30 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                                : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                            }`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-purple-300 font-mono">{item.dream.dreamDate}</span>
                                <span className="text-[10px] text-gray-500">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p className="text-sm text-gray-300 line-clamp-2 group-hover:text-white transition-colors">
                                {item.dream.dreamText}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* INPUT COLUMN */}
      <div className="relative group order-1 lg:order-2">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
        <div className="relative bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl h-full flex flex-col">
          <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
             <span className="text-3xl filter drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">👁️</span>
             <h2 className="text-3xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-indigo-100 drop-shadow-sm">
               Relata tu Visión
             </h2>
          </div>
          
          <div className="space-y-5 flex-grow">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-xs font-bold tracking-widest text-purple-400/70 uppercase ml-1">Fecha Onírica</label>
                 <input 
                    type="date" 
                    className="w-full bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-3 text-sm text-purple-100 focus:ring-1 focus:ring-purple-500/50 focus:bg-indigo-950/50 transition-all outline-none hover:border-purple-500/30"
                    value={dream.dreamDate}
                    onChange={e => setDream({...dream, dreamDate: e.target.value})}
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold tracking-widest text-purple-400/70 uppercase ml-1">Hora Astral</label>
                 <input 
                    type="time" 
                    className="w-full bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-3 text-sm text-purple-100 focus:ring-1 focus:ring-purple-500/50 focus:bg-indigo-950/50 transition-all outline-none hover:border-purple-500/30"
                    value={dream.dreamTime}
                    onChange={e => setDream({...dream, dreamTime: e.target.value})}
                 />
               </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold tracking-widest text-purple-400/70 uppercase ml-1">La Narración</label>
                </div>
                <div className="relative group/input">
                    {!dream.dreamText && !isListening && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-300/20 pointer-events-none transition-opacity duration-300">
                            <span className="text-5xl mb-2 opacity-50 filter blur-[0.5px] animate-pulse">👁️</span>
                            <span className="text-sm font-serif italic tracking-wider">Cierra los ojos y relata tu visión...</span>
                        </div>
                    )}
                    <textarea 
                      className={`w-full h-48 bg-indigo-950/20 border rounded-xl p-4 text-lg text-gray-200 focus:bg-indigo-950/40 transition-all resize-none focus:ring-0 outline-none shadow-inner z-10 relative bg-transparent ${
                        isListening ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-white/5 focus:border-purple-500/30'
                      }`}
                      value={dream.dreamText}
                      onChange={e => setDream({...dream, dreamText: e.target.value})}
                    />
                    {/* Mic Button */}
                    <button 
                        onClick={toggleMic}
                        className={`absolute bottom-4 right-4 z-20 p-2 rounded-full transition-all duration-300 backdrop-blur-md border ${
                           isListening 
                           ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                           : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-purple-300'
                        }`}
                        title={isListening ? "Detener narración" : "Narrar por voz"}
                    >
                        {isListening ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest text-purple-400/70 uppercase ml-1">Fragmentos Dispersos</label>
                <div className="relative group/input">
                    {!dream.additionalNotes && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-300/20 pointer-events-none transition-opacity duration-300">
                             <span className="text-3xl mb-2 opacity-50 rotate-45">🌘</span>
                             <span className="text-xs font-serif italic">Ideas sueltas, sensaciones...</span>
                        </div>
                    )}
                    <textarea 
                      className="w-full h-24 bg-indigo-950/20 border border-white/5 rounded-xl p-4 text-sm text-gray-300 focus:bg-indigo-950/40 focus:border-purple-500/30 transition-all resize-none focus:ring-0 outline-none shadow-inner z-10 relative bg-transparent"
                      value={dream.additionalNotes}
                      onChange={e => setDream({...dream, additionalNotes: e.target.value})}
                    />
                </div>
            </div>

            <div className="pt-2">
                <Button onClick={handleAnalyze} isLoading={loading} className="w-full py-4 text-lg shadow-[0_0_25px_rgba(147,51,234,0.25)] hover:shadow-[0_0_40px_rgba(147,51,234,0.4)] border-t border-white/20">
                  {selectedHistoryId ? "Reinterpretar Visión" : "Invocar Interpretación"}
                </Button>
            </div>
          </div>
        </div>
      </div>

      {/* OUTPUT COLUMN */}
      <div className="space-y-6 h-full order-2 lg:order-3">
        {loading ? (
           <div className="h-full flex flex-col items-center justify-center border border-purple-500/20 rounded-2xl p-10 bg-black/40 backdrop-blur-xl relative overflow-hidden min-h-[600px]">
              {/* Background Ambient Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-900/30 blur-[80px] rounded-full animate-pulse"></div>

              <div className="relative w-32 h-32 mb-8">
                  <div className="absolute inset-0 rounded-full border-4 border-purple-900/40 opacity-30 scale-110"></div>
                  <div className="absolute inset-0 rounded-full border-t-2 border-l-2 border-purple-400 animate-spin duration-1000"></div>
                  <div className="absolute inset-2 rounded-full border-b-2 border-r-2 border-indigo-500 animate-spin duration-[2s] direction-reverse"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">🔮</div>
              </div>

              <div className="w-full max-w-sm space-y-4 z-10">
                <div className="flex justify-between text-xs uppercase tracking-widest text-purple-300/70 mb-1">
                  <span>Progreso Astral</span>
                  <span>{Math.floor(loadingProgress)}%</span>
                </div>
                
                {/* Ethereal Progress Bar */}
                <div className="relative w-full h-3 bg-gray-900/80 rounded-full overflow-hidden border border-white/10 backdrop-blur-sm shadow-inner">
                    <div 
                        className="absolute top-0 left-0 h-full dream-progress-bg transition-all duration-700 ease-out rounded-full"
                        style={{ width: `${loadingProgress}%` }}
                    >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-full bg-white blur-[2px] shadow-[0_0_10px_3px_rgba(255,255,255,0.7)]"></div>
                        <div className="absolute right-4 top-1 w-1 h-1 bg-white rounded-full opacity-70 animate-ping"></div>
                    </div>
                    
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="particle w-1 h-1 bg-purple-300 left-[10%] top-[50%] animate-[floatUp_2s_infinite]"></div>
                        <div className="particle w-1 h-1 bg-indigo-300 left-[30%] top-[70%] animate-[floatUp_2.5s_infinite_0.5s]"></div>
                        <div className="particle w-1 h-1 bg-pink-300 left-[60%] top-[40%] animate-[floatUp_3s_infinite_1s]"></div>
                        <div className="particle w-1 h-1 bg-white left-[85%] top-[60%] animate-[floatUp_1.8s_infinite_0.2s]"></div>
                    </div>
                </div>

                <p className="text-center text-sm italic text-purple-200/60 animate-pulse mt-2">{loadingStatus}</p>
              </div>
           </div>
        ) : analysis ? (
          <div className="h-full relative bg-[#0f0f18]/95 border border-purple-500/20 rounded-2xl p-1 shadow-2xl backdrop-blur-xl animate-[fadeIn_0.8s_ease-out] min-h-[600px]">
            {/* Content Inner with Gradient Border feel */}
            <div className="h-full bg-gradient-to-b from-[#1a1a2e] to-[#0f0f18] rounded-xl p-6 md:p-8 flex flex-col relative overflow-hidden">
                {/* Top gradient line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-70"></div>
                
                <div className="flex justify-between items-start mb-8 z-10">
                    <div>
                        <h3 className="text-2xl md:text-3xl font-serif text-transparent bg-clip-text bg-gradient-to-br from-purple-100 to-indigo-200 mb-1">La Revelación</h3>
                        <div className="h-px w-32 bg-gradient-to-r from-purple-500/50 to-transparent mt-2"></div>
                    </div>
                    <button 
                        onClick={handlePlayAudio}
                        disabled={isAudioLoading}
                        className={`group relative px-4 py-2 rounded-full border transition-all overflow-hidden ${
                            isPlaying 
                            ? 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
                            : 'bg-purple-500/5 border-purple-500/20 text-purple-300 hover:bg-purple-500/10'
                        }`}
                    >
                        <span className="relative z-10 flex items-center gap-2 text-sm font-medium">
                            {isAudioLoading ? (
                                <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Conectando...
                                </>
                            ) : isPlaying ? (
                                <>🛑 Detener Voz</>
                            ) : (
                                <>🔊 Escuchar Voz</>
                            )}
                        </span>
                        {!isPlaying && !isAudioLoading && (
                            <div className="absolute inset-0 bg-purple-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        )}
                    </button>
                </div>

                <div className="markdown-body text-gray-300 text-sm md:text-base leading-relaxed max-h-[600px] overflow-y-auto pr-4 custom-scrollbar z-10 pb-6">
                    <Markdown>{analysis}</Markdown>
                </div>
                
                {/* Grounding Section */}
                <div className="mt-auto pt-6 border-t border-white/5 z-10">
                    <div className="bg-black/40 rounded-lg p-4 border border-white/5">
                        <h4 className="text-xs font-bold text-purple-300 mb-3 flex items-center gap-2 uppercase tracking-wider">
                            <span className="text-lg">🔍</span> Profundizar Simbología
                        </h4>
                        <div className="flex gap-2 mb-3">
                            <input 
                            type="text" 
                            placeholder="Investigar símbolo (ej: gato negro)..." 
                            className="flex-1 bg-black/50 rounded-lg px-4 py-2 text-sm border border-white/10 focus:border-purple-500/50 outline-none text-gray-200 placeholder-gray-600"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <Button variant="secondary" className="py-1 px-4 text-xs" onClick={handleSearchSymbol}>Investigar</Button>
                        </div>
                        {symbolResult && (
                            <div className="bg-purple-900/10 p-3 rounded border border-purple-500/10 text-xs text-gray-300 animate-[fadeIn_0.3s_ease-out]">
                            <p className="mb-2 italic text-purple-200">"{symbolResult.text}"</p>
                            {symbolResult.sources.length > 0 && (
                                <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-white/5">
                                    <span className="text-gray-500">Fuentes:</span>
                                    {symbolResult.sources.map((s, i) => (
                                        <a key={i} href={s.web?.uri} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline truncate max-w-[150px]">
                                        {s.web?.title || "Enlace Externo"}
                                        </a>
                                    ))}
                                </div>
                            )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl p-10 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-sm text-center space-y-8 opacity-70 hover:opacity-100 transition-all duration-500 group min-h-[600px]">
            <div className="relative">
                <div className="absolute inset-0 bg-purple-600 blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
                <div className="w-32 h-32 rounded-full bg-gradient-to-b from-indigo-900/30 to-black border border-white/10 flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform duration-500">
                    <span className="text-6xl grayscale group-hover:grayscale-0 transition-all duration-500">🔮</span>
                </div>
            </div>
            <div className="space-y-2 max-w-xs">
               <p className="text-2xl text-purple-200/80 font-serif group-hover:text-purple-100 transition-colors">El oráculo aguarda...</p>
               <p className="text-sm text-gray-500 group-hover:text-gray-400 transition-colors">Comparte los fragmentos de tu subconsciente para desvelar los mensajes ocultos del cosmos.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- CHAT COMPONENT ---
const PsychoanalystChat: React.FC = () => {
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: 'user' as const, text: input }];
    setMessages(newMessages);
    setInput('');
    setTyping(true);

    // Transform history for Gemini API
    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    try {
      const response = await chatWithPsychoanalyst(history, input);
      setMessages([...newMessages, { role: 'model', text: response }]);
    } catch (error) {
      setMessages([...newMessages, { role: 'model', text: "Lo siento, la conexión psíquica se ha interrumpido." }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-140px)] flex flex-col bg-black/30 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
      <div className="bg-purple-900/30 p-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl">🧠</div>
        <div>
          <h3 className="font-bold text-white">Dr. Freud Bot</h3>
          <p className="text-xs text-green-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> En línea (Emergencias)</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <p>¿Una pesadilla te despertó? Cuéntame, estoy aquí para escucharte.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${
              m.role === 'user' 
                ? 'bg-purple-600 text-white rounded-tr-none' 
                : 'bg-gray-700 text-gray-200 rounded-tl-none'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {typing && <div className="text-gray-500 text-xs animate-pulse ml-4">Dr. Freud está pensando...</div>}
      </div>

      <div className="p-4 border-t border-white/10 flex gap-2">
        <input 
          className="flex-1 bg-black/20 border border-white/10 rounded-full px-4 py-2 outline-none focus:border-purple-500"
          placeholder="Escribe aquí..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} className="bg-purple-600 hover:bg-purple-500 text-white rounded-full w-10 h-10 flex items-center justify-center">
          ➤
        </button>
      </div>
    </div>
  );
};

// --- VISUALIZER COMPONENT (Image Gen/Edit) ---
const DreamVisualizer: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    try {
        const res = await generateDreamImage(prompt);
        setImage(res);
        setEditMode(false);
    } catch(e) {
        alert("Error generando imagen");
    } finally {
        setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!image || !prompt) return;
    setLoading(true);
    try {
        const res = await editDreamImage(image, prompt);
        if(res) setImage(res);
    } catch (e) {
        alert("Error editando imagen");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-md">
            <h2 className="text-2xl font-serif mb-4 text-center text-purple-200">Materializa tu Sueño</h2>
            <div className="mb-6 flex flex-col items-center justify-center min-h-[300px] bg-black/40 rounded-lg border-2 border-dashed border-gray-700 relative overflow-hidden">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                    </div>
                )}
                {image ? (
                    <img src={image} alt="Sueño generado" className="max-w-full max-h-[500px] object-contain" />
                ) : (
                    <div className="text-gray-500 text-center p-4">
                        <p>Describe tu sueño para generar una imagen.</p>
                        <p className="text-xs mt-2 opacity-50">O sube un boceto (Simulado)</p>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder={image ? "Ej: Añade un filtro retro, quita a la persona del fondo..." : "Ej: Un reloj derritiéndose en un desierto..."}
                        className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    {image ? (
                        <Button onClick={handleEdit} disabled={loading}>Editar (Flash Image)</Button>
                    ) : (
                         <Button onClick={handleGenerate} disabled={loading}>Generar</Button>
                    )}
                </div>
                {image && (
                    <button onClick={() => { setImage(null); setPrompt(''); }} className="text-xs text-red-400 underline self-end">
                        Empezar de nuevo
                    </button>
                )}
            </div>
            <div className="mt-4 text-xs text-gray-500 text-center">
                Usa comandos como "Añade...", "Quita...", "Hazlo estilo..." para editar.
            </div>
        </div>
    </div>
  );
}

// --- MAIN APP ---
export default function App() {
  const [view, setView] = useState<AppView>(AppView.ONBOARDING);
  const [user, setUser] = useState<UserProfile | null>(null);

  const handleOnboardingComplete = (profile: UserProfile) => {
    setUser(profile);
    setView(AppView.INPUT);
  };

  // Simple background effect
  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 relative overflow-x-hidden selection:bg-purple-500 selection:text-white">
      
      {/* Surreal Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-900/20 blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-900/20 blur-[120px]"></div>
        <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-pink-900/10 blur-[80px] animate-pulse"></div>
      </div>

      <div className="relative z-10">
        {view === AppView.ONBOARDING && <Onboarding onComplete={handleOnboardingComplete} />}
        
        {view !== AppView.ONBOARDING && (
          <>
            <Header currentView={view} setView={setView} hasUser={!!user} />
            <main className="container mx-auto py-8 px-4">
              {view === AppView.INPUT && user && <DreamJournal user={user} />}
              {view === AppView.CHAT && <PsychoanalystChat />}
              {view === AppView.VISUALIZER && <DreamVisualizer />}
            </main>
          </>
        )}
      </div>
    </div>
  );
}