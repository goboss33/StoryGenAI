import React, { useState } from 'react';
import { StoryState, Pacing } from '../types';

interface Props {
    idea: string;
    totalDuration: number;
    pacing: Pacing;
    language: string;
    onUpdate: (updates: Partial<StoryState>) => void;
    onNext: () => void;
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

const PACING_OPTIONS: { value: Pacing; label: string; desc: string; avgShot: string }[] = [
    { value: 'slow', label: 'Lent / Atmosphérique', desc: 'Plans fixes longs, contemplatif.', avgShot: '8-10s' },
    { value: 'standard', label: 'Standard / Classique', desc: 'Rythme TV/Cinéma équilibré.', avgShot: '5-6s' },
    { value: 'fast', label: 'Rapide / Action', desc: 'Coupes dynamiques, clip.', avgShot: '2-4s' },
];

const Step1Idea: React.FC<Props> = ({
    idea, totalDuration, pacing, language,
    onUpdate, onNext
}) => {
    const isComplete = idea.length > 10;
    const [isLangOpen, setIsLangOpen] = useState(false);

    const selectedLang = LANGUAGES.find(l => l.name === language) || LANGUAGES[0];

    // Estimate shots
    const getEstShots = () => {
        let avg = 5;
        if (pacing === 'slow') avg = 8;
        if (pacing === 'fast') avg = 3;
        return Math.max(1, Math.round(totalDuration / avg));
    };

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex-1 overflow-y-auto pb-10 pr-2">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-slate-900">L'Idée</h1>
                    <p className="text-slate-500">Tout commence par une histoire. Définissez votre concept.</p>
                </div>

                <div className="max-w-4xl mx-auto space-y-8">

                    {/* SECTION 1: L'IDÉE */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-600 w-6 h-6 rounded flex items-center justify-center text-xs">1</span>
                                Pitch & Langue
                            </h2>
                            {/* Language Selector */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsLangOpen(!isLangOpen)}
                                    className="text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:border-indigo-300 transition-colors"
                                >
                                    <span>{selectedLang.flag}</span>
                                    <span>{selectedLang.name}</span>
                                </button>
                                {isLangOpen && (
                                    <div className="absolute right-0 z-20 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                                        {LANGUAGES.map(lang => (
                                            <button
                                                key={lang.code}
                                                onClick={() => { onUpdate({ language: lang.name }); setIsLangOpen(false); }}
                                                className="w-full p-3 flex items-center gap-3 hover:bg-indigo-50 text-left text-sm border-b border-slate-50 last:border-0"
                                            >
                                                <span className="text-lg">{lang.flag}</span>
                                                <span className="font-medium text-slate-700">{lang.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <textarea
                            value={idea}
                            onChange={(e) => onUpdate({ idea: e.target.value })}
                            placeholder="Pitch de votre film : Un robot solitaire découvre une fleur dans une décharge cybernétique..."
                            className="w-full h-40 p-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-lg resize-none shadow-inner placeholder:text-slate-300"
                        />
                    </section>

                    {/* SECTION 2: PARAMÈTRES */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-600 w-6 h-6 rounded flex items-center justify-center text-xs">2</span>
                            Format & Rythme
                        </h2>

                        <div className="space-y-6">
                            {/* Duration Slider */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="text-sm font-bold text-slate-600 uppercase tracking-wider">Durée Totale</label>
                                    <span className="text-2xl font-bold text-indigo-600">{totalDuration}s</span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="180"
                                    step="5"
                                    value={totalDuration}
                                    onChange={(e) => onUpdate({ totalDuration: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2">
                                    <span>10s (Teaser)</span>
                                    <span>3m (Court Métrage)</span>
                                </div>
                            </div>

                            {/* Pacing Cards */}
                            <div>
                                <label className="text-sm font-bold text-slate-600 uppercase tracking-wider block mb-3">Rythme de montage</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {PACING_OPTIONS.map(opt => (
                                        <div
                                            key={opt.value}
                                            onClick={() => onUpdate({ pacing: opt.value })}
                                            className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden ${pacing === opt.value ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-indigo-200 bg-slate-50/50'}`}
                                        >
                                            <div className="font-bold text-sm text-slate-800 mb-1">{opt.label.split(' / ')[0]}</div>
                                            <div className="text-xs text-slate-500 leading-snug">{opt.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Info Footer */}
                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Estimation IA : <span className="font-bold text-slate-700">~{getEstShots()} plans</span> seront générés à l'étape 3.
                        </div>
                    </section>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-6 border-t border-slate-100 flex justify-end items-center">
                <button
                    onClick={onNext}
                    disabled={!isComplete}
                    className={`px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center gap-3 ${isComplete
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 hover:-translate-y-1'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    Définir le Style
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
            </div>
        </div>
    );
};

export default Step1Idea;
