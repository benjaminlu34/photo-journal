/**
 * noteRegistry.tsx
 * Simple lookup so StickyBoard can render a note body
 * without a big switch-statement. For now, using simple placeholders.
 */

import { ComponentType } from 'react';

interface NoteComponentProps {
  content: any;
  onChange?: (content: any) => void;
}

// Simple text note component
const TextNote: ComponentType<NoteComponentProps> = ({ content, onChange }) => {
  return (
    <textarea
      value={content?.text || ''}
      onChange={(e) => onChange?.({ ...content, text: e.target.value })}
      className="w-full h-full resize-none border-none outline-none bg-transparent text-sm placeholder-muted-foreground"
      placeholder="Type your note..."
    />
  );
};

// Simple checklist note component
const ChecklistNote: ComponentType<NoteComponentProps> = ({ content, onChange }) => {
  const items = content?.items || [];
  
  return (
    <div className="space-y-2">
      {items.map((item: any, index: number) => (
        <div key={index} className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={item.completed || false}
            onChange={(e) => {
              const newItems = [...items];
              newItems[index] = { ...item, completed: e.target.checked };
              onChange?.({ ...content, items: newItems });
            }}
            className="rounded"
          />
          <input
            type="text"
            value={item.text || ''}
            onChange={(e) => {
              const newItems = [...items];
              newItems[index] = { ...item, text: e.target.value };
              onChange?.({ ...content, items: newItems });
            }}
            className="flex-1 border-none outline-none bg-transparent text-sm"
            placeholder="New item..."
          />
        </div>
      ))}
    </div>
  );
};

// Simple image note component
const ImageNote: ComponentType<NoteComponentProps> = ({ content }) => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      {content?.url ? (
        <img 
          src={content.url} 
          alt={content.alt || 'Note image'} 
          className="max-w-full max-h-full object-contain rounded" 
        />
      ) : (
        <div className="text-muted-foreground text-sm">No image</div>
      )}
    </div>
  );
};

// Simple voice note component
const VoiceNote: ComponentType<NoteComponentProps> = ({ content }) => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      {content?.url ? (
        <audio controls className="w-full">
          <source src={content.url} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      ) : (
        <div className="text-muted-foreground text-sm">No audio</div>
      )}
    </div>
  );
};

// Simple drawing note component
const DrawingNote: ComponentType<NoteComponentProps> = ({ content }) => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-muted-foreground text-sm">
        Drawing: {content?.strokes?.length || 0} strokes
      </div>
    </div>
  );
};

export const noteRegistry = {
  text: TextNote,
  checklist: ChecklistNote,
  image: ImageNote,
  voice: VoiceNote,
  drawing: DrawingNote,
};

export type NoteKind = keyof typeof noteRegistry;