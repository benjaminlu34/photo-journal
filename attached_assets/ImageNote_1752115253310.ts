import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageNoteProps {
  imageUrl?: string;
  alt?: string;
  onChange?: (imageUrl: string | null) => void;
}

export const ImageNote: React.FC<ImageNoteProps> = ({
  imageUrl,
  alt = 'Uploaded image',
  onChange
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Create object URL for the image
      const url = URL.createObjectURL(file);
      onChange?.(url);
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    onChange?.(null);
  };

  if (imageUrl) {
    return (
      <div className="w-full h-full relative group">
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover rounded-[var(--radius-sm)]"
        />
        
        <button
          onClick={handleRemoveImage}
          className={cn(
            'absolute top-2 right-2 w-6 h-6 rounded-full',
            'bg-destructive text-destructive-foreground',
            'flex items-center justify-center shadow-neu',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full h-full border-2 border-dashed rounded-[var(--radius-sm)]',
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