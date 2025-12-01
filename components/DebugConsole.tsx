import React, { useEffect, useRef, useState } from 'react';
import { UsageStats, PendingRequestData, subscribeToAgentMessages, getAgentHistory, chatWithAgent, updateAgentSystemInstruction, resetAgentMemory } from '../services/geminiService';
import { AgentRole, AgentMessage } from '../types';

interface LogEntry {
    id: string;
    type: 'req' | 'res' | 'info' | 'error';
    title: string;
    data: any;
    timestamp: number;
    model?: string;
    dynamicPrompt?: string;
    finalPrompt?: string;
    agentRole?: AgentRole;
    linkedMessageId?: string;
}

interface DebugConsoleProps {
    logs: LogEntry[];
    totalUsage: UsageStats;
    isOpen: boolean;
    onClose: () => void;
    onClear: () => void;
    isDetached: boolean;
    onToggleDetach: () => void;
    // For inline mode
    height?: number;
    onResizeStart?: () => void;

    // Review Mode Props (Controlled)
    isReviewMode: boolean;
    onToggleReviewMode: (enabled: boolean) => void;
    pendingRequest: PendingRequestData | null;
    onResolveRequest: (id: string, prompt: string) => void;
    onRejectRequest: (id: string) => void;
}

const JsonViewer: React.FC<{ data: any; level?: number; initialExpandedDepth?: number }> = ({
    data,
    level = 0,
    initialExpandedDepth = 1
}) => {
    const [isExpanded, setIsExpanded] = useState(level < initialExpandedDepth);

    if (data === null) return <span className="text-slate-500">null</span>;
    if (data === undefined) return <span className="text-slate-600">undefined</span>;

    if (typeof data === 'boolean') return <span className="text-purple-400">{data.toString()}</span>;
    if (typeof data === 'number') return <span className="text-blue-400">{data}</span>;
    if (typeof data === 'string') {
        return <span className="text-emerald-400">"{data}"</span>;
    }

    const isArray = Array.isArray(data);
    const isEmpty = isArray ? data.length === 0 : Object.keys(data).length === 0;
    const bracketOpen = isArray ? '[' : '{';
    const bracketClose = isArray ? ']' : '}';

    if (isEmpty) return <span className="text-slate-500">{bracketOpen}{bracketClose}</span>;

    return (
        <div className="inline-block align-top font-mono text-[10px]">
            <span
                className="cursor-pointer hover:text-white text-slate-500 select-none font-bold"
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            >
                {bracketOpen}
                {!isExpanded && <span className="text-slate-600 mx-1">...</span>}
            </span>

            {isExpanded && (
                <div className="pl-3 border-l border-slate-800/50 ml-1 my-0.5">
                    {isArray ? (
                        data.map((item: any, idx: number) => (
                            <div key={idx} className="leading-relaxed">
                                <JsonViewer data={item} level={level + 1} initialExpandedDepth={initialExpandedDepth} />
                                {idx < data.length - 1 && <span className="text-slate-600">,</span>}
                            </div>
                        ))
                    ) : (
                        Object.entries(data).map(([key, value], idx, arr) => (
                            <div key={key} className="leading-relaxed">
                                <span className="text-indigo-300 mr-1">"{key}"</span>
                                <span className="text-slate-600 mr-2">:</span>
                                <JsonViewer data={value} level={level + 1} initialExpandedDepth={initialExpandedDepth} />
                                {idx < arr.length - 1 && <span className="text-slate-600">,</span>}
                            </div>
                        ))
                    )}
                </div>
            )}

            <span
                className="cursor-pointer hover:text-white text-slate-500 select-none font-bold"
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            >
                {isExpanded ? bracketClose : bracketClose}
            </span>
        </div>
    );
};

const HighlightVariables: React.FC<{ text: string }> = ({ text }) => {
    const parts = text.split(/(\{\{.*?\}\})/g);
    return (
        <span>
            {parts.map((part, i) => {
                if (part.startsWith('{{') && part.endsWith('}}')) {
                    return (
                        <span key={i} className="text-amber-400 font-bold">
                            {part}
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};

const LogItem: React.FC<{ log: LogEntry; isSummary?: boolean; onClick?: () => void }> = ({ log, isSummary = false, onClick }) => {
    const [showDynamic, setShowDynamic] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false); // Default collapsed
    const [jsonDepth, setJsonDepth] = useState(1); // Default depth 1
    const [jsonKey, setJsonKey] = useState(0); // To force re-render for expand/collapse all

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleExpandAll = () => {
        setJsonDepth(100);
        setJsonKey(prev => prev + 1);
    };

    const handleCollapseAll = () => {
        setJsonDepth(0);
        setJsonKey(prev => prev + 1);
    };

    // Determine Icon
    const getIcon = () => {
        if (log.agentRole === AgentRole.DIRECTOR || log.title.includes("Director")) return "🎬";
        if (log.agentRole === AgentRole.SCREENWRITER || log.title.includes("Screenwriter")) return "✍️";
        if (log.agentRole === AgentRole.REVIEWER || log.title.includes("Reviewer")) return "⚖️";
        if (log.agentRole === AgentRole.DESIGNER || log.title.includes("Designer")) return "🎨";
        if (log.agentRole === AgentRole.ANALYST || log.title.includes("Analyst")) return "🧐";
        if (log.agentRole === AgentRole.VIDEOGRAPHER || log.title.includes("Videographer")) return "🎥";
        return null;
    };
    const icon = getIcon();

    const hasPrompts = !!log.dynamicPrompt || !!log.finalPrompt;
    const displayContent = showDynamic ? log.dynamicPrompt : log.finalPrompt;
    const isClickable = isSummary && !!log.linkedMessageId;

    // In summary mode, we only show details if expanded
    const showDetails = !isSummary || isExpanded;

    return (
        <div
            className={`flex flex-col gap-1 group border-b border-slate-800/50 pb-2 last:border-0 ${isClickable ? 'cursor-pointer hover:bg-slate-800/30 transition-colors rounded px-1 -mx-1' : ''}`}
            onClick={isClickable ? onClick : () => isSummary && setIsExpanded(!isExpanded)}
        >
            {/* Log Header */}
            <div className="flex items-center gap-2 cursor-pointer">
                <span className="text-slate-600 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`px-1.5 rounded-sm font-bold text-[9px] uppercase ${log.type === 'req' ? 'bg-blue-900 text-blue-300' :
                    log.type === 'res' ? 'bg-emerald-900 text-emerald-300' :
                        log.type === 'error' ? 'bg-red-900 text-red-300' : 'bg-slate-800 text-slate-300'
                    }`}>{log.type}</span>

                <span className={`text-slate-300 font-bold flex items-center gap-2 ${isClickable ? 'group-hover:text-indigo-400 transition-colors' : ''}`}>
                    {icon && <span>{icon}</span>}
                    {log.title}
                </span>

                {/* Model Badge */}
                {log.model && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-indigo-900/50 text-indigo-300 border border-indigo-800/50 font-mono">
                        {log.model}
                    </span>
                )}

                {/* Link Icon for Clickable Logs */}
                {isClickable && (
                    <span className="opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </span>
                )}

                <div className="ml-auto flex items-center gap-2">
                    {/* Expand/Collapse Toggle for Summary Mode */}
                    {isSummary && (
                        <span className="text-slate-600 text-[10px]">
                            {isExpanded ? '▼' : '▶'}
                        </span>
                    )}

                    {/* Prompt Toggle - HIDDEN IN SUMMARY MODE UNLESS EXPANDED */}
                    {showDetails && hasPrompts && (
                        <div className="flex bg-slate-800 rounded overflow-hidden border border-slate-700">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowDynamic(true); }}
                                className={`px-2 py-0.5 text-[9px] font-bold uppercase transition-colors ${showDynamic ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                title="Show Dynamic Prompt (Template)"
                            >
                                Dynamic
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowDynamic(false); }}
                                className={`px-2 py-0.5 text-[9px] font-bold uppercase transition-colors ${!showDynamic ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                title="Show Final Prompt (Sent to AI)"
                            >
                                Final
                            </button>
                        </div>
                    )}

                    <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(JSON.stringify(log.data, null, 2)); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity"
                        title="Copy JSON"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                </div>
            </div>

            {/* Prompt Display (if available) */}
            {showDetails && hasPrompts && displayContent && (
                <div className="bg-slate-950 p-2 rounded border border-slate-800 text-slate-300 whitespace-pre-wrap break-words overflow-hidden select-text text-[10px] font-mono relative">
                    <div className="absolute top-1 right-1 text-[9px] text-slate-600 font-bold uppercase pointer-events-none">
                        {showDynamic ? 'TEMPLATE' : 'PAYLOAD'}
                    </div>
                    {showDynamic ? <HighlightVariables text={displayContent} /> : displayContent}
                </div>
            )}

            {/* Raw Data (JSON) */}
            {showDetails && (
                <div className={`bg-slate-950/50 p-2 rounded border border-slate-800 overflow-x-auto custom-scrollbar transition-all ${hasPrompts && !isExpanded ? 'max-h-20 opacity-70 hover:opacity-100 cursor-pointer' : ''}`}
                    onClick={(e) => { e.stopPropagation(); hasPrompts && !isExpanded && setIsExpanded(true); }}
                >
                    {/* Header with Actions when Expanded */}
                    {isExpanded && (
                        <div className="flex justify-between items-center mb-2 border-b border-slate-800/50 pb-1">
                            <span className="text-[9px] text-slate-500 font-bold uppercase">JSON Data</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleExpandAll(); }}
                                    className="text-[9px] text-indigo-400 hover:text-indigo-300 uppercase font-bold hover:bg-slate-800 px-1 rounded transition-colors"
                                >
                                    Expand All
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCollapseAll(); }}
                                    className="text-[9px] text-slate-500 hover:text-slate-300 uppercase font-bold hover:bg-slate-800 px-1 rounded transition-colors"
                                >
                                    Collapse All
                                </button>
                            </div>
                        </div>
                    )}

                    {hasPrompts && !isExpanded && <div className="text-[9px] text-slate-500 mb-1 uppercase font-bold">Raw Data (Click to expand)</div>}

                    <JsonViewer data={log.data} initialExpandedDepth={jsonDepth} key={jsonKey} />
                </div>
            )}
        </div>
    );
};

const AgentMessageItem: React.FC<{ message: AgentMessage; isHighlighted?: boolean }> = ({ message, isHighlighted }) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const [showDynamic, setShowDynamic] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const itemRef = useRef<HTMLDivElement>(null);

    const hasPrompts = !!message.dynamicPrompt || !!message.finalPrompt;
    const displayContent = showDynamic ? message.dynamicPrompt : message.finalPrompt;
    const hasData = !!message.data;

    // Hide content block if it's just a duplicate of the prompt (User messages usually)
    // If it's a user message and hasPrompts is true, the content IS the prompt, so we hide the raw content block.
    const shouldHideContent = (isUser || isSystem) && hasPrompts && !hasData;

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // Auto-scroll if highlighted
    useEffect(() => {
        if (isHighlighted && itemRef.current) {
            itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isHighlighted]);

    return (
        <div
            ref={itemRef}
            className={`flex flex-col gap-1 p-2 rounded border transition-colors duration-500 ${isSystem ? 'bg-slate-900 border-slate-700' :
                isUser ? 'bg-slate-800/50 border-slate-700 mr-8' : // User = Parent (Full width or slight margin right)
                    'bg-indigo-900/10 border-indigo-900/30 ml-8'   // Model = Child (Indented left)
                } ${isHighlighted ? 'ring-2 ring-amber-500 shadow-lg shadow-amber-900/20' : ''}`}
        >
            <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-bold uppercase px-1.5 rounded ${isSystem ? 'bg-slate-700 text-slate-300' :
                    isUser ? 'bg-emerald-900 text-emerald-300' :
                        'bg-indigo-900 text-indigo-300'
                    }`}>
                    {message.role}
                </span>
                <span className="text-slate-500 text-[9px]">{new Date(message.timestamp).toLocaleTimeString()}</span>

                {/* Model Badge */}
                {message.model && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-indigo-900/50 text-indigo-300 border border-indigo-800/50 font-mono">
                        {message.model}
                    </span>
                )}

                <div className="ml-auto flex items-center gap-2">
                    {/* Prompt Toggle */}
                    {hasPrompts && (
                        <div className="flex bg-slate-800 rounded overflow-hidden border border-slate-700">
                            <button
                                onClick={() => setShowDynamic(true)}
                                className={`px-2 py-0.5 text-[9px] font-bold uppercase transition-colors ${showDynamic ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                title="Show Dynamic Prompt (Template)"
                            >
                                Dynamic
                            </button>
                            <button
                                onClick={() => setShowDynamic(false)}
                                className={`px-2 py-0.5 text-[9px] font-bold uppercase transition-colors ${!showDynamic ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                title="Show Final Prompt (Sent to AI)"
                            >
                                Final
                            </button>
                        </div>
                    )}

                    {/* Copy Button */}
                    <button
                        onClick={() => copyToClipboard(hasData ? JSON.stringify(message.data, null, 2) : message.content)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity"
                        title="Copy Content"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                </div>
            </div>

            {/* Prompt Display (if available) */}
            {hasPrompts && displayContent && (
                <div className="bg-slate-950 p-2 rounded border border-slate-800 text-slate-300 whitespace-pre-wrap break-words overflow-hidden select-text text-[10px] font-mono relative mb-2">
                    <div className="absolute top-1 right-1 text-[9px] text-slate-600 font-bold uppercase pointer-events-none">
                        {showDynamic ? 'TEMPLATE' : 'PAYLOAD'}
                    </div>
                    {showDynamic ? <HighlightVariables text={displayContent} /> : displayContent}
                </div>
            )}

            {/* Content / Data Display */}
            {!shouldHideContent && (
                hasData ? (
                    <div className="bg-slate-950/50 p-2 rounded border border-slate-800 overflow-x-auto custom-scrollbar">
                        <JsonViewer data={message.data} initialExpandedDepth={1} />
                    </div>
                ) : (
                    <div className="text-xs font-mono whitespace-pre-wrap text-slate-300">
                        {message.content}
                    </div>
                )
            )}
        </div>
    );
};

const DebugConsole: React.FC<DebugConsoleProps> = ({
    logs,
    totalUsage,
    isOpen,
    onClose,
    onClear,
    isDetached,
    onToggleDetach,
    height,
    onResizeStart,
    isReviewMode,
    onToggleReviewMode,
    pendingRequest,
    onResolveRequest,
    onRejectRequest
}) => {
    const logEndRef = useRef<HTMLDivElement>(null);
    const [editedPrompt, setEditedPrompt] = useState("");
    const [activeTab, setActiveTab] = useState<'SYSTEM' | AgentRole>('SYSTEM');
    const [agentMessages, setAgentMessages] = useState<Record<AgentRole, AgentMessage[]>>({
        [AgentRole.DIRECTOR]: [],
        [AgentRole.SCREENWRITER]: [],
        [AgentRole.REVIEWER]: [],
        [AgentRole.REVIEWER]: [],
        [AgentRole.DESIGNER]: [],
        [AgentRole.ANALYST]: [],
        [AgentRole.VIDEOGRAPHER]: []
    });
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    const [chatInput, setChatInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState("");
    const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false);
    const [attachedImages, setAttachedImages] = useState<string[]>([]); // Base64 strings

    const handleSendMessage = async () => {
        if (!chatInput.trim() && attachedImages.length === 0) return;
        if (activeTab === 'SYSTEM') return;

        const message = chatInput;
        const images = [...attachedImages];

        setChatInput(""); // Clear input immediately
        setAttachedImages([]); // Clear images
        setIsSending(true);

        try {
            await chatWithAgent(activeTab as AgentRole, message, images);
        } catch (error) {
            console.error("Failed to send message", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleUpdateSystemPrompt = () => {
        if (activeTab === 'SYSTEM') return;
        updateAgentSystemInstruction(activeTab as AgentRole, systemPrompt);
        setIsSystemPromptOpen(false);
    };

    const handleResetMemory = () => {
        if (activeTab === 'SYSTEM') return;
        if (confirm(`Are you sure you want to reset the memory for ${activeTab}? This cannot be undone.`)) {
            resetAgentMemory(activeTab as AgentRole);
            setAgentMessages(prev => ({ ...prev, [activeTab as AgentRole]: [] }));
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachedImages(prev => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        }
    };

    // Subscribe to Agent Messages & Load History
    useEffect(() => {
        // Load initial history
        setAgentMessages({
            [AgentRole.DIRECTOR]: getAgentHistory(AgentRole.DIRECTOR),
            [AgentRole.SCREENWRITER]: getAgentHistory(AgentRole.SCREENWRITER),
            [AgentRole.REVIEWER]: getAgentHistory(AgentRole.REVIEWER),
            [AgentRole.REVIEWER]: getAgentHistory(AgentRole.REVIEWER),
            [AgentRole.DESIGNER]: getAgentHistory(AgentRole.DESIGNER),
            [AgentRole.ANALYST]: getAgentHistory(AgentRole.ANALYST),
            [AgentRole.VIDEOGRAPHER]: getAgentHistory(AgentRole.VIDEOGRAPHER)
        });

        const unsubscribe = subscribeToAgentMessages((role, message) => {
            setAgentMessages(prev => ({
                ...prev,
                [role]: [...(prev[role] || []), message]
            }));
        });
        return unsubscribe;
    }, []);

    // Sync edited prompt when new request arrives
    useEffect(() => {
        if (pendingRequest) {
            setEditedPrompt(pendingRequest.prompt);
        }
    }, [pendingRequest]);

    // Auto-scroll to bottom (only if NOT highlighting a specific message)
    useEffect(() => {
        if (isOpen && logEndRef.current && !highlightedMessageId) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen, activeTab, agentMessages, highlightedMessageId]);



    const handleLogClick = (log: LogEntry) => {
        if (log.agentRole && log.linkedMessageId) {
            setActiveTab(log.agentRole);
            setHighlightedMessageId(log.linkedMessageId);
        }
    };

    if (!isOpen) return null;

    // Styles for Detached vs Inline
    const containerClasses = isDetached
        ? "h-screen w-screen bg-slate-900 flex flex-col overflow-hidden relative" // Detached: Full window
        : "fixed bottom-0 right-0 z-50 bg-slate-900 border-t border-slate-700 shadow-2xl flex flex-col transition-none"; // Inline: Fixed bottom

    const containerStyle = isDetached
        ? {}
        : { height: height, left: '16rem' }; // Left 16rem = 64 (Sidebar width)

    return (
        <div className={containerClasses} style={containerStyle}>
            {/* Drag Handle (Only for Inline) */}
            {!isDetached && onResizeStart && (
                <div
                    className="h-1.5 bg-slate-800 hover:bg-indigo-500 cursor-ns-resize w-full flex-shrink-0 transition-colors"
                    onMouseDown={onResizeStart}
                />
            )}

            {/* Header */}
            <div className="bg-slate-950 px-6 py-2 border-b border-slate-800 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300">GenAI Debug Console</span>
                </div>
                <div className="flex items-center gap-3">
                    {/* Review Mode Toggle */}
                    <button
                        onClick={() => onToggleReviewMode(!isReviewMode)}
                        className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold uppercase transition-colors border ${isReviewMode
                            ? 'bg-amber-900/30 border-amber-700 text-amber-400 hover:bg-amber-900/50'
                            : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                            }`}
                        title="Pause requests to review and edit prompts before sending"
                    >
                        <div className={`w-2 h-2 rounded-full ${isReviewMode ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
                        Review Mode
                    </button>

                    <div className="w-px h-4 bg-slate-700 mx-1" />

                    {/* Usage Stats */}
                    <div className="flex items-center gap-4 px-4 border-l border-r border-slate-700">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">In</span>
                            <span className="text-xs font-mono text-slate-300">{totalUsage.inputTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Out</span>
                            <span className="text-xs font-mono text-slate-300">{totalUsage.outputTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Cost</span>
                            <span className="text-xs font-mono text-emerald-400">${totalUsage.cost.toFixed(4)}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <button onClick={onClear} className="text-xs text-slate-500 hover:text-white uppercase font-bold px-3 py-1 rounded hover:bg-slate-800 transition-colors">Clear</button>

                    {/* Detach Button */}
                    <button
                        onClick={onToggleDetach}
                        className={`text-slate-500 hover:text-white transition-colors ${isDetached ? 'text-indigo-400' : ''}`}
                        title={isDetached ? "Reattach to main window" : "Detach to separate window"}
                    >
                        {isDetached ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg> // Arrow pointing in (Reattach)
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg> // External Link (Detach)
                        )}
                    </button>

                    {/* Close Button (Only if inline, or to close the window if detached) */}
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors" title="Close Debug Console">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* TAB BAR */}
            <div className="bg-slate-900 px-6 pt-2 border-b border-slate-800 flex gap-1">
                <button
                    onClick={() => { setActiveTab('SYSTEM'); setHighlightedMessageId(null); }}
                    className={`px-4 py-2 text-xs font-bold uppercase rounded-t-lg transition-colors ${activeTab === 'SYSTEM' ? 'bg-slate-800 text-white border-t border-l border-r border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                    🖥️ System Logs
                </button>
                <button
                    onClick={() => { setActiveTab(AgentRole.DIRECTOR); setHighlightedMessageId(null); }}
                    className={`px-4 py-2 text-xs font-bold uppercase rounded-t-lg transition-colors ${activeTab === AgentRole.DIRECTOR ? 'bg-slate-800 text-white border-t border-l border-r border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                    🎬 Director
                </button>
                <button
                    onClick={() => { setActiveTab(AgentRole.SCREENWRITER); setHighlightedMessageId(null); }}
                    className={`px-4 py-2 text-xs font-bold uppercase rounded-t-lg transition-colors ${activeTab === AgentRole.SCREENWRITER ? 'bg-slate-800 text-white border-t border-l border-r border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                    ✍️ Screenwriter
                </button>
                <button
                    onClick={() => { setActiveTab(AgentRole.REVIEWER); setHighlightedMessageId(null); }}
                    className={`px-4 py-2 text-xs font-bold uppercase rounded-t-lg transition-colors ${activeTab === AgentRole.REVIEWER ? 'bg-slate-800 text-white border-t border-l border-r border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                    ⚖️ Reviewer
                </button>
                <button
                    onClick={() => { setActiveTab(AgentRole.DESIGNER); setHighlightedMessageId(null); }}
                    className={`px-4 py-2 text-xs font-bold uppercase rounded-t-lg transition-colors ${activeTab === AgentRole.DESIGNER ? 'bg-slate-800 text-white border-t border-l border-r border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                    🎨 Designer
                </button>
                <button
                    onClick={() => { setActiveTab(AgentRole.ANALYST); setHighlightedMessageId(null); }}
                    className={`px-4 py-2 text-xs font-bold uppercase rounded-t-lg transition-colors ${activeTab === AgentRole.ANALYST ? 'bg-slate-800 text-white border-t border-l border-r border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                    🧐 Analyst
                </button>
                <button
                    onClick={() => { setActiveTab(AgentRole.VIDEOGRAPHER); setHighlightedMessageId(null); }}
                    className={`px-4 py-2 text-xs font-bold uppercase rounded-t-lg transition-colors ${activeTab === AgentRole.VIDEOGRAPHER ? 'bg-slate-800 text-white border-t border-l border-r border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                    🎥 Videographer
                </button>
            </div>

            {/* AGENT SETTINGS BAR (System Prompt & Reset) */}
            {activeTab !== 'SYSTEM' && (
                <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsSystemPromptOpen(!isSystemPromptOpen)}
                            className="text-[10px] font-bold uppercase text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {isSystemPromptOpen ? 'Hide System Prompt' : 'Edit System Prompt'}
                        </button>
                    </div>
                    <button
                        onClick={handleResetMemory}
                        className="text-[10px] font-bold uppercase text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                        title="Clear Agent Memory"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Reset Memory
                    </button>
                </div>
            )}

            {/* SYSTEM PROMPT EDITOR */}
            {activeTab !== 'SYSTEM' && isSystemPromptOpen && (
                <div className="p-4 bg-slate-950 border-b border-slate-800 animate-in slide-in-from-top-2 duration-200">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2">System Instructions (Persona & Rules)</label>
                    <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Enter system instructions..."
                        className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500 resize-none mb-2"
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={handleUpdateSystemPrompt}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase rounded transition-colors"
                        >
                            Update & Restart Agent
                        </button>
                    </div>
                </div>
            )}

            {/* Logs Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 font-mono text-xs space-y-3 custom-scrollbar relative bg-slate-900">
                {activeTab === 'SYSTEM' ? (
                    <>
                        {logs.length === 0 && (
                            <div className="text-slate-600 italic text-center mt-12">Waiting for API activity...</div>
                        )}
                        {logs.map(log => (
                            <LogItem
                                key={log.id}
                                log={log}
                                isSummary={true}
                                onClick={() => handleLogClick(log)}
                            />
                        ))}
                    </>
                ) : (
                    <>
                        {agentMessages[activeTab as AgentRole]?.length === 0 && (
                            <div className="text-slate-600 italic text-center mt-12">No history for this agent yet...</div>
                        )}
                        {agentMessages[activeTab as AgentRole]?.map(msg => (
                            <AgentMessageItem
                                key={msg.id}
                                message={msg}
                                isHighlighted={msg.id === highlightedMessageId}
                            />
                        ))}
                    </>
                )}
                <div ref={logEndRef}></div>
            </div>

            {/* CHAT INPUT AREA (Only for Agents) */}
            {activeTab !== 'SYSTEM' && (
                <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col gap-2 flex-shrink-0">
                    {/* Attached Images Preview */}
                    {attachedImages.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {attachedImages.map((img, idx) => (
                                <div key={idx} className="relative group flex-shrink-0">
                                    <img src={img} alt="Attachment" className="h-12 w-12 object-cover rounded border border-slate-700" />
                                    <button
                                        onClick={() => setAttachedImages(prev => prev.filter((_, i) => i !== idx))}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2">
                        {/* Image Upload Button */}
                        <label className="cursor-pointer text-slate-500 hover:text-indigo-400 transition-colors p-2 rounded hover:bg-slate-900 flex items-center justify-center" title="Attach Image">
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </label>

                        <textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder={`Message ${activeTab}...`}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 resize-none h-10 custom-scrollbar"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={isSending || (!chatInput.trim() && attachedImages.length === 0)}
                            className="px-4 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase transition-colors"
                        >
                            {isSending ? '...' : 'Send'}
                        </button>
                    </div>
                </div>
            )}

            {/* REVIEW MODE OVERLAY */}
            {pendingRequest && (
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col p-6 animate-in fade-in duration-200">
                    <div className="bg-slate-950 border border-amber-500/50 rounded-lg shadow-2xl flex flex-col flex-1 overflow-hidden">
                        {/* Header */}
                        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-amber-400 font-bold uppercase tracking-wider text-sm">Reviewing Request</span>
                                <span className="text-slate-500 text-xs">|</span>
                                <span className="text-slate-300 font-mono text-xs">{pendingRequest.title}</span>
                            </div>
                        </div>

                        {/* Editor */}
                        <div className="flex-1 p-4 flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Final Prompt (Editable)</label>
                            <textarea
                                value={editedPrompt}
                                onChange={(e) => setEditedPrompt(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded p-4 text-slate-300 font-mono text-xs focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
                                spellCheck={false}
                            />
                        </div>

                        {/* Footer Actions */}
                        <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex justify-end gap-3">
                            <button
                                onClick={() => onRejectRequest(pendingRequest.id)}
                                className="px-4 py-2 rounded text-xs font-bold uppercase text-red-400 hover:bg-red-900/20 transition-colors"
                            >
                                Cancel Request
                            </button>
                            <button
                                onClick={() => onResolveRequest(pendingRequest.id, editedPrompt)}
                                className="px-6 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase transition-colors shadow-lg shadow-amber-900/20"
                            >
                                Send Request
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebugConsole;
