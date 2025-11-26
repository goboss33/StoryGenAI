import React, { useState, useEffect, useRef } from 'react';
import { StoryState } from './types';
import Step1Idea from './components/Step1Idea';
import Step2Style from './components/Step2Style';
import Step1BisDialogue from './components/Step1BisDialogue';
import Step2Script from './components/Step2Script';
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
    totalDuration: 60,
    pacing: 'standard',
    language: 'English',
    script: [],
    stylePrompt: 'Cinematic lighting, photorealistic, 8k, highly detailed',
    aspectRatio: '16:9',
    assets: [],
    isAssetsGenerated: false
  });

  const [debugMode, setDebugMode] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalUsage, setTotalUsage] = useState<UsageStats>({ inputTokens: 0, outputTokens: 0, cost: 0 });
  const logEndRef = useRef<HTMLDivElement>(null);

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

  const handleForceCreateScript = () => {
    setState(prev => ({
      ...prev,
      script: [],
      assets: [],
      step: 3
    }));
  };

  const importProject = (data: StoryState) => {
    if (data.idea && Array.isArray(data.script)) {
      setState(data);
    } else {
      alert('Invalid project file');
    }
  };

  const calculateMaxStep = () => {
    let max = 0;
    if (state.idea.length > 10) max = 1;
    if (state.stylePrompt) max = 2;
    if (state.audioScript && state.audioScript.length > 0) max = 3;
    return max;
  };

  const maxStep = calculateMaxStep();

  // --- GLOBAL SAVE & IMPORT ---
  const saveProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `storygen_project_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        importProject(json);
      } catch (err) { alert('Failed to load project file.'); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              StoryGen AI
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Global Actions */}
            <div className="flex items-center gap-2 mr-4 border-r border-slate-200 pr-4">
              <button
                onClick={saveProject}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 transition-colors"
                title="Save Project"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Save
              </button>

              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 transition-colors"
                title="Import Project"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Import
              </button>
            </div>

            {/* Debug Toggle */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-100 transition-colors">
              <label className="relative inline-flex items-center cursor-pointer select-none gap-2">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                />
                <span className="text-xs font-bold text-slate-500 uppercase">Debug</span>
                <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:left-[calc(100%-16px)] peer-checked:after:left-[calc(100%-18px)] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-slate-800"></div>
              </label>
            </div>
          </div>
        </div>
      </header>

      <main className={`flex-1 flex flex-col min-h-0 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full ${debugMode ? 'pb-[420px]' : ''}`}>
        <div className="flex-shrink-0 mb-6">
          <Steps currentStep={state.step} maxStep={maxStep} onStepClick={goToStep} />
        </div>

        <div className={`flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${state.step === 2 ? 'p-0' : 'p-4 md:p-8'}`}>
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
              onUpdate={updateState}
              onNext={nextStep}
              onBack={prevStep}
              onCreateScript={handleForceCreateScript}
              isNextStepReady={state.script.length > 0}
            />
          )}

          {state.step === 2 && (
            <Step1BisDialogue
              idea={state.idea}
              totalDuration={state.totalDuration}
              pacing={state.pacing}
              language={state.language}
              audioScript={state.audioScript}
              onUpdate={updateState}
              onBack={prevStep}
              onNext={nextStep}
              isNextStepReady={state.script.length > 0}
            />
          )}

          {state.step === 3 && (
            <Step2Script
              idea={state.idea}
              totalDuration={state.totalDuration}
              pacing={state.pacing}
              language={state.language}
              script={state.script}
              assets={state.assets}
              stylePrompt={state.stylePrompt}
              aspectRatio={state.aspectRatio}
              onUpdateAspectRatio={(ratio) => updateState({ aspectRatio: ratio })}
              onUpdateScript={(script) => updateState({ script })}
              onUpdateAssets={(assets) => updateState({ assets })}
              onBack={prevStep}
              onNext={nextStep}
              isNextStepReady={state.script.length > 0}
            />
          )}


        </div>
      </main>

      {/* DEBUG BOTTOM BAR */}
      {debugMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 shadow-2xl">
          <div className="flex flex-col h-[400px]">
            <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300">GenAI Debug Console</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-4 px-4 border-l border-r border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">In</span>
                    <span className="text-xs font-mono text-slate-300">{totalUsage.inputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Out</span>
                    <span className="text-xs font-mono text-slate-300">{totalUsage.outputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Cost</span>
                    <span className="text-xs font-mono text-emerald-400">${totalUsage.cost.toFixed(4)}</span>
                  </div>
                </div>
                <button onClick={() => setLogs([])} className="text-xs text-slate-500 hover:text-white uppercase font-bold px-3 py-1 rounded hover:bg-slate-800 transition-colors">Clear</button>
                <button onClick={() => setDebugMode(false)} className="text-slate-500 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 font-mono text-xs space-y-3 custom-scrollbar">
              {logs.length === 0 && (
                <div className="text-slate-600 italic text-center mt-12">Waiting for API activity...</div>
              )}
              {logs.map(log => (
                <div key={log.id} className="flex flex-col gap-1">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
