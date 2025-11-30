import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import { Scene, Asset, AssetType, Pacing, RefineQuestion, ProjectBackbone, AssetChangeAnalysis, SceneTemplate, AgentRole, AgentMessage } from "../types";

// ... (existing code)

// --- AGENT MANAGER ---
class AgentManager {
  private static instance: AgentManager;
  private agents: Map<AgentRole, ChatSession> = new Map();
  private messageHistory: Map<AgentRole, AgentMessage[]> = new Map();
  private listeners: ((role: AgentRole, message: AgentMessage) => void)[] = [];
  public id: string = crypto.randomUUID().slice(0, 8); // Debug ID

  private constructor() {
    console.log(`[AgentManager] Created new instance: ${this.id}`);
  }

  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  public getAgent(role: AgentRole, model: any, systemInstruction?: string, metadata?: { model?: string; dynamicPrompt?: string; finalPrompt?: string }): ChatSession {
    if (!this.agents.has(role)) {
      console.log(`[AgentManager ${this.id}] Creating new agent: ${role}`);
      const session = model.startChat({
        history: systemInstruction ? [
          { role: "user", parts: [{ text: systemInstruction }] },
          { role: "model", parts: [{ text: `I am the ${role}. I understand my role and instructions.` }] }
        ] : []
      });
      this.agents.set(role, session);

      // Notify listeners of system init
      if (systemInstruction) {
        const sysMsg: AgentMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          agentRole: role,
          content: systemInstruction,
          timestamp: Date.now(),
          // Attach metadata to system message
          model: metadata?.model,
          dynamicPrompt: metadata?.dynamicPrompt,
          finalPrompt: metadata?.finalPrompt
        };
        this.addMessageToHistory(role, sysMsg);
        this.notifyListeners(role, sysMsg);
      }
    }
    return this.agents.get(role)!;
  }

  public subscribe(listener: (role: AgentRole, message: AgentMessage) => void) {
    console.log(`[AgentManager ${this.id}] New subscriber added. Total listeners: ${this.listeners.length + 1}`);
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
      console.log(`[AgentManager ${this.id}] Subscriber removed. Total listeners: ${this.listeners.length}`);
    };
  }

  public notifyListeners(role: AgentRole, message: AgentMessage) {
    console.log(`[AgentManager ${this.id}] Notifying ${this.listeners.length} listeners of message from ${role}`);
    this.listeners.forEach(l => l(role, message));
  }

  public injectMessage(role: AgentRole, message: AgentMessage) {
    console.log(`[AgentManager ${this.id}] Injecting message for ${role}`);
    this.addMessageToHistory(role, message);
    this.notifyListeners(role, message);
  }

  private addMessageToHistory(role: AgentRole, message: AgentMessage) {
    if (!this.messageHistory.has(role)) {
      this.messageHistory.set(role, []);
    }
    this.messageHistory.get(role)!.push(message);
  }

  public getHistory(role: AgentRole): AgentMessage[] {
    const history = this.messageHistory.get(role) || [];
    console.log(`[AgentManager ${this.id}] getHistory for ${role}: ${history.length} messages`);
    return history;
  }

  public async sendMessage(role: AgentRole, session: ChatSession, text: string, metadata?: { model?: string; dynamicPrompt?: string; finalPrompt?: string; data?: any }): Promise<string> {
    console.log(`[AgentManager ${this.id}] sendMessage for ${role}: "${text.slice(0, 50)}..."`);

    // Log User Message
    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      agentRole: role,
      content: text,
      timestamp: Date.now(),
      // Attach prompt metadata to the user message (request)
      model: metadata?.model,
      dynamicPrompt: metadata?.dynamicPrompt,
      finalPrompt: metadata?.finalPrompt
    };
    this.addMessageToHistory(role, userMsg);
    this.notifyListeners(role, userMsg);

    const result = await session.sendMessage(text);
    const responseText = result.response.text();

    // Try to parse JSON data from response
    let parsedData = null;
    try {
      parsedData = JSON.parse(responseText);
    } catch (e) {
      // Not JSON or partial JSON
    }

    // Log Model Message
    const modelMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'model',
      agentRole: role,
      content: responseText,
      timestamp: Date.now(),
      // Attach parsed data to the model message (response)
      model: metadata?.model,
      data: parsedData
    };
    this.addMessageToHistory(role, modelMsg);
    this.notifyListeners(role, modelMsg);

    return responseText;
  }
}

export const subscribeToAgentMessages = (listener: (role: AgentRole, message: AgentMessage) => void) => {
  return AgentManager.getInstance().subscribe(listener);
};

export const getAgentHistory = (role: AgentRole): AgentMessage[] => {
  return AgentManager.getInstance().getHistory(role);
};

export const injectAgentMessage = (role: AgentRole, message: AgentMessage) => {
  AgentManager.getInstance().injectMessage(role, message);
};

// --- AGENTIC WORKFLOW: STEP 1 - SKELETON GENERATION (DIRECTOR AGENT) ---
export const analyzeStoryConcept = async (
  idea: string,
  settings: { tone: string; targetAudience: string; language: string; duration: number; videoType: string; visualStyle: string }
): Promise<import("../types").ProjectBackbone> => {
  const systemInstruction = `
    Role: Creative Director & Showrunner.
    Task: You are responsible for the initial vision of the video project.
    
    Responsibilities:
    1. Analyze the user's raw idea.
    2. Define the "Project Backbone": Structure, Characters, Locations, Scene List.
    3. Ensure the tone and style are consistent.
    4. Output strictly valid JSON when requested.
  `;

  const modelName = "gemini-2.0-flash-exp";
  const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

  // Get or Create DIRECTOR Agent
  const agentManager = AgentManager.getInstance();
  const directorSession = agentManager.getAgent(AgentRole.DIRECTOR, model, systemInstruction, {
    model: modelName,
    dynamicPrompt: systemInstruction, // System instruction is static for now, but good to show
    finalPrompt: systemInstruction
  });

  // 1. Define Template
  const promptTemplate = `
    INPUT:
    - Idea: "{{idea}}"
    - Type: {{videoType}}
    - Visual Style: {{visualStyle}}
    - Tone: {{tone}}
    - Audience: {{targetAudience}}
    - Language: {{language}}
    - Total Duration: {{duration}}s

    INSTRUCTIONS:
    1. **Characters**: Create detailed profiles (Name, Role, Visual Description).
    2. **Locations**: Create detailed profiles (Name, Environment Prompt).
    3. **Scene List**: Break the story into logical scenes.
       - Assign an \`estimated_duration_sec\` to each scene.
       - **CRITICAL**: The sum of scene durations MUST equal {{duration}}s (+/- 5s).
       - **DO NOT generate shots yet.** Leave the "shots" array empty [].

    OUTPUT JSON SCHEMA:
    {
      "project_id": "uuid",
      "meta_data": { "title": "string", "user_intent": "{{idea}}", "created_at": "${new Date().toISOString()}" },
      "config": { "aspect_ratio": "16:9", "resolution": "1080p", "target_fps": 24, "primary_language": "{{language}}", "target_audience": "{{targetAudience}}", "tone_style": "{{tone}}" },
      "global_assets": { "art_style_prompt": "string", "negative_prompt": "string", "music_theme_id": "string" },
      "database": {
        "characters": [{ "id": "char_01", "name": "string", "role": "string", "visual_seed": { "description": "string" } }],
        "locations": [{ "id": "loc_01", "name": "string", "environment_prompt": "string", "interior_exterior": "INT" }],
        "scenes": [{ 
          "scene_index": 1, "id": "sc_01", "slugline": "string", "location_ref_id": "string", "narrative_goal": "string", 
          "estimated_duration_sec": 10, "shots": [] 
        }]
      },
      "final_render": { "total_duration_sec": {{duration}} }
    }
  `;

  // 2. Fill Template
  const finalPrompt = promptTemplate
    .replace(/{{idea}}/g, idea)
    .replace(/{{videoType}}/g, settings.videoType)
    .replace(/{{visualStyle}}/g, settings.visualStyle)
    .replace(/{{tone}}/g, settings.tone)
    .replace(/{{targetAudience}}/g, settings.targetAudience)
    .replace(/{{language}}/g, settings.language)
    .replace(/{{duration}}/g, settings.duration.toString());

  // INTERCEPT FOR REVIEW
  const reviewedPrompt = await checkReviewMode(finalPrompt, 'Director: Generate Skeleton');

  logDebug('req', 'Director Agent: Generate Skeleton', { idea }, { model: modelName, finalPrompt: reviewedPrompt });

  // Use AgentManager to send message (handles logging)
  const text = await agentManager.sendMessage(AgentRole.DIRECTOR, directorSession, reviewedPrompt, {
    model: modelName,
    finalPrompt: reviewedPrompt,
    dynamicPrompt: promptTemplate // Pass the raw template
  });

  trackUsage(modelName, finalPrompt.length / 4, text.length / 4);
  return JSON.parse(text);
};

// ... (rest of file)

