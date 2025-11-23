
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Scene, Pacing, Asset, AssetType, AspectRatio } from '../types';
import { generateScript, generateImage, editImage, generateMultimodalImage } from '../services/geminiService';

interface Props {
    idea: string;
    totalDuration: number;
    pacing: Pacing;
    language: string;
    script: Scene[];
    assets: Asset[];
    stylePrompt: string;
    aspectRatio: AspectRatio;
    onUpdateAspectRatio: (ratio: AspectRatio) => void;
    onUpdateScript: (script: Scene[]) => void;
    onUpdateAssets: (assets: Asset[]) => void;
    onBack: () => void;
    onNext: () => void;
    isNextStepReady?: boolean;
}

// Grouping helper
interface SceneGroup {
    sceneId: string;
    locationAssetId?: string;
    locationName: string; // fallback if asset missing
    time: string;
    context: string;
    weather: string;
    shots: Scene[];
}

// --- Sub-component for Asset Items (Cast/Props) ---
interface VisualAssetItemProps {
    asset: Asset;
    isSelected: boolean;
    onClick: () => void;
    onRemoveFromScene?: () => void;
    onGenerate: (id: string) => void;
    onInspect: (id: string) => void;
}

const VisualAssetItem: React.FC<VisualAssetItemProps> = ({
    asset, isSelected, onClick, onRemoveFromScene, onGenerate, onInspect
}) => {
    const isChar = asset.type === AssetType.CHARACTER;
    const isGenerating = asset.status === 'generating';
    const hasImage = !!asset.imageUri;

    const containerShape = isChar ? "rounded-full" : "rounded-md";
    const activeRing = isChar ? "ring-indigo-500 border-indigo-500" : "ring-amber-500 border-amber-500";
    const placeholderBg = isChar ? "bg-indigo-50 text-indigo-300" : "bg-amber-50 text-amber-300";

    const dragStartY = useRef(0);

    const onDragStart = (e: React.DragEvent) => {
        if (!onRemoveFromScene) return;
        dragStartY.current = e.clientY;
        // Required for drag to work
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragEnd = (e: React.DragEvent) => {
        if (!onRemoveFromScene) return;
        const diff = Math.abs(e.clientY - dragStartY.current);
        // If dragged vertically significantly (e.g. out of the horizontal list), remove it
        if (diff > 50) {
            onRemoveFromScene();
        }
    };

    return (
        <div
            className={`flex flex-col items-center justify-start gap-2 w-24 flex-shrink-0 relative group/asset mt-2 select-none ${onRemoveFromScene ? 'cursor-grab active:cursor-grabbing' : ''}`}
            draggable={!!onRemoveFromScene}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            title={onRemoveFromScene ? "Drag up/down to remove from shot" : undefined}
        >
            {/* Thumbnail Wrapper */}
            <div
                onClick={onClick}
                className={`
             relative w-20 h-20 overflow-hidden border-2 transition-all duration-200 flex-shrink-0 ${containerShape}
             ${isSelected
                        ? `ring-2 ${activeRing} opacity-100 scale-105`
                        : 'border-slate-100 opacity-50 grayscale group-hover/asset:grayscale-0 group-hover/asset:opacity-100'
                    }
          `}
            >
                {hasImage ? (
                    <img src={asset.imageUri} alt={asset.name} className="w-full h-full object-cover pointer-events-none" />
                ) : (
                    <div className={`w-full h-full flex items-center justify-center ${placeholderBg}`}>
                        {isChar ? (
                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                        ) : (
                            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.991.991 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7z" /></svg>
                        )}
                    </div>
                )}

                {isGenerating && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20">
                        <div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                    </div>
                )}

                {/* Toolbar Overlay (Centered - No Background Mask) */}
                <div className="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover/asset:opacity-100 transition-opacity duration-200">
                    {!hasImage ? (
                        /* Generate Button */
                        <button
                            onClick={(e) => { e.stopPropagation(); onGenerate(asset.id); }}
                            disabled={isGenerating}
                            className="w-10 h-10 bg-white text-indigo-600 rounded-full hover:scale-110 transition-transform shadow-lg shadow-black/20 border border-indigo-100 flex items-center justify-center"
                            title="Generate with AI"
                        >
                            {isGenerating ? (
                                <span className="block w-4 h-4 animate-spin border-2 border-indigo-600 border-t-transparent rounded-full"></span>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            )}
                        </button>
                    ) : (
                        /* Inspect Button */
                        <button
                            onClick={(e) => { e.stopPropagation(); onInspect(asset.id); }}
                            className="w-10 h-10 bg-white text-slate-800 rounded-full hover:scale-110 transition-transform shadow-lg shadow-black/20 border border-slate-100 flex items-center justify-center"
                            title="Inspect / Edit"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Title */}
            <span className={`text-[10px] font-bold text-center leading-tight w-full break-words px-1 ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>
                {asset.name}
            </span>
        </div>
    );
};


const Step2Script: React.FC<Props> = ({
    idea, totalDuration, pacing, language, script, assets, stylePrompt, aspectRatio,
    onUpdateAspectRatio, onUpdateScript, onUpdateAssets, onBack, onNext, isNextStepReady
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatingSceneIds, setGeneratingSceneIds] = useState<string[]>([]);
    const [previewStoryboardUri, setPreviewStoryboardUri] = useState<string | null>(null);

    // Layout Mode State
    // Layout Mode State
    type LayoutMode = 'list' | 'grid-9-16' | 'grid-1-1' | 'grid-4-3' | 'grid-3-4';

    const getLayoutFromRatio = (ratio: AspectRatio): LayoutMode => {
        switch (ratio) {
            case '9:16': return 'grid-9-16';
            case '1:1': return 'grid-1-1';
            case '4:3': return 'grid-4-3';
            case '3:4': return 'grid-3-4';
            default: return 'list';
        }
    };

    const [layoutMode, setLayoutMode] = useState<LayoutMode>(getLayoutFromRatio(aspectRatio));
    const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);

    useEffect(() => {
        setLayoutMode(getLayoutFromRatio(aspectRatio));
    }, [aspectRatio]);

    const handleLayoutChange = (mode: LayoutMode) => {
        setLayoutMode(mode);
        let ratio: AspectRatio = '16:9';
        switch (mode) {
            case 'grid-9-16': ratio = '9:16'; break;
            case 'grid-1-1': ratio = '1:1'; break;
            case 'grid-4-3': ratio = '4:3'; break;
            case 'grid-3-4': ratio = '3:4'; break;
        }
        onUpdateAspectRatio(ratio);
    };

    // Flip State
    const [flippedShots, setFlippedShots] = useState<Record<string, boolean>>({});

    const toggleFlip = (shotId: string) => {
        setFlippedShots(prev => ({ ...prev, [shotId]: !prev[shotId] }));
    };

    const toggleFlipAll = () => {
        const allShotIds = script.map(s => s.id);
        const allFlipped = allShotIds.every(id => flippedShots[id]);

        if (allFlipped) {
            setFlippedShots({});
        } else {
            const newFlippedState: Record<string, boolean> = {};
            allShotIds.forEach(id => { newFlippedState[id] = true; });
            setFlippedShots(newFlippedState);
        }
    };

    // Asset Creation Modal
    const [isAddingAsset, setIsAddingAsset] = useState(false);
    const [newAssetData, setNewAssetData] = useState({ name: '', type: AssetType.CHARACTER });

    // --- Inspection / Edit Modal State ---
    const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
    const [editPrompt, setEditPrompt] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Inpainting State
    const [isInpaintingMode, setIsInpaintingMode] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [brushSize, setBrushSize] = useState(20);

    useEffect(() => {
        if (script.length === 0 && !loading && !error) {
            generate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reset canvas when entering inpainting mode
    useEffect(() => {
        if (isInpaintingMode && previewAssetId) {
            setTimeout(setupCanvas, 50);
        }
    }, [isInpaintingMode, previewAssetId]);

    const generate = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await generateScript(idea, totalDuration, pacing, language);
            onUpdateAssets(result.assets);
            onUpdateScript(result.script);
        } catch (err: any) {
            console.error("Full error:", err);
            setError(err.message || 'Failed to generate script. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // --- Quick Generation Logic ---
    const handleQuickGenerate = async (assetId: string) => {
        const asset = assets.find(a => a.id === assetId);
        if (!asset) return;

        const updatedAssetsPending = assets.map(a => a.id === assetId ? { ...a, status: 'generating' } as Asset : a);
        onUpdateAssets(updatedAssetsPending);

        try {
            let prompt = '';
            if (asset.type === AssetType.LOCATION) {
                prompt = `${stylePrompt}. Cinematic wide shot of ${asset.name}. ${asset.visuals.details}, ${asset.visuals.lighting}, ${asset.visuals.background}. Environment only, no text. --no text, typography, watermark`;
            } else {
                // NEW PROMPT LOGIC FOR CLEAN SPRITES
                const typeTerm = asset.type === AssetType.CHARACTER ? "Solo Character Sprite" : "Single Item Sprite";
                prompt = `${typeTerm} of ${asset.name}. ${asset.visuals.subject}, ${asset.visuals.details}. ${stylePrompt}. Flat illustration, Isolated on white background. --no text, typography, multiple views, collage, sketches, hands, other characters`;
            }

            const uri = await generateImage(prompt, aspectRatio);
            const updatedAssetsComplete = assets.map(a => a.id === assetId ? { ...a, imageUri: uri, status: 'complete' } as Asset : a);
            onUpdateAssets(updatedAssetsComplete);

        } catch (e) {
            console.error("Quick gen failed", e);
            const updatedAssetsError = assets.map(a => a.id === assetId ? { ...a, status: 'error' } as Asset : a);
            onUpdateAssets(updatedAssetsError);
        }
    };

    // --- Scene Storyboard Generation ---
    const generateSceneStoryboard = async (group: SceneGroup) => {
        if (generatingSceneIds.includes(group.sceneId)) return;

        setGeneratingSceneIds(prev => [...prev, group.sceneId]);

        try {
            const shotCount = group.shots.length;
            let gridSize = '2x2';
            let numPanels = 'four';
            let cols = 2;

            if (shotCount > 9) { gridSize = '4x3'; numPanels = 'twelve'; cols = 4; }
            else if (shotCount > 6) { gridSize = '3x3'; numPanels = 'nine'; cols = 3; }
            else if (shotCount > 4) { gridSize = '3x2'; numPanels = 'six'; cols = 3; }

            const separatorStyle = group.time.toUpperCase().includes('NIGHT') ? 'solid white lines' : 'solid black lines';

            // 1. Collect Unique Assets Used in this Scene
            const uniqueAssetIds = new Set<string>();
            if (group.locationAssetId) uniqueAssetIds.add(group.locationAssetId);
            group.shots.forEach(shot => {
                (shot.usedAssetIds || []).forEach(id => uniqueAssetIds.add(id));
            });

            const sceneAssets = assets.filter(a => uniqueAssetIds.has(a.id));
            const referenceAssets = sceneAssets.filter(a => !!a.imageUri);
            const descriptionAssets = sceneAssets.filter(a => !a.imageUri);

            // 2. Construct Prompt with References
            let assetContext = "";

            if (referenceAssets.length > 0) {
                assetContext += "\n\nVISUAL REFERENCES (Use provided images):\n";
                referenceAssets.forEach(a => {
                    assetContext += `- ${a.name} (${a.type}): Use the provided reference image for this element.\n`;
                });
            }

            if (descriptionAssets.length > 0) {
                assetContext += "\n\nVISUAL DESCRIPTIONS (No reference image available):\n";
                descriptionAssets.forEach(a => {
                    assetContext += `- ${a.name} (${a.type}): ${a.visuals.subject}. ${a.visuals.details}\n`;
                });
            }

            let panelsDesc = '';
            group.shots.forEach((shot, idx) => {
                if (idx >= 12) return; // Cap at 12
                const r = Math.floor(idx / cols) + 1;
                const c = (idx % cols) + 1;
                panelsDesc += `Panel ${idx + 1}, R${r}C${c}: ${shot.shotType}, ${shot.cameraAngle}. ${shot.description}\n`;
            });

            const prompt = `Professional storyboard sheet template in a ${stylePrompt} illustration style. A rigid ${gridSize} grid layout arranged tightly together, maximizing canvas usage with no extra white space. All ${numPanels} slots hold identical ${aspectRatio} aspect ratio panels separated by distinct ${separatorStyle}.

${assetContext}

${panelsDesc}
(Empty slots remain blank).`;

            let uri: string;

            if (referenceAssets.length > 0) {
                // Prepare references for Multimodal Call
                const references = referenceAssets.map(a => {
                    // Extract base64 and mimeType from data URI
                    const match = a.imageUri!.match(/^data:(.+);base64,(.+)$/);
                    if (!match) return null;
                    return {
                        name: a.name,
                        mimeType: match[1],
                        data: match[2]
                    };
                }).filter(r => r !== null) as { name: string; mimeType: string; data: string }[];

                uri = await generateMultimodalImage(prompt, references, aspectRatio);
            } else {
                uri = await generateImage(prompt, aspectRatio);
            }

            // Update all shots in the scene with the storyboard URI
            const updatedScript = script.map(s => s.sceneId === group.sceneId ? { ...s, sceneStoryboardUri: uri } : s);
            onUpdateScript(updatedScript);

        } catch (e) {
            console.error("Scene storyboard gen failed", e);
            alert("Failed to generate scene storyboard");
        } finally {
            setGeneratingSceneIds(prev => prev.filter(id => id !== group.sceneId));
        }
    };

    // --- Delete Logic ---
    const handleDeleteAsset = (assetId: string) => {
        if (window.confirm("Are you sure you want to delete this asset? It will be removed from all shots.")) {
            // 1. Remove from assets list
            const updatedAssets = assets.filter(a => a.id !== assetId);
            onUpdateAssets(updatedAssets);

            // 2. Remove from usedAssetIds AND locationAssetId in all shots
            const updatedScript = script.map(scene => ({
                ...scene,
                // If the deleted asset was the location for this scene, clear it
                locationAssetId: scene.locationAssetId === assetId ? undefined : scene.locationAssetId,
                // Remove from used list
                usedAssetIds: (scene.usedAssetIds || []).filter(id => id !== assetId)
            }));
            onUpdateScript(updatedScript);

            // Close modal if open
            if (previewAssetId === assetId) setPreviewAssetId(null);
        }
    };

    // --- Edit / Inpainting Logic ---

    const setupCanvas = () => {
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (canvas && img) {
            // Match canvas size to displayed image size
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const startDrawing = (e: React.MouseEvent) => {
        if (!isInpaintingMode) return;
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.beginPath(); // Reset path
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing || !isInpaintingMode) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // Semi-transparent white for visual feedback

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const getMaskFromCanvas = (): string | undefined => {
        if (!canvasRef.current || !isInpaintingMode) return undefined;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;
        const ctx = tempCanvas.getContext('2d');

        if (ctx) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            ctx.drawImage(canvasRef.current, 0, 0);
        }
        return tempCanvas.toDataURL('image/png');
    };

    const handleEditAssetImage = async () => {
        if (!previewAssetId || !editPrompt) return;
        const asset = assets.find(a => a.id === previewAssetId);
        if (!asset || !asset.imageUri) return;

        setIsEditing(true);
        try {
            const mask = isInpaintingMode ? getMaskFromCanvas() : undefined;
            const newUri = await editImage(asset.imageUri, editPrompt, undefined, mask);
            onUpdateAssets(assets.map(a => a.id === previewAssetId ? { ...a, imageUri: newUri } : a));
            setEditPrompt('');
            if (isInpaintingMode) setupCanvas();
        } catch (error) {
            console.error(error);
            alert("Failed to edit image");
        } finally {
            setIsEditing(false);
        }
    };

    // Group flat shots into Scenes
    const sceneGroups = useMemo(() => {
        const groups: SceneGroup[] = [];
        const map = new Map<string, SceneGroup>();

        script.forEach(shot => {
            const gid = shot.sceneId;
            if (!map.has(gid)) {
                const locAsset = assets.find(a => a.id === shot.locationAssetId);
                const parts = shot.location.split(' - ');
                const time = (shot.time || 'DAY').toUpperCase();

                const group: SceneGroup = {
                    sceneId: gid,
                    locationAssetId: shot.locationAssetId,
                    locationName: locAsset ? locAsset.name : shot.location.replace(/ - .*$/, ''),
                    time: time,
                    context: shot.sceneContext,
                    weather: shot.weather,
                    shots: []
                };
                map.set(gid, group);
                groups.push(group);
            }
            map.get(gid)!.shots.push(shot);
        });
        return groups;
    }, [script, assets]);

    // --- Updaters ---

    const updateShot = (shotId: string, updates: Partial<Scene>) => {
        onUpdateScript(script.map(s => s.id === shotId ? { ...s, ...updates } : s));
    };

    const updateSceneHeader = (sceneId: string, updates: Partial<Scene>) => {
        onUpdateScript(script.map(s => s.sceneId === sceneId ? { ...s, ...updates } : s));
    };

    const toggleAssetInShot = (shotId: string, assetId: string) => {
        const shot = script.find(s => s.id === shotId);
        if (!shot) return;
        const current = shot.usedAssetIds || [];
        const next = current.includes(assetId)
            ? current.filter(id => id !== assetId)
            : [...current, assetId];
        updateShot(shotId, { usedAssetIds: next });
    };

    const handleAddAsset = () => {
        if (!newAssetData.name) return;
        const newId = crypto.randomUUID();
        const newAsset: Asset = {
            id: newId,
            name: newAssetData.name.toUpperCase(),
            type: newAssetData.type,
            visuals: {
                subject: newAssetData.name,
                details: 'Custom added asset',
                pose: 'Default',
                constraint: 'None',
                background: 'White',
                lighting: 'Standard'
            },
            status: 'pending'
        };
        onUpdateAssets([...assets, newAsset]);
        setIsAddingAsset(false);
        setNewAssetData({ name: '', type: AssetType.CHARACTER });
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center px-4">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">Generation Failed</h3>
                <p className="text-slate-500 max-w-md mb-6">{error}</p>
                <button onClick={generate} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors">
                    Try Again
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center">
                <div className="animate-spin w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full mb-4"></div>
                <h3 className="text-xl font-semibold text-slate-800">Designing World & Script...</h3>
                <p className="text-slate-500 mt-2">Creating characters, locations, and sequences.</p>
            </div>
        );
    }

    const locationAssets = assets.filter(a => a.type === AssetType.LOCATION);
    const castAssets = assets.filter(a => a.type === AssetType.CHARACTER);
    const itemAssets = assets.filter(a => a.type === AssetType.ITEM);
    const currentTotalDuration = script.reduce((acc, s) => acc + s.duration, 0);

    const activePreviewAsset = assets.find(a => a.id === previewAssetId);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Script Editor</h2>
                    <p className="text-slate-500 text-sm">
                        <span className={currentTotalDuration > totalDuration + 5 ? "text-red-500 font-bold" : "text-green-600 font-bold"}>
                            {currentTotalDuration}s
                        </span> / {totalDuration}s target
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* Layout Toggle Buttons */}
                    <div className="flex items-center gap-2 mr-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Format d'image</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleLayoutChange('list')}
                                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${layoutMode === 'list'
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                16:9
                            </button>
                            <button
                                onClick={() => handleLayoutChange('grid-9-16')}
                                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${layoutMode === 'grid-9-16'
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                9:16
                            </button>
                            <button
                                onClick={() => handleLayoutChange('grid-1-1')}
                                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${layoutMode === 'grid-1-1'
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                1:1
                            </button>
                            <button
                                onClick={() => handleLayoutChange('grid-4-3')}
                                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${layoutMode === 'grid-4-3'
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                4:3
                            </button>
                            <button
                                onClick={() => handleLayoutChange('grid-3-4')}
                                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${layoutMode === 'grid-3-4'
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                3:4
                            </button>
                        </div>

                        {/* Global Flip Button */}
                        <button
                            onClick={toggleFlipAll}
                            className="ml-4 px-3 py-2 rounded-lg text-sm font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-2"
                            title="Flip all cards"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Flip All
                        </button>
                    </div>

                    <button onClick={() => setIsAddingAsset(true)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Add Asset
                    </button>
                    <button onClick={generate} className="px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-bold border border-indigo-200">
                        Regenerate
                    </button>
                </div>
            </div>

            {/* Script Area */}
            <div className="flex-1 overflow-y-auto pr-2 pb-20 space-y-10">
                {sceneGroups.map((group, idx) => (
                    <div key={group.sceneId} className="border border-slate-300 bg-slate-50 rounded-xl overflow-hidden shadow-sm">

                        {/* SCENE HEADER (Dark) */}
                        <div className="bg-slate-900 p-4 text-slate-200 flex flex-col gap-3">

                            <div className="flex items-start gap-4">
                                <div className="flex flex-col gap-2 items-center">
                                    <div className="flex-shrink-0 font-mono text-xl font-bold bg-slate-700 w-10 h-10 flex items-center justify-center rounded-lg text-emerald-400 border border-slate-600 mt-2">
                                        {idx + 1}
                                    </div>
                                    {/* Scene Storyboard Button */}
                                    {group.shots[0]?.sceneStoryboardUri ? (
                                        <button
                                            onClick={() => setPreviewStoryboardUri(group.shots[0].sceneStoryboardUri!)}
                                            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center transition-colors shadow-lg shadow-indigo-900/20 border border-indigo-400"
                                            title="View Scene Storyboard"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => generateSceneStoryboard(group)}
                                            disabled={generatingSceneIds.includes(group.sceneId)}
                                            className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-colors border border-slate-700"
                                            title="Generate Scene Storyboard"
                                        >
                                            {generatingSceneIds.includes(group.sceneId) ? (
                                                <span className="block w-5 h-5 animate-spin border-2 border-indigo-500 border-t-transparent rounded-full"></span>
                                            ) : (
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            )}
                                        </button>
                                    )}
                                </div>

                                <div
                                    className="flex-1 flex gap-4 overflow-x-auto pt-2 pb-2 px-2 items-start custom-scrollbar"
                                    onWheel={(e) => {
                                        if (e.deltaY !== 0) {
                                            e.currentTarget.scrollLeft += e.deltaY;
                                        }
                                    }}
                                >
                                    {locationAssets.map(loc => {
                                        const isSelected = group.locationAssetId === loc.id;
                                        const isGenerating = loc.status === 'generating';
                                        const hasImage = !!loc.imageUri;

                                        return (
                                            <div key={loc.id} className="relative group/loc flex flex-col justify-start items-center gap-2 w-24 flex-shrink-0">

                                                {/* Thumbnail (Middle) */}
                                                <button
                                                    onClick={() => {
                                                        updateSceneHeader(group.sceneId, { locationAssetId: loc.id, location: `${loc.name} - ${group.time}` });
                                                    }}
                                                    className="flex flex-col items-center w-full relative"
                                                >
                                                    <div className={`
                                                    relative w-24 h-24 rounded-xl overflow-hidden shadow-sm transition-all duration-200 flex-shrink-0
                                                    ${isSelected ? 'ring-2 ring-emerald-500 scale-105 opacity-100 z-10' : 'opacity-50 grayscale-[0.5] hover:opacity-100 hover:grayscale-0'}
                                            `}>
                                                        {hasImage ? (
                                                            <img src={loc.imageUri} alt={loc.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-600">
                                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                            </div>
                                                        )}
                                                        {isGenerating && (
                                                            <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-20">
                                                                <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
                                                            </div>
                                                        )}

                                                        {/* Toolbar Overlay (Centered) */}
                                                        <div className="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover/loc:opacity-100 transition-opacity duration-200">
                                                            {!hasImage ? (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleQuickGenerate(loc.id); }}
                                                                    disabled={isGenerating}
                                                                    className="w-10 h-10 bg-white text-indigo-600 rounded-full hover:scale-110 transition-transform shadow-lg shadow-black/20 border border-indigo-100 flex items-center justify-center"
                                                                    title="Generate Location"
                                                                >
                                                                    {isGenerating ? (
                                                                        <span className="block w-4 h-4 animate-spin border-2 border-emerald-400 border-t-transparent rounded-full"></span>
                                                                    ) : (
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                                    )}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setPreviewAssetId(loc.id); }}
                                                                    className="w-10 h-10 bg-white text-slate-800 rounded-full hover:scale-110 transition-transform shadow-lg shadow-black/20 border border-slate-100 flex items-center justify-center"
                                                                    title="Inspect Location"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>

                                                {/* Name (Bottom) */}
                                                <span className={`text-[11px] font-bold text-center leading-tight w-full break-words px-1 ${isSelected ? 'text-emerald-400' : 'text-slate-400 group-hover/loc:text-slate-200'}`}>
                                                    {loc.name}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {locationAssets.length === 0 && <div className="text-xs text-slate-500 italic px-2 pt-8">No locations defined</div>}
                                </div>
                            </div>

                            <div className="flex gap-2 mt-1">
                                <div className="w-10 flex-shrink-0"></div>
                                <div className="flex-1 flex gap-2">
                                    <textarea
                                        className="flex-1 bg-slate-800/50 text-slate-300 text-sm p-2 rounded border border-slate-700 outline-none focus:border-slate-500 h-10 resize-none italic min-h-[40px]"
                                        value={group.context}
                                        onChange={(e) => updateSceneHeader(group.sceneId, { sceneContext: e.target.value })}
                                        placeholder="Scene context / blocking..."
                                    />
                                    <select
                                        className="bg-slate-800 text-slate-300 font-bold uppercase outline-none px-3 rounded border border-slate-700 text-xs h-10"
                                        value={group.time}
                                        onChange={(e) => updateSceneHeader(group.sceneId, { location: `${group.locationName} - ${e.target.value}`, weather: group.weather })}
                                    >
                                        {['DAY', 'NIGHT', 'DAWN', 'DUSK'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className={`bg-slate-100 p-4 ${layoutMode === 'list' ? 'space-y-4' :
                            layoutMode === 'grid-9-16' ? 'grid grid-cols-3 gap-4' :
                                'grid grid-cols-2 gap-4'
                            }`}>
                            {group.shots.map((shot, sIdx) => {
                                const activeShotCast = castAssets.filter(a => (shot.usedAssetIds || []).includes(a.id));
                                const availableShotCast = castAssets.filter(a => !(shot.usedAssetIds || []).includes(a.id));

                                const activeShotProps = itemAssets.filter(a => (shot.usedAssetIds || []).includes(a.id));
                                const availableShotProps = itemAssets.filter(a => !(shot.usedAssetIds || []).includes(a.id));

                                return (
                                    <div
                                        key={shot.id}
                                        className={`bg-transparent perspective-1000 ${layoutMode === 'list' ? 'aspect-video' :
                                            layoutMode === 'grid-9-16' ? 'aspect-[9/16]' :
                                                layoutMode === 'grid-1-1' ? 'aspect-square' :
                                                    layoutMode === 'grid-4-3' ? 'aspect-[4/3]' :
                                                        'aspect-[3/4]'
                                            }`}
                                    >
                                        <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${flippedShots[shot.id] ? 'rotate-y-180' : ''}`}>

                                            {/* FRONT FACE */}
                                            <div className={`absolute inset-0 backface-hidden bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm flex flex-col ${flippedShots[shot.id] ? 'pointer-events-none' : ''}`}>
                                                <div className="bg-slate-400 px-4 py-2 flex flex-wrap items-center gap-3 border-b border-slate-300 relative z-10">
                                                    <div className="text-2xl font-black text-white drop-shadow-sm mr-2">#{shot.number < 10 ? `0${shot.number}` : shot.number}</div>
                                                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-200">
                                                        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        <input type="number" className="w-6 text-center text-xs font-bold text-slate-700 outline-none" value={shot.duration} onChange={(e) => updateShot(shot.id, { duration: parseInt(e.target.value) || 1 })} />
                                                        <span className="text-[10px] font-bold text-slate-400">s</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-auto">
                                                        <select className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm outline-none hover:border-indigo-300 cursor-pointer" value={shot.shotType} onChange={(e) => updateShot(shot.id, { shotType: e.target.value })}>
                                                            <option>Wide Shot</option><option>Medium Shot</option><option>Close Up</option><option>Extreme Close Up</option>
                                                        </select>
                                                        <select className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm outline-none hover:border-indigo-300 cursor-pointer" value={shot.cameraAngle} onChange={(e) => updateShot(shot.id, { cameraAngle: e.target.value })}>
                                                            <option>Eye Level</option><option>Low Angle</option><option>High Angle</option>
                                                        </select>
                                                        <button
                                                            onClick={() => toggleFlip(shot.id)}
                                                            className="ml-2 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
                                                            title="Flip Card"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className={`p-4 flex flex-1 overflow-y-auto min-h-0 ${layoutMode !== 'list' ? 'flex-col' : 'flex-col md:flex-row'} gap-6`}>
                                                    <div className={`${layoutMode !== 'list' ? 'w-full' : 'w-full md:w-1/3'} space-y-4 flex-shrink-0`}>

                                                        {/* Composition Tags */}
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">Composition</label>
                                                            <div className="flex flex-wrap gap-1">
                                                                {(shot.compositionTags || []).map((tag, tIdx) => (
                                                                    <span key={tIdx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-bold">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                                {(shot.compositionTags || []).length === 0 && (
                                                                    <span className="text-[10px] text-slate-300 italic">No tags</span>
                                                                )}
                                                                {/* Editable via text input for simplicity */}
                                                                <input
                                                                    className="flex-1 min-w-[50px] text-[10px] bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-300"
                                                                    placeholder="+ Tag"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            const val = e.currentTarget.value.trim();
                                                                            if (val) updateShot(shot.id, { compositionTags: [...(shot.compositionTags || []), val] });
                                                                            e.currentTarget.value = '';
                                                                        }
                                                                        if (e.key === 'Backspace' && e.currentTarget.value === '') {
                                                                            const tags = [...(shot.compositionTags || [])];
                                                                            tags.pop();
                                                                            updateShot(shot.id, { compositionTags: tags });
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-widest mb-1.5 block">Action</label>
                                                            <textarea className="w-full p-3 border border-slate-200 rounded-lg text-sm text-slate-800 font-medium leading-relaxed shadow-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none min-h-[80px] resize-y" value={shot.description} onChange={(e) => updateShot(shot.id, { description: e.target.value })} />
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-3">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">Dialogue</label>
                                                                <input className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none" placeholder="Character lines..." value={shot.dialogue} onChange={(e) => updateShot(shot.id, { dialogue: e.target.value })} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">Audio / SFX</label>
                                                                <input className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 italic focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none" placeholder="Sound effects, ambiance..." value={shot.sfx} onChange={(e) => updateShot(shot.id, { sfx: e.target.value })} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {layoutMode === 'list' && <div className="hidden md:block w-px bg-slate-200 self-stretch"></div>}
                                                    <div className="flex-1 min-w-0 flex flex-col gap-4">

                                                        {/* CAST SECTION */}
                                                        <div>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <label className="text-[11px] font-extrabold text-indigo-600 uppercase tracking-widest block">Cast</label>

                                                                {/* Available Cast Quick Add */}
                                                                {availableShotCast.length > 0 && (
                                                                    <div className="flex flex-wrap justify-end gap-1">
                                                                        {availableShotCast.map(a => (
                                                                            <button
                                                                                key={a.id}
                                                                                onClick={() => toggleAssetInShot(shot.id, a.id)}
                                                                                className="text-[10px] bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                                                                                title={`Add ${a.name} to shot`}
                                                                            >
                                                                                <span className="text-indigo-500 font-bold">+</span> {a.name}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 min-h-[125px]">
                                                                <div className="flex overflow-x-auto gap-4 pb-2 pt-1 custom-scrollbar items-start" onWheel={(e) => { if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY; }}>
                                                                    {activeShotCast.map(asset => (
                                                                        <VisualAssetItem
                                                                            key={asset.id}
                                                                            asset={asset}
                                                                            isSelected={true}
                                                                            onClick={() => toggleAssetInShot(shot.id, asset.id)}
                                                                            onRemoveFromScene={() => toggleAssetInShot(shot.id, asset.id)}
                                                                            onGenerate={handleQuickGenerate}
                                                                            onInspect={setPreviewAssetId}
                                                                        />
                                                                    ))}
                                                                    {activeShotCast.length === 0 && <span className="text-[10px] text-slate-300 italic w-full text-center py-10">No cast in this shot. Add from list above.</span>}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* PROPS SECTION */}
                                                        <div>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <label className="text-[11px] font-extrabold text-amber-500 uppercase tracking-widest block">Props</label>

                                                                {/* Available Props Quick Add */}
                                                                {availableShotProps.length > 0 && (
                                                                    <div className="flex flex-wrap justify-end gap-1">
                                                                        {availableShotProps.map(a => (
                                                                            <button
                                                                                key={a.id}
                                                                                onClick={() => toggleAssetInShot(shot.id, a.id)}
                                                                                className="text-[10px] bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                                                                                title={`Add ${a.name} to shot`}
                                                                            >
                                                                                <span className="text-amber-500 font-bold">+</span> {a.name}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 min-h-[125px]">
                                                                <div className="flex overflow-x-auto gap-4 pb-2 pt-1 custom-scrollbar items-start" onWheel={(e) => { if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY; }}>
                                                                    {activeShotProps.map(asset => (
                                                                        <VisualAssetItem
                                                                            key={asset.id}
                                                                            asset={asset}
                                                                            isSelected={true}
                                                                            onClick={() => toggleAssetInShot(shot.id, asset.id)}
                                                                            onRemoveFromScene={() => toggleAssetInShot(shot.id, asset.id)}
                                                                            onGenerate={handleQuickGenerate}
                                                                            onInspect={setPreviewAssetId}
                                                                        />
                                                                    ))}
                                                                    {activeShotProps.length === 0 && <span className="text-[10px] text-slate-300 italic w-full text-center py-10">No props in this shot. Add from list above.</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* BACK FACE */}
                                            <div className={`absolute inset-0 backface-hidden rotate-y-180 bg-slate-900 rounded-xl overflow-hidden shadow-sm flex flex-col items-center justify-center text-center p-6 ${flippedShots[shot.id] ? '' : 'pointer-events-none'}`}>
                                                <button
                                                    onClick={() => toggleFlip(shot.id)}
                                                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                </button>
                                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-white/20">
                                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                                <h3 className="text-white font-bold text-lg mb-1">Visual Reference</h3>
                                                <p className="text-slate-400 text-sm font-medium">Image Generation Coming Soon</p>
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-between">
                <button onClick={onBack} className="px-6 py-3 rounded-xl text-slate-500 hover:bg-slate-100 font-medium">Back</button>
                <button onClick={onNext} disabled={!isNextStepReady} className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50">Go to Storyboard</button>
            </div>

            {/* --- ASSET CREATION MODAL --- */}
            {isAddingAsset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                        <h3 className="font-bold text-lg mb-4">Add New Asset</h3>
                        <input autoFocus className="w-full border p-2 rounded mb-4 uppercase font-bold" placeholder="Asset Name" value={newAssetData.name} onChange={(e) => setNewAssetData(prev => ({ ...prev, name: e.target.value }))} />
                        <div className="flex gap-2 mb-6">
                            <button onClick={() => setNewAssetData(prev => ({ ...prev, type: AssetType.CHARACTER }))} className={`flex-1 py-2 rounded text-xs font-bold border ${newAssetData.type === AssetType.CHARACTER ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200'}`}>Character</button>
                            <button onClick={() => setNewAssetData(prev => ({ ...prev, type: AssetType.ITEM }))} className={`flex-1 py-2 rounded text-xs font-bold border ${newAssetData.type === AssetType.ITEM ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200'}`}>Item</button>
                            <button onClick={() => setNewAssetData(prev => ({ ...prev, type: AssetType.LOCATION }))} className={`flex-1 py-2 rounded text-xs font-bold border ${newAssetData.type === AssetType.LOCATION ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200'}`}>Location</button>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsAddingAsset(false)} className="px-4 py-2 text-slate-500">Cancel</button>
                            <button onClick={handleAddAsset} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Add</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- INSPECTION / EDIT MODAL --- */}
            {activePreviewAsset && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] overflow-hidden flex flex-col md:flex-row">

                        {/* LEFT: IMAGE CANVAS */}
                        <div className="w-full md:w-3/5 bg-slate-950 flex items-center justify-center relative overflow-hidden">
                            {activePreviewAsset.imageUri ? (
                                <img
                                    ref={imageRef}
                                    src={activePreviewAsset.imageUri}
                                    className="max-w-full max-h-full object-contain select-none"
                                    alt="Preview"
                                    onLoad={() => isInpaintingMode && setupCanvas()}
                                />
                            ) : (
                                <div className="text-slate-500 text-center p-8">
                                    <div className="text-6xl mb-4">?</div>
                                    <p>No image generated yet.</p>
                                    <button onClick={() => handleQuickGenerate(activePreviewAsset.id)} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">Generate Now</button>
                                </div>
                            )}

                            {/* Inpainting Canvas Layer */}
                            {isInpaintingMode && activePreviewAsset.imageUri && (
                                <canvas
                                    ref={canvasRef}
                                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair touch-none"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                />
                            )}

                            {isInpaintingMode && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 text-white px-4 py-2 rounded-full text-sm font-bold pointer-events-none border border-white/20">
                                    Draw to mask the area you want to change
                                </div>
                            )}
                        </div>

                        {/* RIGHT: CONTROLS */}
                        <div className="w-full md:w-2/5 flex flex-col bg-white border-l border-slate-200">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                                <div>
                                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${activePreviewAsset.type === AssetType.CHARACTER ? 'text-indigo-600' :
                                        activePreviewAsset.type === AssetType.LOCATION ? 'text-emerald-600' : 'text-amber-600'
                                        }`}>
                                        {activePreviewAsset.type}
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 leading-none">{activePreviewAsset.name}</h3>
                                </div>
                                <button onClick={() => { setPreviewAssetId(null); setIsInpaintingMode(false); setEditPrompt(''); }} className="text-slate-400 hover:text-slate-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                                {/* Description */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600 leading-relaxed">
                                    {activePreviewAsset.visuals.subject}. {activePreviewAsset.visuals.details}.
                                </div>

                                {/* Edit Tools */}
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            Edit Asset
                                        </h4>

                                        {/* Magic Edit Toggle */}
                                        {activePreviewAsset.imageUri && (
                                            <button
                                                onClick={() => {
                                                    const next = !isInpaintingMode;
                                                    setIsInpaintingMode(next);
                                                    if (!next) setEditPrompt(''); // clear prompt if turning off? Optional.
                                                }}
                                                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors border flex items-center gap-2 ${isInpaintingMode
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                                                    }`}
                                            >
                                                {isInpaintingMode && <span className="animate-pulse w-2 h-2 bg-white rounded-full"></span>}
                                                Magic Inpainting {isInpaintingMode ? 'ON' : 'OFF'}
                                            </button>
                                        )}
                                    </div>

                                    <textarea
                                        value={editPrompt}
                                        onChange={(e) => setEditPrompt(e.target.value)}
                                        placeholder={isInpaintingMode ? "Describe what to fill in the masked area (e.g. 'Blue Sunglasses')..." : "Describe changes to the whole image (e.g. 'Make it night time')..."}
                                        className="w-full h-32 p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-sm"
                                    />

                                    {isInpaintingMode && (
                                        <div className="mt-3">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Brush Size</label>
                                            <input
                                                type="range"
                                                min="5" max="100"
                                                value={brushSize}
                                                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <button
                                        onClick={() => handleDeleteAsset(activePreviewAsset.id)}
                                        className="text-red-500 text-sm font-bold hover:text-red-700 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        Delete Asset Permanently
                                    </button>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                                <button
                                    onClick={() => { setPreviewAssetId(null); setIsInpaintingMode(false); }}
                                    className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleEditAssetImage}
                                    disabled={isEditing || !editPrompt || !activePreviewAsset.imageUri}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isEditing && <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>}
                                    Apply Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Storyboard Preview Modal */}
            {previewStoryboardUri && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-8" onClick={() => setPreviewStoryboardUri(null)}>
                    <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
                        <img src={previewStoryboardUri} alt="Scene Storyboard" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                        <button
                            onClick={() => setPreviewStoryboardUri(null)}
                            className="absolute -top-4 -right-4 w-8 h-8 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg hover:bg-slate-100"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Step2Script;
