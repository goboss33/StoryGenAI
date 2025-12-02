import React, { useState, useMemo } from 'react';
import { StoryState, ProjectBackbone, CharacterTemplate, LocationTemplate, AssetChangeAnalysis, RefineQuestion } from '../types';
import { generateAssetImage } from '../services/geminiService';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
    project?: ProjectBackbone;
    originalDatabase?: ProjectBackbone['database'];
    onUpdate: (updates: Partial<StoryState>) => void;
    onUpdateAssets: (database: ProjectBackbone['database']) => void;
    onRegenerationComplete: (database: ProjectBackbone['database']) => void;
    onNext: () => void;
    onBack: () => void;
    isAnalyzing?: boolean;
    analysisStatus?: string;
}

type AssetType = 'character' | 'location' | 'item';

// --- SORTABLE SCENE ITEM COMPONENT ---
interface SortableSceneItemProps {
    scene: import('../types').SceneTemplate;
    index: number;
    locations: import('../types').LocationTemplate[];
    onUpdate: (id: string, updates: Partial<import('../types').SceneTemplate>) => void;
    onRemove: (index: number) => void;
    isOverlay?: boolean;
}

const SortableSceneItem: React.FC<SortableSceneItemProps> = ({ scene, index, locations, onUpdate, onRemove, isOverlay }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: scene.id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.3 : 1,
    };

    // Find associated location image
    const location = locations.find(l => l.id === scene.location_ref_id) ||
        locations.find(l => scene.slugline.includes(l.name));

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`p-4 border rounded-xl bg-white flex gap-4 items-start group relative transition-all ${isDragging ? 'ring-2 ring-indigo-500' : 'border-slate-200 shadow-sm hover:border-indigo-300'} ${isOverlay ? 'shadow-2xl rotate-2 scale-105 cursor-grabbing' : ''}`}
        >
            {/* Drag Handle */}
            <div {...attributes} {...listeners} className="mt-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
            </div>

            {/* Scene Index */}
            <div className="font-mono text-slate-400 font-bold text-sm pt-3 select-none">#{index + 1}</div>

            {/* Content */}
            <div className="flex-1 space-y-3">
                {/* Header: Slugline & Time */}
                <div className="flex gap-2 items-center">
                    <select
                        value={scene.slugline_elements?.int_ext || 'EXT.'}
                        onChange={(e) => onUpdate(scene.id, {
                            slugline_elements: { ...scene.slugline_elements!, int_ext: e.target.value as 'INT.' | 'EXT.' },
                            slugline: `${e.target.value} ${scene.slugline_elements?.location} - ${scene.slugline_elements?.time}`
                        })}
                        className="text-xs font-bold bg-slate-100 text-slate-600 rounded px-2 py-1 border-none focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="EXT.">EXT.</option>
                        <option value="INT.">INT.</option>
                    </select>

                    <input
                        type="text"
                        value={scene.slugline_elements?.location || ''}
                        onChange={(e) => onUpdate(scene.id, {
                            slugline_elements: { ...scene.slugline_elements!, location: e.target.value },
                            slugline: `${scene.slugline_elements?.int_ext} ${e.target.value} - ${scene.slugline_elements?.time}`
                        })}
                        className="flex-1 font-bold text-slate-800 text-sm uppercase tracking-wide border-b border-transparent focus:border-indigo-500 outline-none bg-transparent placeholder-slate-300"
                        placeholder="LOCATION..."
                    />

                    <select
                        value={scene.slugline_elements?.time || 'DAY'}
                        onChange={(e) => onUpdate(scene.id, {
                            slugline_elements: { ...scene.slugline_elements!, time: e.target.value },
                            slugline: `${scene.slugline_elements?.int_ext} ${scene.slugline_elements?.location} - ${e.target.value}`
                        })}
                        className="text-xs font-bold bg-slate-100 text-slate-500 rounded px-2 py-1 border-none focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="DAY">DAY</option>
                        <option value="NIGHT">NIGHT</option>
                        <option value="DAWN">DAWN</option>
                        <option value="DUSK">DUSK</option>
                    </select>
                </div>

                {/* Narrative Goal */}
                <textarea
                    value={scene.narrative_goal}
                    onChange={(e) => onUpdate(scene.id, { narrative_goal: e.target.value })}
                    className="w-full text-sm text-slate-600 border border-slate-100 rounded-lg p-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none resize-none bg-slate-50/50"
                    rows={2}
                    placeholder="Describe what happens in this scene..."
                />

                {/* Footer: Duration & Location Thumb */}
                <div className="flex justify-between items-center pt-1">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-600">
                            <span>⏱️</span>
                            <input
                                type="number"
                                value={scene.estimated_duration_sec}
                                onChange={(e) => onUpdate(scene.id, { estimated_duration_sec: parseInt(e.target.value) || 0 })}
                                className="w-8 bg-transparent text-center outline-none border-b border-transparent focus:border-indigo-500"
                            />
                            <span>s</span>
                        </div>

                        {location?.ref_image_url && (
                            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                <img src={location.ref_image_url} alt="" className="w-4 h-4 rounded object-cover" />
                                <span className="truncate max-w-[100px]">{location.name}</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => onRemove(index)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        title="Delete Scene"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

const Step2Analysis: React.FC<Props> = ({
    project, originalDatabase, onUpdate, onUpdateAssets, onRegenerationComplete, onNext, onBack, isAnalyzing, analysisStatus
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<AssetType>('character');
    const [newItemName, setNewItemName] = useState('');
    const [newItemRole, setNewItemRole] = useState('');
    const [newItemDesc, setNewItemDesc] = useState('');

    const [generatingAssetId, setGeneratingAssetId] = useState<string | null>(null);
    const [activeDragScene, setActiveDragScene] = useState<import('../types').SceneTemplate | null>(null);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        if (!project) return;
        const { active } = event;
        const scene = project.database.scenes.find(s => s.id === active.id);
        if (scene) setActiveDragScene(scene);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveDragScene(null);
        const { active, over } = event;
        if (!project || !over || active.id === over.id) return;

        const oldIndex = project.database.scenes.findIndex((s) => s.id === active.id);
        const newIndex = project.database.scenes.findIndex((s) => s.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const newScenes = arrayMove(project.database.scenes, oldIndex, newIndex);
            // Re-index scenes
            const reindexedScenes = newScenes.map((scene, idx) => ({ ...scene, scene_index: idx + 1 }));
            onUpdateAssets({ ...project.database, scenes: reindexedScenes });
        }
    };

    const handleUpdateScene = (id: string, updates: Partial<import('../types').SceneTemplate>) => {
        if (!project) return;
        const newScenes = project.database.scenes.map(s => s.id === id ? { ...s, ...updates } : s);
        onUpdateAssets({ ...project.database, scenes: newScenes });
    };

    const handleAddScene = () => {
        if (!project) return;
        const newScene: import('../types').SceneTemplate = {
            id: `scene_new_${Date.now()}`,
            scene_index: project.database.scenes.length + 1,
            slugline: "EXT. LOCATION - DAY",
            slugline_elements: { int_ext: "EXT.", location: "LOCATION", time: "DAY" },
            narrative_goal: "",
            estimated_duration_sec: 15,
            location_ref_id: "",
            shots: []
        };
        onUpdateAssets({ ...project.database, scenes: [...project.database.scenes, newScene] });
    };

    const handleRemoveScene = (index: number) => {
        if (!project) return;
        const newScenes = [...project.database.scenes];
        newScenes.splice(index, 1);
        // Re-index
        const reindexedScenes = newScenes.map((scene, idx) => ({ ...scene, scene_index: idx + 1 }));
        onUpdateAssets({ ...project.database, scenes: reindexedScenes });
    };

    const handleRemoveCharacter = (index: number) => {
        if (!project) return;
        const newChars = [...project.database.characters];
        newChars.splice(index, 1);
        onUpdateAssets({ ...project.database, characters: newChars });
    };

    const handleRemoveLocation = (index: number) => {
        if (!project) return;
        const newLocs = [...project.database.locations];
        newLocs.splice(index, 1);
        onUpdateAssets({ ...project.database, locations: newLocs });
    };

    const handleRemoveItem = (index: number) => {
        if (!project) return;
        const newItems = [...project.database.items];
        newItems.splice(index, 1);
        onUpdateAssets({ ...project.database, items: newItems });
    };

    const openAddModal = (type: AssetType) => {
        setModalType(type);
        setNewItemName('');
        setNewItemRole(type === 'character' ? 'Supporting Character' : type === 'location' ? 'EXT' : 'prop');
        setNewItemDesc('');
        setIsModalOpen(true);
    };

    const handleAddItem = () => {
        if (!project) return;

        if (modalType === 'character') {
            const newChar: CharacterTemplate = {
                id: `char_new_${Date.now()}`,
                name: newItemName,
                role: newItemRole,
                visual_seed: { description: newItemDesc },
                visual_details: {
                    age: "Unknown", gender: "Unknown", ethnicity: "Unknown", hair: "Unknown", eyes: "Unknown", clothing: "Unknown", accessories: "Unknown", body_type: "Unknown"
                },
                voice_specs: {
                    gender: 'male', age_group: 'adult', accent: 'neutral', pitch: 1.0, speed: 1.0, tone: 'neutral'
                }
            };
            onUpdateAssets({ ...project.database, characters: [...project.database.characters, newChar] });
        } else if (modalType === 'location') {
            const newLoc: LocationTemplate = {
                id: `loc_new_${Date.now()}`,
                name: newItemName,
                interior_exterior: newItemRole as 'INT' | 'EXT',
                environment_prompt: newItemDesc,
                description: newItemDesc,
                lighting_default: "Natural",
                audio_ambiance: "Quiet"
            };
            onUpdateAssets({ ...project.database, locations: [...project.database.locations, newLoc] });
        } else {
            const newItem: import('../types').ItemTemplate = {
                id: `item_new_${Date.now()}`,
                name: newItemName,
                type: newItemRole as any,
                description: newItemDesc,
                visual_details: newItemDesc
            };
            onUpdateAssets({ ...project.database, items: [...project.database.items, newItem] });
        }
        setIsModalOpen(false);
    };

    const handleGenerateImage = async (type: AssetType, index: number) => {
        if (!project) return;

        const asset = type === 'character'
            ? project.database.characters[index]
            : type === 'location' ? project.database.locations[index] : project.database.items[index];

        setGeneratingAssetId(asset.id);

        try {
            const imageUrl = await generateAssetImage(type, asset, {
                title: project.meta_data.title,
                tone: project.config.tone_style,
                style: project.global_assets.art_style_prompt || "Cinematic"
            });

            if (type === 'character') {
                const newChars = [...project.database.characters];
                newChars[index] = { ...newChars[index], visual_seed: { ...newChars[index].visual_seed, ref_image_url: imageUrl } };
                onUpdateAssets({ ...project.database, characters: newChars });
            } else if (type === 'location') {
                const newLocs = [...project.database.locations];
                newLocs[index] = { ...newLocs[index], ref_image_url: imageUrl };
                onUpdateAssets({ ...project.database, locations: newLocs });
            } else {
                const newItems = [...project.database.items];
                newItems[index] = { ...newItems[index], ref_image_url: imageUrl };
                onUpdateAssets({ ...project.database, items: newItems });
            }
        } catch (error) {
            console.error("Failed to generate image", error);
            alert("Failed to generate image. Check console for details.");
        } finally {
            setGeneratingAssetId(null);
        }
    };

    if (!project || isAnalyzing) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-6">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-6"></div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                        Analyse en cours...
                    </h3>
                    <p className="text-slate-500 mb-4">
                        {analysisStatus || "L'IA analyse votre concept..."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-slate-50 p-6 custom-scrollbar">
            <div className="max-w-5xl mx-auto mb-8">
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
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span className="bg-fuchsia-100 text-fuchsia-600 w-6 h-6 rounded flex items-center justify-center text-xs">2</span>
                            Personnages ({project.database.characters.length})
                        </h2>
                        <button
                            onClick={() => openAddModal('character')}
                            className="text-xs font-bold text-fuchsia-600 bg-fuchsia-50 hover:bg-fuchsia-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Ajouter
                        </button>
                    </div>

                    {/* Audio Options Bar */}
                    <div className="flex items-center gap-6 mb-6 ml-8 bg-slate-50 p-3 rounded-lg border border-slate-100 w-fit">
                        {/* Dialogue Toggle */}
                        <label className={`flex items-center gap-3 ${project.database.characters.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${project.config.has_dialogue && project.database.characters.length > 0 ? 'bg-fuchsia-600' : 'bg-slate-300'}`}>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={project.config.has_dialogue && project.database.characters.length > 0}
                                    disabled={project.database.characters.length === 0}
                                    onChange={(e) => onUpdate({
                                        project: {
                                            ...project,
                                            config: { ...project.config, has_dialogue: e.target.checked }
                                        }
                                    })}
                                />
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${project.config.has_dialogue && project.database.characters.length > 0 ? 'translate-x-5' : ''}`}></div>
                            </div>
                            <span className="text-sm font-bold text-slate-700">Dialogues</span>
                        </label>

                        {/* Voice Over Toggle */}
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${project.config.has_voiceover ? 'bg-fuchsia-600' : 'bg-slate-300'}`}>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={!!project.config.has_voiceover}
                                    onChange={(e) => onUpdate({
                                        project: {
                                            ...project,
                                            config: { ...project.config, has_voiceover: e.target.checked }
                                        }
                                    })}
                                />
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${project.config.has_voiceover ? 'translate-x-5' : ''}`}></div>
                            </div>
                            <span className="text-sm font-bold text-slate-700">Voix-off</span>
                        </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {project.database.characters.map((char, idx) => (
                            <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50 hover:border-fuchsia-200 transition-colors group relative">
                                <button
                                    onClick={() => handleRemoveCharacter(idx)}
                                    className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                    title="Supprimer"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                                <div className="flex gap-4">
                                    {/* Avatar / Image */}
                                    <div className="flex-shrink-0">
                                        {char.visual_seed.ref_image_url ? (
                                            <img
                                                src={char.visual_seed.ref_image_url}
                                                alt={char.name}
                                                className="w-20 h-20 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                                            />
                                        ) : (
                                            <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center border-2 border-slate-100">
                                                <span className="text-2xl">👤</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800 text-lg mb-1 pr-6">{char.name}</div>
                                        <div className="text-xs font-bold text-fuchsia-600 uppercase mb-2">{char.role}</div>
                                        <p className="text-sm text-slate-600 leading-relaxed mb-3">{char.visual_seed.description}</p>

                                        <button
                                            onClick={() => handleGenerateImage('character', idx)}
                                            disabled={generatingAssetId === char.id}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {generatingAssetId === char.id ? (
                                                <>
                                                    <svg className="animate-spin h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    Génération...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    {char.visual_seed.ref_image_url ? 'Régénérer Visuel' : 'Générer Visuel'}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* LOCATIONS */}
                <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span className="bg-emerald-100 text-emerald-600 w-6 h-6 rounded flex items-center justify-center text-xs">3</span>
                            Lieux ({project.database.locations.length})
                        </h2>
                        <button
                            onClick={() => openAddModal('location')}
                            className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Ajouter
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {project.database.locations.map((loc, idx) => (
                            <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50 hover:border-emerald-200 transition-colors group relative">
                                <button
                                    onClick={() => handleRemoveLocation(idx)}
                                    className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                    title="Supprimer"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                                <div className="flex gap-4">
                                    {/* Location Image */}
                                    <div className="flex-shrink-0">
                                        {loc.ref_image_url ? (
                                            <img
                                                src={loc.ref_image_url}
                                                alt={loc.name}
                                                className="w-24 h-24 rounded-lg object-cover border-2 border-slate-200 shadow-sm"
                                            />
                                        ) : (
                                            <div className="w-24 h-24 rounded-lg bg-slate-200 flex items-center justify-center border-2 border-slate-100">
                                                <span className="text-2xl">🏞️</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1 pr-6">
                                            <div className="font-bold text-slate-800 text-lg">{loc.name}</div>
                                            <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded">{loc.interior_exterior}</span>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed mb-3">{loc.environment_prompt}</p>

                                        <button
                                            onClick={() => handleGenerateImage('location', idx)}
                                            disabled={generatingAssetId === loc.id}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {generatingAssetId === loc.id ? (
                                                <>
                                                    <svg className="animate-spin h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    Génération...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    {loc.ref_image_url ? 'Régénérer Visuel' : 'Générer Visuel'}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* SCENES (SEQUENCER) */}
                <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded flex items-center justify-center text-xs">5</span>
                            Séquencier ({project.database.scenes.length} scènes)
                        </h2>
                        <button
                            onClick={handleAddScene}
                            className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Ajouter Scène
                        </button>
                    </div>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={project.database.scenes.map(s => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-3">
                                {project.database.scenes.map((scene, idx) => (
                                    <SortableSceneItem
                                        key={scene.id}
                                        scene={scene}
                                        index={idx}
                                        locations={project.database.locations}
                                        onUpdate={handleUpdateScene}
                                        onRemove={handleRemoveScene}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                        <DragOverlay>
                            {activeDragScene ? (
                                <SortableSceneItem
                                    scene={activeDragScene}
                                    index={project.database.scenes.findIndex(s => s.id === activeDragScene.id)}
                                    locations={project.database.locations}
                                    onUpdate={() => { }}
                                    onRemove={() => { }}
                                    isOverlay={true}
                                />
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </section>

            </div >

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

            {/* ADD ASSET MODAL */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-100">
                            <h3 className="text-xl font-bold text-slate-900 mb-4">
                                Ajouter {modalType === 'character' ? 'un Personnage' : 'un Lieu'}
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom</label>
                                    <input
                                        type="text"
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        className="w-full p-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                                        placeholder={modalType === 'character' ? "Ex: Arthur" : "Ex: La Grotte Sombre"}
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                        {modalType === 'character' ? 'Rôle' : 'Type'}
                                    </label>
                                    {modalType === 'character' ? (
                                        <input
                                            type="text"
                                            value={newItemRole}
                                            onChange={(e) => setNewItemRole(e.target.value)}
                                            className="w-full p-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                                            placeholder="Ex: Protagoniste, Mentor..."
                                        />
                                    ) : (
                                        <select
                                            value={newItemRole}
                                            onChange={(e) => setNewItemRole(e.target.value)}
                                            className="w-full p-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                                        >
                                            <option value="EXT">Extérieur (EXT)</option>
                                            <option value="INT">Intérieur (INT)</option>
                                        </select>
                                    )}
                                    {modalType === 'item' && (
                                        <select
                                            value={newItemRole}
                                            onChange={(e) => setNewItemRole(e.target.value)}
                                            className="w-full p-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                                        >
                                            <option value="prop">Accessoire (Prop)</option>
                                            <option value="vehicle">Véhicule</option>
                                            <option value="animal">Animal</option>
                                            <option value="weapon">Arme</option>
                                            <option value="other">Autre</option>
                                        </select>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description Visuelle</label>
                                    <textarea
                                        value={newItemDesc}
                                        onChange={(e) => setNewItemDesc(e.target.value)}
                                        className="w-full p-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-200 outline-none h-24 resize-none"
                                        placeholder={modalType === 'character' ? "Description physique, vêtements, style..." : "Ambiance, éclairage, détails du lieu..."}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleAddItem}
                                    disabled={!newItemName || !newItemDesc}
                                    className={`flex-1 py-3 rounded-xl font-bold text-white transition-colors ${!newItemName || !newItemDesc ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'}`}
                                >
                                    Ajouter
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


        </div >
    );
};

export default Step2Analysis;
