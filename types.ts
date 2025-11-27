
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
  storyAnalysis?: ScreenplayStructure;
  project?: ProjectBackbone;
  script: Scene[];
  stylePrompt: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  assets: Asset[];
  isAssetsGenerated: boolean;
  refineQuestions?: RefineQuestion[];
  refineAnswers?: Record<string, string>;
  audioScript?: AudioScriptItem[];
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

export type AspectRatio = '16:9' | '9:16';

export const PRESET_STYLES = [
  { name: 'Cinematic Realistic', prompt: 'Cinematic lighting, photorealistic, 8k, highly detailed, movie still' },
  { name: 'Studio Ghibli Anime', prompt: 'Studio Ghibli style, hand painted' },
  { name: 'Watercolor', prompt: 'Watercolor painting, artistic, soft edges, pastel colors' },
  { name: 'Cyberpunk', prompt: 'Cyberpunk, neon lights, futuristic, high contrast, sci-fi atmosphere' },
  { name: 'Pixel Art', prompt: 'Pixel art, 16-bit, retro game style, vibrant' },
  { name: 'Black & White Noir', prompt: 'Film noir, black and white, dramatic shadows, high contrast, vintage' },
];

export const TONES = [
  "Drôle", "Sérieux", "Épique", "Inspirant", "Éducatif", "Dramatique", "Mystérieux", "Energique"
];

export const TARGET_AUDIENCES = [
  "Tout public", "Enfants", "Ados", "Jeunes Adultes", "Professionnels", "Seniors", "Passionnés de Tech", "Voyageurs"
];

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
}

export interface ShotTemplate {
  shot_index: number;
  id: string;
  composition: {
    shot_type: string; // Wide, Medium, Close-up
    camera_movement: string; // Pan, Tilt, Static, Zoom
    angle: string; // Eye level, Low angle
  };
  content: {
    ui_description: string;
    characters_in_shot: string[]; // IDs
    final_image_prompt: string;
    seed?: number;
  };
  audio: {
    type: 'dialogue' | 'sfx' | 'silence';
    speaker_ref_id?: string;
    text_content?: string;
    audio_file_url?: string;
    duration_exact_sec?: number;
  };
  video_generation: {
    motion_strength: number;
    video_file_url?: string;
    status: 'pending' | 'processing' | 'ready';
  };
}

export interface SceneTemplate {
  scene_index: number;
  id: string;
  slugline: string;
  location_ref_id: string;
  narrative_goal: string;
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


