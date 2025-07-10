import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Mic, Square, Play, Pause, Trash2 } from 'lucide-react';

interface VoiceNoteProps {
  content: { url?: string; duration?: string; fileName?: string };
  onChange?: (content: { url?: string; duration?: string; fileName?: string }) => void;
}

export const VoiceNote: React.FC<VoiceNoteProps> = ({
  content,
  onChange
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(blob);
        const duration = formatTime(recordingDuration);
        onChange?.({ url: audioUrl, duration, fileName: `recording-${Date.now()}.webm` });
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      setIsRecording(true);
      setRecordingDuration(0);
      mediaRecorder.start();

      // Start timer
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          // Auto-stop at 30 seconds
          if (newDuration >= 30) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const togglePlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || !content.url) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleDeleteRecording = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (content.url) {
      URL.revokeObjectURL(content.url);
    }
    setCurrentTime(0);
    setIsPlaying(false);
    onChange?.({ url: undefined, duration: undefined, fileName: undefined });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (content.url) {
    return (
      <div className="w-full h-full flex flex-col justify-center space-y-4">
        <audio
          ref={audioRef}
          src={content.url}
          onEnded={handleAudioEnded}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          className="hidden"
        />
        
        <div className="flex items-center justify-center">
          <div className="neu-card p-4 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100">
            <div className="text-4xl mb-2 text-center">🎤</div>
            <p className="text-sm font-semibold text-center text-purple-700">
              {content.fileName || "Audio Recording"}
            </p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center space-x-3">
          <button
            onClick={togglePlayback}
            className={cn(
              'w-12 h-12 rounded-full shadow-neu flex items-center justify-center',
              'hover:shadow-neu-hover active:shadow-neu-pressed transition-all',
              'bg-gradient-to-r from-purple-500 to-blue-500 text-white border-none hover:scale-110'
            )}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </button>
          
          <button
            onClick={handleDeleteRecording}
            className={cn(
              'w-8 h-8 rounded-full shadow-neu flex items-center justify-center',
              'hover:shadow-neu-hover active:shadow-neu-pressed transition-all',
              'text-destructive'
            )}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <div className="flex-1 h-3 bg-gradient-to-r from-purple-200 to-blue-200 rounded-full overflow-hidden shadow-neu-inset">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
              style={{ width: `${audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0}%` }}
            />
          </div>
          <span>{content.duration || formatTime(audioDuration)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
      {/* Recording Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          isRecording ? stopRecording() : startRecording();
        }}
        className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center',
          'transition-all duration-200',
          isRecording
            ? 'bg-destructive text-destructive-foreground shadow-neu-pressed animate-pulse'
            : 'shadow-neu hover:shadow-neu-hover active:shadow-neu-pressed text-primary'
        )}
      >
        {isRecording ? (
          <Square className="w-8 h-8" />
        ) : (
          <Mic className="w-8 h-8" />
        )}
      </button>

      {/* Recording Status */}
      <div className="text-center">
        {isRecording ? (
          <div className="space-y-1">
            <div className="text-sm font-medium text-destructive">
              Recording...
            </div>
            <div className="text-xs text-muted-foreground">
              {formatTime(recordingDuration)} / 0:30
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">
              Voice Memo
            </div>
            <div className="text-xs text-muted-foreground">
              Tap to record (max 30s)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceNote;