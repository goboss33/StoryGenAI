import React, { useState, useEffect, useRef } from 'react';
import { ElevenLabsVoice } from '../types';
import { getVoices } from '../services/elevenLabsService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelectVoice: (voice: ElevenLabsVoice) => void;
    currentVoiceId?: string;
    variant?: 'modal' | 'embedded';
}

const VoiceLibrarySidebar: React.FC<Props> = ({ isOpen, onClose, onSelectVoice, currentVoiceId, variant = 'modal' }) => {
    const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [playingPreview, setPlayingPreview] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if ((isOpen || variant === 'embedded') && voices.length === 0) {
            loadVoices();
        }
    }, [isOpen, variant]);

    const loadVoices = async () => {
        setLoading(true);
        try {
            const fetchedVoices = await getVoices();
            setVoices(fetchedVoices);
        } catch (error) {
            console.error("Failed to load voices", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlayPreview = (previewUrl: string, voiceId: string) => {
        if (playingPreview === voiceId) {
            audioRef.current?.pause();
            setPlayingPreview(null);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            const audio = new Audio(previewUrl);
            audio.onended = () => setPlayingPreview(null);
            audio.play();
            audioRef.current = audio;
            setPlayingPreview(voiceId);
        }
    };

    const filteredVoices = voices.filter(voice =>
        voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        voice.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const content = (
        <div className={`h-full flex flex-col bg-white ${variant === 'modal' ? 'shadow-2xl' : 'border-r border-slate-200'}`}>
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-800">Voice Library</h2>
                {variant === 'modal' && (
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="p-4 border-b border-slate-100">
                <div className="relative">
                    <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                        type="text"
                        placeholder="Search voices..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Voice List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full"></div>
                    </div>
                ) : (
                    filteredVoices.map(voice => (
                        <div
                            key={voice.voice_id}
                            onClick={() => variant === 'embedded' && onSelectVoice(voice)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer ${currentVoiceId === voice.voice_id
                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                                : 'border-slate-200 hover:border-indigo-300 hover:shadow-sm bg-white'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-slate-800">{voice.name}</h3>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">
                                        {voice.category}
                                    </span>
                                </div>
                                {voice.preview_url && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handlePlayPreview(voice.preview_url, voice.voice_id);
                                        }}
                                        className={`p-2 rounded-full transition-colors ${playingPreview === voice.voice_id
                                            ? 'bg-indigo-100 text-indigo-600'
                                            : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
                                            }`}
                                    >
                                        {playingPreview === voice.voice_id ? (
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        )}
                                    </button>
                                )}
                            </div>

                            {variant === 'modal' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectVoice(voice);
                                        onClose();
                                    }}
                                    className="w-full py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-indigo-600 hover:text-white hover:border-transparent transition-colors text-sm"
                                >
                                    Select Voice
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    if (variant === 'embedded') {
        return <div className="w-80 h-full flex-shrink-0">{content}</div>;
    }

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
                    onClick={onClose}
                />
            )}
            <div className={`fixed top-0 right-0 h-full w-96 bg-white z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {content}
            </div>
        </>
    );
};

export default VoiceLibrarySidebar;
