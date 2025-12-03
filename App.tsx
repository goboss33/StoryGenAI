import React, { useState, useEffect, useRef } from 'react';
import { StoryState, ProjectBackbone } from './types';
import Step1Idea from './components/Step1Idea';

import Step2Analysis from './components/Step2Analysis';
import Step3Screenplay from './components/Step3Screenplay';
import Step2Script from './components/Step2Script';
import DebugConsole from './components/DebugConsole';
import Step2bScriptProduction from './components/Step2bScriptProduction';
import { Steps } from './components/ui/Steps';
import {
  subscribeToDebugLog,
  subscribeToUsage,
  UsageStats,
  analyzeStoryConcept,
  setReviewMode,
  subscribeToPendingRequests,
  resolvePendingRequest,
  rejectPendingRequest,
  PendingRequestData,
  subscribeToAgentMessages,
  injectAgentMessage
} from './services/geminiService';

interface LogEntry {
  id: string;
  type: 'req' | 'res' | 'info' | 'error';
  title: string;
  data: any;
  timestamp: number;
  model?: string;
  dynamicPrompt?: string;
  finalPrompt?: string;
}

const EMPTY_PROJECT_BACKBONE: ProjectBackbone = {
  project_id: "",
  meta_data: { title: "", created_at: "", user_intent: "" },
  config: {
    aspect_ratio: "16:9",
    resolution: "1080p",
    target_fps: 24,
    primary_language: "",
    target_audience: "",
    tone_style: "",
    has_dialogue: true,
    has_voiceover: true
  },
  global_assets: { art_style_prompt: "", negative_prompt: "" },
  database: {
    characters: [
      {
        id: "",
        name: "",
        role: "",
        visual_details: {
          age: "",
          gender: "",
          ethnicity: "",
          hair: "",
          eyes: "",
          clothing: "",
          accessories: "",
          body_type: ""
        },
        visual_seed: {
          description: "",
          ref_image_url: ""
        },
        voice_specs: {
          gender: "male",
          age_group: "adult",
          accent: "neutral",
          pitch: 1.0,
          speed: 1.0,
          tone: "neutral"
        }
      }
    ],
    locations: [
      {
        id: "",
        name: "",
        description: "",
        environment_prompt: "",
        interior_exterior: "EXT",
        lighting_default: "",
        audio_ambiance: "",
        ref_image_url: ""
      }
    ],
    items: [
      {
        id: "",
        name: "",
        description: "",
        type: "prop",
        visual_details: "",
        ref_image_url: ""
      }
    ],
    scenes: [
      {
        scene_index: 0,
        id: "",
        slugline: "",
        slugline_elements: { int_ext: "EXT.", location: "", time: "" },
        narrative_goal: "",
        estimated_duration_sec: 0,
        location_ref_id: "",
        shots: [
          {
            shot_index: 0,
            id: "",
            duration_sec: 0,
            composition: {
              shot_type: "Wide Shot",
              camera_movement: "Static",
              angle: "Eye Level",
              focal_length: "",
              depth_of_field: ""
            },
            content: {
              ui_description: "",
              characters_in_shot: [],
              items_in_shot: [],
              final_image_prompt: "",
              video_motion_prompt: "",
              veo_elements: {
                cinematography: "",
                subject_context: "",
                action: "",
                style_ambiance: "",
                audio_prompt: "",
                negative_prompt: ""
              }
            },
            audio: {
              audio_context: "",
              is_voice_over: false,
              dialogue: [],
              specificAudioCues: ""
            },
            video_generation: { status: "pending" }
          }
        ]
      }
    ]
  },
  final_render: { total_duration_sec: 0 }
};

