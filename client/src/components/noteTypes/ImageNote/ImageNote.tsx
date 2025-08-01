import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { X, Camera, Upload, AlertCircle, CheckCircle, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";
import { useJournal } from "@/contexts/journal-context";
import { useBoardStore } from "@/lib/board-store";
import type { NoteContent } from "@/types/notes";
import {
  getFromCache,
  addToCache,
  clearCacheForStoragePath
} from "@/utils/image-url-cache";

// Utility function to format date as YYYY-MM-DD in local timezone
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type ImageNoteContent = Extract<NoteContent, { type: 'image' }>;

type ImageNoteProps = {
  content: ImageNoteContent;
  onChange?: (content: ImageNoteContent) => void;
  noteId?: string; // Required for persistent storage
}

interface UploadState {
  status: 'idle' | 'pending' | 'uploading' | 'completed' | 'failed' | 'retrying';
  progress: number;
  error?: string;
  uploadId?: string;
}

const ImageNote: React.FC<ImageNoteProps> = ({
  content = { type: 'image' },
  onChange,
  noteId
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  });
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [cachedImageUrl, setCachedImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);

  // Memoize storage path to prevent unnecessary re-renders
  const storagePath = useMemo(() => content.storagePath, [content.storagePath]);
  const existingImageUrl = useMemo(() => content.imageUrl, [content.imageUrl]);


  // Get authenticated user (same pattern as profile pictures)
  const { data: user } = useUser();
  const { currentDate } = useJournal();

  // Simple state management - no complex service monitoring needed

  // Load image using server's signed URL endpoint for proper permission validation
  useEffect(() => {
    const loadImage = async () => {
      // Skip loading if we already have a valid signed URL (prevents duplicate calls after upload)
      if (existingImageUrl && !existingImageUrl.startsWith('blob:')) {
        setCachedImageUrl(existingImageUrl);
        return;
      }

      if (storagePath && user?.id) {
        // Get current session for authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setImageLoadError('Authentication required');
          setIsLoadingImage(false);
          return;
        }

        // Check global cache first
        const cachedURL = getFromCache(storagePath);
        if (cachedURL) {
          setCachedImageUrl(cachedURL);
          return;
        }

        setIsLoadingImage(true);
        setImageLoadError(null);

        try {
          // Get signed URL from server endpoint for proper permission validation
          const response = await fetch(`/api/photos/${storagePath}/signed-url`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });

          if (!response.ok) {
            if (response.status === 404) {
              // Image was deleted - clear the storagePath to prevent future attempts
              console.warn(`Image not found (likely deleted): ${storagePath}`);
              clearCacheForStoragePath(storagePath);
              onChange?.({
                ...content,
                imageUrl: undefined,
                storagePath: undefined,
              } as any);
              return;
            }
            if (response.status === 403) {
              throw new Error('Access denied to this image');
            }
            throw new Error('Failed to load image');
          }

          const result = await response.json();

          if (result.signedUrl) {
            // Calculate expiration time (server returns expiresAt as ISO string)
            const expiresAt = new Date(result.expiresAt).getTime();

            // Add to global cache
            addToCache(storagePath, result.signedUrl, expiresAt);

            // Set local state
            setCachedImageUrl(result.signedUrl);
          } else {
            throw new Error('No signed URL returned from server');
          }
        } catch (error) {
          console.error('Failed to load image:', error);
          setImageLoadError(error instanceof Error ? error.message : 'Failed to load image');
        } finally {
          setIsLoadingImage(false);
        }
      } else {
        setCachedImageUrl(null);
        setIsLoadingImage(false);
        setImageLoadError(null);
      }
    };

    loadImage();
  }, [storagePath, existingImageUrl, user?.id, onChange]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
      if (cachedImageUrl && cachedImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(cachedImageUrl);
      }
    };
  }, [localPreviewUrl, cachedImageUrl]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;

    // If no user or noteId, fall back to blob URL behavior (same as profile images)
    if (!user?.id || !noteId) {
      const reason = !user?.id ? 'No user ID' : 'No note ID';
      console.warn(`${reason}, using blob URL fallback`);

      try {
        const previewUrl = URL.createObjectURL(file);
        setLocalPreviewUrl(previewUrl);

        const sanitizedAlt = file.name.replace(/\.[^/.]+$/, "").replace(/<[^>]*>/g, '');
        onChange?.({
          type: 'image',
          imageUrl: previewUrl,
          alt: sanitizedAlt,
        });
      } catch (error) {
        console.error("Failed to create blob URL:", error);
        setUploadState({
          status: 'failed',
          progress: 0,
          error: 'Failed to process image file',
        });
      }
      return;
    }

    try {
      const previewUrl = URL.createObjectURL(file);
      setLocalPreviewUrl(previewUrl);

      const sanitizedAlt = file.name.replace(/\.[^/.]+$/, "").replace(/<[^>]*>/g, '');
      const journalDate = formatLocalDate(currentDate);
      onChange?.({
        ...content,
        imageUrl: previewUrl,
        alt: sanitizedAlt,
      });

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Authentication required');
        }

        setUploadState({ status: 'uploading', progress: 0 });

        const formData = new FormData();
        formData.append('photo', file);
        formData.append('journalDate', journalDate);
        if (noteId) {
          formData.append('noteId', noteId);
        }

        const response = await fetch('/api/photos/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Upload failed');
        }

        const result = await response.json();

        setCachedImageUrl(result.url);
        setUploadState({ status: 'completed', progress: 100 });

        if (localPreviewUrl) {
          URL.revokeObjectURL(localPreviewUrl);
          setLocalPreviewUrl(null);
        }

        // Update content with the server-provided URL and storage path
        onChange?.({
          ...content,
          imageUrl: result.url,
          alt: sanitizedAlt,
          storagePath: result.storagePath,
        } as any);

      } catch (error) {
        console.error('Upload failed:', error);
        setUploadState({
          status: 'failed',
          progress: 0,
          error: error instanceof Error ? error.message : 'Upload failed'
        });
      }

    } catch (error) {
      console.error("Failed to start upload:", error);
      setUploadState({
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to start upload',
      });
    }
  }, [onChange, user?.id, noteId, currentDate, content]);

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

  const handleRemoveImage = useCallback(async () => {
    try {
      const storagePath = (content as any).storagePath;
      if (storagePath && user?.id) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            console.error('Authentication required for deletion');
            return;
          }


          const response = await fetch(`/api/photos/${storagePath}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            console.error('Failed to delete photo from server:', await response.text());
            // Continue with removal even if server deletion fails
          }
        } catch (error) {
          console.error('Failed to delete photo from storage:', error);
          // Continue with removal even if storage deletion fails
        }
      }

      // Clean up local preview URL
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }

      if (cachedImageUrl) {
        if (cachedImageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(cachedImageUrl);
        }
        setCachedImageUrl(null);
      }

      if (storagePath) {
        clearCacheForStoragePath(storagePath);
      }

      setUploadState({ status: 'idle', progress: 0 });
      setImageLoadError(null);

      onChange?.({
        ...content,
        imageUrl: undefined,
        alt: undefined,
        storagePath: undefined,
      } as any);
    } catch (error) {
      console.error('Failed to remove image:', error);
    }
  }, [onChange, content, user?.id, localPreviewUrl, cachedImageUrl]);

  const handleRetryUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const displayImageUrl = cachedImageUrl || localPreviewUrl || content.imageUrl;

  if (displayImageUrl) {
    return (
      <div className="relative h-full p-4">
        <img
          src={displayImageUrl}
          alt={content.alt || "Uploaded image"}
          className="w-full h-full object-cover rounded-lg"
        />

        {isLoadingImage && (
          <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
            <div className="bg-white rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading image...</span>
              </div>
            </div>
          </div>
        )}

        {uploadState.status === 'uploading' && (
          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
            <div className="bg-white rounded-lg p-4 max-w-xs w-full mx-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Uploading...</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(uploadState.progress)}%
              </div>
            </div>
          </div>
        )}

        {uploadState.status === 'completed' && (content as any).storagePath && (
          <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full p-1">
            <CheckCircle className="w-3 h-3" />
          </div>
        )}

        {uploadState.status === 'failed' && (
          <div className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1">
            <AlertCircle className="w-3 h-3" />
          </div>
        )}

        {uploadState.status === 'retrying' && (
          <div className="absolute top-2 left-2 bg-yellow-500 text-white rounded-full p-1 animate-spin">
            <RotateCcw className="w-3 h-3" />
          </div>
        )}

        <div className="absolute top-2 right-2 flex gap-1">
          {uploadState.status === 'failed' && (
            <button
              onClick={handleRetryUpload}
              className={cn(
                'w-6 h-6 rounded-full',
                'bg-yellow-500 hover:bg-yellow-600 text-white',
                'flex items-center justify-center',
                'transition-colors duration-200'
              )}
              title="Retry upload"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={handleRemoveImage}
            className={cn(
              'w-6 h-6 rounded-full',
              'bg-red-500 hover:bg-red-600 text-white',
              'flex items-center justify-center opacity-0 hover:opacity-100',
              'transition-opacity duration-200'
            )}
            title="Remove image"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {uploadState.status === 'failed' && uploadState.error && (
          <div className="absolute bottom-2 left-2 right-2 bg-red-500 text-white text-xs p-2 rounded">
            Upload failed: {uploadState.error}
          </div>
        )}

        {imageLoadError && (
          <div className="absolute bottom-2 left-2 right-2 bg-orange-500 text-white text-xs p-2 rounded">
            {imageLoadError}
          </div>
        )}


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

      {uploadState.status === 'uploading' ? (
        <div className={cn(
          'flex flex-col items-center gap-2',
          'text-neutral-600'
        )}>
          <Upload className="w-8 h-8 text-blue-500" />
          <span className="text-sm">Uploading...</span>
          <div className="w-32 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{Math.round(uploadState.progress)}%</span>
        </div>
      ) : uploadState.status === 'failed' ? (
        <div className={cn(
          'flex flex-col items-center gap-2',
          'text-red-600'
        )}>
          <AlertCircle className="w-8 h-8" />
          <span className="text-sm">Upload failed</span>
          {uploadState.error && (
            <p className="text-xs text-center max-w-xs">{uploadState.error}</p>
          )}
          <button
            onClick={handleRetryUpload}
            className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-neutral-500">
          <div className="text-center text-gray-400">
            <Camera className="w-12 h-12 mx-auto mb-2" />
            <span className="text-sm font-medium">
              Click to upload
            </span>
            <p className="text-xs">
              or drag and drop
            </p>
          </div>


        </div>
      )}
    </div>
  );
};

export default ImageNote;