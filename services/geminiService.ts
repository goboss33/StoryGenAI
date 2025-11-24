
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Scene, Asset, AssetType, Pacing, RefineQuestion } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// --- LOGGING INFRASTRUCTURE ---
type LogType = 'req' | 'res' | 'info' | 'error';
type LogListener = (log: { type: LogType; title: string; data: any; timestamp: number }) => void;
let listeners: LogListener[] = [];

export const subscribeToDebugLog = (listener: LogListener) => {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
};

const logDebug = (type: LogType, title: string, data: any) => {
  const payload = { type, title, data, timestamp: Date.now() };
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

  if (specialCost) {
    cost += specialCost;
  }

  const stats: UsageStats = { inputTokens, outputTokens, cost };
  usageListeners.forEach(l => l(stats));
};

// --- 1. Generate Script (Relational Architecture) ---
export const generateScript = async (
  idea: string,
  totalDuration: number,
  pacing: Pacing,
  language: string = 'English'
): Promise<{ script: Scene[], assets: Asset[] }> => {
  try {

    // NEW STRICT SYSTEM PROMPT (Hierarchy & Reusability Rules)
    let prompt = `
      Role: Expert Director & Production Asset Manager.
      Task: Write a screenplay based on the user's concept: "${idea}". Then extract the PRODUCTION DATABASE (World Assets).
      Constraints: ${totalDuration}s total duration, ${pacing} pacing, ${language} language.

      PHASE 1: WRITE THE SCRIPT (Strict Spatial Segmentation)
      - Write the script as a series of SEQUENCES.
      
      **VISUAL DYNAMISM INSTRUCTION (${pacing.toUpperCase()} PACING):**
      ${pacing === 'fast'
        ? "- High Energy: Force frequent location changes. Do not linger in one room for the whole story. Move the characters through different environments to keep the visual flow dynamic."
        : pacing === 'slow'
          ? "- Atmospheric: Focus on depth within locations. Allow scenes to breathe, but ensure camera angles vary significantly to maintain interest."
          : "- Balanced Flow: Mix stable character moments with environment changes to drive the narrative forward."
      }

      - **DEFINITION OF A SEQUENCE:** A sequence is a container for shots that occur in ONE single, continuous physical location with a consistent lighting environment.
      - **THE THRESHOLD RULE:** You MUST start a NEW Sequence ID (e.g., from 'seq_1' to 'seq_2') the instant the camera or characters cross a physical boundary:
          1. Moving from **Interior to Exterior** (or vice versa).
          2. Moving from one distinct room to another.
          3. Moving from a static ground location to a moving vehicle location.
      - **Constraint:** Never group shots with different Location IDs into the same Sequence. One Sequence = One Location ID.
      - Break sequences into SHOTS.
      
      **REQUIRED SHOT DATA & RESTRICTIONS:**
      For every shot, you MUST provide the full set of production data:
          - **Shot Type:** You must select the shotType STRICTLY from the following provided list: {{valid_shot_types}}.
          - **Camera Angle:** You must select the cameraAngle STRICTLY from the following provided list: {{valid_camera_angles}}.
          
          - **Composition Tags:** Select 1 to 3 visual keywords STRICTLY from the provided list: {{valid_composition_tags}}.
          
          - **Action Description:** You must describe HOW the action looks in the frame. Explicitly include:
              1. **Blocking** (Character's position in the frame, e.g., 'Center', 'Far left').
              2. **Body Language** (Specific pose or gesture).
              3. **Eyeline** (Where the character is looking, e.g., 'Looking off-camera right').
          - **Veo Motion Prompt:** You MUST generate a technical instruction strictly for Image-to-Video generation.
              FORMAT: [Camera Movement] + [Main Subject Action] + [Speed/Dynamics].
              RULES:
              - Do NOT describe static visual details (colors, clothes), only MOVEMENT and PHYSICS.
              - Use cinematography terms: Pan, Tilt, Dolly, Tracking Shot, Static.
              - Describe physics: 'Hair blowing', 'Smoke rising', 'Blinking', 'Running'.
              - Example: 'Slow Dolly In. Character turns head left. Background blur increases.'
          - **Dialogue:** (Text or "" if silent)
          - **Audio/SFX/Music:** (Text or "" if silent)
          - **Camera Movement:** (e.g. "Static", "Pan", "Tracking")
          - **Asset IDs:** (List visibly present castIds/itemIds)
      - If a field is empty, return an empty string "" or empty array []. Do NOT omit the key.

      PHASE 2: EXTRACT THE WORLD (Database Logic)
      Review the script you just wrote and extract assets based on these strict rules:

      RULE 1: FLEXIBLE HIERARCHY (DEFAULT TO MASTER)
      - Default every location to "MASTER".
      - ONLY classify a location as "SUB" (with a parentId) if its Parent Master is VISUALLY PRESENT in another sequence of this script.
      - If a location is autonomous (e.g. an Interior where we never see the Exterior), it is a MASTER. Do not invent parents that are not in the script.

      RULE 2: ASSET CREATION RULES
      - LOCATIONS: MUST be created for EVERY distinct setting used in the script, even if used only once. We need to generate a background for every scene.
      - CHARACTERS & ITEMS: Apply the "Reusability Filter". Only create a specific Asset ID if the element appears in TWO OR MORE shots. If it appears once, describe it in the action text only.

      RULE 3: ABSTRACT ITEM DEFINITION
      - An ITEM is defined as any discrete, recurring element (object, phenomenon, or visual entity) that is distinct from the static geometry of the location.
      - If it moves, changes state, or interacts with characters independently of the background, it is an Item.
      - (Do not create Items for static architectural details).
      - **WEARABLE EXCLUSION:** Objects worn on the body (Armor, Helmets, Backpacks, Clothes, Jewelry) are COSTUMES, NOT Items. Describe them in the Character's visual description.
      - **EXCEPTION:** Only tag a wearable as an Item if it is removed, held in hands, or passed to another character.

      RULE 4: VISUAL DESCRIPTION SANITIZATION (CRITICAL)
      - When extracting assets to the 'world' list, the 'description' field MUST BE PURIFIED.
      - Extract ONLY physical visual attributes (color, shape, texture, materials).
      - REMOVE all narrative context, history, interactions, and verbs of action.
      - Example: If the script says "A golden cheese held by the crow", the Asset description must be "A round wheel of yellow wax cheese", NOT "held by the crow".
    `;

    // --- DYNAMIC PLACEHOLDER REPLACEMENT ---
    prompt = prompt.replace('{{valid_shot_types}}', JSON.stringify(VALID_SHOT_TYPES));
    prompt = prompt.replace('{{valid_camera_angles}}', JSON.stringify(VALID_CAMERA_ANGLES));
    prompt = prompt.replace('{{valid_composition_tags}}', JSON.stringify(VALID_COMPOSITION_TAGS));

    logDebug('req', 'Generate Script Prompt', { prompt });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        sequences: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              locationId: { type: Type.STRING },
              time: { type: Type.STRING },
              weather: { type: Type.STRING },
              lighting: { type: Type.STRING },
              context: { type: Type.STRING },
              shots: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    shotType: { type: Type.STRING },
                    cameraAngle: { type: Type.STRING },
                    movement: { type: Type.STRING },
                    compositionTags: { type: Type.ARRAY, items: { type: Type.STRING } }, // NEW ARRAY FIELD
                    duration: { type: Type.NUMBER },
                    action: { type: Type.STRING },
                    veoMotionPrompt: { type: Type.STRING },
                    dialogue: { type: Type.STRING },
                    sfx: { type: Type.STRING },
                    music: { type: Type.STRING },
                    castIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    itemIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["shotType", "cameraAngle", "movement", "compositionTags", "duration", "action", "veoMotionPrompt", "dialogue", "sfx", "music", "castIds", "itemIds"]
                }
              }
            },
            required: ["id", "locationId", "time", "shots"]
          }
        },
        world: {
          type: Type.OBJECT,
          properties: {
            locations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["MASTER", "SUB"] },
                  parentId: { type: Type.STRING, nullable: true },
                  description: { type: Type.STRING }
                },
                required: ["id", "name", "type", "description"]
              }
            },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["id", "name", "description"]
              }
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["id", "name", "description"]
              }
            }
          },
          required: ["locations", "characters", "items"]
        }
      },
      required: ["sequences", "world"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      }
    });

    // Track Usage
    if (response.usageMetadata) {
      trackUsage(
        'gemini-3-pro-preview',
        response.usageMetadata.promptTokenCount || 0,
        response.usageMetadata.candidatesTokenCount || 0
      );
    }

    const text = response.text;
    let data;
    try {
      data = JSON.parse(text || '{}');
      logDebug('res', 'Generate Script Response', data);
    } catch (e) {
      logDebug('error', 'Generate Script JSON Parse Error', { textRaw: text });
      throw new Error("Failed to parse script JSON.");
    }

    if (!data.sequences) throw new Error("No sequences generated");

    const world = data.world || { locations: [], characters: [], items: [] };
    let sequences = data.sequences || [];

    // --- POST-PROCESS: MERGE CONSECUTIVE SEQUENCES ---
    const mergedSequences: any[] = [];
    if (sequences.length > 0) {
      let currentSeq = sequences[0];
      if (!currentSeq.shots) currentSeq.shots = [];

      for (let i = 1; i < sequences.length; i++) {
        const nextSeq = sequences[i];
        if (!nextSeq.shots) nextSeq.shots = [];

        if (nextSeq.locationId === currentSeq.locationId && nextSeq.time === currentSeq.time) {
          currentSeq.shots = [...currentSeq.shots, ...nextSeq.shots];
          if (nextSeq.context && !currentSeq.context.includes(nextSeq.context)) {
            currentSeq.context += " " + nextSeq.context;
          }
        } else {
          mergedSequences.push(currentSeq);
          currentSeq = nextSeq;
        }
      }
      mergedSequences.push(currentSeq);
    }
    sequences = mergedSequences;

    // 1. Build Assets Registry
    const assets: Asset[] = [];

    // Helper to create assets with Hierarchy support
    const createAsset = (def: any, type: AssetType): Asset => ({
      id: def.id,
      name: def.name.toUpperCase(),
      type: type,
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
      const fullSlug = `${locationName} - ${seq.time || 'DAY'}`;
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
          description: shot.action || "",
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
    logDebug('req', 'Generate Image (Gemini 3 Pro)', { prompt, aspectRatio });

    if (!prompt || prompt.trim().length === 0) throw new Error("Prompt cannot be empty");
    const cleanPrompt = prompt.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    const config: any = {
      responseModalities: [Modality.IMAGE]
    };

    if (aspectRatio) {
      config.imageConfig = { aspectRatio: aspectRatio as any };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: cleanPrompt }] },
      config,
    });

    // Track Usage (Image Cost: $0.134)
    trackUsage('gemini-3-pro-image-preview', 0, 0, 0.134);

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    // Check for InlineData (base64)
    if (part && part.inlineData && part.inlineData.data) {
      logDebug('res', 'Generate Image Success', { size: part.inlineData.data.length });
      return `data:image/png;base64,${part.inlineData.data}`;
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
    logDebug('req', 'Edit Image (Gemini 3 Pro)', { prompt, hasMask: !!maskBase64 });
    const { mimeType, data } = parseDataUri(imageUri);
    const parts: any[] = [
      { inlineData: { mimeType, data } },
      { text: prompt }
    ];

    if (maskBase64) {
      const maskData = parseDataUri(maskBase64);
      parts.push({ inlineData: { mimeType: maskData.mimeType, data: maskData.data } });
      parts.push({ text: "Use the black and white image as a mask. White is the area to edit." });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] }
    });

    // Track Usage (Image Cost: $0.134)
    trackUsage('gemini-3-pro-image-preview', 0, 0, 0.134);

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part && part.inlineData && part.inlineData.data) {
      logDebug('res', 'Edit Image Success', { size: part.inlineData.data.length });
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated from edit");
  } catch (error) {
    logDebug('error', 'Edit Image Failed', error);
    console.error("Edit image failed:", error);
    throw error;
  }
};

