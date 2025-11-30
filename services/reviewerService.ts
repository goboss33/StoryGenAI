
// --- REVIEWER AGENT LOGIC ---
export const reviewScene = (
    sceneContent: { lines: import("../types").ScriptLine[] },
    targetDuration: number
): { approved: boolean; feedback: string; estimatedDuration: number } => {

    let wordCount = 0;
    let actionLines = 0;

    if (sceneContent.lines) {
        sceneContent.lines.forEach(line => {
            if (line.type === 'dialogue') {
                // Count words in dialogue
                wordCount += line.content.trim().split(/\s+/).length;
            } else if (line.type === 'action') {
                // Count action lines (paragraphs)
                actionLines++;
            }
        });
    }

    // Formula: Dest = (Wdial / 2.5) + (Lact * 3)
    const estimatedDuration = (wordCount / 2.5) + (actionLines * 3);

    // Validation: Dest > Dcible + 20% -> REJECT
    const maxDuration = targetDuration * 1.20;
    const minDuration = targetDuration * 0.80; // Optional: Check for too short as well? User only specified max.

    if (estimatedDuration > maxDuration) {
        return {
            approved: false,
            estimatedDuration,
            feedback: `REJECTED: Scene is too long. Estimated duration is ${estimatedDuration.toFixed(1)}s, but target is ${targetDuration}s (Max allowed: ${maxDuration.toFixed(1)}s). Reduce dialogue or action.`
        };
    }

    return {
        approved: true,
        estimatedDuration,
        feedback: `APPROVED: Scene duration is valid (${estimatedDuration.toFixed(1)}s).`
    };
};
