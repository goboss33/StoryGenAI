
import React from 'react';
import { Scene, StoryState, PRESET_STYLES, AspectRatio } from '../types';

interface Props {
  stylePrompt: string;
  aspectRatio: AspectRatio;
  onUpdateState: (updates: Partial<StoryState>) => void;
  onBack: () => void;
  onNext: () => void;
  isNextStepReady?: boolean;
}

const Step3Style: React.FC<Props> = ({ 
  stylePrompt, aspectRatio, onUpdateState, onBack, onNext, isNextStepReady 
}) => {
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto pb-8">
        
        {/* SECTION 1: STYLE SELECTION */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Art Direction</h2>
          <p className="text-slate-500 mb-6">Choose a visual style for your storyboard.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {PRESET_STYLES.map(style => (
              <button
                key={style.name}
                onClick={() => onUpdateState({ stylePrompt: style.prompt })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  stylePrompt === style.prompt
                    ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:border-indigo-300 bg-white'
                }`}
              >
                <div className="font-bold text-slate-900">{style.name}</div>
                <div className="text-xs text-slate-500 mt-1 line-clamp-2">{style.prompt}</div>
              </button>
            ))}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Custom Style / Refinement</label>
            <input 
              type="text" 
              value={stylePrompt}
              onChange={(e) => onUpdateState({ stylePrompt: e.target.value })}
              placeholder="Or type your own... e.g. 'Claymation, stop motion style'"
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-100 outline-none"
            />
          </div>

          <div className="mb-6">
             <label className="block text-sm font-medium text-slate-700 mb-2">Aspect Ratio</label>
             <div className="flex gap-3">
               {(['16:9', '9:16', '1:1'] as AspectRatio[]).map(ratio => (
                 <button
                   key={ratio}
                   onClick={() => onUpdateState({ aspectRatio: ratio })}
                   className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                     aspectRatio === ratio
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                   }`}
                 >
                   {ratio}
                 </button>
               ))}
             </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
        <div className="flex gap-2">
          <button onClick={onBack} className="px-6 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-100 transition-colors">
            Back
          </button>
          <button 
            onClick={onNext} 
            disabled={!isNextStepReady}
            className={`px-6 py-3 rounded-xl font-medium transition-colors ${
              isNextStepReady 
                ? 'text-indigo-600 hover:bg-indigo-50' 
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            Next
          </button>
        </div>

        <button 
          onClick={onNext} 
          disabled={!stylePrompt}
          className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${
            !stylePrompt
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
          }`}
        >
          Next: Generate Assets
        </button>
      </div>
    </div>
  );
};

export default Step3Style;