// --- 5. Generate Video (Veo) ---
export const generateVideo = async (imageUri: string, prompt: string, aspectRatio: '16:9' | '9:16' = '16:9'): Promise<string> => {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) await (window as any).aistudio.openSelectKey();
    } catch (e) { console.warn("AI Studio key check failed", e); }
  }

  logDebug('req', 'Generate Video (Veo)', { prompt, aspectRatio });

  const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const { mimeType, data } = parseDataUri(imageUri);

  try {
    let operation = await veoAi.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || "Animate this scene naturally",
      image: { imageBytes: data, mimeType: mimeType },
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio }
    });

    // Track Usage (Video Cost: $0.15/s * 5s = $0.75)
    trackUsage('veo-3.1-fast-generate-preview', 0, 0, 0.75);

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await veoAi.operations.getVideosOperation({ operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("No video URI returned");

    const videoRes = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    const videoBlob = await videoRes.blob();
    const url = URL.createObjectURL(videoBlob);
    logDebug('res', 'Generate Video Success', { url });
    return url;

  } catch (error: any) {
    logDebug('error', 'Generate Video Failed', error);
    if (error.message && error.message.includes("Requested entity was not found") && (window as any).aistudio) {
      try { await (window as any).aistudio.openSelectKey(); throw new Error("API Key refreshed. Please try again."); } catch (e) { /* ignore */ }
    }
    console.error("Video generation failed:", error);
    throw error;
  }
};

