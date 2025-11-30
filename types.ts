
export interface Scene {
  id: string;
  sceneId: string; // Relational ID to group shots into a single Scene event
  number: number;

  // 1. Technical Info
  location: string; // slugline text e.g. EXT. FOREST - DAY
  time: string; // DAY, NIGHT, DAWN, DUSK
  sceneContext: string; // Global context of the scene
  duration: number;

  // 2. Camera / Framing
  shotType: string;
  cameraAngle: string;
  cameraMovement: string;
  compositionTags: string[]; // Replaces visualStyle

  // 3. Visual Action
  // 3. Visual Action
  // description: string; // REMOVED: Use actionData instead
  actionData?: {
    baseEnvironment: string;
    characterActions: { castId: string; action: string }[];
    itemStates: { itemId: string; state: string }[];
  };
  lighting: string;
  weather: string;

  // 4. Audio
  dialogue: string;
  narration: string;
  sfx: string;
  music: string;

  // 5. Post/Trans
  transition: string;
  veoMotionPrompt: string; // Instructions spécifiques pour l'animation vidéo (Veo)

  // Relational Data
  locationAssetId?: string; // Link to the Master Location Asset
  usedAssetIds: string[]; // IDs of characters/items in this specific shot

  // App State
  imageUri?: string;
  videoUri?: string;
  remoteVideoUri?: string; // Google Cloud URI for Veo extension
  isGenerating?: boolean;
  sceneStoryboardUri?: string;
  storyboardPanelUri?: string;
  storyboardPanelDimensions?: { width: number; height: number };
}

export interface AssetMapping {
  assetId: string;
  text: string;
}

export enum AssetType {
  CHARACTER = 'Character',
  LOCATION = 'Location',
  ITEM = 'Item'
}

export interface AssetVisuals {
  subject: string;
  details: string;
  expression?: string;
  clothing?: string;
  material?: string;
  atmosphere?: string;
  pose: string;
  constraint: string;
  background: string;
  lighting: string;
  style?: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  visuals: AssetVisuals;
  imageUri?: string;
  status?: 'pending' | 'generating' | 'complete' | 'error';
  // Hierarchy Fields
  parentId?: string;
  locationType?: 'MASTER' | 'SUB';
  description?: string;
}

export interface RefineQuestion {
  id: string;
  text: string;
  options: string[];
}

export type Pacing = 'slow' | 'standard' | 'fast';

export interface StoryState {
  step: number;
  idea: string;
  totalDuration: number;
  pacing: Pacing;
  language: string;
  tone: string;
  targetAudience: string;
  videoType: string; // [NEW] Type of video (ad, vlog, etc.)
  visualStyle: string; // [NEW] Selected visual style name
  storyAnalysis?: ScreenplayStructure;
  project?: ProjectBackbone;
  originalDatabase?: ProjectBackbone['database']; // [NEW] Track original state for change detection
  script: Scene[];
  stylePrompt: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  assets: Asset[];
  isAssetsGenerated: boolean;
  refineQuestions?: RefineQuestion[];
  refineAnswers?: Record<string, string>;
  audioScript?: AudioScriptItem[];
}

export interface AssetChangeAnalysis {
  status: 'CONFIRMED' | 'QUESTION';
  reasoning: string;
  questions?: RefineQuestion[];
}

export interface AudioScriptItem {
  id: string;
  speaker: string;
  text: string;
  tone: string;
  durationEstimate: number;
  voiceId?: string;
  voiceName?: string;
  audioUri?: string;
  isBreak?: boolean;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string;
  labels?: Record<string, string>;
}

export type AspectRatio = '16:9' | '9:16' | '1:1';

export const PRESET_STYLES = [
  { name: 'Cinematic Realistic', prompt: 'Cinematic lighting, photorealistic, 8k, highly detailed, movie still', image: 'https://placehold.co/320x180/1a1a1a/ffffff?text=Cinematic' },
  { name: 'Studio Ghibli Anime', prompt: 'Studio Ghibli style, hand painted, vibrant colors, detailed background', image: 'https://placehold.co/320x180/2c3e50/ffffff?text=Ghibli' },
  { name: 'Pixar 3D', prompt: 'Pixar style 3D animation, cute, vibrant, high quality render, soft lighting', image: 'https://placehold.co/320x180/e67e22/ffffff?text=Pixar' },
  { name: 'Watercolor', prompt: 'Watercolor painting, artistic, soft edges, pastel colors', image: 'https://placehold.co/320x180/3498db/ffffff?text=Watercolor' },
  { name: 'Cyberpunk', prompt: 'Cyberpunk, neon lights, futuristic, high contrast, sci-fi atmosphere', image: 'https://placehold.co/320x180/8e44ad/ffffff?text=Cyberpunk' },
  { name: 'Pixel Art', prompt: 'Pixel art, 16-bit, retro game style, vibrant', image: 'https://placehold.co/320x180/27ae60/ffffff?text=Pixel+Art' },
  { name: 'Black & White Noir', prompt: 'Film noir, black and white, dramatic shadows, high contrast, vintage', image: 'https://placehold.co/320x180/000000/ffffff?text=Noir' },
  { name: '2D Cartoon', prompt: 'Classic 2D cartoon style, bold lines, flat colors, expressive', image: 'https://placehold.co/320x180/f1c40f/ffffff?text=Cartoon' },
];

export const VIDEO_TYPES = [
  { id: 'ad', label: 'Publicité' },
  { id: 'vlog', label: 'Vlog' },
  { id: 'cartoon', label: 'Dessin Animé' },
  { id: 'tutorial', label: 'Tutoriel' },
  { id: 'documentary', label: 'Documentaire' },
  { id: 'movie', label: 'Court Métrage' },
  { id: 'music_video', label: 'Clip Musical' },
];

export const TONES = [
  "Drôle", "Sérieux", "Épique", "Inspirant", "Éducatif", "Dramatique", "Mystérieux", "Energique"
];

export const TARGET_AUDIENCES = [
  "Tout public", "Enfants", "Ados", "Jeunes Adultes", "Professionnels", "Seniors", "Passionnés de Tech", "Voyageurs"
];

// --- AGENT SYSTEM TYPES ---
export enum AgentRole {
  DIRECTOR = 'Director',
  SCREENWRITER = 'Screenwriter',
  REVIEWER = 'Reviewer',
  DESIGNER = 'Designer'
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  agentRole: AgentRole;
  content: string;
  timestamp: number;
  // Metadata for Debug Console
  model?: string;
  dynamicPrompt?: string;
  finalPrompt?: string;
  data?: any; // Parsed JSON content
}

// --- ADVANCED PROMPT ENGINEERING STRUCTURES ---

export interface ScreenplayCharacter {
  name: string;
  role: string; // e.g., "Protagonist", "Antagonist", "Mentor"
  description: string; // Physical & Personality traits
}

export interface ScreenplayDialogue {
  speaker: string;
  text: string;
  parenthetical?: string; // e.g., (ironically), (coughing)
  type: 'normal' | 'VO' | 'OS'; // VO = Voice Over, OS = Off Screen
}

export interface ScreenplayScene {
  slugline: {
    intExt: 'INT.' | 'EXT.';
    location: string;
    time: string; // DAY, NIGHT, DAWN, etc.
    weather?: string;
  };
  visualStyle: {
    cameraShot: string; // e.g., "Wide Shot", "Close Up"
    lighting: string;
    angle: string;
    transition?: string; // CUT TO:, FADE OUT:
  };
  characters: ScreenplayCharacter[];
  actionSummary: string; // The "Big Print" - what happens
  dialogueSamples: ScreenplayDialogue[];
}

export interface ScreenplayStructure {
  title: string;
  author: string;
  logline: string;
  genre: string;
  themes: string[];
  scenes: ScreenplayScene[];
}

// --- PROJECT BACKBONE STRUCTURES ---

export interface CharacterTemplate {
  id: string;
  name: string;
  role: string; // e.g., "Protagonist"
  visual_seed: {
    description: string;
    ref_image_url?: string;
  };
  voice_config?: {
    provider: string;
    voice_id: string;
    stability: number;
    similarity_boost: number;
  };
}

export interface LocationTemplate {
  id: string;
  name: string;
  environment_prompt: string;
  interior_exterior: 'INT' | 'EXT';
  ref_image_url?: string;
}

export interface ShotTemplate {
  shot_index: number;
  id: string;
  duration_sec: number; // Exact duration of the shot
  composition: {
    shot_type: string; // Wide, Medium, Close-up
    camera_movement: string; // Pan, Tilt, Static, Zoom
    angle: string; // Eye level, Low angle
  };
  content: {
    ui_description: string;
    characters_in_shot: string[]; // IDs
    final_image_prompt: string; // Detailed static image prompt
    video_motion_prompt: string; // Detailed Veo animation prompt
    seed?: number;
  };
  audio: {
    // Context of what is heard during this shot (Dialogue, VO, SFX)
    audio_context: string;
    specificAudioCues?: string; // Specific sound effects or cues
    is_voice_over: boolean;
    dialogue?: {
      speaker: string;
      text: string;
      tone: string;
    }[];
  };
  video_generation: {
    status: 'pending' | 'processing' | 'ready';
    video_file_url?: string;
  };
}

export interface ScriptLine {
  id: string;
  type: 'action' | 'dialogue' | 'parenthetical' | 'transition' | 'slugline';
  content: string;
  speaker?: string;
  parenthetical?: string;
  metadata?: any;
}

export interface SceneTemplate {
  scene_index: number;
  id: string;
  slugline: string;
  slugline_elements?: {
    int_ext: 'INT.' | 'EXT.';
    location: string;
    time: string;
  };
  synopsis?: string;
  location_ref_id: string;
  narrative_goal: string;
  estimated_duration_sec: number; // Total duration of the scene
  script_content?: {
    lines: ScriptLine[];
  };
  shots: ShotTemplate[];
}

export interface ProjectBackbone {
  project_id: string;
  meta_data: {
    title: string;
    created_at: string;
    user_intent: string;
  };
  config: {
    aspect_ratio: '16:9' | '9:16' | '1:1';
    resolution: string;
    target_fps: number;
    primary_language: string;
    target_audience: string;
    tone_style: string;
  };
  global_assets: {
    art_style_prompt: string;
    negative_prompt: string;
    music_theme_id?: string;
  };
  database: {
    characters: CharacterTemplate[];
    locations: LocationTemplate[];
    scenes: SceneTemplate[];
  };
  final_render: {
    total_duration_sec: number;
    video_file_url?: string;
  };
}


