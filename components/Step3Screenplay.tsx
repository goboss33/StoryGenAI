import React, { useState } from 'react';
import { ProjectBackbone, SceneTemplate, ScriptLine } from '../types';
import { generateScreenplay } from '../services/geminiService';

interface Props {
    project?: ProjectBackbone;
    onUpdate: (updates: Partial<any>) => void;
    onBack: () => void;
    onNext: () => void;
}

const Step3Screenplay: React.FC<Props> = ({
    project, onUpdate, onBack, onNext
}) => {
    const [loading, setLoading] = useState(false);
    const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);

    if (!project) return <div>No Project Data</div>;

    const handleGenerateScreenplay = async () => {
        setLoading(true);
        try {
            const updatedProject = await generateScreenplay(project);
            onUpdate({ project: updatedProject });
        } catch (err) {
            console.error(err);
            alert('Failed to generate screenplay');
        } finally {
            setLoading(false);
        }
    };

    const updateSceneLines = (sceneIndex: number, newLines: ScriptLine[]) => {
        const newScenes = [...project.database.scenes];
        const scene = newScenes[sceneIndex];

        if (!scene.script_content) {
            scene.script_content = { lines: [] };
        }

        scene.script_content.lines = newLines;

        onUpdate({
            project: {
                ...project,
                database: {
                    ...project.database,
                    scenes: newScenes
                }
            }
        });
    };

    const handleLineChange = (sceneIndex: number, lineId: string, field: keyof ScriptLine, value: any) => {
        const scene = project.database.scenes[sceneIndex];
        const lines = scene.script_content?.lines || [];
        const newLines = lines.map(line =>
            line.id === lineId ? { ...line, [field]: value } : line
        );
        updateSceneLines(sceneIndex, newLines);
    };

    const addLine = (sceneIndex: number, type: ScriptLine['type'], afterIndex: number) => {
        const scene = project.database.scenes[sceneIndex];
        const lines = scene.script_content?.lines || [];
        const newLine: ScriptLine = {
            id: crypto.randomUUID(),
            type,
            content: type === 'slugline' ? 'INT. LOCATION - DAY' : '',
            speaker: type === 'dialogue' ? 'CHARACTER' : undefined,
            parenthetical: type === 'parenthetical' ? '' : undefined
        };

        const newLines = [...lines];
        newLines.splice(afterIndex + 1, 0, newLine);
        updateSceneLines(sceneIndex, newLines);
    };

    const removeLine = (sceneIndex: number, lineId: string) => {
        const scene = project.database.scenes[sceneIndex];
        const lines = scene.script_content?.lines || [];
        const newLines = lines.filter(l => l.id !== lineId);
        updateSceneLines(sceneIndex, newLines);
    };

    const renderScriptLine = (line: ScriptLine, index: number, sceneIndex: number) => {
        return (
            <div key={line.id} className="group relative mb-2 hover:bg-slate-50 p-2 rounded -mx-2 transition-colors">
                {/* Type Indicator (Hover) */}
                <div className="absolute -left-20 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <select
                        value={line.type}
                        onChange={(e) => handleLineChange(sceneIndex, line.id, 'type', e.target.value)}
                        className="text-xs bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-500"
                    >
                        <option value="slugline">Slugline</option>
                        <option value="action">Action</option>
                        <option value="dialogue">Dialogue</option>
                        <option value="parenthetical">Parenthetical</option>
                        <option value="transition">Transition</option>
                    </select>
                    <button onClick={() => removeLine(sceneIndex, line.id)} className="text-red-400 hover:text-red-600 px-1">×</button>
                </div>

                {/* Content Rendering based on Type */}
                {line.type === 'slugline' && (
                    <input
                        className="w-full bg-transparent font-mono font-bold text-slate-800 uppercase tracking-widest border-none focus:ring-0 p-0"
                        value={line.content}
                        onChange={(e) => handleLineChange(sceneIndex, line.id, 'content', e.target.value)}
                        placeholder="INT. LOCATION - TIME"
                    />
                )}

                {line.type === 'action' && (
                    <textarea
                        className="w-full bg-transparent font-mono text-slate-700 resize-none border-none focus:ring-0 p-0 leading-relaxed"
                        rows={Math.max(1, Math.ceil(line.content.length / 80))}
                        value={line.content}
                        onChange={(e) => handleLineChange(sceneIndex, line.id, 'content', e.target.value)}
                        placeholder="Action description..."
                    />
                )}

                {line.type === 'dialogue' && (
                    <div className="pl-12 pr-12 text-center max-w-lg mx-auto">
                        <input
                            className="w-full bg-transparent font-mono font-bold text-slate-800 text-center uppercase border-none focus:ring-0 p-0 mb-1"
                            value={line.speaker || ''}
                            onChange={(e) => handleLineChange(sceneIndex, line.id, 'speaker', e.target.value)}
                            placeholder="CHARACTER"
                        />
                        <textarea
                            className="w-full bg-transparent font-mono text-slate-800 text-center resize-none border-none focus:ring-0 p-0"
                            rows={Math.max(1, Math.ceil(line.content.length / 50))}
                            value={line.content}
                            onChange={(e) => handleLineChange(sceneIndex, line.id, 'content', e.target.value)}
                            placeholder="Dialogue..."
                        />
                    </div>
                )}

                {line.type === 'parenthetical' && (
                    <div className="pl-16 pr-16 text-center max-w-md mx-auto">
                        <input
                            className="w-full bg-transparent font-mono text-slate-500 italic text-center border-none focus:ring-0 p-0"
                            value={line.parenthetical || line.content}
                            onChange={(e) => {
                                handleLineChange(sceneIndex, line.id, 'parenthetical', e.target.value);
                                handleLineChange(sceneIndex, line.id, 'content', e.target.value);
                            }}
                            placeholder="(emotion)"
                        />
                    </div>
                )}

                {line.type === 'transition' && (
                    <div className="text-right">
                        <input
                            className="bg-transparent font-mono font-bold text-slate-800 uppercase tracking-widest border-none focus:ring-0 p-0 text-right"
                            value={line.content}
                            onChange={(e) => handleLineChange(sceneIndex, line.id, 'content', e.target.value)}
                            placeholder="CUT TO:"
                        />
                    </div>
                )}

                {/* Add Line Buttons (Hover) */}
                <div className="absolute -bottom-3 left-0 w-full h-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex justify-center items-center">
                    <div className="bg-white shadow-sm border border-slate-200 rounded-full px-2 py-0.5 flex gap-2 scale-75">
                        <button onClick={() => addLine(sceneIndex, 'action', index)} className="text-[10px] font-bold text-slate-500 hover:text-indigo-600">+ Action</button>
                        <button onClick={() => addLine(sceneIndex, 'dialogue', index)} className="text-[10px] font-bold text-slate-500 hover:text-indigo-600">+ Dialogue</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderSceneEditor = (scene: SceneTemplate, index: number) => {
        const lines = scene.script_content?.lines || [];
        const hasScript = lines.length > 0;

        return (
            <div key={scene.id} className="mb-12">
                {/* Scene Header */}
                <div className="flex items-baseline justify-between mb-4 border-b border-slate-200 pb-2">
                    <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest font-mono">
                        Scene {index + 1}
                    </h3>
                    <span className="text-xs font-mono text-slate-400">{scene.estimated_duration_sec}s</span>
                </div>

                <div className="bg-white min-h-[200px] p-12 shadow-sm border border-slate-200 rounded-sm font-mono text-sm leading-relaxed max-w-4xl mx-auto relative">
                    {/* Paper Texture / Styling */}

                    {!hasScript ? (
                        <div className="text-center py-12 opacity-50">
                            <p className="italic mb-4">Scene is empty.</p>
                            <button onClick={() => addLine(index, 'slugline', -1)} className="text-indigo-600 underline">Start writing</button>
                        </div>
                    ) : (
                        <div>
                            {lines.map((line, lIdx) => renderScriptLine(line, lIdx, index))}
                        </div>
                    )}

                    {/* Bottom Add Button */}
                    {hasScript && (
                        <div className="mt-8 pt-4 border-t border-dashed border-slate-200 text-center opacity-0 hover:opacity-100 transition-opacity">
                            <button onClick={() => addLine(index, 'action', lines.length - 1)} className="text-xs text-slate-400 hover:text-indigo-600">+ Add Line at End</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const hasAnyScript = project.database.scenes.some(s => s.script_content?.lines && s.script_content.lines.length > 0);

    return (
        <div className="h-full flex flex-col bg-slate-100">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between flex-shrink-0 sticky top-0 z-10 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <span className="text-indigo-600">Step 3:</span> Screenplay
                    </h2>
                    <p className="text-slate-500 text-sm">Write your script in standard format.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleGenerateScreenplay}
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2 border border-indigo-200"
                    >
                        {loading ? <span className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></span> : null}
                        {hasAnyScript ? 'Regenerate Screenplay' : 'Generate Screenplay'}
                    </button>
                    <button
                        onClick={onNext}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2"
                    >
                        Next: Shot List
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-5xl mx-auto">
                    {!hasAnyScript && !loading && (
                        <div className="text-center py-20">
                            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-3">Ready to Write</h3>
                            <p className="text-slate-500 mb-8 max-w-md mx-auto text-lg">
                                Your story structure is set. Now let's turn it into a proper screenplay with action and dialogue.
                            </p>
                            <button
                                onClick={handleGenerateScreenplay}
                                className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
                            >
                                ✨ Generate Screenplay
                            </button>
                        </div>
                    )}

                    {project.database.scenes.map((scene, idx) => renderSceneEditor(scene, idx))}
                </div>
            </div>
        </div>
    );
};

export default Step3Screenplay;
