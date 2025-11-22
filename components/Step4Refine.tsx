import React, { useEffect, useState } from 'react';
import { Scene, StoryState, RefineQuestion } from '../types';
import { generateRefinementQuestions } from '../services/geminiService';

interface Props {
  script: Scene[];
  stylePrompt: string;
  questions: RefineQuestion[];
  answers: Record<string, string>;
  onUpdateState: (updates: Partial<StoryState>) => void;
  onBack: () => void;
  onNext: () => void;
  isNextStepReady?: boolean;
}

const Step4Refine: React.FC<Props> = ({ 
  script, stylePrompt, questions, answers, onUpdateState, onBack, onNext, isNextStepReady 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (questions.length === 0 && !loading && !error) {
      loadQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const generated = await generateRefinementQuestions(script, stylePrompt);
      if (generated.length === 0) {
        // If no questions generated, we can auto-skip or show a message. 
        // For now let's just show a "Proceed" state.
      }
      onUpdateState({ refineQuestions: generated });
    } catch (err) {
      setError('Could not generate refinement questions. You can skip this step.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: string, option: string) => {
    onUpdateState({ 
      refineAnswers: { ...answers, [questionId]: option } 
    });
  };

  const allAnswered = questions.length > 0 && questions.every(q => answers[q.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full mb-4"></div>
        <h3 className="text-xl font-semibold text-slate-800">Thinking of details...</h3>
        <p className="text-slate-500 mt-2">Gemini is analyzing your script to find visual ambiguities.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto pb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Refine Details</h2>
          <p className="text-slate-500">
            Help the AI understand the nuances of your story by answering a few questions.
          </p>
        </div>

        {error && (
           <div className="p-4 bg-orange-50 text-orange-600 rounded-lg mb-6 border border-orange-100">
             {error}
           </div>
        )}

        {questions.length === 0 && !error ? (
          <div className="text-center py-20 text-slate-400">
            <p>No specific ambiguities found. You're good to go!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {questions.map((q, idx) => (
              <div key={q.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex gap-3">
                  <span className="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0">
                    {idx + 1}
                  </span>
                  {q.text}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-11">
                  {q.options.map((option) => {
                    const isSelected = answers[q.id] === option;
                    return (
                      <button
                        key={option}
                        onClick={() => handleAnswer(q.id, option)}
                        className={`p-3 rounded-lg text-left text-sm transition-all border-2 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                            : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-white'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-slate-100 flex justify-between mt-4 items-center">
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
          disabled={questions.length > 0 && !allAnswered}
          className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${
            (questions.length > 0 && !allAnswered)
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

export default Step4Refine;