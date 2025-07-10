import React, { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { TextNoteContent } from "@/types/notes";

interface TextNoteProps {
  content: TextNoteContent;
  onChange?: (content: TextNoteContent) => void;
  placeholder?: string;
}

const TextNote: React.FC<TextNoteProps> = ({ content = { text: "" }, onChange, placeholder = "Start typing..." }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    onChange?.({ text: newText });
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Allow tab in textarea
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      target.value = value.substring(0, start) + '\t' + value.substring(end);
      target.selectionStart = target.selectionEnd = start + 1;
      handleChange(e as any);
    }
  }, [handleChange]);

  return (
    <div className="h-full p-4">
      <textarea
        ref={textareaRef}
        value={content?.text || ""}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full h-full min-h-[60px] resize-none border-none outline-none',
          'bg-transparent text-gray-700 placeholder:text-gray-400',
          'text-sm leading-relaxed font-medium'
        )}
        placeholder={placeholder}
        style={{ 
          resize: 'none',
          overflow: 'hidden'
        }}
      />
    </div>
  );
};

export default TextNote;