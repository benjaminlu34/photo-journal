import React, { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { security } from "@/lib/security";
import { X, Camera, Upload, AlertCircle, CheckCircle, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useJournal } from "@/contexts/journal-context";
import { PhotoStorageService } from "@/services/storage.service/photo-storage.service";
import { UploadQueueService } from "@/services/storage.service/upload-queue.service";
import { ServiceAvailabilityManager, ServiceAvailability } from "@/services/storage.service/service-availability.manager";
import { StorageError } from "@/services/storage.service/storage-errors";
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
  const [serviceAvailability, setServiceAvailability] = useState<ServiceAvailability | null>(null);
  const [showServiceMessage, setShowServiceMessage] = useState(false);
  
  // Handle auth context gracefully - it might not be available in all contexts
  let user: any = null;
  let currentDate: Date = new Date();
  
  try {
    const auth = useAuth();
    user = auth.user;
  } catch (error) {
    console.warn('ImageNote: Auth context not available, using fallback behavior');
  }
  
  try {
    const journal = useJournal();
    currentDate = journal.currentDate;
  } catch (error) {
    console.warn('ImageNote: Journal context not available, using current date');
  }
  const photoService = PhotoStorageService.getInstance();
  const uploadQueue = UploadQueueService.getInstance();
  const availabilityManager = ServiceAvailabilityManager.getInstance();
  const { updateNoteWithStorageMetadata } = useBoardStore((s) => s.actions);

  // Monitor service availability
  useEffect(() => {
    const unsubscribe = availabilityManager.subscribe((availability) => {
      setServiceAvailability(availability);
      
      // Show service message for degraded or offline modes
      const shouldShow = availability.recommendedStrategy.showOfflineMessage || 
                        availability.recommendedStrategy.showDegradedMessage;
      setShowServiceMessage(shouldShow);
    });

    // Get initial availability
    setServiceAvailability(availabilityManager.getAvailability());

    return unsubscribe;
  }, [availabilityManager]);

  // Load cached image if storage path exists with stale-while-revalidate and graceful degradation
  useEffect(() => {
    const loadCachedImage = async () => {
      const storagePath = (content as any).storagePath;
      if (storagePath && user?.id) {
        setIsLoadingImage(true);
        setImageLoadError(null);
        
        try {
          const { url, fromCache, isStale, error } = await photoService.getPhotoWithCache(
            storagePath,
            user.id,
            {
              onStaleUpdate: (freshUrl) => {
                // Update with fresh content when available
                setCachedImageUrl(freshUrl);
                console.log(`Image updated with fresh content: ${storagePath}`);
              },
              maxStaleAge: 24 * 60 * 60 * 1000, // 24 hours
              fallbackToCache: true, // Use cache even if stale when storage unavailable
            }
          );
          setCachedImageUrl(url);
          
          // Show appropriate error message if there was an issue but we got cached content
          if (error && fromCache) {
            setImageLoadError(`Using cached image: ${error.getUserMessage()}`);
          } else {
            setImageLoadError(null);
          }
          
          console.log(`Image loaded from ${fromCache ? 'cache' : 'storage'}${isStale ? ' (stale)' : ''}${error ? ' (with error)' : ''}: ${storagePath}`);
        } catch (error) {
          console.error('Failed to load cached image:', error);
          
          if (error instanceof StorageError) {
            setImageLoadError(error.getUserMessage());
          } else {
            setImageLoadError(error instanceof Error ? error.message : 'Failed to load image');
          }
          
          // Fall back to blob URL if available
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

    loadCachedImage();
  }, [(content as any).storagePath, user?.id, photoService]);

  // Monitor upload progress if there's an active upload
  useEffect(() => {
    const uploadId = (content as any).uploadId;
    if (uploadId) {
      const checkUploadStatus = () => {
        const upload = uploadQueue.getUpload(uploadId);
        if (upload) {
          setUploadState({
            status: upload.status,
            progress: upload.progress,
            error: upload.error,
            uploadId: upload.id,
          });

          // Continue monitoring if still in progress
          if (upload.status === 'uploading' || upload.status === 'retrying') {
            setTimeout(checkUploadStatus, 500);
          }
        }
      };

      checkUploadStatus();
    }
  }, [(content as any).uploadId, uploadQueue]);

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
    
    // Check service availability before proceeding
    const availability = serviceAvailability || availabilityManager.getAvailability();
    
    // If no user or noteId, or uploads not allowed, fall back to blob URL behavior
    if (!user?.id || !noteId || !availability.recommendedStrategy.allowUploads) {
      const reason = !user?.id ? 'No user ID' : 
                    !noteId ? 'No note ID' : 
                    'Uploads not allowed due to service availability';
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

        // Show message about why upload is disabled
        if (!availability.recommendedStrategy.allowUploads) {
          const statusMessage = availabilityManager.getStatusMessage();
          setUploadState({
            status: 'failed',
            progress: 0,
            error: statusMessage.message,
          });
        }
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

      // Queue upload for background processing
      const uploadId = await uploadQueue.enqueue(
        file,
        user.id,
        journalDate,
        noteId,
        { compress: true }, // Enable compression by default
        {
          onProgress: (progress) => {
            setUploadState(prev => ({ ...prev, progress }));
          },
          onComplete: (result) => {
            console.log('Upload completed:', result);
            
            // Update the CRDT with storage metadata for friend access
            if (noteId) {
              updateNoteWithStorageMetadata(noteId, result.storagePath, result.signedUrl);
            }
            
            // Update content with persistent storage path and signed URL
            onChange?.({
              ...content,
              imageUrl: result.signedUrl,
              alt: sanitizedAlt,
              storagePath: result.storagePath,
            } as any);

            // Clean up local preview
            if (localPreviewUrl) {
              URL.revokeObjectURL(localPreviewUrl);
              setLocalPreviewUrl(null);
            }

            setUploadState({
              status: 'completed',
              progress: 100,
            });
          },
          onError: (error) => {
            console.error('Upload failed:', error);
            
            // Provide user-friendly error message
            const errorMessage = error instanceof StorageError 
              ? error.getUserMessage()
              : (error instanceof Error ? error.message : 'Upload failed');
            
            setUploadState({
              status: 'failed',
              progress: 0,
              error: errorMessage,
            });
          },
        }
      );

      // Update content with upload ID for monitoring
      onChange?.({
        ...content,
        imageUrl: previewUrl,
        alt: sanitizedAlt,
        uploadId,
      } as any);

      setUploadState({
        status: 'uploading',
        progress: 0,
        uploadId,
      });

    } catch (error) {
      console.error("Failed to start upload:", error);
      
      const errorMessage = error instanceof StorageError 
        ? error.getUserMessage()
        : (error instanceof Error ? error.message : 'Failed to start upload');
      
      setUploadState({
        status: 'failed',
        progress: 0,
        error: errorMessage,
      });
    }
  }, [onChange, user?.id, noteId, currentDate, uploadQueue, localPreviewUrl, serviceAvailability, availabilityManager]);

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
      // Cancel any active upload
      const uploadId = (content as any).uploadId;
      if (uploadId) {
        uploadQueue.cancel(uploadId);
      }

      // Delete from persistent storage if it exists
      const storagePath = (content as any).storagePath;
      if (storagePath && user?.id) {
        try {
          await photoService.deletePhoto(storagePath, user.id);
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

      // Clean up cached image URL
      if (cachedImageUrl && cachedImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(cachedImageUrl);
        setCachedImageUrl(null);
      }

      // Reset state
      setUploadState({ status: 'idle', progress: 0 });
      
      // Update content
      onChange?.({ 
        ...content,
        imageUrl: undefined, 
        alt: undefined,
      } as any);
    } catch (error) {
      console.error('Failed to remove image:', error);
    }
  }, [onChange, (content as any).uploadId, (content as any).storagePath, user?.id, uploadQueue, photoService, localPreviewUrl, cachedImageUrl]);

  const handleRetryUpload = useCallback(() => {
    const uploadId = (content as any).uploadId;
    if (uploadId) {
      const success = uploadQueue.retry(uploadId);
      if (success) {
        setUploadState(prev => ({ ...prev, status: 'uploading', error: undefined }));
      }
    }
  }, [(content as any).uploadId, uploadQueue]);

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

        {/* Service availability message */}
        {showServiceMessage && serviceAvailability && (
          <div className={cn(
            "absolute top-8 left-2 right-2 text-white text-xs p-2 rounded",
            serviceAvailability.offline ? "bg-red-500" : 
            serviceAvailability.storage.degraded ? "bg-yellow-500" : "bg-blue-500"
          )}>
            {availabilityManager.getStatusMessage().message}
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
              {serviceAvailability?.recommendedStrategy.allowUploads ? 'Click to upload' : 'Upload unavailable'}
            </span>
            <p className="text-xs">
              {serviceAvailability?.recommendedStrategy.allowUploads ? 'or drag and drop' : 
               serviceAvailability?.offline ? 'Device is offline' :
               serviceAvailability?.storage.degraded ? 'Service temporarily limited' :
               'Check connection'}
            </p>
          </div>
          
          {/* Service status indicator */}
          {showServiceMessage && serviceAvailability && (
            <div className={cn(
              "text-xs p-2 rounded max-w-xs text-center",
              serviceAvailability.offline ? "bg-red-100 text-red-700" : 
              serviceAvailability.storage.degraded ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
            )}>
              {availabilityManager.getStatusMessage().message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageNote;