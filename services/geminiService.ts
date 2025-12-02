import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import { Scene, Asset, AssetType, Pacing, RefineQuestion, ProjectBackbone, AssetChangeAnalysis, SceneTemplate, AgentRole, AgentMessage } from "../types";
import { DEFAULT_SYSTEM_INSTRUCTIONS } from './prompts';
import { generateReplicateImage } from './replicateService';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || (process.env.GEMINI_API_KEY as string);
if (!API_KEY) {
  console.warn("Missing VITE_GEMINI_API_KEY in .env.local");
}

const genAI = new GoogleGenerativeAI(API_KEY || "MISSING_KEY");

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

  public updateAgentSystemInstruction(role: AgentRole, newInstruction: string) {
    console.log(`[AgentManager ${this.id}] Updating system instruction for ${role}`);
    // Clear existing agent and history
    this.agents.delete(role);
    this.messageHistory.set(role, []);

    // Re-create with new instruction
    const modelName = "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });
    this.getAgent(role, model, newInstruction, { model: modelName, finalPrompt: newInstruction });
  }

  public resetAgent(role: AgentRole) {
    console.log(`[AgentManager ${this.id}] Resetting agent: ${role}`);
    this.agents.delete(role);
    this.messageHistory.set(role, []);
    // Notify listeners (optional, but good for UI to clear)
    this.notifyListeners(role, {
      id: crypto.randomUUID(),
      role: 'system',
      agentRole: role,
      content: '[MEMORY RESET]',
      timestamp: Date.now()
    });
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

  public getExistingAgent(role: AgentRole): ChatSession | undefined {
    return this.agents.get(role);
  }

  public async sendMessage(role: AgentRole, session: ChatSession, text: string, images: string[] = [], metadata?: { model?: string; dynamicPrompt?: string; finalPrompt?: string; data?: any; messageId?: string }): Promise<string> {
    console.log(`[AgentManager ${this.id}] sendMessage for ${role}: "${text.slice(0, 50)}..." with ${images.length} images`);

    // Log User Message
    const userMsg: AgentMessage = {
      id: metadata?.messageId || crypto.randomUUID(),
      role: 'user',
      agentRole: role,
      content: text + (images.length > 0 ? ` [${images.length} Image(s) Attached]` : ''),
      timestamp: Date.now(),
      // Attach prompt metadata to the user message (request)
      model: metadata?.model,
      dynamicPrompt: metadata?.dynamicPrompt,
      finalPrompt: metadata?.finalPrompt
    };
    this.addMessageToHistory(role, userMsg);
    this.notifyListeners(role, userMsg);

    // Prepare parts for Gemini
    const parts: any[] = [{ text }];
    images.forEach(base64 => {
      // Remove data URL prefix if present
      const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: "image/png" // Assuming PNG for now, or detect from base64 header
        }
      });
    });

    const result = await session.sendMessage(parts);
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

  public reset() {
    console.log(`[AgentManager ${this.id}] Resetting all agents`);
    this.agents.clear();
    this.messageHistory.clear();
    // Notify listeners of reset if needed, or just let them handle empty history
  }
}

export const injectAgentMessage = (role: AgentRole, message: AgentMessage) => {
  AgentManager.getInstance().injectMessage(role, message);
};

export const subscribeToAgentMessages = (listener: (role: AgentRole, message: AgentMessage) => void) => {
  return AgentManager.getInstance().subscribe(listener);
};

export const getAgentHistory = (role: AgentRole) => {
  return AgentManager.getInstance().getHistory(role);
};

export const chatWithAgent = async (role: AgentRole, message: string, images: string[] = []): Promise<string> => {
  const manager = AgentManager.getInstance();
  let session = manager.getExistingAgent(role);

  if (!session) {
    // Create a generic session if not found
    const modelName = "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });
    session = manager.getAgent(role, model, `You are the ${role}. Waiting for project context...`);
  }

  return manager.sendMessage(role, session, message, images);
};

export const updateAgentSystemInstruction = (role: AgentRole, instruction: string) => {
  AgentManager.getInstance().updateAgentSystemInstruction(role, instruction);
};

export const resetAgentMemory = (role: AgentRole) => {
  AgentManager.getInstance().resetAgent(role);
};

// --- AGENTIC WORKFLOW: STEP 1 - PRODUCTION BIBLE (SHOWRUNNER AGENT) ---
// --- AGENTIC WORKFLOW: STEP 1 - CASTING DIRECTOR (CHARACTERS & ITEMS) ---
export const generateCasting = async (
  idea: string,
  settings: { tone: string; targetAudience: string; language: string }
): Promise<{ characters: import("../types").CharacterTemplate[], items: import("../types").ItemTemplate[] }> => {

  const systemInstruction = DEFAULT_SYSTEM_INSTRUCTIONS[AgentRole.CASTING_DIRECTOR];
  const modelName = "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

  const agentManager = AgentManager.getInstance();
  const session = agentManager.getAgent(AgentRole.CASTING_DIRECTOR, model, systemInstruction, {
    model: modelName,
    dynamicPrompt: systemInstruction,
    finalPrompt: systemInstruction
  });

  const promptTemplate = `
    PROJECT IDEA: "{{idea}}"
    TONE: {{tone}}
    TARGET AUDIENCE: {{targetAudience}}
    LANGUAGE: {{language}}

    INSTRUCTIONS:
    Generate the Cast (Characters) and Props (Items) for this project.
  `;

  const prompt = promptTemplate
    .replace('{{idea}}', idea)
    .replace('{{tone}}', settings.tone)
    .replace('{{targetAudience}}', settings.targetAudience)
    .replace('{{language}}', settings.language);

  // INTERCEPT FOR REVIEW
  const finalPrompt = await checkReviewMode(prompt, 'Casting Director: Generate Cast');
  const messageId = crypto.randomUUID();
  logDebug('req', 'Casting Director Agent: Generate Cast', { idea }, { model: modelName, finalPrompt: finalPrompt, dynamicPrompt: promptTemplate, agentRole: AgentRole.CASTING_DIRECTOR, linkedMessageId: messageId });

  const text = await agentManager.sendMessage(AgentRole.CASTING_DIRECTOR, session, finalPrompt, [], {
    model: modelName,
    finalPrompt: finalPrompt,
    dynamicPrompt: promptTemplate,
    messageId: messageId
  });

  const result = JSON.parse(text);
  logDebug('res', 'Casting Director Agent: Cast Generated', { result }, { agentRole: AgentRole.CASTING_DIRECTOR, linkedMessageId: messageId });
  trackUsage(modelName, finalPrompt.length / 4, text.length / 4);

  return {
    characters: result.characters.map((c: any) => ({ ...c, id: crypto.randomUUID() })),
    items: result.items.map((i: any) => ({ ...i, id: crypto.randomUUID() }))
  };
};

// --- AGENTIC WORKFLOW: STEP 2 - LOCATION SCOUT (LOCATIONS) ---
export const generateLocations = async (
  idea: string,
  characters: import("../types").CharacterTemplate[]
): Promise<import("../types").LocationTemplate[]> => {

  const systemInstruction = DEFAULT_SYSTEM_INSTRUCTIONS[AgentRole.LOCATION_SCOUT];
  const modelName = "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

  const agentManager = AgentManager.getInstance();
  const session = agentManager.getAgent(AgentRole.LOCATION_SCOUT, model, systemInstruction, {
    model: modelName,
    dynamicPrompt: systemInstruction,
    finalPrompt: systemInstruction
  });

  const charContext = characters.map(c => `- ${c.name} (${c.role})`).join('\n');

  const promptTemplate = `
    PROJECT IDEA: "{{idea}}"
    CHARACTERS:
    {{charContext}}

    INSTRUCTIONS:
    Generate the Locations where this story takes place.
  `;

  const prompt = promptTemplate
    .replace('{{idea}}', idea)
    .replace('{{charContext}}', charContext);

  // INTERCEPT FOR REVIEW
  const finalPrompt = await checkReviewMode(prompt, 'Location Scout: Generate Locations');
  const messageId = crypto.randomUUID();
  logDebug('req', 'Location Scout Agent: Generate Locations', { idea }, { model: modelName, finalPrompt: finalPrompt, dynamicPrompt: promptTemplate, agentRole: AgentRole.LOCATION_SCOUT, linkedMessageId: messageId });

  const text = await agentManager.sendMessage(AgentRole.LOCATION_SCOUT, session, finalPrompt, [], {
    model: modelName,
    finalPrompt: finalPrompt,
    dynamicPrompt: promptTemplate,
    messageId: messageId
  });

  const result = JSON.parse(text);
  logDebug('res', 'Location Scout Agent: Locations Generated', { result }, { agentRole: AgentRole.LOCATION_SCOUT, linkedMessageId: messageId });
  trackUsage(modelName, finalPrompt.length / 4, text.length / 4);

  return result.locations.map((l: any) => ({ ...l, id: crypto.randomUUID() }));
};

// --- MAIN ORCHESTRATOR ---
export const analyzeStoryConcept = async (
  idea: string,
  settings: { tone: string; targetAudience: string; language: string; duration: number; videoType: string; visualStyle: string }
): Promise<import("../types").ProjectBackbone> => {

  // 1. Initialize Empty Backbone
  let projectBackbone: import("../types").ProjectBackbone = {
    project_id: crypto.randomUUID(),
    meta_data: {
      title: "New Project", // Placeholder
      user_intent: idea,
      created_at: new Date().toISOString()
    },
    config: {
      aspect_ratio: "16:9",
      resolution: "1080p",
      target_fps: 24,
      primary_language: settings.language,
      target_audience: settings.targetAudience,
      tone_style: settings.tone,
      has_dialogue: true,
      has_voiceover: false
    },
    global_assets: {
      art_style_prompt: settings.visualStyle,
      negative_prompt: "text, watermark, bad quality, blurry",
      music_theme_id: "default"
    },
    database: {
      characters: [],
      locations: [],
      items: [],
      scenes: []
    },
    final_render: {
      total_duration_sec: settings.duration
    }
  };

  // 2. CASTING DIRECTOR
  logDebug('info', 'Orchestrator: Calling Casting Director...', {});
  const castingResult = await generateCasting(idea, settings);
  projectBackbone.database.characters = castingResult.characters;
  projectBackbone.database.items = castingResult.items;

  // 3. LOCATION SCOUT
  logDebug('info', 'Orchestrator: Calling Location Scout...', {});
  const locationResult = await generateLocations(idea, projectBackbone.database.characters);
  projectBackbone.database.locations = locationResult;

  // 4. SCREENWRITER
  logDebug('info', 'Orchestrator: Calling Screenwriter...', {});
  projectBackbone = await generateScreenplay(projectBackbone);

  return projectBackbone;
};
// --- AGENTIC WORKFLOW: STEP 2 - SCREENPLAY (SCREENWRITER AGENT) ---
// --- AGENTIC WORKFLOW: STEP 2 - SCREENPLAY (SCREENWRITER AGENT) ---
export const generateScreenplay = async (
  project: import("../types").ProjectBackbone
): Promise<import("../types").ProjectBackbone> => {
  try {
    const { database, meta_data, config } = project;

    logDebug('info', 'Agentic Workflow', { step: '2. Generating Screenplay (Screenwriter Agent)' });

    const modelName = "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

    // 1. Prepare Bible Context
    const bibleContext = `
      PRODUCTION BIBLE CONTEXT:
      Title: ${meta_data.title}
      Tone: ${config.tone_style}
      Intent: ${meta_data.user_intent}
      
      CHARACTERS:
      ${database.characters.map(c => `- [ID: ${c.id}] ${c.name} (${c.role}): ${c.visual_seed.description}`).join('\n')}
      
      LOCATIONS:
      ${database.locations.map(l => `- [ID: ${l.id}] ${l.name}: ${l.environment_prompt}`).join('\n')}
    `;

    // 2. Initialize Screenwriter Agent
    const systemInstruction = DEFAULT_SYSTEM_INSTRUCTIONS[AgentRole.SCREENWRITER];
    const fullSystemInstruction = `${systemInstruction}\n\n${bibleContext}`;

    const agentManager = AgentManager.getInstance();
    const chatSession = agentManager.getAgent(AgentRole.SCREENWRITER, model, fullSystemInstruction, {
      model: modelName,
      dynamicPrompt: fullSystemInstruction,
      finalPrompt: fullSystemInstruction
    });

    // 3. Generate Full Screenplay
    const promptTemplate = `
      TASK: Write the complete screenplay for this project.
      DURATION: {{duration}} seconds.
      
      INSTRUCTIONS:
      1. Create a sequence of scenes that tell the story.
      2. Use the Characters and Locations provided in the Context.
      3. For each scene, provide:
         - Slugline
         - Synopsis
         - Script Content (Dialogue/Action)
         - location_ref_id: The exact ID of the location from the context.
         - characters_in_scene: An array of exact IDs of characters present in the scene.
      4. Ensure the total duration matches the target duration.
    `;

    const prompt = promptTemplate.replace('{{duration}}', project.final_render.total_duration_sec.toString());

    // INTERCEPT FOR REVIEW
    const finalPrompt = await checkReviewMode(prompt, 'Screenwriter: Generate Screenplay');

    const messageId = crypto.randomUUID();
    logDebug('req', 'Screenwriter Agent: Generate Screenplay', {}, {
      model: modelName,
      finalPrompt: finalPrompt,
      dynamicPrompt: promptTemplate,
      agentRole: AgentRole.SCREENWRITER,
      linkedMessageId: messageId
    });

    const text = await agentManager.sendMessage(AgentRole.SCREENWRITER, chatSession, finalPrompt, [], {
      model: modelName,
      finalPrompt: finalPrompt,
      dynamicPrompt: promptTemplate,
      messageId: messageId
    });

    const result = JSON.parse(text);
    logDebug('res', 'Screenwriter Agent: Screenplay Generated', { result }, {
      agentRole: AgentRole.SCREENWRITER,
      linkedMessageId: messageId
    });

    trackUsage(modelName, finalPrompt.length / 4, text.length / 4);

    const generatedScenes = result.scenes.map((s: any) => ({
      ...s,
      id: crypto.randomUUID(),
      characters_in_scene: s.characters_in_scene || [], // Ensure array exists
      shots: [], // Initialize empty shots
      script_content: {
        lines: s.script_content?.lines?.map((l: any) => ({ ...l, id: crypto.randomUUID() })) || []
      }
    }));

    return {
      ...project,
      database: {
        ...database,
        scenes: generatedScenes
      }
    };

  } catch (error) {
    logDebug('error', 'Generate Screenplay Failed', error);
    throw error;
  }
};



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

async function checkReviewMode(prompt: string, title: string): Promise<string> {
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
  agentRole?: AgentRole;
  linkedMessageId?: string;
}) => void;

let listeners: LogListener[] = [];

export const subscribeToDebugLog = (listener: LogListener) => {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
};

export function logDebug(
  type: LogType,
  title: string,
  data: any,
  options?: { model?: string; dynamicPrompt?: string; finalPrompt?: string; agentRole?: AgentRole; linkedMessageId?: string }
) {
  const payload = {
    type,
    title,
    data,
    timestamp: Date.now(),
    ...options
  };
  listeners.forEach(l => l(payload));
}

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

function trackUsage(model: string, inputTokens: number, outputTokens: number, specialCost?: number) {
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
}

// --- AGENTIC WORKFLOW: STEP 3 - SHOT LIST (DIRECTOR & DoP AGENTS) ---
export const generateShotList = async (
  scene: import("../types").SceneTemplate,
  project: import("../types").ProjectBackbone
): Promise<import("../types").ShotTemplate[]> => {
  const agentManager = AgentManager.getInstance();
  const modelName = "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

  try {
    // 1. DIRECTOR AGENT: Create Shot List
    const directorSystemPrompt = DEFAULT_SYSTEM_INSTRUCTIONS[AgentRole.DIRECTOR];
    const directorSession = agentManager.getAgent(AgentRole.DIRECTOR, model, directorSystemPrompt, {
      model: modelName,
      dynamicPrompt: directorSystemPrompt,
      finalPrompt: directorSystemPrompt
    });

    const directorRequest = `
        SCENE CONTEXT:
        Slugline: ${scene.slugline}
        Goal: ${scene.narrative_goal}
        Synopsis: ${scene.synopsis || "N/A"}
        Duration: ${scene.estimated_duration_sec}s
        Script: ${JSON.stringify(scene.script_content?.lines || [])}

        TASK:
        Break this scene into a sequence of shots.
        Total Duration must be approx ${scene.estimated_duration_sec}s.

        OUTPUT JSON SCHEMA:
        {
          "shots": [
            {
              "shot_index": 1,
              "duration_sec": 4,
              "content": { "ui_description": "Description of action" },
              "composition": { "shot_type": "Wide" }
            }
          ]
        }
      `;

    // INTERCEPT FOR REVIEW
    const finalDirectorPrompt = await checkReviewMode(directorRequest, `Director: Shot List for ${scene.slugline}`);
    const directorMsgId = crypto.randomUUID();

    logDebug('req', `Director Agent: Shot List for ${scene.slugline}`, { sceneId: scene.id }, {
      model: modelName,
      agentRole: AgentRole.DIRECTOR,
      linkedMessageId: directorMsgId
    });

    const directorResponse = await agentManager.sendMessage(AgentRole.DIRECTOR, directorSession, finalDirectorPrompt, [], {
      model: modelName,
      messageId: directorMsgId
    });

    const directorJson = JSON.parse(directorResponse);
    let shots: import("../types").ShotTemplate[] = (directorJson.shots || []).map((s: any) => ({
      ...s,
      id: crypto.randomUUID(),
      audio: { is_voice_over: false }, // Default
      composition: { ...s.composition, camera_movement: "Static" } // Default
    }));

    logDebug('res', `Director Agent: Generated ${shots.length} shots`, { shots }, { linkedMessageId: directorMsgId });


    // 2. DoP AGENT: Refine Visuals
    const dopSystemPrompt = DEFAULT_SYSTEM_INSTRUCTIONS[AgentRole.DIRECTOR_OF_PHOTOGRAPHY];
    const dopSession = agentManager.getAgent(AgentRole.DIRECTOR_OF_PHOTOGRAPHY, model, dopSystemPrompt, {
      model: modelName,
      dynamicPrompt: dopSystemPrompt,
      finalPrompt: dopSystemPrompt
    });

    // We can process shots in batch or individually. Batch is faster.
    const dopRequest = `
        PROJECT STYLE: ${project.config.tone_style}
        
        SHOT LIST TO REFINE:
        ${JSON.stringify(shots.map(s => ({ index: s.shot_index, description: s.content.ui_description, type: s.composition.shot_type })))}

        TASK:
        For EACH shot, define the Cinematography (Lighting, Camera Movement, Angle).
        
        OUTPUT JSON SCHEMA:
        {
          "updates": [
            {
              "shot_index": 1,
              "composition": { "camera_movement": "...", "angle": "..." },
              "lighting": "...",
              "veo_elements": { "cinematography": "...", "style_ambiance": "..." }
            }
          ]
        }
      `;

    const finalDoPPrompt = await checkReviewMode(dopRequest, `DoP: Refine Shots for ${scene.slugline}`);
    const dopMsgId = crypto.randomUUID();

    logDebug('req', `DoP Agent: Refine Shots for ${scene.slugline}`, {}, {
      model: modelName,
      agentRole: AgentRole.DIRECTOR_OF_PHOTOGRAPHY,
      linkedMessageId: dopMsgId
    });

    const dopResponse = await agentManager.sendMessage(AgentRole.DIRECTOR_OF_PHOTOGRAPHY, dopSession, finalDoPPrompt, [], {
      model: modelName,
      messageId: dopMsgId
    });

    const dopJson = JSON.parse(dopResponse);
    const updates = dopJson.updates || [];

    // Merge Updates
    shots = shots.map(shot => {
      const update = updates.find((u: any) => u.shot_index === shot.shot_index);
      if (update) {
        return {
          ...shot,
          composition: { ...shot.composition, ...update.composition },
          lighting: update.lighting,
          content: { ...shot.content, veo_elements: update.veo_elements }
        };
      }
      return shot;
    });

    logDebug('res', `DoP Agent: Refined Shots`, { shots }, { linkedMessageId: dopMsgId });

    return shots;

  } catch (error) {
    console.error(`Failed to generate shot list for scene ${scene.id}`, error);
    logDebug('error', `Generate Shot List Failed`, error);
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
  if (!API_KEY || API_KEY === "MISSING_KEY") throw new Error("API Key is missing.");

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

    const itemContext = project.database.items.map(i => ({
      id: i.id,
      name: i.name,
      type: i.type
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

    ITEMS (PROPS):
    {{items}}

    VISUAL STORYBOARD (DO NOT CHANGE STRUCTURE):
    {{visualStoryboard}}

    INSTRUCTIONS:
    1. **Fill Empty Audio Slots**: For each shot, you must provide the 'audio' object.
    2. **Dialogue**: Write natural, character-consistent dialogue. Use the provided character IDs.
    3. **Specific Audio Cues**: If a shot needs a specific sound (SFX) to match the visual action (e.g., "Door slams", "Bird chirps", "Sword clash"), add it to 'specificAudioCues'.
    4. **Item Sounds**: If an item is in the shot (e.g., a car), ensure its sound is present in 'audio_context' or 'specificAudioCues'.
    5. **Timing**: Ensure dialogue length fits the shot duration.
    6. **Silence**: If a shot has no dialogue, leave the dialogue array empty.

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
      .replace('{{items}}', JSON.stringify(itemContext, null, 2))
      .replace('{{visualStoryboard}}', JSON.stringify(visualContext, null, 2));

    // INTERCEPT FOR REVIEW
    prompt = await checkReviewMode(prompt, 'Populate Script Audio');

    const modelName = "gemini-2.5-flash";
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

// --- Helper for Asset Conversion ---
const createAssetFromTemplate = (
  template: import("../types").CharacterTemplate | import("../types").LocationTemplate | import("../types").ItemTemplate,
  type: AssetType
): import("../types").Asset => {

  // Extract details and description based on type
  let details = "";
  let description = "";

  if (type === AssetType.CHARACTER) {
    const char = template as import("../types").CharacterTemplate;
    details = char.visual_seed.description;
    description = char.visual_seed.description;
  } else if (type === AssetType.LOCATION) {
    const loc = template as import("../types").LocationTemplate;
    details = loc.environment_prompt;
    description = loc.description;
  } else {
    const item = template as import("../types").ItemTemplate;
    details = item.visual_details;
    description = item.description;
  }

  return {
    id: template.id,
    name: template.name,
    type: type,
    description: description,
    visuals: {
      subject: template.name,
      details: details,
      pose: type === AssetType.LOCATION ? "Wide establishing shot" : "Single Full body shot",
      constraint: type === AssetType.LOCATION ? "Environment only" : "Single view only",
      background: type === AssetType.LOCATION ? "Cinematic atmosphere" : "Isolated on white",
      lighting: type === AssetType.LOCATION ? "Cinematic lighting" : "Studio lighting",
      expression: "Neutral",
      clothing: "Standard"
    },
    status: 'pending'
  };
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
    logDebug('info', 'Starting Full Generation Workflow', { idea, totalDuration, pacing });

    // 1. SHOWRUNNER: Generate Bible (Assets) & Initial Project Backbone
    let project = await analyzeStoryConcept(idea, {
      tone: 'Standard', // Default
      targetAudience: 'General Audience', // Default
      language,
      duration: totalDuration,
      videoType: 'Short', // Default
      visualStyle: 'Cinematic' // Default
    });

    // Update project config
    project.config.target_fps = 24;
    project.config.resolution = '1080p';
    project.config.aspect_ratio = '16:9';
    project.final_render.total_duration_sec = totalDuration;

    // 3. SCREENWRITER: Generate Scenes
    project = await generateScreenplay(project);

    // 4. DIRECTOR & DOP: Generate Shots for each Scene
    const allUiShots: Scene[] = [];
    let shotCounter = 1;

    // Process scenes sequentially to maintain context if needed, or parallel for speed
    // Sequential is safer for rate limits and debugging
    for (const scene of project.database.scenes) {
      logDebug('info', `Generating shots for scene ${scene.scene_index}: ${scene.slugline}`, {});

      // Generate shots for this scene
      const shots = await generateShotList(scene, project);

      // Update project model
      scene.shots = shots;

      // Map to UI 'Scene' (Shot) objects
      shots.forEach(shot => {
        // Find location asset to link
        const locationAsset = project.database.locations.find(l => l.id === scene.location_ref_id);

        allUiShots.push({
          id: shot.id,
          sceneId: scene.id,
          number: shotCounter++,
          location: scene.slugline,
          time: scene.slugline_elements?.time || 'DAY',
          locationAssetId: scene.location_ref_id,
          sceneContext: scene.synopsis || '',
          duration: shot.duration_sec,
          shotType: shot.composition.shot_type,
          cameraAngle: shot.composition.angle,
          cameraMovement: shot.composition.camera_movement,
          compositionTags: [],
          actionData: {
            baseEnvironment: `${locationAsset?.environment_prompt || "Generic Environment"}. ${shot.content.ui_description}`,
            characterActions: [],
            itemStates: []
          },
          lighting: shot.lighting || 'Standard',
          weather: "Clear", // Default
          dialogue: shot.audio.dialogue?.map(d => `${d.speaker}: ${d.text}`).join('\n') || "",
          narration: shot.audio.is_voice_over ? shot.audio.audio_context : "",
          sfx: shot.audio.specificAudioCues || "",
          music: "",
          transition: "Cut",
          veoMotionPrompt: shot.content.video_motion_prompt || "",
          usedAssetIds: [...shot.content.characters_in_shot, ...shot.content.items_in_shot],

          // UI State
          isGenerating: false,
          imageUri: undefined,
          videoUri: undefined
        });
      });
    }

    // 5. Convert Assets to UI Format
    const uiAssets: Asset[] = [
      ...project.database.characters.map(c => createAssetFromTemplate(c, AssetType.CHARACTER)),
      ...project.database.locations.map(l => createAssetFromTemplate(l, AssetType.LOCATION)),
      ...project.database.items.map(i => createAssetFromTemplate(i, AssetType.ITEM))
    ];

    logDebug('info', 'Full Generation Complete', { shotCount: allUiShots.length, assetCount: uiAssets.length });

    return {
      script: allUiShots,
      assets: uiAssets
    };

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
  aspectRatio?: string, // Optional: e.g. "16:9", "1:1". If not provided, AI decides format
  logContext?: { agentRole: AgentRole; linkedMessageId: string }
): Promise<string> => {
  try {
    const modelName = 'gemini-3-pro-image-preview';

    // INTERCEPT FOR REVIEW
    const finalPrompt = await checkReviewMode(prompt, 'Generate Image');

    logDebug('req', 'Generate Image', { prompt, aspectRatio }, {
      model: modelName,
      finalPrompt: finalPrompt,
      agentRole: logContext?.agentRole,
      linkedMessageId: logContext?.linkedMessageId
    });

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
      const imageData = `data:image/png;base64,${part.inlineData.data}`;
      logDebug('res', 'Generate Image Success', {
        size: part.inlineData.data.length,
        image: imageData // Log the full image data for the console
      }, {
        agentRole: logContext?.agentRole,
        linkedMessageId: logContext?.linkedMessageId
      });
      return imageData;
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
      return `data:image/png;base64,${part.inlineData.data}`;
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



// --- 15. Generate Asset Image (Designer Agent) ---
// --- 15. Generate Asset Image (ART DIRECTOR AGENT) ---
export const generateAssetImage = async (
  type: 'character' | 'location' | 'item',
  data: import("../types").CharacterTemplate | import("../types").LocationTemplate | import("../types").ItemTemplate,
  projectContext: { title: string; tone: string; style: string }
): Promise<string> => {
  const agentManager = AgentManager.getInstance();
  const modelName = "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

  // 1. Initialize Art Director Agent
  const systemInstruction = DEFAULT_SYSTEM_INSTRUCTIONS[AgentRole.ART_DIRECTOR];

  const chatSession = agentManager.getAgent(AgentRole.ART_DIRECTOR, model, systemInstruction, {
    model: modelName,
    dynamicPrompt: systemInstruction,
    finalPrompt: systemInstruction
  });

  // 2. Construct Request
  let assetDescription = "";
  if (type === 'character') {
    const char = data as import("../types").CharacterTemplate;
    assetDescription = `Role: ${char.role}. Visuals: ${char.visual_seed.description}`;
  } else if (type === 'location') {
    const loc = data as import("../types").LocationTemplate;
    assetDescription = `Type: ${loc.interior_exterior}. Environment: ${loc.environment_prompt}`;
  } else {
    const item = data as import("../types").ItemTemplate;
    assetDescription = `Type: ${item.type}. Description: ${item.description}. Visuals: ${item.visual_details}`;
  }

  const userRequest = `
    PROJECT CONTEXT:
    Title: ${projectContext.title}
    Style: ${projectContext.style}
    Tone: ${projectContext.tone}

    TASK:
    Generate a photorealistic image prompt for:
    Type: ${type.toUpperCase()}
    Name: ${data.name}
    Details: ${assetDescription}

    OUTPUT JSON: { "prompt": "..." }
  `;

  // 3. Get Prompt from Art Director
  const messageId = crypto.randomUUID();
  logDebug('req', `Art Director Agent: Generating prompt for ${data.name}`, { type }, {
    model: modelName,
    agentRole: AgentRole.ART_DIRECTOR,
    linkedMessageId: messageId
  });

  const responseText = await agentManager.sendMessage(AgentRole.ART_DIRECTOR, chatSession, userRequest, [], {
    model: modelName,
    messageId: messageId
  });

  const responseJson = JSON.parse(responseText);
  const imagePrompt = responseJson.prompt;

  logDebug('info', `Art Director Agent: Prompt Generated`, { prompt: imagePrompt });

  // 4. Generate Image via Replicate
  // Aspect Ratio: 1:1 for Characters (Profile) and Items, 16:9 for Locations (Cinematic)
  const aspectRatio = type === 'location' ? '16:9' : '1:1';

  // Add style keywords to ensure consistency
  const finalImagePrompt = `${imagePrompt}, ${projectContext.style}, high quality, 8k`;

  const imageUrl = await generateImage(finalImagePrompt, aspectRatio, {
    agentRole: AgentRole.ART_DIRECTOR,
    linkedMessageId: messageId
  });

  logDebug('res', `Art Director Agent: Image Generated`, { imageUrl });

  return imageUrl;
};


// --- 16. Generate Veo Prompt (Videographer Agent) ---



// --- 16. Generate Veo Prompt (Videographer Agent) ---
export const generateVideoPrompt = async (
  shot: import("../types").ShotTemplate,
  sceneContext: string,
  style: string
): Promise<string> => {
  const agentManager = AgentManager.getInstance();
  const modelName = "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "text/plain" } });

  const systemInstruction = DEFAULT_SYSTEM_INSTRUCTIONS[AgentRole.PROMPT_ENGINEER_VEO];

  // Get or Create PROMPT_ENGINEER_VEO Agent
  const chatSession = agentManager.getAgent(AgentRole.PROMPT_ENGINEER_VEO, model, systemInstruction, {
    model: modelName,
    dynamicPrompt: systemInstruction,
    finalPrompt: systemInstruction
  });

  const prompt = `
    INPUT DATA:
    - Shot Type: ${shot.composition.shot_type}
    - Camera Movement: ${shot.composition.camera_movement}
    - Action Description: ${shot.content.ui_description}
    - Scene Context: ${sceneContext}
    - Style: ${style}
    - Dialogue: ${shot.audio.dialogue?.map(d => `"${d.text}"`).join(' ') || "None"}
    - SFX: ${shot.audio.specificAudioCues || "None"}
  `;

  // INTERCEPT FOR REVIEW
  const finalPrompt = await checkReviewMode(prompt, 'Prompt Engineer Veo: Generate Prompt');

  const messageId = crypto.randomUUID();
  logDebug('req', 'Prompt Engineer Veo Agent: Generate Prompt', { shotId: shot.id }, {
    model: modelName,
    finalPrompt: finalPrompt,
    agentRole: AgentRole.PROMPT_ENGINEER_VEO,
    linkedMessageId: messageId
  });

  const text = await agentManager.sendMessage(AgentRole.PROMPT_ENGINEER_VEO, chatSession, finalPrompt, [], {
    model: modelName,
    finalPrompt: finalPrompt,
    dynamicPrompt: prompt,
    messageId: messageId
  });

  logDebug('res', 'Prompt Engineer Veo Agent: Prompt Generated', { text }, {
    agentRole: AgentRole.PROMPT_ENGINEER_VEO,
    linkedMessageId: messageId
  });

  return text.trim();
};

// --- 17. Validate Continuity (Script Supervisor Agent) ---
export const validateContinuity = async (
  project: import("../types").ProjectBackbone
): Promise<import("../types").AssetChangeAnalysis> => {
  const agentManager = AgentManager.getInstance();
  const modelName = "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

  const systemInstruction = DEFAULT_SYSTEM_INSTRUCTIONS[AgentRole.SCRIPT_SUPERVISOR];
  const session = agentManager.getAgent(AgentRole.SCRIPT_SUPERVISOR, model, systemInstruction, {
    model: modelName,
    dynamicPrompt: systemInstruction,
    finalPrompt: systemInstruction
  });

  const request = `
      PROJECT CONTEXT:
      Title: ${project.meta_data.title}
      Tone: ${project.config.tone_style}
      
      SCRIPT TO VALIDATE:
      ${JSON.stringify(project.database.scenes.map(s => ({
    slugline: s.slugline,
    action: s.script_content?.lines.filter(l => l.type === 'action').map(l => l.content).join(' '),
    dialogue: s.script_content?.lines.filter(l => l.type === 'dialogue').map(l => `${l.speaker}: ${l.content}`).join('\n')
  })))}

      TASK:
      Analyze the script for continuity errors, plot holes, and tone inconsistencies.
      
      OUTPUT JSON:
      {
        "status": "CONFIRMED" | "QUESTION",
        "reasoning": "...",
        "questions": [ { "id": "1", "text": "...", "options": ["..."] } ]
      }
    `;

  // INTERCEPT FOR REVIEW
  const finalPrompt = await checkReviewMode(request, 'Script Supervisor: Validate Continuity');
  const msgId = crypto.randomUUID();

  logDebug('req', 'Script Supervisor: Validate Continuity', {}, {
    model: modelName,
    agentRole: AgentRole.SCRIPT_SUPERVISOR,
    linkedMessageId: msgId
  });

  const response = await agentManager.sendMessage(AgentRole.SCRIPT_SUPERVISOR, session, finalPrompt, [], {
    model: modelName,
    messageId: msgId
  });

  const json = JSON.parse(response);
  logDebug('res', 'Script Supervisor: Validation Complete', { json }, { linkedMessageId: msgId });

  return json;
};
