import React from 'react';
import { Door } from '../types/game';
import { WORLD_W, WORLD_H } from '../game/constants';

interface Props {
  doors: Door[];
  playerX: number;
  playerY: number;
  pinnedDoorIndex: number | null;
  onPin: (index: number | null) => void;
  onClose: () => void;
}

// Map area size in px — kept at the same 4:3 ratio as WORLD_W / WORLD_H so
// door positions scale evenly on both axes.
const MAP_W = 700;
const MAP_H = MAP_W * (WORLD_H / WORLD_W);
const SCALE_X = MAP_W / WORLD_W;
const SCALE_Y = MAP_H / WORLD_H;

// Bearing from (fromX, fromY) to (toX, toY) in degrees, 0 = north/up,
// clockwise — matches a CSS rotate() applied to an upward-pointing arrow.
// World y grows downward (canvas convention), so "north" is -y.
function bearingDeg(fromX: number, fromY: number, toX: number, toY: number) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
}

export const WorldMap: React.FC<Props> = ({ doors, playerX, playerY, pinnedDoorIndex, onPin, onClose }) => {
  const pinned = pinnedDoorIndex != null ? doors.find((d) => d.index === pinnedDoorIndex) || null : null;
  const compassSize = MAP_W * 1.18;
  const compassRadius = compassSize / 2;

  const heading = pinned ? bearingDeg(playerX, playerY, pinned.x, pinned.y) : null;
  const distance = pinned ? Math.round(Math.hypot(pinned.x - playerX, pinned.y - playerY)) : null;

  return (
    <div className="absolute inset-0 z-50 bg-black/85 flex items-center justify-center p-3 md:p-4">
      <div className="w-[min(96vw,900px)] max-h-[92vh] overflow-y-auto bg-[#14141a] border border-[#3a3a46] rounded-2xl p-5 md:p-6 shadow-2xl flex flex-col items-center">
        <div className="flex justify-between items-center w-full mb-4">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-black text-[#83d3e1] mb-0.5">WORLD MAP</h2>
            <div className="text-xs text-gray-400">
              Click a gate icon to pin it — the compass ring below points the way.
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white px-3 py-1 bg-white/10 rounded-lg text-sm cursor-pointer"
          >
            ✕ Close (M)
          </button>
        </div>

        {/* Compass ring circumscribing the map + the map itself */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: compassSize, height: compassSize, maxWidth: '100%' }}
        >
          {/* Perimeter compass ring */}
          <div
            className="absolute rounded-full border-2 border-[#83d3e1]/40"
            style={{ width: compassSize, height: compassSize }}
          />
          {['N', 'E', 'S', 'W'].map((label, i) => {
            const ang = i * 90; // 0=N(top), 90=E(right), 180=S(bottom), 270=W(left)
            const rad = (ang * Math.PI) / 180;
            const x = compassRadius + Math.sin(rad) * (compassRadius - 14);
            const y = compassRadius - Math.cos(rad) * (compassRadius - 14);
            return (
              <span
                key={label}
                className="absolute text-[11px] font-black text-[#83d3e1]"
                style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
              >
                {label}
              </span>
            );
          })}

          {/* Sharp direction pointer — sits on the ring, rotated toward the pinned door's bearing */}
          {pinned && heading != null && (
            <div
              className="absolute"
              style={{
                width: compassSize,
                height: compassSize,
                transform: `rotate(${heading}deg)`,
                transition: 'transform 120ms linear',
              }}
            >
              <div
                className="absolute left-1/2 top-0 -translate-x-1/2"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '9px solid transparent',
                  borderRight: '9px solid transparent',
                  borderBottom: '16px solid #ffd166',
                  filter: 'drop-shadow(0 0 6px #ffd166)',
                }}
              />
            </div>
          )}

          {/* Map surface */}
          <div
            className="relative rounded-xl overflow-hidden border border-[#3a3a46] bg-[#0a0a0d]"
            style={{
              width: MAP_W,
              height: MAP_H,
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(131,211,225,0.06) 0px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(131,211,225,0.06) 0px, transparent 1px, transparent 40px)',
            }}
          >
            {/* Player marker */}
            <div
              className="absolute rounded-full bg-white shadow-[0_0_10px_#fff]"
              style={{
                width: 10,
                height: 10,
                left: playerX * SCALE_X,
                top: playerY * SCALE_Y,
                transform: 'translate(-50%, -50%)',
              }}
              title="You"
            />
            <div
              className="absolute rounded-full border border-white/40 animate-ping"
              style={{
                width: 18,
                height: 18,
                left: playerX * SCALE_X,
                top: playerY * SCALE_Y,
                transform: 'translate(-50%, -50%)',
              }}
            />

            {/* Door / gate pins */}
            {doors.map((d) => {
              const isPinned = d.index === pinnedDoorIndex;
              return (
                <button
                  key={d.index}
                  onClick={() => onPin(isPinned ? null : d.index)}
                  className="absolute flex items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-110"
                  style={{
                    width: 30,
                    height: 30,
                    left: d.x * SCALE_X,
                    top: d.y * SCALE_Y,
                    transform: 'translate(-50%, -50%)',
                    background: d.unlocked ? `${d.bossColor}33` : 'rgba(80,80,90,0.3)',
                    border: `2px solid ${isPinned ? '#ffd166' : d.unlocked ? d.bossColor : '#555'}`,
                    boxShadow: isPinned ? '0 0 12px #ffd166' : 'none',
                    filter: d.unlocked ? 'none' : 'grayscale(1) brightness(0.7)',
                  }}
                  title={`${d.name}${d.cleared ? ' (Cleared)' : d.unlocked ? ' (Unlocked)' : ' (Locked)'}`}
                >
                  <span className="text-sm">{d.bossIcon}</span>
                  {d.cleared && (
                    <span className="absolute -bottom-1 -right-1 text-[10px] bg-[#7ee787] text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-black">
                      ✓
                    </span>
                  )}
                  {isPinned && (
                    <span className="absolute -top-2 -right-1 text-[11px]">📌</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status line */}
        <div className="mt-4 w-full text-center">
          {pinned ? (
            <div className="text-sm text-[#ffd166] font-bold">
              📌 Tracking {pinned.name} — {distance} units away
              <button
                onClick={() => onPin(null)}
                className="ml-3 text-xs text-gray-400 hover:text-white underline cursor-pointer"
              >
                Unpin
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No location pinned — click a gate icon above to track it.</div>
          )}
        </div>
      </div>
    </div>
  );
};
