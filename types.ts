
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
  description: string; // Action lines
  lighting: string;
  weather: string;

  // 4. Audio
  dialogue: string;
  narration: string;
  sfx: string;
  music: string;

  // 5. Post/Trans
  transition: string;

  // Relational Data
  locationAssetId?: string; // Link to the Master Location Asset
  usedAssetIds: string[]; // IDs of characters/items in this specific shot

  // App State
  imageUri?: string;
  videoUri?: string;
  isGenerating?: boolean;
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
  script: Scene[];
  stylePrompt: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  assets: Asset[];
  isAssetsGenerated: boolean;
  refineQuestions?: RefineQuestion[];
  refineAnswers?: Record<string, string>;
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

export const PRESET_STYLES = [
  { name: 'Cinematic Realistic', prompt: 'Cinematic lighting, photorealistic, 8k, highly detailed, movie still' },
  { name: 'Studio Ghibli Anime', prompt: 'Studio Ghibli style, hand painted' },
  { name: 'Watercolor', prompt: 'Watercolor painting, artistic, soft edges, pastel colors' },
  { name: 'Cyberpunk', prompt: 'Cyberpunk, neon lights, futuristic, high contrast, sci-fi atmosphere' },
  { name: 'Pixel Art', prompt: 'Pixel art, 16-bit, retro game style, vibrant' },
  { name: 'Black & White Noir', prompt: 'Film noir, black and white, dramatic shadows, high contrast, vintage' },
];
