/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string
    readonly VITE_ELEVENLABS_API_KEY: string
    readonly VITE_REPLICATE_API_TOKEN: string
    readonly VITE_USE_MOCK_VEO: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
