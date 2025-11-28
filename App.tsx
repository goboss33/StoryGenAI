import React, { useState, useEffect, useRef } from 'react';
import { StoryState, ProjectBackbone } from './types';
import Step1Idea from './components/Step1Idea';

import Step2Analysis from './components/Step2Analysis';
import Step1BisDialogue from './components/Step1BisDialogue';
import Step2Script from './components/Step2Script';
import { Steps } from './components/ui/Steps';
import { subscribeToDebugLog, subscribeToUsage, UsageStats, analyzeStoryConcept } from './services/geminiService';

interface LogEntry {
  id: string;
  type: 'req' | 'res' | 'info' | 'error';
  title: string;
  data: any;
  timestamp: number;
}

const EMPTY_PROJECT_BACKBONE: ProjectBackbone = {
  project_id: "",
  meta_data: { title: "", created_at: "", user_intent: "" },
  config: {
    aspect_ratio: "16:9",
    resolution: "1080p",
    target_fps: 24,
    primary_language: "fr-FR",
    target_audience: "General Public",
    tone_style: "Cinematic"
  },
  global_assets: { art_style_prompt: "", negative_prompt: "" },
  database: { characters: [], locations: [], scenes: [] },
  final_render: { total_duration_sec: 0 }
};

const App: React.FC = () => {
  const [state, setState] = useState<StoryState>({
    step: 0,
    idea: '',
    totalDuration: 60,
    pacing: 'standard',
    language: 'English',
    tone: 'Inspirant',
    targetAudience: 'Tout public',
    videoType: '',
    visualStyle: 'Cinematic Realistic',
    script: [],
    stylePrompt: 'Cinematic lighting, photorealistic, 8k, highly detailed',
    aspectRatio: '16:9',
    assets: [],
    isAssetsGenerated: false
  });

  const updateState = (updates: Partial<StoryState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleRegenerationComplete = (updatedDatabase: ProjectBackbone['database']) => {
    setState(prev => {
      if (!prev.project) return prev;
      return {
        ...prev,
        project: {
          ...prev.project,
          database: updatedDatabase
        },
        originalDatabase: JSON.parse(JSON.stringify(updatedDatabase)), // Reset change detection
      };
    });
  };

  const [debugMode, setDebugMode] = useState(false);
  const [debugHeight, setDebugHeight] = useState(400);
  const [isResizingDebug, setIsResizingDebug] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalUsage, setTotalUsage] = useState<UsageStats>({ inputTokens: 0, outputTokens: 0, cost: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const logEndRef = useRef<HTMLDivElement>(null);

  // Debug Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingDebug) return;
      const newHeight = window.innerHeight - e.clientY;
      setDebugHeight(Math.max(200, Math.min(newHeight, window.innerHeight - 100)));
    };

    const handleMouseUp = () => setIsResizingDebug(false);

    if (isResizingDebug) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingDebug]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  useEffect(() => {
    const unsubscribeLogs = subscribeToDebugLog((log) => {
      setLogs(prev => [...prev, { ...log, id: crypto.randomUUID() }]);

      // Update status based on logs for better UX
      if (log.title.includes("Generating Skeleton")) setAnalysisStatus("Génération de la structure narrative...");
      if (log.title.includes("Generating Shots")) setAnalysisStatus("Création du découpage technique et des plans...");
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

  // Point #1: Log empty structure when on Step 1 (index 0)
  useEffect(() => {
    if (state.step === 0) {
      console.log("Step 1 Active - Logging Empty Project Backbone");
      setLogs(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'info',
        title: 'Step 1: Empty Project Backbone',
        data: EMPTY_PROJECT_BACKBONE,
        timestamp: Date.now()
      }]);
    }
  }, [state.step]);

  useEffect(() => {
    if (debugMode && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, debugMode]);

  const nextStep = async () => {
    // Point #2: Intercept Step 1 -> Step 2
    if (state.step === 0) {
      // INSTANT TRANSITION
      setState(prev => ({ ...prev, step: 1 }));
      setIsAnalyzing(true);
      setAnalysisStatus("Initialisation de l'IA...");

      try {
        const projectBackbone = await analyzeStoryConcept(state.idea, {
          tone: state.tone,
          targetAudience: state.targetAudience,
          language: state.language,
          duration: state.totalDuration,
          videoType: state.videoType,
          visualStyle: state.visualStyle
        });

        // Log the filled result
        setLogs(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'info',
          title: 'Step 1 Analysis Complete (Project Backbone)',
          data: projectBackbone,
          timestamp: Date.now()
        }]);

        setState(prev => ({
          ...prev,
          project: projectBackbone,
          originalDatabase: JSON.parse(JSON.stringify(projectBackbone.database)), // Deep copy
          // We are already on step 1, so we just update the data
        }));

      } catch (error: any) {
        console.error("Analysis failed", error);
        alert(`Failed to analyze story: ${error.message || "Unknown error"}`);
        // Go back to step 0 on error
        setState(prev => ({ ...prev, step: 0 }));
      } finally {
        setIsAnalyzing(false);
        setAnalysisStatus("");
      }
    } else {
      // If moving from Step 2 (Dialogue) to Step 3 (Production), sync script
      if (state.step === 2 && state.project) {
        setState(prev => ({
          ...prev,
          step: prev.step + 1,
          script: prev.project!.database.scenes
        }));
      } else {
        setState(prev => ({ ...prev, step: prev.step + 1 }));
      }
    }
  };
  const prevStep = () => setState(prev => ({ ...prev, step: prev.step - 1 }));
  const goToStep = (stepIndex: number) => setState(prev => ({ ...prev, step: stepIndex }));

  const importProject = (data: StoryState) => {
    if (data.idea && Array.isArray(data.script)) {
      setState(data);
    } else {
      alert('Invalid project file');
    }
  };

  const calculateMaxStep = () => {
    let max = 0;

    // Step 0 -> 1 Requirements
    const hasIdea = state.idea.length > 10;
    const hasType = !!state.videoType;
    const hasStyle = !!state.visualStyle;

    if (hasIdea && hasType && hasStyle) {
      max = 1;

      // Step 1 -> 2 Requirements (Project exists)
      if (state.project) {
        max = 2;

        // Step 2 -> 3 Requirements (Script exists)
        if (state.script && state.script.length > 0) {
          max = 3;
        }
      }
    }

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
    <div className="h-screen flex flex-row bg-slate-50 text-slate-900 overflow-hidden">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              StoryGen AI
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {/* Placeholder Menu Items */}
          <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Menu</div>
          <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Mes Projets
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Mon Compte
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Paramètres
          </a>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">U</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">Utilisateur</div>
              <div className="text-xs text-slate-500 truncate">Free Plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT COLUMN */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* STICKY TOP BAR */}
        <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-30 flex-shrink-0 h-16 px-8 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {state.project?.meta_data.title || "Nouveau Projet"}
          </h2>

          <div className="flex items-center gap-4">
            {/* Global Actions */}
            <div className="flex items-center gap-2 mr-4 border-r border-slate-200 pr-4">
              <button
                onClick={saveProject}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-slate-200 hover:border-indigo-200 transition-all shadow-sm"
                title="Save Project"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Save
              </button>

              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-slate-200 hover:border-indigo-200 transition-all shadow-sm"
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
        </header>

        {/* SCROLLABLE WORKSPACE */}
        <main
          className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 w-full relative"
          style={{ paddingBottom: debugMode ? debugHeight + 40 : 40 }}
        >
          <div className="max-w-6xl mx-auto">
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
                  tone={state.tone}
                  targetAudience={state.targetAudience}
                  videoType={state.videoType}
                  visualStyle={state.visualStyle}
                  aspectRatio={state.aspectRatio}
                  onUpdate={updateState}
                  onNext={nextStep}
                  onImport={importProject}
                  isDebugMode={debugMode}
                />
              )}

              {state.step === 1 && (
                <Step2Analysis
                  project={state.project || undefined}
                  originalDatabase={state.originalDatabase || undefined}
                  onUpdate={updateState}
                  onUpdateAssets={(updatedDatabase) => {
                    if (state.project) {
                      updateState({
                        project: { ...state.project, database: updatedDatabase }
                      });
                    }
                  }}
                  onRegenerationComplete={handleRegenerationComplete}
                  onNext={nextStep}
                  onBack={prevStep}
                  isAnalyzing={isAnalyzing}
                  analysisStatus={analysisStatus}
                />
              )}

              {state.step === 2 && (
                <Step1BisDialogue
                  project={state.project}
                  idea={state.idea}
                  totalDuration={state.totalDuration}
                  pacing={state.pacing}
                  language={state.language}
                  tone={state.tone}
                  targetAudience={state.targetAudience}
                  audioScript={state.audioScript}
                  onUpdate={updateState}
                  onBack={prevStep}
                  onNext={nextStep}
                  isNextStepReady={!!state.script && state.script.length > 0}
                />
              )}

              {state.step === 3 && (
                <Step2Script
                  idea={state.idea}
                  totalDuration={state.totalDuration}
                  pacing={state.pacing}
                  language={state.language}
                  script={state.script}
                  audioScript={state.audioScript}
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
          </div>
        </main>

        {/* DEBUG BOTTOM BAR */}
        {debugMode && (
          <div
            className="fixed bottom-0 right-0 z-50 bg-slate-900 border-t border-slate-700 shadow-2xl flex flex-col transition-none"
            style={{ height: debugHeight, left: '16rem' }} // Left 16rem = 64 (Sidebar width)
          >
            {/* Drag Handle */}
            <div
              className="h-1.5 bg-slate-800 hover:bg-indigo-500 cursor-ns-resize w-full flex-shrink-0 transition-colors"
              onMouseDown={() => setIsResizingDebug(true)}
            />

            <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex justify-between items-center flex-shrink-0">
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
                <div key={log.id} className="flex flex-col gap-1 group">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`px-1.5 rounded-sm font-bold text-[9px] uppercase ${log.type === 'req' ? 'bg-blue-900 text-blue-300' :
                      log.type === 'res' ? 'bg-emerald-900 text-emerald-300' :
                        log.type === 'error' ? 'bg-red-900 text-red-300' : 'bg-slate-800 text-slate-300'
                      }`}>{log.type}</span>
                    <span className="text-slate-300 font-bold">{log.title}</span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(log.data, null, 2))}
                      className="opacity-0 group-hover:opacity-100 ml-auto text-slate-500 hover:text-white transition-opacity"
                      title="Copy JSON"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                  </div>
                  <div className="bg-slate-950/50 p-2 rounded border border-slate-800 text-slate-400 whitespace-pre-wrap break-words overflow-hidden select-text">
                    {JSON.stringify(log.data, null, 2)}
                  </div>
                </div>
              ))}
              <div ref={logEndRef}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
