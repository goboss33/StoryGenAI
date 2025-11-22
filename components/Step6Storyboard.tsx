
import React, { useEffect, useState, useRef } from 'react';
import { Scene, Asset, AspectRatio, AssetType, StoryState } from '../types';
import { generateImage, editImage, generateVideo, generateMultimodalImage, generateBridgeScene, outpaintImage } from '../services/geminiService';

interface Props {
  storyState: StoryState;
  script: Scene[];
  stylePrompt: string;
  aspectRatio: AspectRatio;
  assets: Asset[];
  onUpdateState: (updates: Partial<StoryState>) => void;
  onBack: () => void;
}

interface SceneState extends Scene {
  status: 'pending' | 'generating' | 'complete' | 'error';
  statusMessage?: string;
  isVideoGenerating?: boolean;
  lastPrompt?: string;
}

const Step6Storyboard: React.FC<Props> = ({ storyState, script, stylePrompt, aspectRatio, assets, onUpdateState, onBack }) => {
  const [scenes, setScenes] = useState<SceneState[]>(() =>
    script.map(s => ({ ...s, status: s.imageUri ? 'complete' : 'pending' }))
  );

  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isInpaintingMode, setIsInpaintingMode] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [inspectorAssetIds, setInspectorAssetIds] = useState<string[]>([]);
  const [isInspectorDirty, setIsInspectorDirty] = useState(false);

  // Inpainting logic simplified for this view update
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (canvas && img) {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  useEffect(() => { if (isInpaintingMode && editingSceneId) setTimeout(setupCanvas, 100); }, [isInpaintingMode, editingSceneId]);
  const startDrawing = (e: React.MouseEvent) => { if (!isInpaintingMode) return; setIsDrawing(true); draw(e); };
  const stopDrawing = () => setIsDrawing(false);
  const draw = (e: React.MouseEvent) => {
    if (!isDrawing || !isInpaintingMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineWidth = brushSize; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
  };
  const clearMask = () => setupCanvas();
  const getMaskFromCanvas = async (): Promise<string | undefined> => {
    if (!canvasRef.current || !isInpaintingMode) return undefined;
    return canvasRef.current.toDataURL('image/png');
  };

  useEffect(() => {
    scenes.forEach(scene => {
      if (scene.status === 'pending' && !scene.imageUri) {
        triggerSceneGeneration(scene.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncToParent = (updatedScenes: SceneState[]) => { onUpdateState({ script: updatedScenes }); };

  const parseDataUri = (dataUri: string) => {
    const split = dataUri.split(',');
    const match = split[0].match(/:(.*?);/);
    return { mimeType: match ? match[1] : 'image/png', data: split[1] };
  };

  const handleSaveProject = () => {
    const jsonString = JSON.stringify({ ...storyState, script: scenes }, null, 2);
    const url = URL.createObjectURL(new Blob([jsonString], { type: "application/json" }));
    const link = document.createElement('a');
    link.href = url; link.download = `StoryGen_Project.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  const triggerSceneGeneration = async (sceneId: string, overrideAssetIds?: string[]) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    // 1. Identify Assets to include
    let relevantAssets: Asset[] = [];

    if (overrideAssetIds) {
      relevantAssets = assets.filter(a => overrideAssetIds.includes(a.id));
    } else {
      // AUTO MODE:
      // Include location asset if present
      if (scene.locationAssetId) {
        const locAsset = assets.find(a => a.id === scene.locationAssetId);
        if (locAsset && locAsset.imageUri) relevantAssets.push(locAsset);
      }
      // Include tagged assets
      const taggedAssets = assets.filter(a => (scene.usedAssetIds || []).includes(a.id) && a.imageUri);
      relevantAssets = [...relevantAssets, ...taggedAssets];

      // Deduplicate
      relevantAssets = Array.from(new Set(relevantAssets));
    }

    const usedAssetIds = relevantAssets.map(a => a.id);
    const isMultimodal = relevantAssets.length > 0;

    // 2. Construct the Prompt with Strict Structure
    // Style: [Visual Style] + [Composition Tags].
    const compositionTags = (scene.compositionTags || []).join(', ');
    let promptText = `Style: ${stylePrompt}. ${compositionTags ? `Composition: ${compositionTags}.` : ''}\n`;

    // Setting: [Location Name] ([Location Description]).
    const locationAsset = assets.find(a => a.id === scene.locationAssetId);
    if (locationAsset) {
      promptText += `Setting: ${locationAsset.name} (${locationAsset.visuals.details}).\n`;
    } else {
      const parts = scene.location.split(' - ');
      promptText += `Setting: ${parts[0]}.\n`;
    }

    // Time: [DAY/NIGHT/DAWN/DUSK].
    promptText += `Time: ${scene.time || 'DAY'}.\n`;

    // Action: [Action Description with Blocking/Eyelines].
    promptText += `Action: ${scene.description}.\n`;

    // Shot: [Shot Type], [Camera Angle].
    promptText += `Shot: ${scene.shotType}, ${scene.cameraAngle}.`;

    if (isMultimodal) {
      const refNames = relevantAssets.map(r => `${r.name} (${r.type})`).join(', ');
      promptText += `\n\nINSTRUCTIONS:\nUse the attached images as strict references for: ${refNames}.`;
    }

    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'generating', statusMessage: 'Generating...', usedAssetIds } : s));
    if (overrideAssetIds && sceneId === editingSceneId) setIsInspectorDirty(false);

    try {
      let uri = '';
      if (isMultimodal) {
        const refs = relevantAssets.map(a => { const { mimeType, data } = parseDataUri(a.imageUri!); return { name: a.name, data, mimeType }; });
        // Updated to pass aspectRatio
        uri = await generateMultimodalImage(promptText, refs, aspectRatio);
      } else {
        // Updated: No longer appending aspect ratio to prompt text, API config handles it.
        uri = await generateImage(promptText, aspectRatio);
      }

      setScenes(prev => {
        const updated = prev.map(s => s.id === sceneId ? { ...s, imageUri: uri, status: 'complete', statusMessage: undefined } as SceneState : s);
        syncToParent(updated); return updated;
      });
    } catch (e) {
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'error' } as SceneState : s));
    }
  };

  const handleEditImage = async () => {
    if (!editingSceneId || !editPrompt) return;
    const scene = scenes.find(s => s.id === editingSceneId);
    if (!scene || !scene.imageUri) return;
    setIsEditing(true);
    try {
      const mask = isInpaintingMode ? await getMaskFromCanvas() : undefined;
      const newUri = await editImage(scene.imageUri, editPrompt, undefined, mask);
      setScenes(prev => { const u = prev.map(s => s.id === editingSceneId ? { ...s, imageUri: newUri } : s); syncToParent(u); return u; });
      setEditPrompt(''); clearMask();
    } catch (error) { alert("Edit failed"); } finally { setIsEditing(false); }
  };

  const handleGenerateVideo = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || !scene.imageUri) return;
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isVideoGenerating: true } : s));
    try {
      const videoRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
      const videoUri = await generateVideo(scene.imageUri, scene.description, videoRatio);
      setScenes(prev => { const u = prev.map(s => s.id === sceneId ? { ...s, videoUri: videoUri, isVideoGenerating: false } : s); syncToParent(u); return u; });
    } catch (error) {
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isVideoGenerating: false } : s));
      alert("Failed to generate video.");
    }
  };

  const activeScene = scenes.find(s => s.id === editingSceneId);
  const visibleAssets = assets;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex justify-between items-end">
        <div><h2 className="text-2xl font-bold text-slate-900">Final Storyboard</h2><p className="text-slate-500 text-sm">Review, edit, and animate.</p></div>
        <div className="flex gap-3">
          <button onClick={onBack} className="text-slate-500 font-bold hover:text-indigo-600 text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Script
          </button>
          <button onClick={handleSaveProject} className="px-4 py-2 bg-indigo-100 text-indigo-700 font-bold rounded-lg hover:bg-indigo-200">Save Project</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {scenes.map((scene, index) => (
          <div key={scene.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group">
            <div className="p-3 border-b border-slate-100 flex justify-between">
              <span className="font-bold text-slate-700 text-xs">Scene {scene.number}</span>
              <button onClick={() => triggerSceneGeneration(scene.id)} className="text-xs text-indigo-600 font-bold hover:underline">Regenerate</button>
            </div>
            <div className={`relative bg-slate-100 w-full ${aspectRatio === '16:9' ? 'aspect-video' : aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'}`}>
              {scene.status === 'generating' ? (
                <div className="absolute inset-0 flex items-center justify-center"><span className="animate-spin w-6 h-6 border-2 border-indigo-600 rounded-full border-t-transparent"></span></div>
              ) : scene.videoUri ? (
                <video src={scene.videoUri} controls autoPlay loop className="w-full h-full object-cover" />
              ) : scene.imageUri ? (
                <img src={scene.imageUri} className="w-full h-full object-cover" alt="Scene" />
              ) : null}

              {!scene.videoUri && scene.status === 'complete' && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => setEditingSceneId(scene.id)} className="bg-white text-slate-900 px-3 py-1 rounded-full text-xs font-bold hover:scale-105">Inspector</button>
                  <button onClick={() => handleGenerateVideo(scene.id)} disabled={scene.isVideoGenerating} className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold hover:scale-105 flex items-center gap-1">
                    {scene.isVideoGenerating ? <span className="animate-spin w-3 h-3 border border-white rounded-full border-t-transparent"></span> : <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
                    Video
                  </button>
                </div>
              )}
              {scene.videoUri && <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md">Veo</div>}
            </div>
            <div className="p-3 text-xs text-slate-600 line-clamp-3">{scene.description}</div>
          </div>
        ))}
      </div>

      {/* Inspector Modal */}
      {activeScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col md:flex-row">
            <div className="w-full md:w-3/5 bg-slate-900 flex flex-col relative">
              <div className="flex-1 flex items-center justify-center p-8 relative">
                {activeScene.imageUri && <img ref={imageRef} src={activeScene.imageUri} className="max-w-full max-h-full object-contain" onLoad={() => isInpaintingMode && setupCanvas()} alt="Preview" />}
                {isInpaintingMode && <canvas ref={canvasRef} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} />}
              </div>
              {/* Asset Strip */}
              <div className="h-24 bg-slate-800 border-t border-slate-700 flex items-center gap-2 overflow-x-auto p-2">
                {visibleAssets.map(asset => {
                  const isSelected = inspectorAssetIds.includes(asset.id) || (!isInspectorDirty && (activeScene.usedAssetIds?.includes(asset.id) || activeScene.locationAssetId === asset.id));
                  return (
                    <div key={asset.id} onClick={() => {
                      if (!isInspectorDirty) {
                        // Initialize with current if starting fresh
                        setInspectorAssetIds([...(activeScene.usedAssetIds || []), ...(activeScene.locationAssetId ? [activeScene.locationAssetId] : [])]);
                      }
                      setInspectorAssetIds(prev => prev.includes(asset.id) ? prev.filter(id => id !== asset.id) : [...prev, asset.id]);
                      setIsInspectorDirty(true);
                    }} className={`w-16 h-16 rounded overflow-hidden border-2 cursor-pointer relative flex-shrink-0 ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500 z-10' : 'border-transparent opacity-50'}`}>
                      {asset.imageUri ? <img src={asset.imageUri} className="w-full h-full object-cover" alt={asset.name} /> : <div className="w-full h-full bg-slate-700 flex items-center justify-center text-[8px] text-white">{asset.name}</div>}
                      {isSelected && <div className="absolute top-0 right-0 bg-indigo-500 w-3 h-3 rounded-bl-lg"></div>}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="w-full md:w-2/5 bg-white flex flex-col p-6">
              <div className="flex justify-between mb-6"><h3 className="font-bold text-lg">Inspector</h3><button onClick={() => { setEditingSceneId(null); setIsInspectorDirty(false); setInspectorAssetIds([]); }}>Close</button></div>
              <div className="flex-1 space-y-4">
                <div className="bg-slate-50 p-3 rounded text-sm border border-slate-100">
                  <span className="font-bold block text-xs text-slate-400 mb-1 uppercase">Prompt Scene Description</span>
                  {activeScene.description}
                </div>

                {isInspectorDirty && (
                  <button onClick={() => triggerSceneGeneration(activeScene.id, inspectorAssetIds)} className="w-full py-3 bg-indigo-50 text-indigo-600 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-100 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Regenerate with Selected Assets
                  </button>
                )}

                <div className="border-t border-slate-100 my-4 pt-4">
                  <div className="flex items-center justify-between mb-2"><h4 className="font-bold text-sm">Magic Edit</h4><button onClick={() => { setIsInpaintingMode(!isInpaintingMode); if (isInpaintingMode) clearMask(); }} className={`text-xs px-3 py-1 rounded-full font-bold transition-colors ${isInpaintingMode ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{isInpaintingMode ? 'ON' : 'OFF'}</button></div>
                  <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} className="w-full border p-3 rounded-xl h-24 text-sm focus:ring-2 focus:ring-indigo-200 outline-none" placeholder={isInpaintingMode ? "Paint area and describe change..." : "Describe changes to the whole image..."} />
                  {isInpaintingMode && <div className="mt-2"><input type="range" min="5" max="100" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" /></div>}
                  <button onClick={handleEditImage} disabled={!editPrompt} className="w-full mt-3 bg-slate-900 text-white py-3 rounded-xl font-bold disabled:opacity-50">Apply Edit</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step6Storyboard;
