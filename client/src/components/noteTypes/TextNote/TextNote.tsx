import React, { useRef, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { security } from "@/lib/security";
import type { NoteContent } from "@/types/notes";

type TextNoteContent = Extract<NoteContent, { type: 'text' }>;

interface TextNoteProps {
  content: TextNoteContent;
  onChange?: (content: TextNoteContent) => void;
  placeholder?: string;
}

const TextNote: React.FC<TextNoteProps> = ({
  content = { type: 'text', text: "", backgroundColor: "#F4F7FF" },
  onChange,
  placeholder = "Type your note here..."
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Local state for immediate UI updates
  const [localText, setLocalText] = useState(content.text || "");

  // Sync local state when content prop changes (from server)
  useEffect(() => {
    setLocalText(content.text || "");
  }, [content.text]);

  // Debounced save function
  const debouncedSave = useCallback((text: string) => {
    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for saving
    debounceTimeoutRef.current = setTimeout(() => {
      // For plain text content, use basic XSS protection without HTML entity encoding
      // Simply strip any HTML tags and return plain text
      const sanitizedText = text.replace(/<[^>]*>/g, '');
      onChange?.({ ...content, text: sanitizedText });
    }, 500); // 500ms debounce
  }, [onChange, content]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    
    // Update local state immediately for responsive UI
    setLocalText(newText);
    
    // Debounce the actual save
    debouncedSave(newText);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [debouncedSave]);

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
        value={localText}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full h-full min-h-[60px] resize-none border-none outline-none',
          'bg-transparent placeholder:text-current/50',
          'text-base leading-relaxed font-medium'
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