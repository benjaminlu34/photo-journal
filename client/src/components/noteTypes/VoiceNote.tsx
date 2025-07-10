import React, { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Mic, Play, Pause, Trash2, AudioWaveform } from "lucide-react";
import type { VoiceNoteContent } from "@/types/notes";

interface VoiceNoteProps {
  content: VoiceNoteContent;
  onChange?: (content: VoiceNoteContent) => void;
}

const VoiceNote: React.FC<VoiceNoteProps> = ({ content = { type: 'voice' }, onChange }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        onChange?.({ type: 'voice', audioUrl, duration: Date.now() / 1000 });
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDeleteRecording = () => {
    onChange?.({ type: 'voice', audioUrl: undefined, duration: undefined });
    setIsPlaying(false);
    setCurrentTime(0);
  };

  if (content?.audioUrl) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <audio
          ref={audioRef}
          src={content?.audioUrl}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          className="hidden"
        />
        
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlayback}
            className={cn(
              'w-12 h-12 rounded-full shadow-md hover:shadow-lg flex items-center justify-center',
              'bg-blue-500 hover:bg-blue-600 text-white transition-all'
            )}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>

          <button
            onClick={handleDeleteRecording}
            className={cn(
              'w-8 h-8 rounded-full opacity-70 hover:opacity-100',
              'bg-red-500 hover:bg-red-600 text-white',
              'flex items-center justify-center transition-all'
            )}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Voice Recording</span>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"
              style={{ backgroundImage: `linear-gradient(to right, #3b82f6 ${(currentTime / duration) * 100}%, transparent 0%)` }}
            />
            <span className="text-xs text-gray-500">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col items-center justify-center gap-4">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={cn(
          'w-16 h-16 rounded-full shadow-md hover:shadow-lg flex items-center justify-center',
          'transition-all',
          isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
        )}
      >
        <Mic className="w-8 h-8" />
      </button>

      {isRecording ? (
        <div className={cn(
          'flex flex-col items-center gap-1',
          'text-red-500'
        )}>
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm">Recording...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <AudioWaveform className="w-8 h-8" />
          <div className="text-center">
            <div className="text-sm">Tap to record</div>
            <div className="text-xs">(max 60s)</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceNote;