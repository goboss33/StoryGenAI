
import React, { useEffect, useState } from 'react';
import { Scene, Asset, StoryState } from '../types';
import { extractAssets, generateImage, editImage } from '../services/geminiService';

interface Props {
  script: Scene[];
  stylePrompt: string;
  assets: Asset[];
  isAssetsGenerated: boolean;
  onUpdateState: (updates: Partial<StoryState>) => void;
  onBack: () => void;
  onNext: () => void;
}

const Step4Assets: React.FC<Props> = ({
  script, stylePrompt, assets, isAssetsGenerated, onUpdateState, onBack, onNext
}) => {
  const [processing, setProcessing] = useState(false);
  
  // Editing State
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Initial Extraction & Generation on Mount
  useEffect(() => {
    if (!isAssetsGenerated && assets.length === 0 && !processing) {
      initializeAssets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeAssets = async () => {
    setProcessing(true);
    try {
      // 1. Extract
      // Destructure 'assets' from the result of extractAssets
      const { assets: extracted } = await extractAssets(script);
      const initialAssets: Asset[] = extracted.map(a => ({ ...a, status: 'pending' }));
      
      // Update parent immediately so we see the placeholders
      onUpdateState({ assets: initialAssets });

      // 2. Generate Images Sequentially
      const workingAssets = [...initialAssets];
      
      for (let i = 0; i < workingAssets.length; i++) {
        workingAssets[i] = { ...workingAssets[i], status: 'generating' };
        onUpdateState({ assets: [...workingAssets] });

        try {
          const prompt = `${stylePrompt}. Character sheet/Reference sheet for ${workingAssets[i].name}. ${workingAssets[i].visuals.subject}, ${workingAssets[i].visuals.details}. White background, clear lighting, full body view.`;
          const uri = await generateImage(prompt, '1:1');
          workingAssets[i] = { ...workingAssets[i], imageUri: uri, status: 'complete' };
        } catch (e) {
          workingAssets[i] = { ...workingAssets[i], status: 'error' };
        }
        
        onUpdateState({ assets: [...workingAssets] });
      }
      
      onUpdateState({ isAssetsGenerated: true });
    } catch (error) {
      console.error("Asset pipeline failed", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleRegenerate = async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    const newAssets = assets.map(a => a.id === assetId ? { ...a, status: 'generating' } as Asset : a);
    onUpdateState({ assets: newAssets });

    try {
      const prompt = `${stylePrompt}. Character sheet/Reference sheet for ${asset.name}. ${asset.visuals.subject}, ${asset.visuals.details}. White background, clear lighting, full body view.`;
      const uri = await generateImage(prompt, '1:1');
      onUpdateState({ 
        assets: assets.map(a => a.id === assetId ? { ...a, imageUri: uri, status: 'complete' } as Asset : a)
      });
    } catch (error) {
      onUpdateState({ 
        assets: assets.map(a => a.id === assetId ? { ...a, status: 'error' } as Asset : a)
      });
    }
  };

  const handleEditAsset = async () => {
    if (!editingAssetId || !editPrompt) return;
    const asset = assets.find(a => a.id === editingAssetId);
    if (!asset || !asset.imageUri) return;

    setIsEditing(true);
    try {
      const newUri = await editImage(asset.imageUri, editPrompt);
      onUpdateState({
        assets: assets.map(a => a.id === editingAssetId ? { ...a, imageUri: newUri } : a)
      });
      setEditingAssetId(null);
      setEditPrompt('');
    } catch (error) {
      alert("Failed to edit asset");
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Story Assets</h2>
        <p className="text-slate-500">
          We've identified these key elements from your script. Review and refine them to ensure consistency in the final storyboard.
        </p>
      </div>

      {/* Asset Grid */}
      <div className="flex-1 overflow-y-auto pb-8">
         {assets.length === 0 && processing ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-400">
             <div className="animate-spin w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full mb-4"></div>
             <p>Analyzing script for characters...</p>
           </div>
         ) : (
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
             {assets.map(asset => (
               <div key={asset.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all group">
                 
                 {/* Image Container */}
                 <div className="aspect-square bg-slate-100 rounded-lg mb-4 overflow-hidden relative">
                    {asset.imageUri ? (
                      <img src={asset.imageUri} alt={asset.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50">
                         {asset.status === 'generating' ? (
                            <span className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full"></span>
                         ) : (
                            <span className="text-xs">Waiting...</span>
                         )}
                      </div>
                    )}
                    
                    {/* Type Badge */}
                    <div className="absolute top-2 left-2">
                       <span className="text-[10px] uppercase font-bold bg-black/50 text-white px-2 py-1 rounded backdrop-blur-sm">
                         {asset.type}
                       </span>
                    </div>

                    {/* Actions Overlay */}
                    {asset.status === 'complete' && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                         <button 
                           onClick={() => setEditingAssetId(asset.id)}
                           className="bg-white text-slate-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg hover:scale-105 transition-transform"
                         >
                           Edit
                         </button>
                         <button 
                           onClick={() => handleRegenerate(asset.id)}
                           className="bg-white/20 text-white border border-white/50 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-white/30 transition-colors"
                         >
                           Regenerate
                         </button>
                      </div>
                    )}
                 </div>

                 {/* Details */}
                 <div>
                   <h4 className="font-bold text-slate-900 mb-1">{asset.name}</h4>
                   <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">
                     {asset.visuals.subject}. {asset.visuals.details}
                   </p>
                 </div>
               </div>
             ))}
           </div>
         )}
      </div>

      {/* Footer Actions */}
      <div className="pt-6 border-t border-slate-100 flex justify-between mt-4">
        <button onClick={onBack} className="px-6 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-100 transition-colors">
          Back
        </button>
        <button 
          onClick={onNext} 
          disabled={!isAssetsGenerated || processing || assets.some(a => a.status === 'generating')}
          className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${
            !isAssetsGenerated || processing || assets.some(a => a.status === 'generating')
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
          }`}
        >
          Create Storyboard
        </button>
      </div>

      {/* Edit Modal */}
      {editingAssetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Edit Asset</h3>
            <p className="text-slate-500 text-sm mb-4">Use text to modify this character (e.g., "Add glasses", "Change hair color to blue").</p>
            
            <textarea 
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="Describe the change..."
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none mb-4 h-32 resize-none"
            />

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setEditingAssetId(null)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleEditAsset}
                disabled={isEditing || !editPrompt}
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
              >
                {isEditing && <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>}
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step4Assets;
