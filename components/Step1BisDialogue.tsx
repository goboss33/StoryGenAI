import React, { useState, useEffect, useRef } from 'react';
import { AudioScriptItem, Pacing, StoryState, ElevenLabsVoice } from '../types';
import { generateAudioScript } from '../services/geminiService';
import { generateSpeech } from '../services/elevenLabsService';
import VoiceLibrarySidebar from './VoiceLibrarySidebar';

interface Props {
    idea: string;
    totalDuration: number;
    pacing: Pacing;
    language: string;
    audioScript?: AudioScriptItem[];
    onUpdate: (updates: Partial<StoryState>) => void;
    onBack: () => void;
    onNext: () => void;
    isNextStepReady?: boolean;
}

const Step1BisDialogue: React.FC<Props> = ({
    idea, totalDuration, pacing, language, audioScript = [], onUpdate, onBack, onNext, isNextStepReady
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatingAudio, setGeneratingAudio] = useState<string | null>(null);
    const [activeItemId, setActiveItemId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Sequencer State
    const [isPlayingSequence, setIsPlayingSequence] = useState(false);
    const isPlayingRef = useRef(false); // Ref for synchronous access in loop
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDurationState, setTotalDurationState] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Calculate total duration whenever script changes
    useEffect(() => {
        const total = audioScript.reduce((acc, item) => acc + (item.durationEstimate || 0), 0);
        setTotalDurationState(total);
    }, [audioScript]);

    // Initialize active item if script exists
    useEffect(() => {
        if (audioScript.length > 0 && !activeItemId) {
            setActiveItemId(audioScript[0].id);
        }
    }, [audioScript]);

    const handleGenerate = async () => {
        setLoading(true);
        setIsGenerating(true);
        setError('');
        try {
            const script = await generateAudioScript(idea, totalDuration, pacing, language);
            onUpdate({ audioScript: script });
            if (script.length > 0) setActiveItemId(script[0].id);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to generate audio script');
        } finally {
            setLoading(false);
            setIsGenerating(false);
        }
    };

    const handleUpdateItem = (id: string, updates: Partial<AudioScriptItem>) => {
        const newScript = audioScript.map(item => item.id === id ? { ...item, ...updates } : item);
        onUpdate({ audioScript: newScript });
    };

    const handleDeleteItem = (id: string) => {
        const newScript = audioScript.filter(item => item.id !== id);
        onUpdate({ audioScript: newScript });
        if (activeItemId === id) setActiveItemId(null);
    };

    const handleAddItem = (index: number, isBreak: boolean = false) => {
        const newItem: AudioScriptItem = {
            id: crypto.randomUUID(),
            speaker: isBreak ? 'Break' : 'Narrator',
            text: isBreak ? '[2s]' : '',
            tone: 'Neutral',
            durationEstimate: 2,
            isBreak: isBreak
        };
        const newScript = [...audioScript];
        newScript.splice(index + 1, 0, newItem);
        onUpdate({ audioScript: newScript });
        setActiveItemId(newItem.id);
    };

    const handleGenerateAudioForItem = async (item: AudioScriptItem) => {
        if (!item.voiceId) {
            alert("Please select a voice first.");
            return;
        }
        if (!item.text) return;

        setGeneratingAudio(item.id);
        try {
            const audioUri = await generateSpeech(item.text, item.voiceId);
            handleUpdateItem(item.id, { audioUri });
        } catch (err) {
            console.error("Audio generation failed", err);
            alert("Failed to generate audio. Check console for details.");
        } finally {
            setGeneratingAudio(null);
        }
    };

    const handleVoiceSelect = (voice: ElevenLabsVoice) => {
        if (activeItemId) {
            const item = audioScript.find(i => i.id === activeItemId);
            if (item) {
                handleUpdateItem(activeItemId, { voiceId: voice.voice_id, voiceName: voice.name });
            }
        }
    };

    // --- Sequencer Logic ---
    const stopSequence = () => {
        setIsPlayingSequence(false);
        isPlayingRef.current = false;
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    };

    const playSequence = async () => {
        if (isPlayingSequence) {
            stopSequence();
            return;
        }

        setIsPlayingSequence(true);
        isPlayingRef.current = true;
        let accumulatedTime = 0;

        for (const item of audioScript) {
            if (!isPlayingRef.current) break;

            setActiveItemId(item.id);

            // Scroll item into view
            const element = document.getElementById(`timeline-item-${item.id}`);
            if (element && scrollContainerRef.current) {
                const container = scrollContainerRef.current;
                const offset = element.offsetLeft - container.offsetLeft - (container.clientWidth / 2) + (element.clientWidth / 2);
                container.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
            }

            const duration = item.durationEstimate || 2;

            if (item.isBreak) {
                const startTime = Date.now();
                while (Date.now() - startTime < duration * 1000) {
                    if (!isPlayingRef.current) break;
                    setCurrentTime(accumulatedTime + (Date.now() - startTime) / 1000);
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            } else if (item.audioUri) {
                await new Promise<void>((resolve) => {
                    const audio = new Audio(item.audioUri);
                    audioRef.current = audio;

                    audio.ontimeupdate = () => {
                        if (isPlayingRef.current) {
                            setCurrentTime(accumulatedTime + audio.currentTime);
                        }
                    };

                    audio.onended = () => {
                        resolve();
                    };

                    audio.play().catch(e => {
                        console.error("Playback failed", e);
                        resolve(); // Skip if error
                    });
                });
            } else {
                // Simulate reading time if no audio
                const startTime = Date.now();
                while (Date.now() - startTime < duration * 1000) {
                    if (!isPlayingRef.current) break;
                    setCurrentTime(accumulatedTime + (Date.now() - startTime) / 1000);
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }

            accumulatedTime += duration;
        }

        stopSequence();
        setCurrentTime(0);
        setActiveItemId(null);
    };

    // --- Render Helpers ---
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getItemWidth = (item: AudioScriptItem) => Math.max(60, (item.durationEstimate || 2) * 30);

    const calculatePlayheadPosition = () => {
        let pixelOffset = 0;
        let remainingTime = currentTime;

        for (const item of audioScript) {
            const itemDuration = item.durationEstimate || 2;
            const itemWidth = getItemWidth(item);

            if (remainingTime <= itemDuration) {
                // We are inside this item
                const progressPercent = remainingTime / itemDuration;
                return pixelOffset + (itemWidth * progressPercent);
            }

            remainingTime -= itemDuration;
            pixelOffset += itemWidth;
        }
        return pixelOffset; // End of timeline
    };

    const renderWaveform = (item: AudioScriptItem, isActive: boolean) => {
        // Deterministic pseudo-random height based on id
        const getBarHeight = (index: number) => {
            const seed = item.id.charCodeAt(index % item.id.length) + index;
            return 20 + (seed % 60) + '%';
        };

        return (
            <div className="flex items-end justify-center gap-[1px] h-full w-full px-1 opacity-80">
                {Array.from({ length: Math.max(5, (item.durationEstimate || 2) * 3) }).map((_, i) => (
                    <div
                        key={i}
                        className={`w-1 rounded-t-sm transition-all duration-300 ${isActive ? 'bg-indigo-500' : 'bg-slate-300'}`}
                        style={{ height: getBarHeight(i) }}
                    />
                ))}
            </div>
        );
    };

    const renderTimelineItem = (item: AudioScriptItem) => {
        const width = getItemWidth(item);
        const isActive = activeItemId === item.id;

        if (item.isBreak) {
            return (
                <div
                    id={`timeline-item-${item.id}`}
                    key={item.id}
                    className="h-full flex flex-col justify-end pb-2 relative group flex-shrink-0"
                    style={{ width: `${width}px` }}
                    title={`Break: ${item.durationEstimate}s`}
                >
                    <div className="w-full h-8 flex items-center justify-center">
                        <div className="w-full h-[2px] bg-slate-200 border-t border-dashed border-slate-400/50" />
                    </div>
                    <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.durationEstimate}s
                    </span>
                </div>
            );
        }

        return (
            <div
                id={`timeline-item-${item.id}`}
                key={item.id}
                onClick={() => setActiveItemId(item.id)}
                className={`h-full flex flex-col relative group flex-shrink-0 cursor-pointer transition-colors border-r border-slate-100
                    ${isActive ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}
                `}
                style={{ width: `${width}px` }}
            >
                {/* Header (Speaker) */}
                <div className={`px-2 py-1 text-[10px] font-bold truncate ${isActive ? 'text-indigo-600' : 'text-slate-500'}`}>
                    {item.speaker}
                </div>

                {/* Waveform Area */}
                <div className="flex-1 w-full relative">
                    {item.audioUri ? renderWaveform(item, isActive) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300 italic">
                            Pending
                        </div>
                    )}
                </div>

                {/* Selection Indicator */}
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />}
            </div>
        );
    };

    const activeItem = audioScript.find(i => i.id === activeItemId);

    // --- RENDER ---

    // Empty State
    if (audioScript.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 p-8">
                <div className="max-w-md text-center">
                    <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Générer le Scénario Audio</h2>
                    <p className="text-slate-500 mb-8">L'IA va transformer votre idée en dialogues et narration.</p>
                    {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                    >
                        {loading ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span> : null}
                        {loading ? 'Écriture en cours...' : 'Générer le Script'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-140px)] bg-slate-50 overflow-hidden relative">
            {/* LEFT SIDEBAR: VOICE LIBRARY */}
            <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white z-10 flex flex-col h-full">
                <VoiceLibrarySidebar
                    isOpen={true}
                    onClose={() => { }}
                    onSelectVoice={handleVoiceSelect}
                    currentVoiceId={activeItem?.voiceId}
                    variant="embedded"
                />
            </div>

            {/* CENTER: DOCUMENT EDITOR */}
            <div className="flex-1 flex flex-col min-w-0 relative h-full">
                {/* Toolbar */}
                <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0 z-20 shadow-sm">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold text-slate-800">Audio Script</h2>
                        <span className="text-sm text-slate-500">
                            {audioScript.length} lines • ~{totalDurationState.toFixed(0)}s total
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-100 text-sm font-medium transition-colors"
                        >
                            {isGenerating ? 'Generating...' : 'Regenerate Script'}
                        </button>
                        <button onClick={onNext} className="text-sm font-bold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors ml-2">
                            Suivant
                        </button>
                    </div>
                </div>

                {/* Scrollable Document Area (with padding for sticky timeline) */}
                <div className="flex-1 overflow-y-auto p-8 pb-64 bg-slate-50">
                    <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-xl min-h-[800px] p-12 border border-slate-200">
                        {audioScript.map((item, index) => {
                            if (item.isBreak) {
                                return (
                                    <div key={item.id} className="flex items-center justify-center py-4 opacity-50 hover:opacity-100 transition-opacity group relative">
                                        <div className="h-px bg-slate-300 w-full max-w-xs"></div>
                                        <span className="mx-4 text-xs font-mono text-slate-400 uppercase tracking-widest">Break ({item.durationEstimate}s)</span>
                                        <div className="h-px bg-slate-300 w-full max-w-xs"></div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                                            className="absolute right-0 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => setActiveItemId(item.id)}
                                    className={`group relative flex gap-6 mb-6 p-4 rounded-lg transition-all border-2
                                        ${activeItemId === item.id ? 'bg-indigo-50/30 border-indigo-100 shadow-sm' : 'border-transparent hover:bg-slate-50'}
                                    `}
                                >
                                    {/* Left Margin: Avatar */}
                                    <div className="w-12 flex-shrink-0 flex flex-col items-center gap-2 pt-1">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ring-2 ring-white
                                                ${item.speaker === 'Narrator' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-100 text-indigo-600'}
                                            `}
                                        >
                                            {item.speaker.substring(0, 2).toUpperCase()}
                                        </div>
                                        {item.audioUri && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); const audio = new Audio(item.audioUri); audio.play(); }}
                                                className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between mb-2">
                                            <input
                                                value={item.speaker}
                                                onChange={(e) => handleUpdateItem(item.id, { speaker: e.target.value })}
                                                className="font-bold text-sm text-slate-700 bg-transparent hover:bg-slate-200/50 rounded px-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            />
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-xs text-slate-400 font-mono">~{item.durationEstimate}s</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleGenerateAudioForItem(item); }}
                                                    className="text-xs bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-2 py-1 rounded shadow-sm transition-all"
                                                >
                                                    {item.audioUri ? 'Regenerate' : 'Generate'}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                                                    className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={item.text}
                                            onChange={(e) => handleUpdateItem(item.id, { text: e.target.value })}
                                            className="w-full bg-transparent resize-none focus:outline-none text-slate-800 leading-relaxed p-0 border-none focus:ring-0"
                                            rows={Math.max(2, Math.ceil(item.text.length / 80))}
                                            placeholder="Type dialogue here..."
                                        />
                                    </div>

                                    {/* Add Break / New Line Indicator (Hover) */}
                                    <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all z-20 flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAddItem(index); }}
                                            className="bg-indigo-600 text-white rounded-full p-1.5 shadow-lg hover:bg-indigo-700 hover:scale-110 transition-all"
                                            title="Add Dialogue Line"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAddItem(index, true); }}
                                            className="bg-slate-600 text-white rounded-full p-1.5 shadow-lg hover:bg-slate-700 hover:scale-110 transition-all"
                                            title="Add Break"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* STICKY BOTTOM PLAYER & TIMELINE */}
                <div className="fixed bottom-0 left-0 right-0 h-48 bg-white border-t border-slate-200 z-50 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] flex flex-col">

                    {/* Player Controls */}
                    <div className="h-16 border-b border-slate-100 flex items-center justify-between px-8 bg-slate-50/50">
                        <div className="flex items-center gap-4 w-1/3">
                            <div className="text-xs font-mono text-slate-500">
                                <span className="text-slate-900 font-bold">{formatTime(currentTime)}</span> / {formatTime(totalDurationState)}
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-6 w-1/3">
                            <button className="text-slate-400 hover:text-slate-600 transition-colors">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></svg>
                            </button>
                            <button
                                onClick={playSequence}
                                className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all"
                            >
                                {isPlayingSequence ? (
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                ) : (
                                    <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                )}
                            </button>
                            <button className="text-slate-400 hover:text-slate-600 transition-colors">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></svg>
                            </button>
                        </div>

                        <div className="flex items-center justify-end gap-4 w-1/3">
                            <div className="flex gap-4 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Active</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300"></div> Pending</span>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Track */}
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-x-auto custom-scrollbar relative bg-slate-50"
                    >
                        <div className="flex h-full items-stretch min-w-max px-4 relative">
                            {audioScript.map(renderTimelineItem)}

                            {/* Playhead Overlay */}
                            <div
                                className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-30 pointer-events-none transition-all duration-100 ease-linear"
                                style={{
                                    left: `${calculatePlayheadPosition() + 16}px`, // +16 for padding-left
                                    display: isPlayingSequence ? 'block' : 'none'
                                }}
                            >
                                <div className="w-3 h-3 -ml-1.5 bg-red-500 rounded-full shadow-sm mt-1" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step1BisDialogue;
