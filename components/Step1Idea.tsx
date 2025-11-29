import React, { useState } from 'react';
import { StoryState, Pacing, TONES, TARGET_AUDIENCES, AspectRatio, PRESET_STYLES, VIDEO_TYPES } from '../types';

interface Props {
    idea: string;
    totalDuration: number;
    pacing: Pacing;
    language: string;
    tone: string;
    targetAudience: string;
    videoType: string;
    visualStyle: string;
    aspectRatio: AspectRatio;
    onUpdate: (updates: Partial<StoryState>) => void;
    onNext: () => void;
    onImport: (data: StoryState) => void;
    isDebugMode: boolean;
    setIsDebugMode: (mode: boolean) => void;
}

const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
];

const DURATION_MARKERS = [
    { value: 10, label: 'Pub', desc: '10s' },
    { value: 20, label: 'Short', desc: '20s' },
    { value: 60, label: 'Produit', desc: '1m' },
    { value: 600, label: 'Vlog', desc: '10m' },
    { value: 900, label: 'Tuto', desc: '15m' },
    { value: 3600, label: 'Podcast', desc: '60m' },
];

const Step1Idea: React.FC<Props> = ({
    idea, totalDuration, pacing, language, tone, targetAudience, videoType, visualStyle, aspectRatio,
    onUpdate, onNext
}) => {
    const isComplete = idea.length > 10;
    const [isLangOpen, setIsLangOpen] = useState(false);

    const selectedLang = LANGUAGES.find(l => l.name === language) || LANGUAGES[0];

    // Helper to format duration
    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m`;
    };

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex-1 overflow-y-auto pb-10 pr-2">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-slate-900">Concept & Paramètres</h1>
                    <p className="text-slate-500">Définissez l'ADN de votre vidéo.</p>
                </div>

                <div className="max-w-4xl mx-auto space-y-6">

                    {/* SECTION 1: L'IDÉE */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-600 w-6 h-6 rounded flex items-center justify-center text-xs">1</span>
                            Votre Idée
                        </h2>
                        <textarea
                            value={idea}
                            onChange={(e) => onUpdate({ idea: e.target.value })}
                            placeholder="Décrivez votre idée de vidéo ici... (ex: Un tutoriel dynamique sur la cuisine italienne, un vlog de voyage au Japon, une publicité pour une nouvelle boisson énergisante...)"
                            className="w-full h-32 p-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-lg resize-none shadow-inner placeholder:text-slate-300"
                        />
                    </section>

                    {/* SECTION 2: FORMAT & TYPE */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-600 w-6 h-6 rounded flex items-center justify-center text-xs">2</span>
                            Format & Type
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Format Selector */}
                            <div className="col-span-1">
                                <label className="text-sm font-bold text-slate-600 uppercase tracking-wider block mb-3">Format</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => onUpdate({ aspectRatio: '16:9' })}
                                        className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${aspectRatio === '16:9'
                                            ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-500 text-indigo-700'
                                            : 'border-slate-200 hover:border-indigo-200 text-slate-500'
                                            }`}
                                    >
                                        <div className="w-12 h-8 border-2 border-current rounded-sm flex items-center justify-center">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>
                                        </div>
                                        <span className="text-xs font-bold">YouTube (16:9)</span>
                                    </button>
                                    <button
                                        onClick={() => onUpdate({ aspectRatio: '9:16' })}
                                        className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${aspectRatio === '9:16'
                                            ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-500 text-indigo-700'
                                            : 'border-slate-200 hover:border-indigo-200 text-slate-500'
                                            }`}
                                    >
                                        <div className="w-6 h-10 border-2 border-current rounded-sm flex items-center justify-center">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93v6.14c0 3.48-2.42 5.7-5.83 5.78-3.45.08-6.47-2.3-6.68-5.7-.2-3.48 2.58-6.19 6.05-6.24.62-.01 1.24.08 1.84.25v4.03c-.29-.11-.61-.16-.92-.15-1.42.06-2.57 1.23-2.55 2.65.02 1.43 1.18 2.57 2.6 2.55 1.43-.02 2.58-1.17 2.6-2.6V.02z" /></svg>
                                        </div>
                                        <span className="text-xs font-bold">TikTok (9:16)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Video Type Selector */}
                            <div className="col-span-2">
                                <label className="text-sm font-bold text-slate-600 uppercase tracking-wider block mb-3">Type de Vidéo</label>
                                <select
                                    value={videoType}
                                    onChange={(e) => onUpdate({ videoType: e.target.value })}
                                    className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                                >
                                    <option value="">Sélectionner un type...</option>
                                    {VIDEO_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Duration Slider */}
                        <div className="mt-8">
                            <div className="flex justify-between items-end mb-4">
                                <label className="text-sm font-bold text-slate-600 uppercase tracking-wider">Durée Souhaitée</label>
                                <span className="text-3xl font-bold text-indigo-600">{formatDuration(totalDuration)}</span>
                            </div>
                            <div className="relative px-2 mb-8">
                                <input
                                    type="range"
                                    min="5"
                                    max="5400" // 90 mins
                                    step="5"
                                    value={totalDuration}
                                    onChange={(e) => onUpdate({ totalDuration: parseInt(e.target.value) })}
                                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 relative z-10"
                                />
                                {/* Markers */}
                                <div className="absolute top-6 left-0 right-0 h-4 pointer-events-none">
                                    {DURATION_MARKERS.map(marker => {
                                        const percent = ((marker.value - 5) / (5400 - 5)) * 100;
                                        return (
                                            <div key={marker.value} className="absolute flex flex-col items-center transform -translate-x-1/2" style={{ left: `${percent}%` }}>
                                                <div className="w-0.5 h-2 bg-slate-300 mb-1"></div>
                                                <div className="bg-slate-100 text-[10px] font-bold text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap group relative cursor-help pointer-events-auto">
                                                    {marker.desc}
                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                                                        {marker.label}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 3: STYLE & CIBLE */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-600 w-6 h-6 rounded flex items-center justify-center text-xs">3</span>
                            Style & Audience
                        </h2>

                        {/* Visual Style Carousel */}
                        <div className="mb-8">
                            <label className="text-sm font-bold text-slate-600 uppercase tracking-wider block mb-3">Style Visuel</label>
                            <div className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                {PRESET_STYLES.map(style => (
                                    <button
                                        key={style.name}
                                        onClick={() => onUpdate({ visualStyle: style.name, stylePrompt: style.prompt })}
                                        className={`flex-none w-48 snap-center group text-left transition-all relative overflow-hidden rounded-xl border-2 ${visualStyle === style.name
                                            ? 'border-indigo-600 ring-2 ring-indigo-200 ring-offset-2'
                                            : 'border-transparent hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="aspect-video w-full bg-slate-100 relative">
                                            <img
                                                src={style.image}
                                                alt={style.name}
                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            />
                                            {visualStyle === style.name && (
                                                <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                                                    <div className="bg-white rounded-full p-1 shadow-lg">
                                                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 bg-white">
                                            <span className={`text-sm font-bold block truncate ${visualStyle === style.name ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                {style.name}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Tone Selector */}
                            <div>
                                <label className="text-sm font-bold text-slate-600 uppercase tracking-wider block mb-2">Ton / Style</label>
                                <select
                                    value={tone}
                                    onChange={(e) => onUpdate({ tone: e.target.value })}
                                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                                >
                                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            {/* Audience Selector */}
                            <div>
                                <label className="text-sm font-bold text-slate-600 uppercase tracking-wider block mb-2">Public Cible</label>
                                <select
                                    value={targetAudience}
                                    onChange={(e) => onUpdate({ targetAudience: e.target.value })}
                                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                                >
                                    {TARGET_AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>

                            {/* Language Selector */}
                            <div>
                                <label className="text-sm font-bold text-slate-600 uppercase tracking-wider block mb-2">Langue</label>
                                <div className="relative">
                                    <button
                                        onClick={() => setIsLangOpen(!isLangOpen)}
                                        className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 flex items-center justify-between hover:border-indigo-300 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{selectedLang.flag}</span>
                                            <span>{selectedLang.name}</span>
                                        </div>
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    {isLangOpen && (
                                        <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                                            {LANGUAGES.map(lang => (
                                                <button
                                                    key={lang.code}
                                                    onClick={() => { onUpdate({ language: lang.name }); setIsLangOpen(false); }}
                                                    className="w-full p-3 flex items-center gap-3 hover:bg-indigo-50 text-left text-sm border-b border-slate-50 last:border-0"
                                                >
                                                    <span className="text-xl">{lang.flag}</span>
                                                    <span className="font-medium text-slate-700">{lang.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </section>

                </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-6 border-t border-slate-100 flex justify-end items-center">
                <button
                    onClick={onNext}
                    disabled={!isComplete || !videoType || !visualStyle}
                    className={`px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center gap-3 ${isComplete && videoType && visualStyle
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 hover:-translate-y-1'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    Analyser le Concept
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
            </div>
        </div>
    );
};

export default Step1Idea;