// --- 2.5 Generate Screenplay (Step 3) (SCREENWRITER AGENT) ---
export const generateScreenplay = async (
  project: import("../types").ProjectBackbone
): Promise<import("../types").ProjectBackbone> => {
  try {
    const { database, meta_data, config } = project;
    const scenes = database.scenes;

    logDebug('info', 'Agentic Workflow', { step: '3. Generating Screenplay (Screenwriter Agent)', sceneCount: scenes.length });

    const modelName = "gemini-2.0-flash-exp";
    const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

    // 1. Initialize Screenwriter Agent with Project Bible
    const projectBibleTemplate = `
      Role: Professional Screenwriter.
      Task: You are writing a screenplay for a video project. You will receive scene details one by one.
      
      PROJECT CONTEXT (THE BIBLE):
      Title: {{title}}
      Tone: {{tone}}
      Intent: {{intent}}
      Language: {{language}}
      
      CHARACTERS:
      {{characters}}
      
      LOCATIONS:
      {{locations}}

      INSTRUCTIONS:
      1. Maintain consistency with previous scenes (you have full memory).
      2. Write in standard screenplay format.
      3. Output JSON only.
    `;

    const projectBible = projectBibleTemplate
      .replace(/{{title}}/g, meta_data.title)
      .replace(/{{tone}}/g, config.tone_style)
      .replace(/{{intent}}/g, meta_data.user_intent)
      .replace(/{{language}}/g, config.primary_language)
      .replace(/{{characters}}/g, database.characters.map(c => `- ${c.name} (${c.role}): ${c.visual_seed.description}`).join('\n'))
      .replace(/{{locations}}/g, database.locations.map(l => `- ${l.name} (${l.interior_exterior}): ${l.environment_prompt}`).join('\n'));

    // Get or Create SCREENWRITER Agent
    const agentManager = AgentManager.getInstance();
    // Note: We might want to reset the screenwriter if it's a new generation run, but for now we keep persistence.
    // Ideally, we check if the bible changed. For simplicity, we assume the agent persists.
    // If we wanted to "reset" the memory for a new project, we'd clear the agent from the map.
    const chatSession = agentManager.getAgent(AgentRole.SCREENWRITER, model, projectBible, {
      model: modelName,
      dynamicPrompt: projectBibleTemplate,
      finalPrompt: projectBible
    });

    const updatedScenes: import("../types").SceneTemplate[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      // If script content already exists, inject it into history to maintain context
      if (scene.script_content && scene.script_content.lines && scene.script_content.lines.length > 0) {
        updatedScenes.push(scene);

        // Manually inject into history via sendMessage (simulating memory)
        await agentManager.sendMessage(AgentRole.SCREENWRITER, chatSession, `
          [SYSTEM: Scene ${i + 1} was already written. Here is the content for your memory:]
          Slugline: ${scene.slugline}
          Content: ${JSON.stringify(scene.script_content)}
        `);
        continue;
      }

      // 1. Define Template
      const scenePromptTemplate = `
        WRITE SCENE {{sceneIndex}} of {{totalScenes}}:
        
        Slugline: {{slugline}}
        Goal: {{goal}}
        Estimated Duration: {{duration}} seconds
        
        OUTPUT JSON SCHEMA:
        {
          "lines": [
            { 
              "type": "slugline" | "action" | "dialogue" | "parenthetical" | "transition", 
              "content": "Text content", 
              "speaker": "CHARACTER NAME (only for dialogue)", 
              "parenthetical": "(optional emotion)"
            }
          ]
        }
      `;

      // 2. Fill Template
      const scenePrompt = scenePromptTemplate
        .replace(/{{sceneIndex}}/g, (i + 1).toString())
        .replace(/{{totalScenes}}/g, scenes.length.toString())
        .replace(/{{slugline}}/g, scene.slugline)
        .replace(/{{goal}}/g, scene.narrative_goal)
        .replace(/{{duration}}/g, scene.estimated_duration_sec.toString());

      try {
        // INTERCEPT FOR REVIEW
        const finalPrompt = await checkReviewMode(scenePrompt, `Screenwriter: Scene ${scene.slugline}`);

        logDebug('req', `Screenwriter Agent: Scene ${scene.slugline}`, { sceneId: scene.id }, { model: modelName, dynamicPrompt: scenePromptTemplate, finalPrompt: finalPrompt });

        // Use AgentManager to send message
        const text = await agentManager.sendMessage(AgentRole.SCREENWRITER, chatSession, finalPrompt, {
          model: modelName,
          finalPrompt: finalPrompt,
          dynamicPrompt: scenePromptTemplate // Pass the raw template
        });
        const content = JSON.parse(text);

        logDebug('res', `Screenwriter Agent: Scene ${scene.slugline}`, { content });

        trackUsage(modelName, finalPrompt.length / 4, text.length / 4);

        const newScene = {
          ...scene,
          script_content: {
            lines: Array.isArray(content.lines) ? content.lines.map((l: any) => ({ ...l, id: crypto.randomUUID() })) : []
          }
        };

        updatedScenes.push(newScene);

      } catch (error) {
        console.error(`Failed to generate scene ${scene.slugline}`, error);
        updatedScenes.push(scene); // Keep original if failed
      }
    }

    return {
      ...project,
      database: {
        ...database,
        scenes: updatedScenes
      }
    };

  } catch (error) {
    logDebug('error', 'Generate Screenplay Failed', error);
    throw error;
  }
};

// Define SchemaType locally to avoid import errors with older SDK versions
const SchemaType = {
  STRING: "STRING" as const,
  NUMBER: "NUMBER" as const,
  INTEGER: "INTEGER" as const,
  BOOLEAN: "BOOLEAN" as const,
  ARRAY: "ARRAY" as const,
  OBJECT: "OBJECT" as const
};

// Robust API Key Retrieval
const apiKey = import.meta.env.VITE_GEMINI_API_KEY ||
  (process.env.GEMINI_API_KEY as string) ||
  (process.env.API_KEY as string);

if (!apiKey) {
  console.error("CRITICAL: GEMINI_API_KEY is missing. Please check .env.local");
}

const genAI = new GoogleGenerativeAI(apiKey || "MISSING_KEY");

// --- REVIEW MODE INFRASTRUCTURE ---
let isReviewMode = false;

export const setReviewMode = (enabled: boolean) => {
  console.log(`[GeminiService] setReviewMode called: ${enabled}`);
  isReviewMode = enabled;
};

export const getReviewMode = () => {
  return isReviewMode;
};

export interface PendingRequest {
  id: string;
  title: string;
  prompt: string;
  resolve: (newPrompt: string) => void;
  reject: () => void;
}

// Serializable version for UI/Channel
export interface PendingRequestData {
  id: string;
  title: string;
  prompt: string;
}

type PendingRequestListener = (request: PendingRequestData | null) => void;
let pendingRequestListeners: PendingRequestListener[] = [];

// REQUEST QUEUE (To handle parallel requests sequentially)
let requestQueue: PendingRequest[] = [];

export const subscribeToPendingRequests = (listener: PendingRequestListener) => {
  pendingRequestListeners.push(listener);
  // If there is already a pending request (head of queue), notify immediately
  if (requestQueue.length > 0) {
    const head = requestQueue[0];
    listener({ id: head.id, title: head.title, prompt: head.prompt });
  }
  return () => { pendingRequestListeners = pendingRequestListeners.filter(l => l !== listener); };
};

