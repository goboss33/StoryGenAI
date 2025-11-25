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
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

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
    const playSequence = async () => {
        for (const item of audioScript) {
            if (item.isBreak) {
                await new Promise(resolve => setTimeout(resolve, (item.durationEstimate || 1) * 1000));
                continue;
            }
            if (item.audioUri) {
                setActiveItemId(item.id);
                const audio = new Audio(item.audioUri);
                await new Promise((resolve) => {
                    audio.onended = resolve;
                    audio.play();
                });
            }
        }
        setActiveItemId(null);
    };

    // --- Render Helpers ---
    const renderTimelineItem = (item: AudioScriptItem) => {
        const width = Math.max(40, (item.durationEstimate || 2) * 20);
        const isActive = activeItemId === item.id;

        if (item.isBreak) {
            return (
                <div
                    key={item.id}
                    className="h-full flex items-center justify-center relative group"
                    style={{ width: `${width}px` }}
                    title={`Break: ${item.durationEstimate}s`}
                >
                    <div className="w-full h-1 bg-slate-300 rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                    <span className="absolute text-[10px] text-slate-400 -top-4 opacity-0 group-hover:opacity-100">{item.durationEstimate}s</span>
                </div>
            );
        }

        return (
            <div
                key={item.id}
                onClick={() => setActiveItemId(item.id)}
                className={`h-12 rounded-md border flex items-center justify-center px-2 text-xs font-medium cursor-pointer transition-all whitespace-nowrap overflow-hidden text-ellipsis relative overflow-hidden
                    ${isActive ? 'border-indigo-500 ring-2 ring-indigo-200 z-10' : 'border-slate-200 hover:border-indigo-300'}
                    ${item.audioUri ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-600'}
                `}
                style={{ width: `${width}px` }}
                title={item.text}
            >
                {/* Waveform Visualization (CSS Pattern) */}
                {item.audioUri && (
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
                            backgroundSize: '4px 4px'
                        }}
                    />
                )}
                <span className="relative z-10">{item.speaker}</span>
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
                            {audioScript.length} lines • ~{audioScript.reduce((acc, item) => acc + (item.durationEstimate || 0), 0).toFixed(0)}s total
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={playSequence}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Play All
                        </button>
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
                <div className="flex-1 overflow-y-auto p-8 pb-48 bg-slate-50">
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

                {/* STICKY BOTTOM TIMELINE */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-white/90 backdrop-blur-md border-t border-slate-200 flex-shrink-0 flex flex-col z-30 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
                    <div className="h-8 border-b border-slate-100 flex items-center px-4 justify-between text-xs text-slate-500">
                        <span>Timeline Visualization</span>
                        <div className="flex gap-4">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-100 border border-emerald-300"></div> Audio Ready</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-white border border-slate-300"></div> Pending</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300 opacity-50"></div> Break</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-x-auto custom-scrollbar p-4 relative">
                        <div className="flex h-full items-center space-x-1 min-w-max px-4">
                            {audioScript.map(renderTimelineItem)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step1BisDialogue;
