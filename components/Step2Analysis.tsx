import React from 'react';
import { StoryState, ProjectBackbone } from '../types';

interface Props {
    project?: ProjectBackbone;
    onUpdate: (updates: Partial<StoryState>) => void;
    onNext: () => void;
    onBack: () => void;
}

const Step2Analysis: React.FC<Props> = ({
    project, onUpdate, onNext, onBack
}) => {

    if (!project) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-slate-500">Analyse de votre concept en cours...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto pb-8">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-slate-900">Analyse du Projet</h1>
                    <p className="text-slate-500">Voici la structure générée par l'IA pour votre histoire.</p>
                </div>

                <div className="max-w-5xl mx-auto space-y-8">

                    {/* METADATA & CONFIG */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-600 w-6 h-6 rounded flex items-center justify-center text-xs">1</span>
                            Configuration
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-slate-400 text-xs uppercase font-bold mb-1">Titre</div>
                                <div className="font-medium text-slate-800">{project.meta_data.title || "Sans titre"}</div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-slate-400 text-xs uppercase font-bold mb-1">Ton</div>
                                <div className="font-medium text-slate-800">{project.config.tone_style}</div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-slate-400 text-xs uppercase font-bold mb-1">Cible</div>
                                <div className="font-medium text-slate-800">{project.config.target_audience}</div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-slate-400 text-xs uppercase font-bold mb-1">Format</div>
                                <div className="font-medium text-slate-800">{project.config.aspect_ratio}</div>
                            </div>
                        </div>
                    </section>

                    {/* CHARACTERS */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="bg-fuchsia-100 text-fuchsia-600 w-6 h-6 rounded flex items-center justify-center text-xs">2</span>
                            Personnages ({project.database.characters.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {project.database.characters.map((char, idx) => (
                                <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50 hover:border-fuchsia-200 transition-colors">
                                    <div className="font-bold text-slate-800 text-lg mb-1">{char.name}</div>
                                    <div className="text-xs font-bold text-fuchsia-600 uppercase mb-2">{char.role}</div>
                                    <p className="text-sm text-slate-600 leading-relaxed">{char.visual_seed.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* LOCATIONS */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="bg-emerald-100 text-emerald-600 w-6 h-6 rounded flex items-center justify-center text-xs">3</span>
                            Lieux ({project.database.locations.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {project.database.locations.map((loc, idx) => (
                                <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50 hover:border-emerald-200 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold text-slate-800 text-lg">{loc.name}</div>
                                        <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded">{loc.interior_exterior}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">{loc.environment_prompt}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* SCENES */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded flex items-center justify-center text-xs">4</span>
                            Séquencier ({project.database.scenes.length} scènes)
                        </h2>
                        <div className="space-y-3">
                            {project.database.scenes.map((scene, idx) => (
                                <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50 flex gap-4 items-start">
                                    <div className="font-mono text-slate-400 font-bold text-sm pt-1">#{scene.scene_index}</div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-1">{scene.slugline}</div>
                                        <p className="text-sm text-slate-600">{scene.narrative_goal}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                <button onClick={onBack} className="px-6 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-100 transition-colors">
                    Retour
                </button>

                <button
                    onClick={onNext}
                    className="px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
                >
                    Valider & Continuer
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
            </div>
        </div>
    );
};

export default Step2Analysis;