const notifyPendingRequest = (request: PendingRequest | null) => {
  const data = request ? { id: request.id, title: request.title, prompt: request.prompt } : null;
  pendingRequestListeners.forEach(l => l(data));
};

export const resolvePendingRequest = (id: string, newPrompt: string) => {
  const index = requestQueue.findIndex(r => r.id === id);

  if (index !== -1) {
    const req = requestQueue[index];

    // Resolve the promise
    req.resolve(newPrompt);

    // Remove from queue
    requestQueue.splice(index, 1);

    // If queue still has items, notify the next one (Head)
    if (requestQueue.length > 0) {
      notifyPendingRequest(requestQueue[0]);
    } else {
      notifyPendingRequest(null);
    }
  } else {
    console.warn(`[GeminiService] Attempted to resolve unknown or already handled request ${id}`);
  }
};

export const rejectPendingRequest = (id: string) => {
  const index = requestQueue.findIndex(r => r.id === id);

  if (index !== -1) {
    const req = requestQueue[index];

    // Reject the promise
    req.reject();

    // Remove from queue
    requestQueue.splice(index, 1);

    // If queue still has items, notify the next one
    if (requestQueue.length > 0) {
      notifyPendingRequest(requestQueue[0]);
    } else {
      notifyPendingRequest(null);
    }
  } else {
    console.warn(`[GeminiService] Attempted to reject unknown or already handled request ${id}`);
  }
};

const checkReviewMode = async (prompt: string, title: string): Promise<string> => {
  console.log(`[GeminiService] checkReviewMode for "${title}". ReviewMode is: ${isReviewMode}`);

  if (!isReviewMode) return prompt;

  console.log(`[GeminiService] Pausing for review...`);
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();

    const pendingRequest: PendingRequest = {
      id,
      title,
      prompt,
      resolve: (newPrompt) => {
        console.log(`[GeminiService] Request ${id} resolved`);
        resolve(newPrompt);
      },
      reject: () => {
        console.log(`[GeminiService] Request ${id} rejected`);
        reject(new Error("Request cancelled by user"));
      }
    };

    // Add to Queue
    requestQueue.push(pendingRequest);

    // Only notify if this is the ONLY (or first) item in the queue
    // If there are others ahead, this one waits its turn
    if (requestQueue.length === 1) {
      notifyPendingRequest(pendingRequest);
    }
  });
};

// Helper to assemble dynamic prompt from modular action data
export const assembleActionPrompt = (shot: Scene, assets: Asset[]): string => {
  if (!shot.actionData) return "";

  let prompt = shot.actionData.baseEnvironment;

  // Add Character Actions
  const activeCharacters = shot.usedAssetIds
    .map(id => assets.find(a => a.id === id))
    .filter(a => a?.type === AssetType.CHARACTER);

  activeCharacters.forEach(char => {
    if (Array.isArray(shot.actionData?.characterActions)) {
      const actionEntry = shot.actionData.characterActions.find(a => a.castId === char?.id);
      if (char && actionEntry) {
        prompt += `, ${char.name} is ${actionEntry.action}`;
      }
    }
  });

  // Add Item States
  const activeItems = shot.usedAssetIds
    .map(id => assets.find(a => a.id === id))
    .filter(a => a?.type === AssetType.ITEM);

  activeItems.forEach(item => {
    if (Array.isArray(shot.actionData?.itemStates)) {
      const stateEntry = shot.actionData.itemStates.find(a => a.itemId === item?.id);
      if (item && stateEntry) {
        prompt += `, ${item.name} is ${stateEntry.state}`;
      }
    }
  });

  return prompt;
};

// --- LOGGING INFRASTRUCTURE ---
type LogType = 'req' | 'res' | 'info' | 'error';
type LogListener = (log: {
  type: LogType;
  title: string;
  data: any;
  timestamp: number;
  model?: string;
  dynamicPrompt?: string;
  finalPrompt?: string;
}) => void;

let listeners: LogListener[] = [];

export const subscribeToDebugLog = (listener: LogListener) => {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
};

export const logDebug = (
  type: LogType,
  title: string,
  data: any,
  options?: { model?: string; dynamicPrompt?: string; finalPrompt?: string }
) => {
  const payload = {
    type,
    title,
    data,
    timestamp: Date.now(),
    ...options
  };
  listeners.forEach(l => l(payload));
};

// --- CONSTANTS FOR UI SYNC ---
const VALID_SHOT_TYPES = ["Wide Shot", "Medium Shot", "Close Up", "Extreme Close Up"];
const VALID_CAMERA_ANGLES = ["Eye Level", "Low Angle", "High Angle"];
const VALID_COMPOSITION_TAGS = [
  "Symmetrical", "Rule of Thirds", "Center Framed", "Dynamic Diagonal", "Leading Lines",
  "Depth of Field", "Shallow Focus", "Deep Focus", "Silhouette", "Backlit",
  "High Contrast", "Low Key", "High Key", "Minimalist", "Cluttered / Busy",
  "Over the Shoulder", "Dutch Angle", "Bokeh", "Golden Hour", "Blue Hour"
];

// --- Helper to parse Data URI ---
function parseDataUri(dataUri: string): { mimeType: string; data: string } {
  const match = dataUri.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URI");
  }
  return { mimeType: match[1], data: match[2] };
}

// --- USAGE TRACKING INFRASTRUCTURE ---
export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

type UsageListener = (stats: UsageStats) => void;
let usageListeners: UsageListener[] = [];

export const subscribeToUsage = (listener: UsageListener) => {
  usageListeners.push(listener);
  return () => { usageListeners = usageListeners.filter(l => l !== listener); };
};

