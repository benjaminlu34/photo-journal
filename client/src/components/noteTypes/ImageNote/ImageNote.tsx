import React, { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, Camera, Upload, AlertCircle, CheckCircle, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";
import { useJournal } from "@/contexts/journal-context";
import { useBoardStore } from "@/lib/board-store";
import type { NoteContent } from "@/types/notes";

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


  // Get authenticated user (same pattern as profile pictures)
  const { data: user } = useUser();
  const { currentDate } = useJournal();
  const { updateNoteWithStorageMetadata } = useBoardStore((s) => s.actions);

  // Simple state management - no complex service monitoring needed

  // Load image from Supabase Storage (same pattern as profile pictures)
  useEffect(() => {
    const loadImage = async () => {
      const storagePath = (content as any).storagePath;
      const existingImageUrl = (content as any).imageUrl;

      // Skip loading if we already have a valid signed URL (prevents duplicate calls after upload)
      if (existingImageUrl && !existingImageUrl.startsWith('blob:')) {
        setCachedImageUrl(existingImageUrl);
        return;
      }

      if (storagePath && user?.id) {
        setIsLoadingImage(true);
        setImageLoadError(null);

        try {
          // Get signed URL from Supabase Storage (same as profile pictures)
          const { data, error } = await supabase.storage
            .from('journal-images')
            .createSignedUrl(storagePath, 3600); // 1 hour TTL

          if (error) {
            // Handle specific error cases
            if (error.message?.includes('not found') || error.message?.includes('404')) {
              // Image was deleted - clear the storagePath to prevent future attempts
              console.warn(`Image not found (likely deleted): ${storagePath}`);
              onChange?.({
                ...content,
                imageUrl: undefined,
                storagePath: undefined,
              } as any);
              return;
            }
            throw error;
          }

          if (data?.signedUrl) {
            setCachedImageUrl(data.signedUrl);
          } else {
            throw new Error('No signed URL returned');
          }
        } catch (error) {
          console.error('Failed to load image:', error);
          setImageLoadError(error instanceof Error ? error.message : 'Failed to load image');
        } finally {
          setIsLoadingImage(false);
        }
      } else {
        // Clear states if no storage path
        setCachedImageUrl(null);
        setIsLoadingImage(false);
        setImageLoadError(null);
      }
    };

    loadImage();
  }, [(content as any).storagePath, (content as any).imageUrl, user?.id]);

  // No complex upload monitoring needed

  // Cleanup blob URLs on unmount
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
      // Create optimistic local preview immediately
      const previewUrl = URL.createObjectURL(file);
      setLocalPreviewUrl(previewUrl);

      const sanitizedAlt = file.name.replace(/\.[^/.]+$/, "").replace(/<[^>]*>/g, '');
      const journalDate = formatLocalDate(currentDate);

      // Update content with blob URL for immediate display (fallback)
      onChange?.({
        ...content,
        imageUrl: previewUrl,
        alt: sanitizedAlt,
      });

      // Direct Supabase upload (same as profile images)
      try {
        setUploadState({ status: 'uploading', progress: 0 });

        // Generate file path
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${journalDate}/${noteId}/${Date.now()}.${fileExt}`;

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from('journal-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get signed URL (same as loading logic)
        const { data: signedData, error: signedError } = await supabase.storage
          .from('journal-images')
          .createSignedUrl(fileName, 3600); // 1 hour TTL

        if (signedError) throw signedError;

        const signedUrl = signedData?.signedUrl;
        if (!signedUrl) throw new Error('Failed to generate signed URL');

        setCachedImageUrl(signedUrl);
        setUploadState({ status: 'completed', progress: 100 });

        // Clean up local preview URL since we now have the persistent URL
        if (localPreviewUrl) {
          URL.revokeObjectURL(localPreviewUrl);
          setLocalPreviewUrl(null);
        }

        // Update content with the signed URL and storage path
        onChange?.({
          ...content,
          imageUrl: signedUrl,
          alt: sanitizedAlt,
          storagePath: fileName,
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
  }, [onChange, user?.id, noteId, currentDate, localPreviewUrl]);

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
      // Delete from persistent storage if it exists
      const storagePath = (content as any).storagePath;
      if (storagePath && user?.id) {
        try {
          await supabase.storage
            .from('journal-images')
            .remove([storagePath]);
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

      // Clean up cached image URL (both blob and signed URLs)
      if (cachedImageUrl) {
        if (cachedImageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(cachedImageUrl);
        }
        setCachedImageUrl(null);
      }

      // Reset state
      setUploadState({ status: 'idle', progress: 0 });
      setImageLoadError(null);

      // Update content - IMPORTANT: Clear storagePath to prevent reload attempts
      onChange?.({
        ...content,
        imageUrl: undefined,
        alt: undefined,
        storagePath: undefined, // Clear this to prevent reload attempts
      } as any);
    } catch (error) {
      console.error('Failed to remove image:', error);
    }
  }, [onChange, (content as any).storagePath, user?.id, localPreviewUrl, cachedImageUrl]);

  const handleRetryUpload = useCallback(() => {
    // For simple implementation, just trigger file select again
    fileInputRef.current?.click();
  }, []);

  // Determine which image URL to display (priority: cached > local preview > content URL)
  const displayImageUrl = cachedImageUrl || localPreviewUrl || content.imageUrl;

  if (displayImageUrl) {
    return (
      <div className="relative h-full p-4">
        <img
          src={displayImageUrl}
          alt={content.alt || "Uploaded image"}
          className="w-full h-full object-cover rounded-lg"
        />

        {/* Image loading overlay */}
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

        {/* Upload progress overlay */}
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

        {/* Upload status indicators */}
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

        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex gap-1">
          {/* Retry button for failed uploads */}
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

          {/* Remove button */}
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

        {/* Upload error message */}
        {uploadState.status === 'failed' && uploadState.error && (
          <div className="absolute bottom-2 left-2 right-2 bg-red-500 text-white text-xs p-2 rounded">
            Upload failed: {uploadState.error}
          </div>
        )}

        {/* Image load error message */}
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