import { ElevenLabsVoice } from '../types';
import { logDebug } from './geminiService';

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';

if (!API_KEY) {
    console.warn("ElevenLabs API Key is missing. Please add VITE_ELEVENLABS_API_KEY to your .env.local file.");
}

/**
 * Fetch available voices from ElevenLabs
 */
export const getVoices = async (): Promise<ElevenLabsVoice[]> => {
    if (!API_KEY) {
        console.warn("ElevenLabs API Key is missing");
        return [];
    }

    logDebug('req', 'ElevenLabs: Fetch Voices', { url: `${BASE_URL}/voices` });
    try {
        const response = await fetch(`${BASE_URL}/voices`, {
            method: 'GET',
            headers: {
                'xi-api-key': API_KEY,
                'Content-Type': 'application/json',
            },
        });

        logDebug('info', 'ElevenLabs: Fetch Voices Status', { status: response.status });

        if (!response.ok) {
            throw new Error(`Failed to fetch voices: ${response.statusText}`);
        }

        const data = await response.json();
        logDebug('res', 'ElevenLabs: Voices Fetched', { count: data.voices?.length });
        return data.voices as ElevenLabsVoice[];
    } catch (error) {
        console.error("Error fetching ElevenLabs voices:", error);
        logDebug('error', 'ElevenLabs: Fetch Voices Failed', error);
        throw error;
    }
};

/**
 * Generate speech from text using a specific voice
 */
export const generateSpeech = async (text: string, voiceId: string): Promise<string> => {
    if (!API_KEY) throw new Error("ElevenLabs API Key is missing");

    logDebug('req', 'ElevenLabs: Generate Speech', { voiceId, textLength: text.length, model: "eleven_turbo_v2" });

    try {
        const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_turbo_v2", // Optimized for low latency
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`TTS Generation failed: ${errorData.detail?.message || response.statusText}`);
        }

        const blob = await response.blob();
        logDebug('res', 'ElevenLabs: Speech Generated', { size: blob.size, type: blob.type });

        // Convert Blob to Base64 Data URI for persistence
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error generating speech:", error);
        logDebug('error', 'ElevenLabs: Generate Speech Failed', error);
        throw error;
    }
};
