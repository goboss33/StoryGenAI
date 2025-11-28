
import React from 'react';

interface StepsProps {
  currentStep: number;
  maxStep: number;
  onStepClick: (step: number) => void;
}

const steps = [
  { title: 'Concept', desc: 'L\'idée' },
  { title: 'Structure', desc: 'Univers & Séquencier' },
  { title: 'Dialogues', desc: 'Script & Audio' },
  { title: 'Production', desc: 'Visuels & Rendu' },
];

export const Steps: React.FC<StepsProps> = ({ currentStep, maxStep, onStepClick }) => {
  return (
    <div className="w-full">
      <div className="relative flex justify-between">
        {/* Background Line */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 z-0 rounded-full"></div>

        {/* Active Progress Line (fills up to the max reachable step) */}
        <div
          className="absolute top-1/2 left-0 h-1 bg-indigo-300 -translate-y-1/2 z-0 transition-all duration-500 ease-in-out rounded-full"
          style={{ width: `${(maxStep / (steps.length - 1)) * 100}%` }}
        ></div>

        {/* Current Step Progress Line (Darker, fills up to current step) */}
        <div
          className="absolute top-1/2 left-0 h-1 bg-indigo-600 -translate-y-1/2 z-0 transition-all duration-500 ease-in-out rounded-full"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        ></div>

        {/* Steps */}
        {steps.map((step, index) => {
          // Status Logic
          const isCurrentOrPast = index <= currentStep;
          const isFutureButReady = index > currentStep && index <= maxStep;
          const isClickable = index <= maxStep;

          // Style Logic
          let circleClasses = "bg-white border-slate-200 text-slate-400"; // Default Future Empty
          let textClasses = "text-slate-500";

          if (isCurrentOrPast) {
            // Status 1: Current or Past (Dark Purple)
            circleClasses = "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200";
            textClasses = index === currentStep ? "text-indigo-700" : "text-slate-600";
          } else if (isFutureButReady) {
            // Status 2: Future but Ready (Light Purple)
            circleClasses = "bg-indigo-300 border-indigo-300 text-white hover:bg-indigo-400 transition-colors";
            textClasses = "text-slate-500";
          }

          return (
            <div
              key={index}
              className={`relative z-10 flex flex-col items-center group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => isClickable && onStepClick(index)}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 font-bold ${circleClasses}`}
              >
                {index + 1}
              </div>
              <div className="absolute top-12 text-center w-24 md:w-32">
                <p className={`text-sm font-bold transition-colors ${textClasses}`}>
                  {step.title}
                </p>
                <p className={`text-xs hidden md:block transition-colors ${index === currentStep ? 'text-indigo-400' : 'text-slate-400'}`}>
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
