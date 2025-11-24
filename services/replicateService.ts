import { AspectRatio } from '../types';

const REPLICATE_API_TOKEN = import.meta.env.VITE_REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN) {
    console.warn("Missing VITE_REPLICATE_API_TOKEN in .env.local");
}

export const generateReplicateVideo = async (
    imageUri: string,
    prompt: string,
    aspectRatio: AspectRatio
): Promise<{ localUri: string, remoteUri: string }> => {
    if (!REPLICATE_API_TOKEN) {
        throw new Error("Replicate API Token is missing. Please check your .env.local file.");
    }

    // Use proxy path to avoid CORS
    const url = "/api/replicate/v1/models/google/veo-3.1-fast/predictions";

    const headers = {
        "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "wait"
    };

    const body = {
        input: {
            image: imageUri,
            prompt: prompt,
        }
    };

    console.log("Generating video with Replicate (veo-3.1-fast)...");

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            console.error("Replicate Error:", err);
            throw new Error(`Replicate API Error: ${err.detail || response.statusText}`);
        }

        const prediction = await response.json();

        if (prediction.status === "succeeded") {
            const videoUrl = prediction.output;
            return { localUri: videoUrl, remoteUri: videoUrl };
        } else if (prediction.status === "failed") {
            throw new Error(`Generation failed: ${prediction.error}`);
        } else {
            return await pollPrediction(prediction.urls.get, headers);
        }

    } catch (error: any) {
        console.error("Replicate Generation Failed:", error);
        throw error;
    }
};

const pollPrediction = async (url: string, headers: any): Promise<{ localUri: string, remoteUri: string }> => {
    const maxAttempts = 60;
    const delay = 2000;

    // Rewrite URL to use proxy
    const proxyUrl = url.replace('https://api.replicate.com', '/api/replicate');

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, delay));

        const response = await fetch(proxyUrl, { headers });
        if (!response.ok) throw new Error("Polling failed");

        const prediction = await response.json();

        if (prediction.status === "succeeded") {
            return { localUri: prediction.output, remoteUri: prediction.output };
        } else if (prediction.status === "failed") {
            throw new Error(`Generation failed: ${prediction.error}`);
        }
    }
    throw new Error("Generation timed out");
};