const App: React.FC = () => {
  // --- DEBUG WINDOW CHECK ---
  const [isDebugWindow, setIsDebugWindow] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setIsDebugWindow(searchParams.get('debug') === 'true');
  }, []);

  // --- STATE ---
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
    isAssetsGenerated: false,
    project: EMPTY_PROJECT_BACKBONE
  });

  const updateState = (updates: Partial<StoryState>) => {
    setState(prev => ({ ...prev, ...updates }));
    if (updates.project) {
      broadcastChannelRef.current?.postMessage({ type: 'PROJECT_STATE_UPDATE', payload: updates.project });
    }
  };

  const handleRegenerationComplete = (updatedDatabase: ProjectBackbone['database']) => {
    const updatedProject = state.project ? { ...state.project, database: updatedDatabase } : undefined;

    setState(prev => {
      if (!prev.project) return prev;
      return {
        ...prev,
        project: updatedProject,
        originalDatabase: JSON.parse(JSON.stringify(updatedDatabase)), // Reset change detection
      };
    });

    if (updatedProject) {
      broadcastChannelRef.current?.postMessage({ type: 'PROJECT_STATE_UPDATE', payload: updatedProject });
    }
  };

  // --- DEBUG & LOGGING ---
  const [debugMode, setDebugMode] = useState(false);
  const [debugHeight, setDebugHeight] = useState(400);
  const [isResizingDebug, setIsResizingDebug] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalUsage, setTotalUsage] = useState<UsageStats>({ inputTokens: 0, outputTokens: 0, cost: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const logEndRef = useRef<HTMLDivElement>(null);

  // --- REVIEW MODE STATE ---
  const [reviewMode, setReviewModeState] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingRequestData | null>(null);

  // Detach Logic
  const [isDebugDetached, setIsDebugDetached] = useState(false);
  const debugWindowRef = useRef<Window | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Initialize BroadcastChannel
  useEffect(() => {
    const channel = new BroadcastChannel('storygen-debug');
    broadcastChannelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, payload } = event.data;

      if (type === 'LOG_UPDATE') {
        // Received new log (Debug Window)
        setLogs(prev => [...prev, payload]);
      } else if (type === 'SYNC_REQUEST') {
        // Received sync request (Main Window)
        // Send all current logs and state to the new window
        channel.postMessage({ type: 'SYNC_RESPONSE', payload: logs });
        channel.postMessage({ type: 'USAGE_UPDATE', payload: totalUsage });
        channel.postMessage({ type: 'TOGGLE_REVIEW_MODE', payload: reviewMode }); // Sync review mode
        if (pendingRequest) {
          channel.postMessage({ type: 'PENDING_REQUEST_UPDATE', payload: pendingRequest });
        }
        if (state.project) {
          channel.postMessage({ type: 'PROJECT_STATE_UPDATE', payload: state.project });
        }
      } else if (type === 'SYNC_RESPONSE') {
        // Received full history (Debug Window)
        setLogs(payload);
      } else if (type === 'USAGE_UPDATE') {
        setTotalUsage(payload);
      } else if (type === 'CLEAR_LOGS') {
        setLogs([]);
      } else if (type === 'TOGGLE_REVIEW_MODE') {
        // Received toggle from other window
        setReviewModeState(payload);
        setReviewMode(payload); // Update local service
      } else if (type === 'PENDING_REQUEST_UPDATE') {
        // Received pending request (Debug Window)
        setPendingRequest(payload);
      } else if (type === 'RESOLVE_REQUEST') {
        // Received resolve command (Main Window)
        resolvePendingRequest(payload.id, payload.prompt);
      } else if (type === 'REJECT_REQUEST') {
        // Received reject command (Main Window)
        rejectPendingRequest(payload.id);
      } else if (type === 'AGENT_MESSAGE') {
        // Received agent message (Debug Window)
        const { role, message } = payload;
        injectAgentMessage(role, message);
      } else if (type === 'PROJECT_STATE_UPDATE') {
        // Received project state update (Debug Window)
        setState(prev => ({ ...prev, project: payload }));
      }
    };

    // If we are the debug window, request sync immediately
    if (new URLSearchParams(window.location.search).get('debug') === 'true') {
      channel.postMessage({ type: 'SYNC_REQUEST' });
    }

    return () => {
      channel.close();
    };
  }, []); // Empty dependency array to run once on mount

  // Sync Review Mode with Service (Main Window Only - but harmless in debug window as service is local)
  useEffect(() => {
    setReviewMode(reviewMode);
  }, [reviewMode]);

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

  // Subscribe to Service Logs & Requests (Main Window Only)
  useEffect(() => {
    if (isDebugWindow) return; // Debug window receives logs via BroadcastChannel

    const unsubscribeLogs = subscribeToDebugLog((log) => {
      const newLog = { ...log, id: crypto.randomUUID() };
      setLogs(prev => [...prev, newLog]);

      // Broadcast to debug window
      broadcastChannelRef.current?.postMessage({ type: 'LOG_UPDATE', payload: newLog });

      // Update status based on logs for better UX
      if (log.title.includes("Generating Skeleton")) setAnalysisStatus("Génération de la structure narrative...");
      if (log.title.includes("Generating Shots")) setAnalysisStatus("Création du découpage technique et des plans...");
    });

    const unsubscribeUsage = subscribeToUsage((stats) => {
      setTotalUsage(prev => {
        const newStats = {
          inputTokens: prev.inputTokens + stats.inputTokens,
          outputTokens: prev.outputTokens + stats.outputTokens,
          cost: prev.cost + stats.cost
        };
        // Broadcast usage
        broadcastChannelRef.current?.postMessage({ type: 'USAGE_UPDATE', payload: newStats });
        return newStats;
      });
    });

    const unsubscribePending = subscribeToPendingRequests((req) => {
      setPendingRequest(req);
      // Broadcast pending request
      broadcastChannelRef.current?.postMessage({ type: 'PENDING_REQUEST_UPDATE', payload: req });
    });

    // Subscribe to Agent Messages (Main Window Only)
    let unsubscribeAgents: (() => void) | undefined;
    if (!isDebugWindow) {
      unsubscribeAgents = subscribeToAgentMessages((role, message) => {
        broadcastChannelRef.current?.postMessage({ type: 'AGENT_MESSAGE', payload: { role, message } });
      });
    }

    return () => {
      unsubscribeLogs();
      unsubscribeUsage();
      unsubscribePending();
      if (unsubscribeAgents) unsubscribeAgents();
    };
  }, [isDebugWindow]);

  // Point #1: Log empty structure on mount
  useEffect(() => {
    if (!isDebugWindow) {
      console.log("App Mounted - Logging Empty Project Backbone");
      const newLog: LogEntry = {
        id: crypto.randomUUID(),
        type: 'info',
        title: 'Initial State: Empty Project Backbone',
        data: EMPTY_PROJECT_BACKBONE,
        timestamp: Date.now()
      };
      setLogs(prev => [...prev, newLog]);
      broadcastChannelRef.current?.postMessage({ type: 'LOG_UPDATE', payload: newLog });
    }
  }, [isDebugWindow]);

  useEffect(() => {
    if ((debugMode || isDebugWindow) && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, debugMode, isDebugWindow]);

  // Handle Detach Window
  useEffect(() => {
    if (isDebugDetached) {
      // Open new window with ?debug=true
      const newWindow = window.open(window.location.href.split('?')[0] + '?debug=true', 'DebugConsole', 'width=800,height=600,left=200,top=200');

      if (newWindow) {
        debugWindowRef.current = newWindow;

        // Handle window close
        const checkWindowClosed = setInterval(() => {
          if (newWindow.closed) {
            setIsDebugDetached(false);
            debugWindowRef.current = null;
            clearInterval(checkWindowClosed);
          }
        }, 500);

      } else {
        // Popup blocked or failed
        setIsDebugDetached(false);
      }
    } else {
      // Close window if it exists
      if (debugWindowRef.current) {
        debugWindowRef.current.close();
        debugWindowRef.current = null;
      }
    }

    return () => {
      // Cleanup if needed
    };
  }, [isDebugDetached]);


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
        const newLog: LogEntry = {
          id: crypto.randomUUID(),
          type: 'info',
          title: 'Step 1 Analysis Complete (Project Backbone)',
          data: projectBackbone,
          timestamp: Date.now()
        };
        setLogs(prev => [...prev, newLog]);
        broadcastChannelRef.current?.postMessage({ type: 'LOG_UPDATE', payload: newLog });

        setState(prev => ({
          ...prev,
          project: projectBackbone,
          originalDatabase: JSON.parse(JSON.stringify(projectBackbone.database)), // Deep copy
          // We are already on step 1, so we just update the data
        }));

        broadcastChannelRef.current?.postMessage({ type: 'PROJECT_STATE_UPDATE', payload: projectBackbone });

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

  // --- HANDLERS FOR DEBUG CONSOLE ---
  const handleToggleReviewMode = (enabled: boolean) => {
    setReviewModeState(enabled);
    setReviewMode(enabled); // Update local
    broadcastChannelRef.current?.postMessage({ type: 'TOGGLE_REVIEW_MODE', payload: enabled });
  };

  const handleResolveRequest = (id: string, prompt: string) => {
    resolvePendingRequest(id, prompt); // Try local resolution (works if main window)
    broadcastChannelRef.current?.postMessage({ type: 'RESOLVE_REQUEST', payload: { id, prompt } }); // Send to main window (if detached)
  };

  const handleRejectRequest = (id: string) => {
    rejectPendingRequest(id); // Try local resolution
    broadcastChannelRef.current?.postMessage({ type: 'REJECT_REQUEST', payload: { id } }); // Send to main window
  };

  // --- RENDER DEBUG WINDOW ---
  if (isDebugWindow) {
    return (
      <DebugConsole
        logs={logs}
        totalUsage={totalUsage}
        isOpen={true}
        onClose={() => window.close()}
        onClear={() => {
          setLogs([]);
          broadcastChannelRef.current?.postMessage({ type: 'CLEAR_LOGS' });
        }}
        isDetached={true}
        onToggleDetach={() => {
          // Reattach logic: Close this window, main window will detect close and reset state
          window.close();
        }}
        isReviewMode={reviewMode}
        onToggleReviewMode={handleToggleReviewMode}
        pendingRequest={pendingRequest}
        onResolveRequest={handleResolveRequest}
        onRejectRequest={handleRejectRequest}
        projectState={state.project}
      />
    );
  }

  // --- RENDER MAIN APP ---
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
            {/* Step 2b Toggle (Temporary) */}
            {(state.step === 2 || state.step === 2.5) && (
              <div className="flex items-center bg-slate-100 p-1 rounded-lg mr-4">
                <button
                  onClick={() => setState(prev => ({ ...prev, step: 2 }))}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${state.step === 2 ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Step 3 (Old)
                </button>
                <button
                  onClick={() => setState(prev => ({ ...prev, step: 2.5 }))}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${state.step === 2.5 ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Step 2b (New)
                </button>
              </div>
            )}

            {/* Global Actions */}
            <div className="flex items-center gap-2 mr-4 border-r border-slate-200 pr-4">
              {/* ... */}
            </div>
            {/* ... */}
          </div>
        </header>

        {/* SCROLLABLE WORKSPACE */}
        <main
          className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 w-full relative"
          style={{ paddingBottom: debugMode && !isDebugDetached ? debugHeight + 40 : 40 }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex-shrink-0 mb-6">
              <Steps currentStep={Math.floor(state.step)} maxStep={maxStep} onStepClick={goToStep} />
            </div>

            <div className={`flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${state.step === 2 || state.step === 2.5 ? 'p-0' : 'p-4 md:p-8'}`}>
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
                <Step3Screenplay
                  project={state.project}
                  onUpdate={updateState}
                  onBack={prevStep}
                  onNext={nextStep}
                />
              )}

              {state.step === 2.5 && (
                <Step2bScriptProduction
                  onBack={() => setState(prev => ({ ...prev, step: 1 }))}
                  onNext={() => setState(prev => ({ ...prev, step: 3 }))}
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


        {/* DEBUG CONSOLE (INLINE ONLY - DETACHED IS HANDLED ABOVE) */}
        {debugMode && !isDebugDetached && (
          <DebugConsole
            logs={logs}
            totalUsage={totalUsage}
            isOpen={true}
            onClose={() => setDebugMode(false)}
            onClear={() => {
              setLogs([]);
              broadcastChannelRef.current?.postMessage({ type: 'CLEAR_LOGS' });
            }}
            isDetached={false}
            onToggleDetach={() => setIsDebugDetached(true)}
            height={debugHeight}
            onResizeStart={() => setIsResizingDebug(true)}
            isReviewMode={reviewMode}
            onToggleReviewMode={handleToggleReviewMode}
            pendingRequest={pendingRequest}
            onResolveRequest={handleResolveRequest}
            onRejectRequest={handleRejectRequest}
            projectState={state.project}
          />
        )}
      </div>
    </div>
  );
};

export default App;
