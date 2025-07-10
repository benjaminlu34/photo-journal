import React, { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, Upload } from "lucide-react";
import type { ImageNoteContent } from "@/types/notes";

interface ImageNoteProps {
  content: ImageNoteContent;
  onChange?: (content: ImageNoteContent) => void;
}

const ImageNote: React.FC<ImageNoteProps> = ({ content = { type: 'image' }, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    setIsUploading(true);
    try {
      // For now, create a blob URL (in real app would upload to server)
      const imageUrl = URL.createObjectURL(file);
      onChange?.({ 
        type: 'image',
        imageUrl, 
        alt: file.name.replace(/\.[^/.]+$/, "") 
      });
    } catch (error) {
      console.error("Failed to upload image:", error);
    } finally {
      setIsUploading(false);
    }
  }, [onChange]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemoveImage = useCallback(() => {
    onChange?.({ type: 'image', imageUrl: undefined, alt: undefined });
  }, [onChange]);

  if (content?.imageUrl) {
    return (
      <div className="relative h-full p-4">
        <img
          src={content.imageUrl}
          alt={content?.alt || "Uploaded image"}
          className="w-full h-full object-cover rounded-lg"
        />
        <button
          onClick={handleRemoveImage}
          className={cn(
            'absolute top-2 right-2 w-6 h-6 rounded-full',
            'bg-red-500 hover:bg-red-600 text-white',
            'flex items-center justify-center opacity-0 hover:opacity-100',
            'transition-opacity duration-200'
          )}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-full p-4 border-2 border-dashed rounded-lg',
        'flex items-center justify-center cursor-pointer',
        'transition-colors duration-200',
        isDragOver ? 'border-blue-400 bg-white/50' : 'border-gray-400'
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
      
      {isUploading ? (
        <div className={cn(
          'flex flex-col items-center gap-2',
          'text-neutral-600'
        )}>
          <span className="text-sm">Uploading...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-neutral-500">
          {isDragOver ? (
            <span className="text-sm">Drop image here</span>
          ) : (
            <div className="text-center">
              <span className="text-sm">Click to upload</span>
              <br />
              <span className="text-xs">or drag and drop</span>
            </div>
          )}
          <Upload className="w-8 h-8" />
        </div>
      )}
    </div>
  );
};

export default ImageNote;