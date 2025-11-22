import React, { useState, useEffect, useRef } from 'react';
import { StoryState } from './types';
import Step1Idea from './components/Step1Idea';
import Step2Style from './components/Step2Style';
import Step2Script from './components/Step2Script';
import Step6Storyboard from './components/Step6Storyboard';
import { Steps } from './components/ui/Steps';
import { subscribeToDebugLog, subscribeToUsage, UsageStats } from './services/geminiService';

interface LogEntry {
  id: string;
  type: 'req' | 'res' | 'info' | 'error';
  title: string;
  data: any;
  timestamp: number;
}

const App: React.FC = () => {
  const [state, setState] = useState<StoryState>({
    step: 0,
    idea: '',
    totalDuration: 60, // Default 1 minute
    pacing: 'standard',
    language: 'English',
    script: [],
    stylePrompt: 'Cinematic lighting, photorealistic, 8k, highly detailed', // Default style
    aspectRatio: '16:9',
    assets: [],
    isAssetsGenerated: false
  });

  // Debug State
  const [debugMode, setDebugMode] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalUsage, setTotalUsage] = useState<UsageStats>({ inputTokens: 0, outputTokens: 0, cost: 0 });
  const logEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to service logs & usage
  useEffect(() => {
    const unsubscribeLogs = subscribeToDebugLog((log) => {
      setLogs(prev => [...prev, { ...log, id: crypto.randomUUID() }]);
    });

    const unsubscribeUsage = subscribeToUsage((stats) => {
      setTotalUsage(prev => ({
        inputTokens: prev.inputTokens + stats.inputTokens,
        outputTokens: prev.outputTokens + stats.outputTokens,
        cost: prev.cost + stats.cost
      }));
    });

    return () => {
      unsubscribeLogs();
      unsubscribeUsage();
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (debugMode && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, debugMode]);

  const nextStep = () => setState(prev => ({ ...prev, step: prev.step + 1 }));
  const prevStep = () => setState(prev => ({ ...prev, step: prev.step - 1 }));
  const goToStep = (stepIndex: number) => setState(prev => ({ ...prev, step: stepIndex }));

  const updateState = (updates: Partial<StoryState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Triggers script generation and moves to Step 3 (Script View)
  const handleForceCreateScript = () => {
    setState(prev => ({
      ...prev,
      script: [], // Clear script to trigger regeneration
      assets: [], // Clear assets
      step: 2     // Move to Script Step (Index 2 now)
    }));
  };

  const importProject = (data: StoryState) => {
    if (data.idea && Array.isArray(data.script)) {
      setState(data);
    } else {
      alert('Invalid project file');
    }
  };

  // 0: Idea, 1: Style, 2: Script, 3: Storyboard
  const calculateMaxStep = () => {
    let max = 0;
    if (state.idea.length > 10) max = 1; // Idea valid -> Style ready
    if (state.script.length > 0) max = 3; // Script exists -> Storyboard ready (skip assets step)
    // Note: max=2 (Script) is implied if > 0. 
    // If script is generated, we allow going to Storyboard immediately.
    return max;
  };

  const maxStep = calculateMaxStep();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              StoryGen AI
            </span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-500">
            Powered by Gemini 2.5 Flash & Veo
          </div>
        </div>
      </header>

      {/* Layout Container */}
      <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300 ${debugMode ? 'flex gap-6 max-w-[95vw]' : ''}`}>

        {/* Main Application Area */}
        <main className="flex-1 min-w-0">
          <div className="mb-10">
            <Steps currentStep={state.step} maxStep={maxStep} onStepClick={goToStep} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-8 min-h-[700px] flex flex-col">

            {state.step === 0 && (
              <Step1Idea
                idea={state.idea}
                totalDuration={state.totalDuration}
                pacing={state.pacing}
                language={state.language}
                onUpdate={updateState}
                onNext={nextStep}
                onImport={importProject}
                isDebugMode={debugMode}
                setIsDebugMode={setDebugMode}
              />
            )}

            {state.step === 1 && (
              <Step2Style
                stylePrompt={state.stylePrompt}
                aspectRatio={state.aspectRatio}
                onUpdate={updateState}
                onNext={nextStep}
                onBack={prevStep}
                onCreateScript={handleForceCreateScript}
                isNextStepReady={state.script.length > 0}
              />
            )}

            {state.step === 2 && (
              <Step2Script
                idea={state.idea}
                totalDuration={state.totalDuration}
                pacing={state.pacing}
                language={state.language}
                script={state.script}
                assets={state.assets}
                stylePrompt={state.stylePrompt}
                onUpdateScript={(script) => updateState({ script })}
                onUpdateAssets={(assets) => updateState({ assets })}
                onBack={prevStep}
                onNext={nextStep}
                isNextStepReady={state.script.length > 0}
              />
            )}

            {state.step === 3 && (
              <Step6Storyboard
                storyState={state}
                script={state.script}
                stylePrompt={state.stylePrompt}
                aspectRatio={state.aspectRatio}
                assets={state.assets}
                onUpdateState={updateState}
                onBack={prevStep}
              />
            )}
          </div>
        </main>

        {/* DEBUG LOG WINDOW */}
        {debugMode && (
          <aside className="w-[450px] flex-shrink-0 h-[780px] sticky top-24">
            <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden flex flex-col h-full">
              <div className="bg-slate-950 p-3 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider">GenAI Debug Console</span>
                </div>
                <button onClick={() => setLogs([])} className="text-[10px] text-slate-500 hover:text-white uppercase font-bold">Clear</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-4 custom-scrollbar">
                {logs.length === 0 && (
                  <div className="text-slate-600 italic text-center mt-20">Waiting for API activity...</div>
                )}
                {logs.map(log => (
                  <div key={log.id} className="flex flex-col gap-1 group">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className={`px-1.5 rounded-sm font-bold text-[9px] uppercase ${log.type === 'req' ? 'bg-blue-900 text-blue-300' :
                          log.type === 'res' ? 'bg-emerald-900 text-emerald-300' :
                            log.type === 'error' ? 'bg-red-900 text-red-300' : 'bg-slate-800 text-slate-300'
                        }`}>{log.type}</span>
                      <span className="text-slate-300 font-bold">{log.title}</span>
                    </div>
                    <div className="bg-slate-950/50 p-2 rounded border border-slate-800 text-slate-400 whitespace-pre-wrap break-words overflow-hidden select-text">
                      {JSON.stringify(log.data, null, 2)}
                    </div>
                  </div>
                ))}
                <div ref={logEndRef}></div>
              </div>

              {/* USAGE STATS PANEL */}
              <div className="bg-slate-950 border-t border-slate-800 p-4 grid grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Input Tokens</span>
                  <span className="text-sm font-mono text-slate-300">{totalUsage.inputTokens.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Output Tokens</span>
                  <span className="text-sm font-mono text-slate-300">{totalUsage.outputTokens.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Est. Cost</span>
                  <span className="text-sm font-mono text-emerald-400">${totalUsage.cost.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default App;
