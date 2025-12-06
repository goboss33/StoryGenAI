import React, { useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface Props {
    onBack: () => void;
    onNext: () => void;
}

// --- DUMMY DATA REMOVED --- 
// Using props provided by App.tsx

interface Props {
    project?: import('../types').ProjectBackbone;
    onBack: () => void;
    onNext: () => void;
}


// --- ICONS ---
const Icons = {
    Play: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
    Pause: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>,
    Settings: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Flip: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    Video: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    Image: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Grid: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    List: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
    Camera: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Audio: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
    User: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Close: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    ChevronLeft: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
    ChevronRight: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
    Eye: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
    Clock: () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

// --- COMPONENTS ---

const LargeShotCard: React.FC<{ shot: any }> = ({ shot }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [activeTab, setActiveTab] = useState<'visuals' | 'audio'>('visuals');

    return (
        <div className="relative group perspective-1000 w-full mb-8">
            <div className={`relative w-full transition-all duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>

                {/* FRONT: Detailed Editor */}
                <div className="backface-hidden bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px] flex flex-col">
                    {/* Header Bar */}
                    <div className="h-16 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-6">
                        <div className="flex items-center gap-6">
                            <span className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center text-sm font-bold shadow-sm">#{shot.number}</span>

                            {/* Editable Duration */}
                            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <input
                                    type="text"
                                    defaultValue="3s"
                                    className="w-8 text-sm font-bold text-slate-700 outline-none bg-transparent text-center"
                                />
                            </div>
                        </div>

                        {/* Prominent Tabs */}
                        <div className="flex bg-slate-200/50 p-1.5 rounded-xl gap-1">
                            <button
                                onClick={() => setActiveTab('visuals')}
                                className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'visuals' ? 'bg-indigo-600 text-white shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                            >
                                Visuals
                            </button>
                            <button
                                onClick={() => setActiveTab('audio')}
                                className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'audio' ? 'bg-indigo-600 text-white shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                            >
                                Audio
                            </button>
                        </div>

                        <button
                            onClick={() => setIsFlipped(true)}
                            className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-lg hover:bg-indigo-50"
                            title="Preview Visuals"
                        >
                            <Icons.Flip />
                        </button>
                    </div>

                    {/* Editor Body */}
                    <div className="flex-1 p-6">
                        {activeTab === 'visuals' && (
                            <div className="grid grid-cols-12 gap-8 animate-fadeIn h-full">
                                {/* Left Column: Visual Details */}
                                <div className="col-span-7 space-y-6">
                                    {/* Moved Dropdowns */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shot Type</label>
                                            <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-medium text-slate-700 focus:border-indigo-500 outline-none transition-all" defaultValue={shot.type}>
                                                <option>Wide Shot</option>
                                                <option>Medium Shot</option>
                                                <option>Close-up</option>
                                                <option>Extreme Close-up</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Camera Angle</label>
                                            <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-medium text-slate-700 focus:border-indigo-500 outline-none transition-all" defaultValue={shot.camera.angle}>
                                                <option>Eye Level</option>
                                                <option>Low Angle</option>
                                                <option>High Angle</option>
                                                <option>Overhead</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Action Description</label>
                                        <textarea
                                            className="w-full h-32 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none transition-all"
                                            defaultValue={shot.description}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Movement</label>
                                            <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:border-indigo-500 outline-none" defaultValue={shot.camera.movement}>
                                                <option>Static</option>
                                                <option>Pan</option>
                                                <option>Tilt</option>
                                                <option>Tracking</option>
                                                <option>Handheld</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lighting</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:border-indigo-500 outline-none"
                                                defaultValue={shot.camera.lighting}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Focal Length</label>
                                            <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:border-indigo-500 outline-none" defaultValue={shot.camera.focal_length}>
                                                <option>14mm (Ultra Wide)</option>
                                                <option>24mm (Wide)</option>
                                                <option>35mm (Standard Wide)</option>
                                                <option>50mm (Standard)</option>
                                                <option>85mm (Portrait)</option>
                                                <option>100mm (Macro)</option>
                                                <option>200mm (Telephoto)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Depth of Field</label>
                                            <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:border-indigo-500 outline-none" defaultValue={shot.camera.depth_of_field}>
                                                <option>Deep Focus (Everything in focus)</option>
                                                <option>Standard</option>
                                                <option>Shallow Focus (Blurry background)</option>
                                                <option>Macro (Extremely shallow)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Assets (Merged) */}
                                <div className="col-span-5 space-y-6 border-l border-slate-100 pl-8">
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-2">
                                            <Icons.User /> Cast
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {shot.assets.filter((a: string) => ['Scientist', 'Lab Coat'].includes(a)).length === 0 && (
                                                <span className="text-xs text-slate-400 italic">No cast.</span>
                                            )}
                                            {shot.assets.map((asset: string, i: number) => (
                                                <span key={i} className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                                                    {asset}
                                                    <button className="ml-1 text-indigo-400 hover:text-indigo-600">×</button>
                                                </span>
                                            ))}
                                            <button className="inline-flex items-center px-2 py-1 rounded bg-white text-slate-400 text-xs font-medium border border-dashed border-slate-300 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2">
                                            <Icons.Video /> Props
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {shot.assets.filter((a: string) => !['Scientist', 'Lab Coat'].includes(a)).length === 0 && (
                                                <span className="text-xs text-slate-400 italic">No props.</span>
                                            )}
                                            {shot.assets.filter((a: string) => !['Scientist', 'Lab Coat'].includes(a)).map((asset: string, i: number) => (
                                                <span key={i} className="inline-flex items-center px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-medium border border-amber-100">
                                                    {asset}
                                                    <button className="ml-1 text-amber-400 hover:text-amber-600">×</button>
                                                </span>
                                            ))}
                                            <button className="inline-flex items-center px-2 py-1 rounded bg-white text-slate-400 text-xs font-medium border border-dashed border-slate-300 hover:border-amber-300 hover:text-amber-500 transition-colors">
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'audio' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dialogue</label>
                                    <textarea
                                        className="w-full h-32 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none transition-all font-mono"
                                        defaultValue={shot.audio.dialogue}
                                        placeholder="CHARACTER: Dialogue..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sound Effects (SFX)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all italic"
                                        defaultValue={shot.audio.sfx}
                                        placeholder="Sound effects, ambiance..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* BACK: Visual Preview */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden flex flex-col">
                    <div className="relative flex-1 group">
                        <img src={shot.image} alt={shot.description} className="w-full h-full object-cover" />

                        {/* Overlay Header */}
                        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-20">
                            <div className="flex gap-2">
                                <span className="bg-black/50 backdrop-blur-md text-white px-2 py-1 rounded text-xs font-bold border border-white/10">SHOT {shot.number}</span>
                                <span className="bg-black/50 backdrop-blur-md text-slate-300 px-2 py-1 rounded text-xs border border-white/10">{shot.type}</span>
                            </div>
                            <button
                                onClick={() => setIsFlipped(false)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg flex items-center gap-2 transition-all transform hover:scale-105"
                            >
                                <Icons.Settings /> Edit Details
                            </button>
                        </div>

                        {/* Prompt Details Overlay - Visible on Hover or Always? User said "par dessus l'image" */}
                        <div className="absolute inset-0 top-16 bottom-20 px-6 py-4 overflow-y-auto custom-scrollbar bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Final Image Prompt</h4>
                                    <p className="text-xs text-slate-200 leading-relaxed">{shot.final_image_prompt}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Video Motion Prompt</h4>
                                    <p className="text-xs text-slate-200 leading-relaxed">{shot.video_motion_prompt}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cinematography</h4>
                                        <p className="text-xs text-slate-300">{shot.veo_elements?.cinematography}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subject Context</h4>
                                        <p className="text-xs text-slate-300">{shot.veo_elements?.subject_context}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Action</h4>
                                        <p className="text-xs text-slate-300">{shot.veo_elements?.action}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Style & Ambiance</h4>
                                        <p className="text-xs text-slate-300">{shot.veo_elements?.style_ambiance}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Audio Prompt</h4>
                                        <p className="text-xs text-slate-300">{shot.veo_elements?.audio_prompt}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Negative Prompt</h4>
                                        <p className="text-xs text-slate-300">{shot.veo_elements?.negative_prompt}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent flex justify-center gap-4 z-20">
                            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg text-white text-sm font-bold border border-white/10 transition-colors flex items-center gap-2">
                                <Icons.Video /> Generate Video
                            </button>
                            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg text-white text-sm font-bold border border-white/10 transition-colors flex items-center gap-2">
                                <Icons.Image /> Regenerate Image
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

const SceneHeader: React.FC<{ scene: any }> = ({ scene }) => {
    const [intExt, setIntExt] = useState<'INT' | 'EXT'>(scene.int_ext || 'INT');
    const [time, setTime] = useState<'DAY' | 'NIGHT'>(scene.time || 'DAY');
    const [location, setLocation] = useState(scene.location || 'LOCATION');
    const [isTimeOpen, setIsTimeOpen] = useState(false);

    return (
        <div className="bg-slate-900 border-b border-slate-800 p-6 sticky top-0 z-30">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-6">
                    {/* Scene Number & Duration */}
                    <div className="flex flex-col gap-1">
                        <span className="text-slate-500 font-bold text-sm uppercase tracking-wider">SCENE {scene.number}</span>
                        <div className="flex items-center gap-1 text-slate-500 text-xs font-bold">
                            <Icons.Clock />
                            <span>{scene.duration}s</span>
                        </div>
                    </div>

                    {/* INT/EXT Toggle */}
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button
                            onClick={() => setIntExt('INT')}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${intExt === 'INT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            INT
                        </button>
                        <button
                            onClick={() => setIntExt('EXT')}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${intExt === 'EXT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            EXT
                        </button>
                    </div>

                    {/* Location Name */}
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="bg-transparent text-2xl font-black text-white outline-none border-b-2 border-transparent focus:border-indigo-500 transition-all w-64 placeholder-slate-600"
                        placeholder="LOCATION NAME"
                    />
                </div>

                <div className="flex items-center gap-6">
                    {/* Time Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsTimeOpen(!isTimeOpen)}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-3 py-2 rounded-lg transition-all"
                        >
                            {time === 'DAY' ? (
                                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            ) : (
                                <svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            )}
                            <span className="text-sm font-bold">{time}</span>
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>

                        {isTimeOpen && (
                            <div className="absolute top-full right-0 mt-2 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                                <button
                                    onClick={() => { setTime('DAY'); setIsTimeOpen(false); }}
                                    className="w-full text-left px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    DAY
                                </button>
                                <button
                                    onClick={() => { setTime('NIGHT'); setIsTimeOpen(false); }}
                                    className="w-full text-left px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                                    NIGHT
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Timeline = () => {
    return (
        <div className="fixed bottom-0 left-64 right-0 h-48 bg-slate-900 border-t border-slate-800 flex flex-col z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            {/* Timeline Tools */}
            <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900">
                <div className="flex items-center gap-4">
                    <button className="text-slate-400 hover:text-white"><Icons.Play /></button>
                    <span className="text-xs font-mono text-slate-500">00:00:00 / 00:01:30</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-1 w-32 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full w-1/3 bg-slate-600"></div>
                    </div>
                </div>
            </div>

            {/* Tracks Area */}
            <div className="flex-1 overflow-x-auto custom-scrollbar relative bg-slate-950">
                {/* Time Ruler */}
                <div className="h-6 border-b border-slate-800 flex items-end px-2 sticky top-0 bg-slate-900 z-10">
                    {[...Array(20)].map((_, i) => (
                        <div key={i} className="flex-1 border-l border-slate-800 h-2 text-[10px] text-slate-600 pl-1">
                            {i * 5}s
                        </div>
                    ))}
                </div>

                {/* Video Track */}
                <div className="h-16 border-b border-slate-800 relative bg-slate-900/50 mt-2">
                    <div className="absolute left-0 top-1 bottom-1 w-32 bg-indigo-900/50 border border-indigo-700 rounded ml-2 flex items-center justify-center text-xs text-indigo-300 truncate px-2">
                        Scene 1 - Shot 1
                    </div>
                    <div className="absolute left-36 top-1 bottom-1 w-48 bg-indigo-900/50 border border-indigo-700 rounded ml-2 flex items-center justify-center text-xs text-indigo-300 truncate px-2">
                        Scene 1 - Shot 2
                    </div>
                </div>

                {/* Audio Track */}
                <div className="h-12 border-b border-slate-800 relative bg-slate-900/50">
                    <div className="absolute left-0 top-2 bottom-2 w-64 bg-emerald-900/50 border border-emerald-700 rounded ml-2 flex items-center justify-center text-xs text-emerald-300 truncate px-2">
                        Background Ambience
                    </div>
                </div>

                {/* Playhead */}
                <div className="absolute top-0 bottom-0 left-32 w-px bg-red-500 z-20 pointer-events-none">
                    <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 transform rotate-45"></div>
                </div>
            </div>
        </div>
    );
};

const Step2bScriptProduction: React.FC<Props> = ({ project, onBack, onNext }) => {

    if (!project) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">Loading Project...</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden relative">
            {/* Top Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Production Studio</h2>
                        <p className="text-xs text-slate-500">Script, Storyboard & Video</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg font-bold hover:bg-slate-50 transition-colors text-sm">
                        Export Project
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

            {/* Main Workspace - Vertical Scroll */}
            <div className="flex-1 overflow-y-auto bg-slate-100 pb-64">
                <div className="max-w-5xl mx-auto p-8">
                    {project.database.scenes.map(scene => (
                        <div key={scene.id} className="mb-12 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            {/* Scene Header - Interactive */}
                            {/* Adapting SceneHeader to accept SceneTemplate structure which is compatible */}
                            <SceneHeader scene={{ ...scene, number: scene.scene_index, duration: scene.estimated_duration_sec, int_ext: scene.slugline_elements?.int_ext, time: scene.slugline_elements?.time, location: scene.slugline_elements?.location }} />

                            {/* Shots List */}
                            <div className="p-8 space-y-8 bg-slate-50/50">
                                {scene.shots && scene.shots.map(shot => (
                                    <LargeShotCard key={shot.id} shot={{
                                        ...shot,
                                        number: shot.shot_index,
                                        type: shot.composition.shot_type,
                                        description: shot.content.ui_description,
                                        image: 'https://placehold.co/1280x720/1a1a1a/ffffff?text=Image+Generating...', // Default until generated
                                        camera: {
                                            angle: shot.composition.angle,
                                            movement: shot.composition.camera_movement,
                                            lighting: shot.lighting || '',
                                            focal_length: shot.composition.focal_length || '',
                                            depth_of_field: shot.composition.depth_of_field || ''
                                        },
                                        audio: {
                                            dialogue: shot.audio.dialogue?.map(d => `${d.speaker || 'UNKNOWN'}: ${d.text}`).join('\n') || '',
                                            sfx: shot.audio.specificAudioCues || ''
                                        },
                                        assets: [...(shot.content.characters_in_shot || []), ...(shot.content.items_in_shot || [])],
                                        final_image_prompt: shot.content.final_image_prompt,
                                        video_motion_prompt: shot.content.video_motion_prompt,
                                        veo_elements: shot.content.veo_elements
                                    }} />
                                ))}

                                {/* Add Shot Button */}
                                <button className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                                    <span className="text-xl font-light">+</span>
                                    Add Shot to Scene {scene.scene_index}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Timeline is now fixed */}
            <Timeline />
        </div>
    );
};

export default Step2bScriptProduction;
