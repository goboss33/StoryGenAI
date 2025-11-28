import React, { useState } from 'react';
import { ProjectBackbone, SceneTemplate, ShotTemplate } from '../types';
import { populateScriptAudio } from '../services/geminiService';

interface Props {
    project?: ProjectBackbone;
    onUpdate: (updates: Partial<any>) => void;
    onBack: () => void;
    onNext: () => void;
    // Legacy props (can be ignored or removed later)
    idea: string;
    totalDuration: number;
    pacing: any;
    language: string;
    tone: string;
    targetAudience: string;
    audioScript: any[];
    isNextStepReady?: boolean;
}

const Step1BisDialogue: React.FC<Props> = ({
    project, onUpdate, onBack, onNext
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!project) return <div>No Project Data</div>;

    const handlePopulateAudio = async () => {
        setLoading(true);
        setError('');
        try {
            const updatedProject = await populateScriptAudio(project);
            onUpdate({ project: updatedProject });
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to populate audio');
        } finally {
            setLoading(false);
        }
    };

    const renderShot = (shot: ShotTemplate, sceneIndex: number) => {
        return (
            <div key={shot.id} className="mb-6 pl-4 border-l-2 border-slate-200">
                <div className="flex items-baseline justify-between mb-2">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                        Plan {shot.shot_index} <span className="text-slate-400 font-normal">({shot.duration_sec}s)</span>
                    </h4>
                    <div className="text-xs text-slate-400 italic">
                        {shot.composition.shot_type} • {shot.composition.angle}
                    </div>
                </div>

                {/* Visual Description */}
                <p className="text-slate-600 mb-3 text-sm bg-slate-50 p-2 rounded-md border border-slate-100">
                    <span className="font-semibold text-slate-700">Visuel :</span> {shot.content.ui_description}
                </p>

                {/* Audio / Dialogue Section */}
                <div className="space-y-2">
                    {shot.audio?.dialogue && shot.audio.dialogue.length > 0 ? (
                        shot.audio.dialogue.map((line, idx) => (
                            <div key={idx} className="flex gap-4">
                                <div className="w-32 flex-shrink-0 text-right font-bold text-slate-800 text-sm pt-1">
                                    {line.speaker}
                                </div>
                                <div className="flex-1">
                                    <p className="text-slate-900 text-base font-serif leading-relaxed">
                                        "{line.text}"
                                    </p>
                                    {line.tone && (
                                        <span className="text-xs text-slate-400 italic">({line.tone})</span>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-slate-400 italic pl-36">
                            (Aucun dialogue)
                        </div>
                    )}

                    {/* Specific Audio Cues */}
                    {shot.audio?.specificAudioCues && (
                        <div className="flex gap-4 mt-2">
                            <div className="w-32 flex-shrink-0 text-right font-bold text-amber-600 text-xs pt-1">
                                SFX
                            </div>
                            <div className="flex-1 text-sm text-amber-700 italic bg-amber-50 px-2 py-1 rounded inline-block">
                                {shot.audio.specificAudioCues}
                            </div>
                        </div>
                    )}
                    {/* Audio Context */}
                    <div className="flex gap-4 mt-1">
                        <div className="w-32 flex-shrink-0 text-right font-bold text-slate-400 text-xs pt-1">
                            Ambiance
                        </div>
                        <div className="flex-1 text-xs text-slate-500">
                            {shot.audio?.audio_context || 'N/A'}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderScene = (scene: SceneTemplate, index: number) => {
        return (
            <div key={scene.id} className="mb-12 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <div className="border-b border-slate-100 pb-4 mb-6">
                    <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                        {index + 1}. {scene.slugline}
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">{scene.narrative_goal}</p>
                </div>
                <div className="space-y-6">
                    {scene.shots.map(shot => renderShot(shot, index))}
                </div>
            </div>
        );
    };

    const hasAudio = project.database.scenes.some(s => s.shots.some(shot => shot.audio?.dialogue?.length || shot.audio?.specificAudioCues));

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Scénario & Dialogues</h2>
                    <p className="text-slate-500 text-sm">Étape 3 : Peuplez votre structure avec des dialogues et du sound design.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handlePopulateAudio}
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2"
                    >
                        {loading ? <span className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></span> : null}
                        {hasAudio ? 'Régénérer l\'Audio' : 'Générer les Dialogues'}
                    </button>
                    <button
                        onClick={onNext}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                    >
                        Suivant : Storyboard
                    </button>
                </div>
            </div>

            {/* Script Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    {!hasAudio && !loading && (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Structure Prête</h3>
                            <p className="text-slate-500 mb-6 max-w-md mx-auto">
                                Votre structure visuelle est en place. Cliquez ci-dessus pour laisser l'IA écrire les dialogues et placer les effets sonores.
                            </p>
                            <button
                                onClick={handlePopulateAudio}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-xl"
                            >
                                Générer les Dialogues
                            </button>
                        </div>
                    )}

                    {project.database.scenes.map((scene, idx) => renderScene(scene, idx))}
                </div>
            </div>
        </div>
    );
};

export default Step1BisDialogue;
