import React from 'react';
import { PlayerState, Door, Superpower, Soldier, BaseState } from '../types/game';

interface Props {
  hudState: {
    hp: number;
    hpMax: number;
    wave: number;
    kills: number;
    atoms: number;
    airdropTimer: string;
    bossTimer: string;
    activeSlot: number;
    grenades: number;
    medkits: number;
    serums: number;
    hasBoss: boolean;
    bossName: string;
    bossQuote: string;
    bossAttackTag: string;
    bossHpPct: number;
    bossPhase?: number;
    bossEnraged?: boolean;
    meleeLegendary: boolean;
    meleeName: string;
    slots: (any)[];
    tankNear: boolean;
    tankMounted: boolean;
    nearDoor: Door | null;
    onTowerName: string | null;
    towerHp?: number;
    towerHpMax?: number;
    inCover: boolean;
    inBaseSafeZone: boolean;
  };
  player: PlayerState;
  superpowers: Record<string, Superpower>;
  soldiers: Soldier[];
  base: BaseState;
  onOpenShop: () => void;
  onPerformMelee: () => void;
  onSelectSlot: (idx: number) => void;
  onThrowGrenade: () => void;
  onUseConsumable: () => void;
  onActivateSuperpower: (id: string) => void;
}

export const GameHUD: React.FC<Props> = ({
  hudState,
  player,
  superpowers,
  soldiers,
  base,
  onOpenShop,
  onPerformMelee,
  onSelectSlot,
  onThrowGrenade,
  onUseConsumable,
  onActivateSuperpower,
}) => {
  const now = performance.now();

  return (
    <div className="absolute inset-0 z-20 pointer-events-none p-4 flex flex-col justify-between">
      {/* Top Row */}
      <div className="flex justify-between items-start w-full">
        {/* Operator HP & Status */}
        <div className="glass-panel p-3 neon-border-blue w-72 pointer-events-auto bg-[#0a0a0d]/90">
          <div className="text-[10px] text-[#83d3e1] font-bold tracking-widest mb-1 flex justify-between">
            <span>OPERATOR HP</span>
            <span className="text-[#7ee787] animate-pulse">
              {hudState.inBaseSafeZone
                ? `🏰 BASE REGEN +${base.healingRate} HP/s`
                : player.upgrades.regenBoost > 0
                ? 'BIOREGEN ACTIVE'
                : hudState.hasBoss
                ? 'REGEN: 4%/10s'
                : 'REGEN: 6%/10s'}
            </span>
          </div>
          <div className="w-full h-4 bg-gray-950 rounded overflow-hidden border border-gray-700 relative">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#ff4d5e] to-[#ff8a7a] transition-all duration-150 shadow-[0_0_10px_#ff4d5e]"
              style={{ width: `${Math.max(0, (hudState.hp / hudState.hpMax) * 100)}%` }}
            />
          </div>
          <div className="text-xs mt-1 text-white font-bold flex justify-between">
            <span>
              {Math.floor(hudState.hp)} / {hudState.hpMax}
            </span>
            {player.armorLevel > 0 && (
              <span className="text-[#ffcf5c] text-[10px]">ARMOR LV{player.armorLevel}</span>
            )}
          </div>

          {/* Tactical Elevation, Base & Cover Indicator */}
          <div className="mt-2 pt-2 border-t border-gray-800 flex flex-col gap-1.5">
            {hudState.inBaseSafeZone && (
              <div className="p-1.5 rounded bg-blue-950/60 border border-[#83d3e1] text-[#83d3e1] text-[10px] font-bold flex flex-col gap-0.5 animate-pulse">
                <div className="flex justify-between items-center">
                  <span>🏰 MINECRAFT SAFE ZONE</span>
                  <span className="text-[#7ee787]">SANCTUARY</span>
                </div>
                <span className="text-[9px] text-gray-300">
                  Zombies cannot enter • Weapon safety on • Fast healing
                </span>
              </div>
            )}
            {hudState.onTowerName && (
              <div className="p-1.5 rounded bg-[#83d3e1]/20 border border-[#83d3e1] text-[#83d3e1] text-[10px] font-bold flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span>🗼 {hudState.onTowerName} (HIGH GROUND)</span>
                  <span className="text-white">{hudState.towerHp || 1000}/{hudState.towerHpMax || 1000} HP</span>
                </div>
                <div className="w-full h-1.5 bg-black/60 rounded overflow-hidden">
                  <div
                    className="h-full bg-[#83d3e1] transition-all"
                    style={{ width: `${((hudState.towerHp || 1000) / (hudState.towerHpMax || 1000)) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] text-[#ffd166]">✓ Immune to ground melee • +35% Snipe Range</span>
              </div>
            )}
            {hudState.inCover && (
              <span className="px-2 py-0.5 rounded bg-[#7ee787]/20 border border-[#7ee787] text-[#7ee787] text-[10px] font-bold">
                🛡️ BEHIND COVER (-60% RANGED DMG)
              </span>
            )}
            {player.onBoxId && (
              <span className="px-2 py-0.5 rounded bg-[#ffd166]/20 border border-[#ffd166] text-[#ffd166] text-[10px] font-bold">
                📦 ON CRATE PLATFORM
              </span>
            )}
          </div>
        </div>

        {/* Boss HUD with Phase 2 & Enrage display */}
        {hudState.hasBoss && (
          <div className="flex flex-col items-center w-[min(90vw,440px)] pointer-events-auto">
            <div className="flex items-center gap-2 mb-1">
              <div className="font-display text-2xl font-black text-[#ff4d5e] neon-text-red tracking-widest text-center">
                {hudState.bossName}
              </div>
              {hudState.bossEnraged && (
                <span className="px-2 py-0.5 text-[10px] font-black tracking-widest bg-red-600/40 border border-red-500 text-red-300 rounded animate-pulse shadow-[0_0_10px_#f00]">
                  🔥 PHASE 2: ENRAGED
                </span>
              )}
            </div>

            {hudState.bossQuote && <div className="text-[11px] text-gray-300 italic mb-1 h-4">{hudState.bossQuote}</div>}
            {hudState.bossAttackTag && (
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#ffcf5c] mb-1 bg-black/60 px-2 py-0.5 rounded border border-[#ffcf5c]/40 animate-pulse">
                {hudState.bossAttackTag}
              </div>
            )}
            <div className="w-full h-5 bg-gray-950 rounded border-2 border-[#ff4d5e] relative overflow-hidden shadow-[0_0_15px_rgba(255,77,94,0.4)]">
              <div
                className={`absolute top-0 left-0 h-full transition-all duration-150 ${
                  hudState.bossEnraged ? 'bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400' : 'bg-[#ff4d5e]'
                }`}
                style={{ width: `${hudState.bossHpPct}%` }}
              />
            </div>
            <div className="text-[10px] text-[#ffd166] mt-1 font-bold">
              ⚡ Defeat this Boss to unlock Superpowers!
            </div>
          </div>
        )}

        {/* Stats, Squad & Atoms */}
        <div className="flex flex-col gap-2 items-end">
          <div className="glass-panel p-3 neon-border-red w-56 text-right pointer-events-auto bg-[#0a0a0d]/90">
            <div className="text-[10px] text-[#ff4d5e] font-bold tracking-widest border-b border-gray-700 pb-1 mb-2">ARENA STATUS</div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-400">WAVE</span>
              <span className="font-bold text-[#ffcf5c] text-lg font-display">{hudState.wave}</span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-400">KILLS</span>
              <span className="font-bold text-[#83d3e1] text-lg">{hudState.kills}</span>
            </div>

            {/* Squad Status Mini Widget */}
            {soldiers.length > 0 && (
              <div className="mt-2 pt-1.5 border-t border-gray-800 text-left">
                <div className="text-[10px] text-[#7ee787] font-bold flex justify-between">
                  <span>👥 SQUAD SIZED</span>
                  <span>{soldiers.filter(s => !s.isDead).length}/{soldiers.length} ALIVE</span>
                </div>
                <div className="flex gap-1 mt-1">
                  {soldiers.map((s, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 h-1.5 rounded-full ${
                        s.isDead ? 'bg-red-500/40' : s.hasSuperpower ? 'bg-[#ffd166]' : 'bg-[#7ee787]'
                      }`}
                      title={`${s.name} (${s.isDead ? 'Down' : 'Ready'})`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-700 text-left">
              <div>
                AIRDROP: <span className="text-[#ffcf5c] font-bold">{hudState.airdropTimer}</span>
              </div>
              <div>
                BOSS IN: <span className="text-[#ff4d5e] font-bold">{hudState.bossTimer}</span>
              </div>
            </div>
          </div>

          <div
            onClick={onOpenShop}
            className="glass-panel p-3 w-56 pointer-events-auto cursor-pointer border border-[#7ee787]/60 hover:bg-[#7ee787]/10 transition-colors bg-[#0a0a0d]/90"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[#7ee787] font-bold tracking-widest">⚛ ZOMB ATOMS</span>
              <span className="text-xl font-bold text-[#c6ff6b]">{hudState.atoms}</span>
            </div>
            <div className="text-[9px] text-gray-400 mt-1 flex justify-between">
              <span>Base & Squad HQ</span>
              <span className="text-[#7ee787]">PRESS B ↗</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center Skill Bar — 1 clickable Active + up to 2 passive badges */}
      <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
        <div className="flex gap-2">
          {(Object.values(superpowers) as Superpower[])
            .filter((sp) => sp.unlocked && sp.equipped && sp.category === 'active')
            .map((sp) => {
            const timeSince = now - sp.lastUsed;
            const onCd = timeSince < sp.cooldown;
            const cdPct = onCd ? 1 - timeSince / sp.cooldown : 0;
            const cdSec = Math.ceil((sp.cooldown - timeSince) / 1000);
            const isActive = sp.activeUntil > now;

            return (
              <button
                key={sp.id}
                disabled={!sp.unlocked || onCd}
                onClick={() => onActivateSuperpower(sp.id)}
                className={`relative px-3 py-2 rounded-xl flex items-center gap-2 border transition-all cursor-pointer overflow-hidden ${
                  isActive
                    ? 'bg-purple-600/40 border-[#ffd166] shadow-[0_0_20px_#ffd166] scale-105 animate-pulse'
                    : sp.unlocked
                    ? 'bg-[#0a0a0d]/90 border-purple-500/50 hover:border-purple-300 hover:scale-102'
                    : 'bg-black/40 border-white/5 opacity-40 cursor-not-allowed'
                }`}
              >
                {/* CD Overlay */}
                {onCd && (
                  <div
                    className="absolute inset-0 bg-black/75 z-10 flex items-center justify-center text-xs font-mono font-bold text-white"
                  >
                    {cdSec}s
                  </div>
                )}
                {/* CD Progress fill */}
                {onCd && (
                  <div
                    className="absolute bottom-0 left-0 h-1 bg-[#ff4d5e] z-20"
                    style={{ width: `${cdPct * 100}%` }}
                  />
                )}

                <span className="text-xl">{sp.icon}</span>
                <div className="text-left">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-white">{sp.name}</span>
                    <span className="px-1 py-0.2 bg-white/20 rounded text-[9px] font-mono text-[#ffd166]">
                      [{sp.key}]
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {sp.unlocked ? (isActive ? '⚡ ACTIVE NOW' : 'READY') : 'LOCKED (Beat Boss)'}
                  </div>
                </div>
              </button>
            );
          })}
          {(Object.values(superpowers) as Superpower[])
            .filter((sp) => sp.unlocked && sp.equipped && sp.category === 'passive')
            .map((sp) => (
              <div
                key={sp.id}
                title={`${sp.name}: ${sp.desc}`}
                className="relative px-2.5 py-2 rounded-xl flex items-center gap-1.5 border border-white/10 bg-[#0a0a0d]/70"
              >
                <span className="text-lg">{sp.icon}</span>
                <span className="text-[9px] font-mono text-gray-400">PASSIVE</span>
              </div>
            ))}
        </div>
      </div>

      {/* Bottom Inventory */}
      <div className="flex justify-center items-end w-full pb-2 pointer-events-auto">
        <div className="glass-panel p-2 flex gap-2 shadow-[0_0_20px_rgba(0,0,0,0.8)] bg-[#0a0a0d]/90 items-center rounded-xl">
          {/* Melee Slot */}
          <div
            onClick={onPerformMelee}
            className="inv-slot cursor-pointer"
            style={{ borderColor: hudState.meleeLegendary ? '#ffd166' : '#b98bff' }}
          >
            <span className="absolute top-1 left-1 text-[9px] text-gray-400">Q</span>
            <span className="text-2xl">{hudState.meleeLegendary ? '🗡️' : '🔪'}</span>
            <span className="absolute bottom-1 text-[8px] text-gray-300 truncate max-w-[56px] text-center">{hudState.meleeName}</span>
          </div>

          <div className="w-px h-10 bg-gray-700 mx-1" />

          {/* Weapon Slots 1-4 */}
          {[0, 1, 2, 3].map((slotIdx) => {
            const wpn = hudState.slots[slotIdx];
            const isActive = hudState.activeSlot === slotIdx;
            return (
              <div
                key={slotIdx}
                onClick={() => onSelectSlot(slotIdx)}
                className={`inv-slot cursor-pointer ${isActive ? 'active' : ''}`}
              >
                <span className="absolute top-1 left-1 text-[9px] text-gray-400">{slotIdx + 1}</span>
                {wpn?.iconImg ? (
                  <img src={wpn.iconImg} alt={wpn.name} className="w-7 h-7 object-contain" style={{ imageRendering: 'pixelated' }} />
                ) : (
                  <span className="text-2xl">{wpn ? wpn.icon : ''}</span>
                )}
                <span className="absolute bottom-1 right-1 text-[10px] text-[#83d3e1] font-bold">
                  {wpn ? (wpn.ammoBased ? wpn.ammo : wpn.infinite ? '∞' : '') : ''}
                </span>
                <div
                  className="durability-bar"
                  style={{
                    width: wpn ? (wpn.ammoBased ? `${((wpn.ammo || 0) / (wpn.ammoMax || 1)) * 100}%` : wpn.infinite ? '100%' : `${((wpn.dur || 0) / (wpn.durMax || 1)) * 100}%`) : '0%',
                  }}
                />
              </div>
            );
          })}

          <div className="w-px h-10 bg-gray-700 mx-1" />

          {/* Gadgets */}
          <div onClick={onThrowGrenade} className="inv-slot cursor-pointer">
            <span className="absolute top-1 left-1 text-[9px] text-gray-400">G</span>
            <span className="text-2xl">💣</span>
            <span className="absolute bottom-1 right-1 text-[10px] text-[#ffcf5c] font-bold">{hudState.grenades}</span>
          </div>
          <div onClick={onUseConsumable} className="inv-slot cursor-pointer">
            <span className="absolute top-1 left-1 text-[9px] text-gray-400">E</span>
            <span className="text-2xl">{hudState.serums > 0 ? '🧪' : '💊'}</span>
            <span className="absolute bottom-1 right-1 text-[10px] text-[#7ee787] font-bold">{hudState.medkits + hudState.serums}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
