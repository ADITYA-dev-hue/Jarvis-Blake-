import React, { useState, useEffect } from 'react';
import {
  Music,
  Video,
  Play,
  Pause,
  RefreshCw,
  ShieldCheck,
  Disc,
  Radio
} from 'lucide-react';
import { MediaStatusData } from '../../types/command';
import socketService from '../../services/socket';
import audioFx from '../../services/audioFx';

interface NowPlayingCardProps {
  isOnline: boolean;
}

export const NowPlayingCard: React.FC<NowPlayingCardProps> = ({ isOnline }) => {
  const [media, setMedia] = useState<MediaStatusData>({
    active: false,
    playbackState: 'stopped',
    mediaType: 'none',
    title: '',
    artist: '',
    album: '',
    source: ''
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const unsub = socketService.onMediaStatus((data) => {
      if (data) {
        setMedia(data);
      }
    });

    if (isOnline) {
      socketService.requestMediaStatus();
    }

    return () => {
      unsub();
    };
  }, [isOnline]);

  const handleRefresh = () => {
    audioFx.playClick();
    setIsRefreshing(true);
    socketService.requestMediaStatus();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const isPlaying = media.active && media.playbackState === 'playing';
  const isPaused = media.active && media.playbackState === 'paused';

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-violet-500/20 rounded-2xl p-4 shadow-xl relative overflow-hidden">
      {/* Subtle pulsing background glow if playing */}
      {isPlaying && (
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-400">
            {media.mediaType === 'video' ? (
              <Video className="w-5 h-5" />
            ) : (
              <Music className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              DESKTOP MEDIA
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                  isPlaying
                    ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400'
                    : isPaused
                    ? 'bg-amber-950/60 border-amber-500/30 text-amber-400'
                    : 'bg-slate-950/60 border-slate-700/50 text-slate-400'
                }`}
              >
                {isPlaying && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                {media.playbackState.toUpperCase()}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Live desktop playback telemetry</p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={!isOnline || isRefreshing}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-violet-400 hover:text-violet-300 border border-violet-500/30 disabled:opacity-50 transition-all flex items-center gap-1 text-xs"
          title="Poll media playback"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {media.active ? (
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-violet-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl bg-violet-950/40 border border-violet-500/30 text-violet-400 flex-shrink-0 ${isPlaying ? 'animate-pulse' : ''}`}>
              <Disc className={`w-6 h-6 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate max-w-[280px]" title={media.title}>
                {media.title || 'Playing Audio'}
              </div>
              <div className="text-[11px] text-violet-300 truncate max-w-[280px]">
                {media.artist ? media.artist : 'Active Playback Stream'}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {media.source && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {media.source}
                  </span>
                )}
                {media.mediaType && media.mediaType !== 'none' && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-violet-300 border border-violet-900/40 capitalize">
                    {media.mediaType}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-400 font-mono">
            {isPlaying ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Play className="w-3.5 h-3.5 fill-current" />
                Playing
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400">
                <Pause className="w-3.5 h-3.5 fill-current" />
                Paused
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="py-5 px-4 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
          <Radio className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
          <p className="text-xs text-slate-400 font-medium">No media playback detected</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Play music or video on Chrome, Edge, Spotify, or VLC
          </p>
        </div>
      )}

      {/* Authoritative Privacy Shield Notice */}
      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span className="flex items-center gap-1 text-slate-400 font-medium">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          Privacy Guard Active
        </span>
        <span className="font-mono text-slate-500">
          Metadata-Only • Zero Audio/Video Capture
        </span>
      </div>
    </div>
  );
};

export default NowPlayingCard;