// --- 5b. Generate Plan Video (Veo 3.1 Preview with Duration) ---
export const generatePlanVideo = async (
  imageUri: string,
  prompt: string,
  aspectRatio: '16:9' | '9:16',
  duration: number
): Promise<{ localUri: string; remoteUri: string }> => {
  // Validate aspect ratio (only 16:9 and 9:16 supported)
  if (aspectRatio !== '16:9' && aspectRatio !== '9:16') {
    throw new Error(`Aspect ratio ${aspectRatio} not supported. Only 16:9 and 9:16 are allowed.`);
  }

  // Validate duration (Veo supports 1-8 seconds for preview model)
  const clampedDuration = Math.min(Math.max(duration, 1), 8);

  if (typeof window !== 'undefined' && (window as any).aistudio) {
    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) await (window as any).aistudio.openSelectKey();
    } catch (e) { console.warn("AI Studio key check failed", e); }
  }

  logDebug('req', 'Generate Plan Video (Veo 3.1)', { prompt, aspectRatio, duration: clampedDuration });

  const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const { mimeType, data } = parseDataUri(imageUri);

  try {
    let operation = await veoAi.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: prompt || "Animate this scene naturally",
      image: { imageBytes: data, mimeType: mimeType },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio,
        duration: `${clampedDuration}s`
      } as any // Cast to any because duration is not yet in type definitions
    });

    // Track Usage (Video Cost varies by duration: ~$0.15/s)
    const estimatedCost = clampedDuration * 0.15;
    trackUsage('veo-3.1-generate-preview', 0, 0, estimatedCost);

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await veoAi.operations.getVideosOperation({ operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("No video URI returned");

    // Fetch video and convert to base64 data URI for storage
    const videoRes = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    const videoBlob = await videoRes.blob();

    // Convert blob to base64 data URI
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(videoBlob);
    });

    logDebug('res', 'Generate Plan Video Success', { size: base64.length, duration: clampedDuration, remoteUri: videoUri });
    return { localUri: base64, remoteUri: videoUri };

  } catch (error: any) {
    logDebug('error', 'Generate Plan Video Failed', error);
    if (error.message && error.message.includes("Requested entity was not found") && (window as any).aistudio) {
      try {
        await (window as any).aistudio.openSelectKey();
        throw new Error("API Key refreshed. Please try again.");
      } catch (e) { /* ignore */ }
    }
    console.error("Plan video generation failed:", error);
    throw error;
  }
};

// --- 5c. Extend Video (Veo 3.1) ---
export const extendVideo = async (
  remoteVideoUri: string,
  prompt: string,
  aspectRatio: '16:9' | '9:16'
): Promise<{ localUri: string; remoteUri: string }> => {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) await (window as any).aistudio.openSelectKey();
    } catch (e) { console.warn("AI Studio key check failed", e); }
  }

  logDebug('req', 'Extend Video (Veo 3.1)', { prompt, aspectRatio, sourceUri: remoteVideoUri });

  const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  try {
    // Note: The input video must be a Google Cloud URI from a previous generation
    // We cannot use a local blob or base64 here for extension in the current API version
    // if it requires a file URI.
    // Assuming the API accepts the 'gs://' or 'https://' URI returned by the previous generation.

    let operation = await veoAi.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: prompt || "Continue the action naturally",
      video: {
        fileUri: remoteVideoUri, // Pass the remote URI (File API URI) from the previous generation
      } as any,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio,
        duration: '5s' // Extend by 5 seconds
      } as any
    });

    // Track Usage
    trackUsage('veo-3.1-generate-preview', 0, 0, 0.75);

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await veoAi.operations.getVideosOperation({ operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("No video URI returned");

    const videoRes = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    const videoBlob = await videoRes.blob();

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(videoBlob);
    });

    logDebug('res', 'Extend Video Success', { size: base64.length, remoteUri: videoUri });
    return { localUri: base64, remoteUri: videoUri };

  } catch (error: any) {
    logDebug('error', 'Extend Video Failed', error);
    console.error("Extend video failed:", error);
    throw error;
  }
};

