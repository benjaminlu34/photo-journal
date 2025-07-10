import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageNoteProps {
  content: { url?: string; caption?: string; fileName?: string };
  onChange?: (content: { url?: string; caption?: string; fileName?: string }) => void;
}

export const ImageNote: React.FC<ImageNoteProps> = ({
  content,
  onChange
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempCaption, setTempCaption] = useState(content.caption || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    setIsLoading(true);
    
    try {
      const url = URL.createObjectURL(file);
      onChange?.({ ...content, url, fileName: file.name });
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (content.url) {
      URL.revokeObjectURL(content.url);
    }
    onChange?.({ url: undefined, caption: undefined, fileName: undefined });
  };

  const handleCaptionSave = () => {
    onChange?.({ ...content, caption: tempCaption });
    setIsEditing(false);
  };

  if (content.url) {
    return (
      <div className="w-full h-full relative group">
        <img
          src={content.url}
          alt={content.caption || 'Uploaded image'}
          className="w-full h-full object-cover rounded-lg"
        />
        
        {isEditing ? (
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-3">
            <input
              type="text"
              value={tempCaption}
              onChange={(e) => setTempCaption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCaptionSave();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-white text-sm placeholder-gray-300 border-none outline-none mb-2"
              placeholder="Add a caption..."
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCaptionSave();
                }}
                className="text-xs py-1 px-3 bg-primary text-primary-foreground rounded"
              >
                Save
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(false);
                }}
                className="text-xs py-1 px-3 bg-secondary text-secondary-foreground rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {content.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white p-3">
                <p className="text-sm font-medium">{content.caption}</p>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTempCaption(content.caption || '');
                    setIsEditing(true);
                  }}
                  className="bg-white/90 hover:bg-white text-black text-xs py-1 px-3 rounded"
                >
                  {content.caption ? "Edit" : "Caption"}
                </button>
                <button
                  onClick={handleRemoveImage}
                  className="bg-white/90 hover:bg-white text-black text-xs py-1 px-3 rounded"
                >
                  Remove
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full h-full border-2 border-dashed rounded-lg',
        'flex flex-col items-center justify-center cursor-pointer',
        'transition-all duration-200',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted hover:border-primary/50 hover:bg-surface'
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleUploadClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      {isLoading ? (
        <div className="flex flex-col items-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Uploading...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-2 text-center">
          {isDragOver ? (
            <Upload className="w-8 h-8 text-primary" />
          ) : (
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
          )}
          
          <div className="text-sm text-muted-foreground">
            {isDragOver ? (
              <span>Drop image here</span>
            ) : (
              <div>
                <span className="font-medium text-primary">Click to upload</span>
                <br />
                <span>or drag and drop</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageNote;