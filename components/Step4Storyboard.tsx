import React, { useEffect, useState } from 'react';
import { Scene, Asset, AspectRatio } from '../types';
import { generateImage, editImage, generateVideo } from '../services/geminiService';

interface Props {
  script: Scene[];
  stylePrompt: string;
  aspectRatio: AspectRatio;
  assets: Asset[];
  onBack: () => void;
}

interface SceneState extends Scene {
  status: 'pending' | 'generating' | 'complete' | 'error';
  isVideoGenerating?: boolean;
}

const Step4Storyboard: React.FC<Props> = ({ script, stylePrompt, aspectRatio, assets, onBack }) => {
  // Local state to manage images per scene independently
  const [scenes, setScenes] = useState<SceneState[]>(() => 
    script.map(s => ({ ...s, status: 'pending' }))
  );

  // Modal State
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // Trigger generation for pending scenes one by one or in parallel batches
    // For UX, we'll do parallel but limit concurrency if this were real. 
    // Here we just fire all off (beware API limits).
    scenes.forEach(scene => {
      if (scene.status === 'pending') {
        triggerSceneGeneration(scene.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerSceneGeneration = async (sceneId: string) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'generating' } : s));

    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    // Construct Context-Aware Prompt
    // Include descriptions of assets mentioned in the scene text
    const relevantAssets = assets.filter(a => scene.description.includes(a.name));
    const assetContext = relevantAssets.map(a => `${a.name} looks like: ${a.visuals.subject} - ${a.visuals.details}`).join('. ');

    const finalPrompt = `Style: ${stylePrompt}. 
    Scene: ${scene.description}. 
    ${assetContext ? `Context: ${assetContext}` : ''}
    High quality, consistent style.`;

    try {
      const uri = await generateImage(finalPrompt, aspectRatio);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, imageUri: uri, status: 'complete' } : s));
    } catch (error) {
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'error' } : s));
    }
  };

  const handleEditImage = async () => {
    if (!editingSceneId || !editPrompt) return;
    const scene = scenes.find(s => s.id === editingSceneId);
    if (!scene || !scene.imageUri) return;

    setIsEditing(true);
    try {
      const newUri = await editImage(scene.imageUri, editPrompt);
      setScenes(prev => prev.map(s => s.id === editingSceneId ? { ...s, imageUri: newUri } : s));
      setEditingSceneId(null);
      setEditPrompt('');
    } catch (error) {
      alert("Failed to edit image");
    } finally {
      setIsEditing(false);
    }
  };

  const handleGenerateVideo = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || !scene.imageUri) return;

    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isVideoGenerating: true } : s));
    try {
        // Veo only supports landscape (16:9) or portrait (9:16). Map others to 16:9 default.
        const videoRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
        const videoUri = await generateVideo(scene.imageUri, scene.description, videoRatio);
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, videoUri: videoUri, isVideoGenerating: false } : s));
    } catch (error) {
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isVideoGenerating: false } : s));
        alert("Failed to generate video. Check console.");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex justify-between items-end">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">Final Storyboard</h2>
            <p className="text-slate-500 text-sm">Generated using Imagen 4 & Veo</p>
        </div>
        <button onClick={onBack} className="text-slate-500 font-medium hover:text-indigo-600">
             Back to Style
        </button>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pb-20">
        {scenes.map((scene, index) => (
          <div key={scene.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="font-bold text-slate-700 text-sm">Scene {scene.number}</span>
              <div className="flex gap-2">
                  <button 
                    onClick={() => triggerSceneGeneration(scene.id)}
                    className="text-xs text-indigo-600 font-medium hover:underline"
                    disabled={scene.status === 'generating'}
                  >
                    Regenerate
                  </button>
              </div>
            </div>

            {/* Image Area */}
            <div className={`relative bg-slate-100 w-full group ${
                aspectRatio === '16:9' ? 'aspect-video' : 
                aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'
            }`}>
              {scene.status === 'generating' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm z-10">
                   <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mb-2"></div>
                   <span className="text-xs font-medium text-indigo-600">Painting...</span>
                </div>
              )}
              
              {scene.status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center text-red-500 text-sm font-medium">
                  Generation Failed
                </div>
              )}

              {/* Main Content: Video or Image */}
              {scene.videoUri ? (
                 <video 
                    src={scene.videoUri} 
                    controls 
                    autoPlay 
                    loop 
                    className="w-full h-full object-cover"
                 />
              ) : scene.imageUri ? (
                <img src={scene.imageUri} alt="Scene" className="w-full h-full object-cover" />
              ) : null}

              {/* Overlay Actions (only if complete) */}
              {scene.status === 'complete' && !scene.videoUri && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button 
                        onClick={() => setEditingSceneId(scene.id)}
                        className="bg-white text-slate-900 px-4 py-2 rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                      >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                         Edit
                      </button>
                      <button 
                        onClick={() => handleGenerateVideo(scene.id)}
                        disabled={scene.isVideoGenerating}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                         {scene.isVideoGenerating ? (
                             <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                         ) : (
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                         )}
                         Animate
                      </button>
                  </div>
              )}
               {scene.videoUri && (
                   <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-md font-medium">
                       Veo Video
                   </div>
               )}
            </div>

            {/* Description Footer */}
            <div className="p-4 text-sm text-slate-600 leading-relaxed">
              <p className="line-clamp-3">{scene.description}</p>
              {scene.narration && (
                 <p className="mt-2 text-indigo-700 italic border-l-2 border-indigo-200 pl-2">"{scene.narration}"</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingSceneId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Edit Image with AI</h3>
            <p className="text-slate-500 text-sm mb-4">Tell the AI what to change (e.g., "Add a hat", "Make it raining").</p>
            
            <textarea 
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="Describe the change..."
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none mb-4 h-32 resize-none"
            />

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setEditingSceneId(null)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleEditImage}
                disabled={isEditing || !editPrompt}
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
              >
                {isEditing && <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>}
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Step4Storyboard;