// --- 6. Generate Multimodal Image (Gemini 3 Pro) ---
export const generateMultimodalImage = async (
  prompt: string,
  references: { name: string; data: string; mimeType: string }[],
  aspectRatio?: string // Optional: e.g. "16:9", "1:1". If not provided, AI decides format
): Promise<string> => {
  try {
    logDebug('req', 'Generate Multimodal Image (Gemini 3 Pro)', { prompt, refs: references.map(r => r.name), aspectRatio });
    const parts: any[] = [];
    references.forEach(ref => {
      parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
    });
    parts.push({ text: prompt });

    const config: any = {
      responseModalities: [Modality.IMAGE]
    };

    if (aspectRatio) {
      config.imageConfig = { aspectRatio: aspectRatio as any };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config
    });

    // Track Usage (Image Cost: $0.134)
    trackUsage('gemini-3-pro-image-preview', 0, 0, 0.134);

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part && part.inlineData && part.inlineData.data) {
      logDebug('res', 'Generate Multimodal Success', { size: part.inlineData.data.length });
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No multimodal image generated");
  } catch (error) {
    logDebug('error', 'Multimodal Gen Failed', error);
    console.error("Multimodal gen failed:", error);
    throw error;
  }
};

// --- 7. Outpaint/Resize Image ---
export const outpaintImage = async (imageUri: string, targetAspectRatio: string): Promise<string> => {
  const prompt = `Resize and extend this image to fit a ${targetAspectRatio} aspect ratio. Fill in the background naturally to match the style.`;
  return editImage(imageUri, prompt);
};

// --- 8. Generate Refinement Questions ---
export const generateRefinementQuestions = async (script: Scene[], stylePrompt: string): Promise<RefineQuestion[]> => {
  logDebug('info', 'Refinement Questions Skipped (Not Implemented)', {});
  return [];
};
export const generateBridgeScene = async (prevDesc: string, nextDesc: string, stylePrompt: string): Promise<{ description: string; narration: string }> => {
  return { description: "A transition", narration: "" };
};