const trackUsage = (model: string, inputTokens: number, outputTokens: number, specialCost?: number) => {
  let cost = 0;

  // Pricing Logic (User Provided)
  if (model.includes('gemini-3-pro')) {
    // Text: $2.00/1M input, $12.00/1M output
    cost += (inputTokens / 1000000) * 2.00;
    cost += (outputTokens / 1000000) * 12.00;
  }
  // Add other model pricing here if needed

  if (specialCost) {
    cost += specialCost;
  }
  const stats: UsageStats = { inputTokens, outputTokens, cost };
  usageListeners.forEach(l => l(stats));
};

// --- AGENTIC WORKFLOW: STEP 1 - SKELETON GENERATION ---


// --- AGENTIC WORKFLOW: STEP 2 - SHOT GENERATION ---
const generateSceneShots = async (
  scene: import("../types").SceneTemplate,
  context: import("../types").ProjectBackbone
): Promise<import("../types").ShotTemplate[]> => {
  const template = `
    Role: Director of Photography & Editor.
    Task: Generate a detailed SHOT LIST for ONE specific scene.
    
    CONTEXT:
    - Project Title: "${context.meta_data.title}"
    - Style: "${context.config.tone_style}"
    - Characters: ${JSON.stringify(context.database.characters.map(c => c.name))}
    - Location: ${context.database.locations.find(l => l.id === scene.location_ref_id)?.name || "Unknown"}
    
    SCENE TO VISUALIZE:
    - Slugline: ${scene.slugline}
    - Goal: ${scene.narrative_goal}
    - Duration: ${scene.estimated_duration_sec} seconds

    INSTRUCTIONS:
    1. Break this scene into a sequence of shots.
    2. **CRITICAL**: The sum of shot durations MUST equal ${scene.estimated_duration_sec}s.
    3. For each shot:
       - \`final_image_prompt\`: Detailed static visual description.
       - \`video_motion_prompt\`: Camera movement and action for AI video.
       - \`audio_context\`: What we hear (Dialogue/SFX) linked to this specific visual.

    OUTPUT JSON (Array of Shots):
    [
      {
        "shot_index": 1,
        "duration_sec": 4,
        "composition": { "shot_type": "Wide", "camera_movement": "Static", "angle": "Eye Level" },
        "content": { "ui_description": "...", "characters_in_shot": [], "final_image_prompt": "...", "video_motion_prompt": "..." },
        "audio": { "audio_context": "...", "is_voice_over": false }
      }
    ]
  `;

  try {
    // INTERCEPT FOR REVIEW
    const finalPrompt = await checkReviewMode(template, `Generate Shots: ${scene.slugline}`);

    const modelName = "gemini-2.0-flash-exp";
    const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

    const result = await model.generateContent(finalPrompt);
    const text = result.response.text();
    const shots = JSON.parse(text);

    trackUsage(modelName, finalPrompt.length / 4, text.length / 4);

    return Array.isArray(shots) ? shots.map((s: any) => ({ ...s, id: crypto.randomUUID() })) : [];

  } catch (error) {
    console.error(`Failed to generate shots for scene ${scene.id}`, error);
    return [];
  }
};

// --- 0. Generate Audio Script (Step 1bis) ---
// DEPRECATED: Now handled by populateScriptAudio in Step 3
export const generateAudioScript = async (
  idea: string,
  totalDuration: number,
  pacing: Pacing,
  language: string = 'English',
  tone: string = 'Standard',
  targetAudience: string = 'General Audience'
): Promise<import("../types").AudioScriptItem[]> => {
  return [];
};

