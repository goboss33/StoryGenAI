import React, { useEffect, useRef, useState } from 'react';

interface ScriptEditorInputProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    onFocus?: () => void;
    onBlur?: () => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    onClick?: (e: React.MouseEvent) => void;
    style?: React.CSSProperties;
}

const ScriptEditorInput: React.FC<ScriptEditorInputProps> = ({
    value,
    onChange,
    className = '',
    placeholder = '',
    onFocus,
    onBlur,
    onKeyDown,
    onClick,
    style
}) => {
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const lastHtml = useRef(value);

    // Sync value from props to innerText, but only if it changed externally
    // to avoid resetting cursor position during typing.
    useEffect(() => {
        if (contentEditableRef.current) {
            // We compare against the current text content to avoid unnecessary updates
            // that would reset the cursor.
            if (contentEditableRef.current.innerText !== value) {
                contentEditableRef.current.innerText = value;
            }
        }
    }, [value]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const text = e.currentTarget.innerText;
        onChange(text);
        lastHtml.current = text;
    };

    return (
        <div
            ref={contentEditableRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onInput={handleInput}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            onClick={onClick}
            className={`${className} empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 cursor-text outline-none`}
            data-placeholder={placeholder}
            style={{
                minHeight: '1.5em',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                ...style
            }}
        />
    );
};

export default ScriptEditorInput;
