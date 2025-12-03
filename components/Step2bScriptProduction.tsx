import React from 'react';

interface Props {
    onBack: () => void;
    onNext: () => void;
}

const Step2bScriptProduction: React.FC<Props> = ({ onBack, onNext }) => {
    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Script & Production</h2>
                    <p className="text-xs text-slate-500">Step 2b (New Workflow)</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onBack}
                        className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
                    >
                        Back
                    </button>
                    <button
                        onClick={onNext}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                        2b
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">New Production Workflow</h3>
                    <p className="text-slate-500">
                        This is a blank canvas for the new unified Script & Production step.
                        It will run in parallel to the existing Step 3.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Step2bScriptProduction;