// --- NEW: Populate Script Audio (Step 3) ---
export const populateScriptAudio = async (
  project: import("../types").ProjectBackbone
): Promise<import("../types").ProjectBackbone> => {
  if (!apiKey || apiKey === "MISSING_KEY") throw new Error("API Key is missing.");

  try {
    // 1. Serialize Visual Context for the AI
    const visualContext = project.database.scenes.map(scene => ({
      id: scene.id,
      slugline: scene.slugline,
      narrative_goal: scene.narrative_goal,
      shots: scene.shots.map(shot => ({
        id: shot.id,
        duration: shot.duration_sec,
        description: shot.content.ui_description,
        characters: shot.content.characters_in_shot
      }))
    }));

    const characterContext = project.database.characters.map(c => ({
      id: c.id,
      name: c.name,
      role: c.role
    }));

    const template = `
    Role: Professional Screenwriter & Dialogue Editor.
    Task: Write precise dialogue and audio cues for an existing visual storyboard.
    
    INPUT CONTEXT:
    - Title: "${project.meta_data.title}"
    - Intent: "${project.meta_data.user_intent}"
    - Tone: "${project.config.tone_style}"
    - Language: "{{language}}"
    
    CHARACTERS:
    {{characters}}

    VISUAL STORYBOARD (DO NOT CHANGE STRUCTURE):
    {{visualStoryboard}}

    INSTRUCTIONS:
    1. **Fill Empty Audio Slots**: For each shot, you must provide the 'audio' object.
    2. **Dialogue**: Write natural, character-consistent dialogue. Use the provided character IDs.
    3. **Specific Audio Cues**: If a shot needs a specific sound (SFX) to match the visual action (e.g., "Door slams", "Bird chirps"), add it to 'specificAudioCues'.
    4. **Timing**: Ensure dialogue length fits the shot duration.
    5. **Silence**: If a shot has no dialogue, leave the dialogue array empty.

    OUTPUT FORMAT:
    Return a JSON object mapping Shot IDs to their new Audio Data.
    Example:
    {
      "shot_id_123": {
        "audio_context": "Quiet room, distant traffic",
        "specificAudioCues": "Clock ticking loudly",
        "is_voice_over": false,
        "dialogue": [
          { "speaker": "Character Name", "text": "Hello?", "tone": "Whisper" }
        ]
      }
    }
    `;

    let prompt = template
      .replace(/{{language}}/g, project.config.primary_language)
      .replace('{{characters}}', JSON.stringify(characterContext, null, 2))
      .replace('{{visualStoryboard}}', JSON.stringify(visualContext, null, 2));

    // INTERCEPT FOR REVIEW
    prompt = await checkReviewMode(prompt, 'Populate Script Audio');

    const modelName = "gemini-2.0-flash-exp";
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    logDebug('req', 'Populate Script Audio', {
      projectTitle: project.meta_data.title
    }, { model: modelName, dynamicPrompt: template, finalPrompt: prompt });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const jsonText = response.text();
    logDebug('res', 'Populate Script Audio', { jsonText });

    let rawData = JSON.parse(jsonText);
    let audioMap: Record<string, any> = {};

    // Normalize Data: Handle Array of Objects vs Single Object
    if (Array.isArray(rawData)) {
      // Case: [{ "shot_id": { ... } }, { "shot_id_2": { ... } }]
      rawData.forEach(item => {
        const shotId = Object.keys(item)[0];
        if (shotId) audioMap[shotId] = item[shotId];
      });
    } else if (rawData.shot_audio_map) {
      // Case: { "shot_audio_map": { "shot_id": { ... } } }
      audioMap = rawData.shot_audio_map;
    } else {
      // Case: { "shot_id": { ... }, "shot_id_2": { ... } }
      audioMap = rawData;
    }

    // Merge back into ProjectBackbone
    const updatedScenes = project.database.scenes.map(scene => ({
      ...scene,
      shots: scene.shots.map(shot => {
        const newAudio = audioMap[shot.id];
        if (newAudio) {
          return {
            ...shot,
            audio: {
              ...shot.audio,
              ...newAudio
            }
          };
        }
        return shot;
      })
    }));

    // Usage tracking
    if (response.usageMetadata) {
      trackUsage(modelName, response.usageMetadata.promptTokenCount, response.usageMetadata.candidatesTokenCount);
    }

    return {
      ...project,
      database: {
        ...project.database,
        scenes: updatedScenes
      }
    };

  } catch (error) {
    console.error("Audio Population Failed:", error);
    logDebug('error', 'Audio Population Failed', error);
    throw error;
  }
};

