import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TextNoteProps {
  content: string;
  onChange?: (content: string) => void;
  placeholder?: string;
}

export const TextNote: React.FC<TextNoteProps> = ({
  content,
  onChange,
  placeholder = "Type your note here..."
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [textContent, setTextContent] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTextContent(content);
  }, [content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onChange?.(textContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setTextContent(content); // Reset to original content
    } else if (e.key === 'Enter' && e.metaKey) {
      handleBlur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextContent(e.target.value);
  };

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={textContent}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full h-full resize-none border-0 outline-none bg-transparent',
          'text-foreground placeholder:text-muted-foreground',
          'font-medium leading-relaxed'
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'w-full h-full cursor-text overflow-y-auto',
        'font-medium leading-relaxed text-foreground',
        !textContent && 'text-muted-foreground'
      )}
    >
      {textContent || placeholder}
    </div>
  );
};