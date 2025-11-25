import React, { useState, useEffect } from 'react';
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
    const [generatingAudio, setGeneratingAudio] = useState<string | null>(null); // ID of item currently generating audio

    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeItemId, setActiveItemId] = useState<string | null>(null); // ID of item currently selecting voice

    const handleGenerate = async () => {
        setLoading(true);
        setError('');
        try {
            const script = await generateAudioScript(idea, totalDuration, pacing, language);
            onUpdate({ audioScript: script });
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to generate audio script');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateItem = (id: string, updates: Partial<AudioScriptItem>) => {
        const newScript = audioScript.map(item => item.id === id ? { ...item, ...updates } : item);
        onUpdate({ audioScript: newScript });
    };

    const handleDeleteItem = (id: string) => {
        const newScript = audioScript.filter(item => item.id !== id);
        onUpdate({ audioScript: newScript });
    };

    const handleAddItem = (index: number) => {
        const newItem: AudioScriptItem = {
            id: crypto.randomUUID(),
            speaker: 'Narrator',
            text: '',
            tone: 'Neutral',
            durationEstimate: 2
        };
        const newScript = [...audioScript];
        newScript.splice(index + 1, 0, newItem);
        onUpdate({ audioScript: newScript });
    };

    const handleGenerateAudio = async (item: AudioScriptItem) => {
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

    const assignVoiceToSpeaker = (speakerName: string, voiceId: string, voiceName: string) => {
        const newScript = audioScript.map(item =>
            item.speaker === speakerName ? { ...item, voiceId, voiceName } : item
        );
        onUpdate({ audioScript: newScript });
    };

    const openVoiceSelector = (itemId: string) => {
        setActiveItemId(itemId);
        setIsSidebarOpen(true);
    };

    const handleVoiceSelected = (voice: ElevenLabsVoice) => {
        if (activeItemId) {
            const item = audioScript.find(i => i.id === activeItemId);
            if (item) {
                handleUpdateItem(activeItemId, { voiceId: voice.voice_id, voiceName: voice.name } as any); // Casting as any to avoid TS error if voiceName isn't in type yet

                // Optional: Ask to apply to all
                setTimeout(() => {
                    if (confirm(`Apply voice "${voice.name}" to all lines by ${item.speaker}?`)) {
                        assignVoiceToSpeaker(item.speaker, voice.voice_id, voice.name);
                    }
                }, 100);
            }
        }
    };

    const totalEstimatedDuration = audioScript.reduce((acc, item) => acc + (item.durationEstimate || 0), 0);

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="px-8 py-6 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Scénario Audio</h1>
                    <p className="text-slate-500 text-sm">Éditez les dialogues, choisissez les voix et générez l'audio.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Durée Estimée</div>
                        <div className={`text-xl font-mono font-bold ${totalEstimatedDuration > totalDuration + 5 ? 'text-red-500' : 'text-slate-700'}`}>
                            {totalEstimatedDuration.toFixed(1)}s <span className="text-slate-400 text-sm">/ {totalDuration}s</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8">
                {audioScript.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
                        <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Générer le Scénario</h2>
                        <p className="text-slate-500 mb-8">L'IA va écrire les dialogues et la narration basés sur votre idée "{idea}".</p>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm w-full">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span>
                                    Écriture en cours...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    Générer le Script
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto relative pl-8 border-l-2 border-slate-200 space-y-8 pb-20">
                        {audioScript.map((item, index) => (
                            <div key={item.id} className="relative group">
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[41px] top-6 w-5 h-5 rounded-full border-4 z-10 ${item.audioUri ? 'bg-green-500 border-green-200' : 'bg-white border-indigo-500'}`}></div>

                                {/* Card */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow group-hover:border-indigo-200">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex gap-2 items-center flex-wrap">
                                            <input
                                                value={item.speaker}
                                                onChange={(e) => handleUpdateItem(item.id, { speaker: e.target.value })}
                                                className="font-bold text-indigo-700 bg-transparent hover:bg-indigo-50 px-1 rounded outline-none w-32 sm:w-40"
                                                placeholder="Speaker"
                                            />
                                            <input
                                                value={item.tone || ''}
                                                onChange={(e) => handleUpdateItem(item.id, { tone: e.target.value })}
                                                className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full outline-none w-24 text-center"
                                                placeholder="Tone"
                                            />

                                            {/* Voice Selector Button */}
                                            <button
                                                onClick={() => openVoiceSelector(item.id)}
                                                className={`flex items-center gap-1 text-xs border rounded px-3 py-1.5 transition-colors ${item.voiceId
                                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                                                    }`}
                                            >
                                                {item.voiceId && (item as any).voiceName ? (item as any).voiceName : (item.voiceId ? 'Voice Selected' : 'Select Voice')}
                                                <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-slate-400">~{item.durationEstimate}s</span>

                                            {/* Generate Audio Button */}
                                            <button
                                                onClick={() => handleGenerateAudio(item)}
                                                disabled={!item.voiceId || generatingAudio === item.id}
                                                className={`p-1.5 rounded-full transition-colors ${item.audioUri
                                                        ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                                        : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                title={item.audioUri ? "Regenerate Audio" : "Generate Audio"}
                                            >
                                                {generatingAudio === item.id ? (
                                                    <span className="animate-spin block w-4 h-4 border-2 border-current border-t-transparent rounded-full"></span>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                                )}
                                            </button>

                                            <button
                                                onClick={() => handleDeleteItem(item.id)}
                                                className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                                                title="Delete line"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>

                                    <textarea
                                        value={item.text}
                                        onChange={(e) => handleUpdateItem(item.id, { text: e.target.value })}
                                        className="w-full text-lg text-slate-800 leading-relaxed outline-none resize-none bg-transparent placeholder-slate-300"
                                        rows={Math.max(2, Math.ceil(item.text.length / 60))}
                                        placeholder="Write dialogue here..."
                                    />

                                    {/* Audio Player */}
                                    {item.audioUri && (
                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                            <audio controls src={item.audioUri} className="w-full h-8" />
                                        </div>
                                    )}
                                </div>

                                {/* Add Button (Between items) */}
                                <div className="absolute -bottom-6 left-0 w-full flex justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                    <button
                                        onClick={() => handleAddItem(index)}
                                        className="pointer-events-auto bg-indigo-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"
                                        title="Insert line below"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Add Button at the end if list is not empty */}
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={() => handleAddItem(audioScript.length - 1)}
                                className="flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-800 transition-colors px-4 py-2 rounded-lg hover:bg-indigo-50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Ajouter une ligne
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-8 py-6 bg-white border-t border-slate-200 flex justify-between items-center">
                <button onClick={onBack} className="px-6 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-100 transition-colors">
                    Retour
                </button>
                <button
                    onClick={onNext}
                    disabled={audioScript.length === 0}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    Suivant : Storyboard Visuel
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
            </div>

            {/* Voice Library Sidebar */}
            <VoiceLibrarySidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                onSelectVoice={handleVoiceSelected}
                currentVoiceId={activeItemId ? audioScript.find(i => i.id === activeItemId)?.voiceId : undefined}
            />
        </div>
    );
};

export default Step1BisDialogue;