// --- 1. Generate Script (Relational Architecture) ---
export const generateScript = async (
  idea: string,
  totalDuration: number,
  pacing: Pacing,
  language: string = 'English',
  audioScript: import("../types").AudioScriptItem[] = []
): Promise<{ script: Scene[], assets: Asset[] }> => {
  try {

    // Serialize Audio Script for the prompt
    const audioScriptText = JSON.stringify(audioScript.map(item => ({
      speaker: item.speaker,
      text: item.text,
      duration: item.durationEstimate,
      isBreak: item.isBreak
    })));

    // NEW STRICT SYSTEM PROMPT (Hierarchy & Reusability Rules)
    const template = `
  Role: Expert Director & Production Asset Manager.
      Task: Create a VISUAL STORYBOARD(Screenplay) that perfectly matches the provided AUDIO SCRIPT.
      
      INPUT CONTEXT:
      - Concept: "{{idea}}"
    - Total Duration: { { totalDuration } } s
      - Pacing: { { pacing } }
  - Language: { { language } }
      
      AUDIO SCRIPT(SOURCE OF TRUTH):
  { { audioScriptText } }

  INSTRUCTIONS:
  1. ** Synchronize Visuals **: You must create visual shots that correspond to the audio script. 
         - A single dialogue line might need 1 shot, or multiple shots(e.g.cutting between characters).
         - Ensure the total duration of your shots matches the audio script duration.
      2. ** Visual Dynamism **:
  { { pacingInstruction } }
      
      PHASE 1: WRITE THE SCRIPT(Sequences & Shots)
    - Group shots into SEQUENCES based on location / time.
      - Every shot MUST have a 'duration'.
      - ** MODULAR ACTION DATA **:
  - \`baseEnvironment\`: Describe ONLY the static environment/background (e.g., "A dark, misty forest with ancient trees").
        - \`characterActions\`: List of objects { castId, action }. For EACH character in the shot, describe their specific action.
        - \`itemStates\`: List of objects { itemId, state }. For EACH item in the shot, describe its state/position.
      
      PHASE 2: EXTRACT THE WORLD (Relational Database)
      - Define unique LOCATIONS (Master & Sub-locations).
      - Define unique CHARACTERS (consistent appearance).
      - Define unique ITEMS (props).
      - Assign IDs to everything.
      
      PHASE 3: LINK THEM
      - Every shot MUST reference a locationId.
      - Every shot MUST list castIds (characters in shot) and itemIds.
    `;

    const pacingInstruction = pacing === 'fast' ? "Use rapid cuts, dynamic camera movements, and high energy." :
      pacing === 'slow' ? "Use long takes, slow pans/zooms, and atmospheric focus." :
        "Balance establishing shots with action cuts.";

    let prompt = template
      .replace(/{{idea}}/g, idea)
      .replace(/{{totalDuration}}/g, totalDuration.toString())
      .replace(/{{pacing}}/g, pacing)
      .replace(/{{language}}/g, language)
      .replace('{{audioScriptText}}', audioScriptText)
      .replace('{{pacingInstruction}}', pacingInstruction);

    // --- DYNAMIC PLACEHOLDER REPLACEMENT ---
    prompt = prompt.replace('{{valid_shot_types}}', JSON.stringify(VALID_SHOT_TYPES));
    prompt = prompt.replace('{{valid_camera_angles}}', JSON.stringify(VALID_CAMERA_ANGLES));
    prompt = prompt.replace('{{valid_composition_tags}}', JSON.stringify(VALID_COMPOSITION_TAGS));

    // INTERCEPT FOR REVIEW
    prompt = await checkReviewMode(prompt, 'Generate Script');

    const modelName = "gemini-2.0-flash-exp";
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        // responseSchema: responseSchema as any, // Using JSON mode instead
      },
    });

    logDebug('req', 'Generate Script Prompt', { idea }, { model: modelName, dynamicPrompt: template, finalPrompt: prompt });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const json = response.text();
    logDebug('res', 'Generate Script', { json });

    const rawData = JSON.parse(json);
    const sequences = rawData.sequences || [];
    const world = rawData.world || {};

    // 1. Process Assets (Create Asset Objects)
    const assets: Asset[] = [];

    const createAsset = (def: any, type: AssetType): Asset => ({
      id: def.id,
      type: type,
      name: def.name,
      description: def.description,
      parentId: def.parentId, // Capture Parent ID
      locationType: def.type, // Capture MASTER/SUB
      visuals: {
        subject: def.name,
        details: def.description,
        pose: type === AssetType.LOCATION ? "Wide establishing shot" : "Single Full body shot",
        constraint: type === AssetType.LOCATION ? "Environment only" : "Single view only",
        background: type === AssetType.LOCATION ? "Cinematic atmosphere" : "Isolated on white",
        lighting: type === AssetType.LOCATION ? "Cinematic lighting" : "Studio lighting",
        expression: "Neutral",
        clothing: "Standard"
      },
      status: 'pending'
    });

    (world.locations || []).forEach((l: any) => assets.push(createAsset(l, AssetType.LOCATION)));
    (world.characters || []).forEach((c: any) => assets.push(createAsset(c, AssetType.CHARACTER)));
    (world.items || []).forEach((i: any) => assets.push(createAsset(i, AssetType.ITEM)));

    // 2. Build Script (Flatten Sequences into Shots)
    const script: Scene[] = [];
    let shotCounter = 1;

    sequences.forEach((seq: any) => {
      const locAsset = assets.find(a => a.id === seq.locationId);
      const locationName = locAsset ? locAsset.name : "UNKNOWN";
      const fullSlug = `${locationName} - ${seq.time || 'DAY'} `;
      const groupSceneId = seq.id || crypto.randomUUID();

      (seq.shots || []).forEach((shot: any) => {
        const usedAssets = [
          ...(shot.castIds || []),
          ...(shot.itemIds || [])
        ];

        script.push({
          id: crypto.randomUUID(),
          sceneId: groupSceneId,
          number: shotCounter++,
          location: fullSlug,
          time: seq.time || 'DAY',
          locationAssetId: seq.locationId,
          sceneContext: seq.context || "",
          duration: shot.duration || 5,
          shotType: shot.shotType || "Wide Shot",
          cameraAngle: shot.cameraAngle || "Eye Level",
          cameraMovement: shot.movement || "Static",
          compositionTags: shot.compositionTags || [], // Map New Field
          // description: shot.action || "", // REMOVED: Use actionData instead
          veoMotionPrompt: shot.veoMotionPrompt || "",
          lighting: seq.lighting || "Natural",
          weather: seq.weather || "Clear",
          dialogue: shot.dialogue || "",
          narration: shot.narration || "",
          sfx: shot.sfx || "",
          music: shot.music || "",
          transition: "Cut to",
          usedAssetIds: usedAssets
        });
      });
    });

    return { script, assets };

  } catch (error) {
    console.error("Script generation failed:", error);
    logDebug('error', 'Generate Script Failed', error);
    throw error;
  }
};

// --- 2.5 Generate Screenplay (Step 3) ---


// --- 2. Extract Assets (Deprecated/Unused logic now that script handles it) ---
export const extractAssets = async (script: Scene[]): Promise<{ assets: Asset[], sceneMappings: any }> => {
  return { assets: [], sceneMappings: {} };
};

// --- 3. Generate Image (Gemini 3 Pro) ---
export const generateImage = async (
  prompt: string,
  aspectRatio?: string // Optional: e.g. "16:9", "1:1". If not provided, AI decides format
): Promise<string> => {
  try {
    const modelName = 'gemini-3-pro-image-preview';

    // INTERCEPT FOR REVIEW
    const finalPrompt = await checkReviewMode(prompt, 'Generate Image');

    logDebug('req', 'Generate Image', { prompt, aspectRatio }, { model: modelName, finalPrompt: finalPrompt });

    if (!finalPrompt || finalPrompt.trim().length === 0) throw new Error("Prompt cannot be empty");
    const cleanPrompt = finalPrompt.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    let apiPrompt = cleanPrompt;
    if (aspectRatio) {
      apiPrompt += ` --aspect - ratio ${aspectRatio} `;
    }

    const model = genAI.getGenerativeModel({ model: modelName });
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: apiPrompt }] }],
    });

    // Track Usage (Image Cost: $0.134)
    trackUsage(modelName, 0, 0, 0.134);

    const candidate = response.response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    // Check for InlineData (base64)
    if (part && part.inlineData && part.inlineData.data) {
      logDebug('res', 'Generate Image Success', { size: part.inlineData.data.length });
      return `data: image / png; base64, ${part.inlineData.data} `;
    }

    throw new Error("No image data received from Gemini 3 Pro");

  } catch (err) {
    logDebug('error', 'Generate Image Failed', err);
    throw err;
  }
};

// --- 4. Edit Image (Gemini 3 Pro) ---
export const editImage = async (
  imageUri: string,
  prompt: string,
  _ignored?: any,
  maskBase64?: string
): Promise<string> => {
  try {
    const modelName = 'gemini-3-pro-image-preview';

    // INTERCEPT FOR REVIEW
    const finalPrompt = await checkReviewMode(prompt, 'Edit Image');

    logDebug('req', 'Edit Image', { prompt, hasMask: !!maskBase64 }, { model: modelName, finalPrompt: finalPrompt });

    const { mimeType, data } = parseDataUri(imageUri);
    const parts: any[] = [
      { inlineData: { mimeType, data } },
      { text: finalPrompt }
    ];

    if (maskBase64) {
      const maskData = parseDataUri(maskBase64);
      parts.push({ inlineData: { mimeType: maskData.mimeType, data: maskData.data } });
    }

    const model = genAI.getGenerativeModel({ model: modelName });
    const response = await model.generateContent({
      contents: [{ role: 'user', parts }]
    });

    trackUsage(modelName, 0, 0, 0.134);

    const candidate = response.response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part && part.inlineData && part.inlineData.data) {
      logDebug('res', 'Edit Image Success', { size: part.inlineData.data.length });
      return `data: image / png; base64, ${part.inlineData.data} `;
    }

    throw new Error("No image data received from Gemini 3 Pro");

  } catch (err) {
    logDebug('error', 'Edit Image Failed', err);
    throw err;
  }
};

// --- 5. Analyze Asset Changes ---
export const analyzeAssetChanges = async (
  current: import("../types").ProjectBackbone['database'],
  original: import("../types").ProjectBackbone['database']
): Promise<import("../types").AssetChangeAnalysis> => {
  // Simple comparison logic
  const changes: string[] = [];

  // Check characters
  current.characters.forEach(c => {
    const orig = original.characters.find(o => o.id === c.id);
    if (!orig) changes.push(`New character added: ${c.name} `);
    else if (orig.name !== c.name) changes.push(`Character renamed: ${orig.name} -> ${c.name} `);
    else if (orig.visual_seed.description !== c.visual_seed.description) changes.push(`Character ${c.name} description modified`);
  });

  // Check locations
  current.locations.forEach(l => {
    const orig = original.locations.find(o => o.id === l.id);
    if (!orig) changes.push(`New location added: ${l.name} `);
    else if (orig.name !== l.name) changes.push(`Location renamed: ${orig.name} -> ${l.name} `);
    else if (orig.environment_prompt !== l.environment_prompt) changes.push(`Location ${l.name} prompt modified`);
  });

  if (changes.length === 0) {
    return { status: 'CONFIRMED', reasoning: "No significant changes detected." };
  }

  return {
    status: 'QUESTION',
    reasoning: "Changes detected in assets. Do you want to regenerate the scene shots to reflect these changes?",
    questions: [{
      id: "regenerate_shots",
      text: "Regenerate shots for affected scenes?",
      options: ["Yes", "No"]
    }]
  };
};

// --- 6. Regenerate Sequencer ---
export const regenerateSequencer = async (
  database: import("../types").ProjectBackbone['database'],
  metaData: import("../types").ProjectBackbone['meta_data'],
  answers?: Record<string, string>
): Promise<import("../types").ProjectBackbone['database']> => {
  console.warn("regenerateSequencer: Not fully implemented yet. Returning current database.");
  return database;
};

// --- 7. Generate Multimodal Image ---
export const generateMultimodalImage = async (prompt: string, images: any[], aspectRatio?: string): Promise<string> => {
  console.warn("generateMultimodalImage not implemented");
  return "";
};

// --- 8. Generate Plan Video ---
export const generatePlanVideo = async (imageUri: string, prompt: string, aspectRatio: string, duration: number = 5): Promise<{ localUri: string, remoteUri: string }> => {
  console.warn("generatePlanVideo not implemented");
  return { localUri: "", remoteUri: "" };
};

// --- 9. Extend Video ---
export const extendVideo = async (videoUri: string, prompt: string, aspectRatio: string): Promise<{ localUri: string, remoteUri: string }> => {
  console.warn("extendVideo not implemented");
  return { localUri: "", remoteUri: "" };
};

// --- 10. Generate Refinement Questions ---
export const generateRefinementQuestions = async (
  script: import("../types").Scene[],
  stylePrompt: string
): Promise<import("../types").RefineQuestion[]> => {
  console.warn("generateRefinementQuestions not implemented");
  return [];
};

// --- 11. Generate Video (Wrapper) ---
export const generateVideo = async (imageUri: string, prompt: string, aspectRatio: string): Promise<string> => {
  const result = await generatePlanVideo(imageUri, prompt, aspectRatio);
  return result.localUri || result.remoteUri || "";
};

// --- 13. Generate Bridge Scene ---
export const generateBridgeScene = async (sceneId: string, prompt: string): Promise<string> => {
  console.warn("generateBridgeScene not implemented");
  return "";
};

// --- 14. Outpaint Image ---
export const outpaintImage = async (imageUri: string, prompt: string, direction: string): Promise<string> => {
  console.warn("outpaintImage not implemented");
  return "";
};


