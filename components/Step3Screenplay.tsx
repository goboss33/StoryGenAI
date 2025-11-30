import React, { useState, useEffect, useRef } from 'react';
import { ProjectBackbone, SceneTemplate, ScriptLine, CharacterTemplate } from '../types';
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
    const [activeLineId, setActiveLineId] = useState<string | null>(null);
    const [activeSceneIndex, setActiveSceneIndex] = useState<number | null>(null);

    // Derived state for the active line
    const activeLine = activeLineId && activeSceneIndex !== null && project
        ? project.database.scenes[activeSceneIndex].script_content?.lines.find(l => l.id === activeLineId)
        : null;

    // Derived state for active scene (if header is clicked)
    const activeScene = activeSceneIndex !== null && project && !activeLineId
        ? project.database.scenes[activeSceneIndex]
        : null;

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

    const updateSceneProperty = (sceneIndex: number, field: keyof SceneTemplate, value: any) => {
        const newScenes = [...project.database.scenes];
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], [field]: value };

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
            content: type === 'action' ? '' : '',
            speaker: type === 'dialogue' ? 'CHARACTER' : undefined,
            parenthetical: type === 'parenthetical' ? '' : undefined
        };

        const newLines = [...lines];
        newLines.splice(afterIndex + 1, 0, newLine);
        updateSceneLines(sceneIndex, newLines);
        setActiveLineId(newLine.id);
        setActiveSceneIndex(sceneIndex);
    };

    const removeLine = (sceneIndex: number, lineId: string) => {
        const scene = project.database.scenes[sceneIndex];
        const lines = scene.script_content?.lines || [];
        const newLines = lines.filter(l => l.id !== lineId);
        updateSceneLines(sceneIndex, newLines);
        if (activeLineId === lineId) {
            setActiveLineId(null);
            // Don't reset scene index so we stay in context
        }
    };

    // --- ICONS ---
    const Icons = {
        Slugline: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        Action: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
        Dialogue: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
        Parenthetical: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
        Transition: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>,
        Clock: () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
        Edit: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
    };

    const getIconForType = (type: ScriptLine['type']) => {
        switch (type) {
            case 'slugline': return <Icons.Slugline />;
            case 'action': return <Icons.Action />;
            case 'dialogue': return <Icons.Dialogue />;
            case 'parenthetical': return <Icons.Parenthetical />;
            case 'transition': return <Icons.Transition />;
            default: return <Icons.Action />;
        }
    };

    const renderSidebar = () => {
        if (activeScene && !activeLine) {
            return (
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-slate-800">Scene Properties</h3>
                    </div>

                    {/* Structured Slugline Editor */}
                    {activeScene.slugline_elements ? (
                        <>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Int/Ext</label>
                                    <select
                                        value={activeScene.slugline_elements.int_ext}
                                        onChange={(e) => updateSceneProperty(activeSceneIndex!, 'slugline_elements', { ...activeScene.slugline_elements, int_ext: e.target.value })}
                                        className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold uppercase text-sm"
                                    >
                                        <option value="INT.">INT.</option>
                                        <option value="EXT.">EXT.</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Time</label>
                                    <input
                                        value={activeScene.slugline_elements.time}
                                        onChange={(e) => updateSceneProperty(activeSceneIndex!, 'slugline_elements', { ...activeScene.slugline_elements, time: e.target.value })}
                                        className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold uppercase text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Location</label>
                                <input
                                    value={activeScene.slugline_elements.location}
                                    onChange={(e) => updateSceneProperty(activeSceneIndex!, 'slugline_elements', { ...activeScene.slugline_elements, location: e.target.value })}
                                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold uppercase text-sm"
                                />
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Slugline</label>
                            <input
                                value={activeScene.slugline}
                                onChange={(e) => updateSceneProperty(activeSceneIndex!, 'slugline', e.target.value)}
                                className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold uppercase text-sm"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Synopsis</label>
                        <textarea
                            value={activeScene.synopsis || ''}
                            onChange={(e) => updateSceneProperty(activeSceneIndex!, 'synopsis', e.target.value)}
                            className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[100px]"
                            placeholder="Brief description of the scene..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Duration (seconds)</label>
                        <input
                            type="number"
                            value={activeScene.estimated_duration_sec}
                            onChange={(e) => updateSceneProperty(activeSceneIndex!, 'estimated_duration_sec', parseInt(e.target.value))}
                            className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>
            );
        }

        if (!activeLine || activeSceneIndex === null) {
            return (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                    <div className="text-4xl mb-4 opacity-20"><Icons.Edit /></div>
                    <p>Select a line or scene header to edit.</p>
                </div>
            );
        }

        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-slate-800">Line Properties</h3>
                    <button
                        onClick={() => removeLine(activeSceneIndex, activeLine.id)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        title="Delete Line"
                    >
                        <Icons.Trash />
                    </button>
                </div>

                {/* Type Selector */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Type</label>
                    <div className="grid grid-cols-2 gap-2">
                        {['action', 'dialogue', 'parenthetical', 'transition'].map(type => (
                            <button
                                key={type}
                                onClick={() => handleLineChange(activeSceneIndex, activeLine.id, 'type', type)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 ${activeLine.type === type
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                    }`}
                            >
                                {getIconForType(type as any)} {type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dynamic Fields */}
                <div className="space-y-4">
                    {activeLine.type === 'dialogue' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Character</label>
                            <select
                                value={activeLine.speaker || ''}
                                onChange={(e) => handleLineChange(activeSceneIndex, activeLine.id, 'speaker', e.target.value)}
                                className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800"
                            >
                                <option value="">Select Character...</option>
                                {project.database.characters.map(char => (
                                    <option key={char.id} value={char.name.toUpperCase()}>{char.name}</option>
                                ))}
                                <option value="CUSTOM">Custom...</option>
                            </select>
                        </div>
                    )}

                    {activeLine.type === 'parenthetical' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Emotion / Direction</label>
                            <input
                                type="text"
                                value={activeLine.parenthetical || ''}
                                onChange={(e) => handleLineChange(activeSceneIndex, activeLine.id, 'parenthetical', e.target.value)}
                                className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="(happily)"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Content</label>
                        <textarea
                            value={activeLine.content}
                            onChange={(e) => handleLineChange(activeSceneIndex, activeLine.id, 'content', e.target.value)}
                            className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px] resize-none font-mono text-sm"
                            placeholder="Write here..."
                        />
                    </div>
                </div>
            </div>
        );
    };

    const renderScriptLine = (line: ScriptLine, index: number, sceneIndex: number) => {
        // Skip rendering inline sluglines as they are now in the header
        if (line.type === 'slugline') return null;

        const isActive = activeLineId === line.id;

        return (
            <div
                key={line.id}
                className={`group relative flex items-start gap-4 p-3 -mx-4 rounded-lg transition-all cursor-pointer ${isActive ? 'bg-indigo-50/50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
                onClick={(e) => {
                    e.stopPropagation();
                    setActiveLineId(line.id);
                    setActiveSceneIndex(sceneIndex);
                }}
            >
                {/* Icon Column */}
                <div className="w-8 flex-shrink-0 flex flex-col items-center pt-1">
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs select-none transition-colors ${isActive ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 group-hover:text-slate-400 bg-slate-50 group-hover:bg-slate-100'}`}>
                        {getIconForType(line.type)}
                    </div>
                </div>

                {/* Content Column */}
                <div className="flex-1 min-w-0 font-mono text-sm leading-relaxed">
                    {line.type === 'action' && (
                        <div className="text-slate-700 whitespace-pre-wrap">
                            {line.content || <span className="text-slate-300 italic">Action description...</span>}
                        </div>
                    )}

                    {line.type === 'dialogue' && (
                        <div className="max-w-lg mx-auto text-center">
                            <div className="font-bold text-slate-800 uppercase mb-0.5">{line.speaker || 'CHARACTER'}</div>
                            <div className="text-slate-800 whitespace-pre-wrap">{line.content || <span className="text-slate-300 italic">Dialogue...</span>}</div>
                        </div>
                    )}

                    {line.type === 'parenthetical' && (
                        <div className="max-w-md mx-auto text-center text-slate-500 italic">
                            ({line.parenthetical || line.content || 'emotion'})
                        </div>
                    )}

                    {line.type === 'transition' && (
                        <div className="text-right font-bold text-slate-800 uppercase tracking-widest">
                            {line.content || 'CUT TO:'}
                        </div>
                    )}
                </div>

                {/* Hover Add Buttons */}
                <div className="absolute -bottom-3 left-12 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); addLine(sceneIndex, 'action', index); }}
                        className="bg-white border border-slate-200 shadow-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-200"
                    >
                        + Action
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); addLine(sceneIndex, 'dialogue', index); }}
                        className="bg-white border border-slate-200 shadow-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-200"
                    >
                        + Dialogue
                    </button>
                </div>
            </div>
        );
    };

    const renderScene = (scene: SceneTemplate, index: number) => {
        const lines = scene.script_content?.lines || [];
        const hasScript = lines.length > 0;
        const isSelected = activeSceneIndex === index && !activeLineId;

        // Construct slugline display
        const sluglineText = scene.slugline_elements
            ? `${scene.slugline_elements.int_ext} ${scene.slugline_elements.location} - ${scene.slugline_elements.time}`
            : scene.slugline;

        return (
            <div key={scene.id} className="relative group">
                {/* Scene Header (Full Width) */}
                <div
                    className={`bg-slate-900 text-white px-8 py-4 cursor-pointer transition-colors border-y border-slate-950 ${isSelected ? 'bg-slate-800 ring-2 ring-indigo-500 ring-inset z-10 relative' : 'hover:bg-slate-800'}`}
                    onClick={() => {
                        setActiveSceneIndex(index);
                        setActiveLineId(null);
                    }}
                >
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-4">
                            <span className="font-mono font-bold text-slate-500 text-xs uppercase tracking-widest">Scene {index + 1}</span>
                            <span className="font-mono font-bold text-white text-base uppercase tracking-wide">{sluglineText}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-mono bg-black/30 px-2 py-1 rounded">
                            <Icons.Clock />
                            <span>{scene.estimated_duration_sec}s</span>
                        </div>
                    </div>

                    {/* Synopsis Display */}
                    {scene.synopsis && (
                        <div className="text-slate-400 text-sm font-serif italic pl-16 border-l-2 border-slate-700 ml-2 max-w-3xl">
                            "{scene.synopsis}"
                        </div>
                    )}
                </div>

                {/* Script Body */}
                <div className="px-16 py-8 min-h-[100px] relative hover:bg-slate-50/50 transition-colors" onClick={() => {
                    // If clicking empty space, select scene
                    setActiveSceneIndex(index);
                    setActiveLineId(null);
                }}>
                    {!hasScript ? (
                        <div className="text-center py-8 opacity-50 cursor-pointer hover:opacity-100 transition-opacity" onClick={(e) => {
                            e.stopPropagation();
                            addLine(index, 'action', -1);
                        }}>
                            <p className="italic mb-2 text-slate-400">Scene is empty.</p>
                            <button className="text-indigo-600 font-bold text-sm bg-indigo-50 px-3 py-1 rounded-lg">Start Writing</button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {lines.map((line, lIdx) => renderScriptLine(line, lIdx, index))}
                        </div>
                    )}

                    {/* Bottom Add Area */}
                    {hasScript && (
                        <div className="h-8 -mb-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer absolute bottom-0 left-0 right-0 z-10"
                            onClick={(e) => { e.stopPropagation(); addLine(index, 'action', lines.length - 1); }}
                        >
                            <div className="h-px bg-indigo-200 w-full absolute"></div>
                            <span className="relative bg-white px-2 text-xs text-indigo-500 font-bold border border-indigo-200 rounded-full z-10 shadow-sm">+ Add Line</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const hasAnyScript = project.database.scenes.some(s => s.script_content?.lines && s.script_content.lines.length > 0);

    return (
        <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
            {/* Top Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Screenplay Editor</h2>
                        <p className="text-xs text-slate-500">Step 3</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleGenerateScreenplay}
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2 border border-indigo-200 text-sm"
                    >
                        {loading ? <span className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></span> : '✨ Auto-Generate'}
                    </button>
                    <button
                        onClick={onNext}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2 text-sm"
                    >
                        Next Step
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            {/* Editor Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar (Properties) */}
                <div className="w-80 bg-white border-r border-slate-200 flex-shrink-0 overflow-y-auto z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                    {renderSidebar()}
                </div>

                {/* Main Script Area */}
                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                    {/* The "Page" - Now Full Width/Height */}
                    <div className="min-h-full pb-20">
                        {project.database.scenes.map((scene, idx) => renderScene(scene, idx))}

                        {/* Empty State / Welcome */}
                        {!hasAnyScript && !loading && (
                            <div className="text-center py-20 opacity-50">
                                <div className="text-6xl mb-4">🎬</div>
                                <h3 className="text-xl font-bold text-slate-900">Your screenplay starts here.</h3>
                                <p className="text-slate-500">Use the Auto-Generate button or start writing manually.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step3Screenplay;
