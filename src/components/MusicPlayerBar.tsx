import React from 'react';
import { SoundtrackMeta, getSoundtracks } from '../audio/sound';

interface Props {
  currentTrackIndex: number;
  isPlaying: boolean;
  onSelectTrack: (idx: number) => void;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
}

export const MusicPlayerBar: React.FC<Props> = ({
  currentTrackIndex,
  isPlaying,
  onSelectTrack,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
}) => {
  const tracks = getSoundtracks();
  const curTrack = tracks[currentTrackIndex] || tracks[0];

  return (
    <div className="glass-panel p-2.5 flex items-center justify-between gap-3 text-xs bg-[#101018]/90 border border-[#b98bff]/40 shadow-[0_0_15px_rgba(185,139,255,0.15)] pointer-events-auto rounded-xl">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onTogglePlay}
          className="w-8 h-8 rounded-lg bg-[#b98bff]/20 hover:bg-[#b98bff]/40 border border-[#b98bff]/60 text-white flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
          title={isPlaying ? 'Pause Music' : 'Play Background Music'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#b98bff] font-bold tracking-wider">OST JUKEBOX</span>
            {isPlaying && <span className="w-1.5 h-1.5 rounded-full bg-[#7ee787] animate-ping" />}
          </div>
          <div className="font-bold text-white text-xs truncate max-w-[170px] md:max-w-[220px]">
            {curTrack.title}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onPrevTrack}
          className="w-7 h-7 rounded bg-white/5 hover:bg-white/15 border border-white/20 text-gray-300 text-xs flex items-center justify-center cursor-pointer"
          title="Previous Track"
        >
          ⏮
        </button>
        <select
          value={currentTrackIndex}
          onChange={(e) => onSelectTrack(parseInt(e.target.value, 10))}
          className="bg-black/60 border border-gray-700 text-gray-200 text-[11px] rounded px-2 py-1 cursor-pointer focus:outline-none focus:border-[#b98bff]"
        >
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id + 1}. {t.title}
            </option>
          ))}
        </select>
        <button
          onClick={onNextTrack}
          className="w-7 h-7 rounded bg-white/5 hover:bg-white/15 border border-white/20 text-gray-300 text-xs flex items-center justify-center cursor-pointer"
          title="Next Track"
        >
          ⏭
        </button>
      </div>
    </div>
  );
};
