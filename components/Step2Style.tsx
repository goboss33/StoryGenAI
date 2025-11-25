
import React from 'react';
import { StoryState, PRESET_STYLES } from '../types';

interface Props {
  stylePrompt: string;
  onUpdate: (updates: Partial<StoryState>) => void;
  onNext: () => void;
  onBack: () => void;
  onCreateScript: () => void;
  isNextStepReady?: boolean;
}

const Step2Style: React.FC<Props> = ({
  stylePrompt, onUpdate, onNext, onBack, onCreateScript, isNextStepReady
}) => {

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto pb-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Direction Artistique</h1>
          <p className="text-slate-500">Choisissez l'atmosphère visuelle et le format de votre histoire.</p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full flex flex-col">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="bg-fuchsia-100 text-fuchsia-600 w-6 h-6 rounded flex items-center justify-center text-xs">3</span>
              Format & Style
            </h2>

            {/* Style Grid */}
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">Style Visuel</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {PRESET_STYLES.map(style => (
                  <button
                    key={style.name}
                    onClick={() => onUpdate({ stylePrompt: style.prompt })}
                    className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between group ${stylePrompt === style.prompt
                      ? 'border-fuchsia-500 bg-fuchsia-50 ring-1 ring-fuchsia-500'
                      : 'border-slate-200 hover:border-fuchsia-300 bg-white'
                      }`}
                  >
                    <div>
                      <div className={`font-bold text-sm ${stylePrompt === style.prompt ? 'text-fuchsia-800' : 'text-slate-700'}`}>{style.name}</div>
                      <div className="text-xs text-slate-400 line-clamp-1 mt-1">{style.prompt}</div>
                    </div>
                    {stylePrompt === style.prompt && <div className="w-3 h-3 rounded-full bg-fuchsia-500 shadow-sm"></div>}
                  </button>
                ))}
              </div>

              {/* Custom Style */}
              <div className="mt-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Prompt Style Personnalisé</label>
                <textarea
                  value={stylePrompt}
                  onChange={(e) => onUpdate({ stylePrompt: e.target.value })}
                  placeholder="Ex: Claymation, stop motion style, textured lighting..."
                  className="w-full p-4 rounded-xl border border-slate-200 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 outline-none text-sm h-24 resize-none"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
        <button onClick={onBack} className="px-6 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-100 transition-colors">
          Retour
        </button>

        <div className="flex items-center gap-4">
          {isNextStepReady && (
            <span className="text-sm text-green-600 font-medium animate-pulse">Script prêt !</span>
          )}
          <button
            onClick={onNext}
            disabled={!stylePrompt}
            className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 ${!stylePrompt
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              }`}
          >
            Suivant : Dialogues
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step2Style;
