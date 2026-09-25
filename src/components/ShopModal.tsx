import React from 'react';
import { PlayerState, Tank, BaseState, Soldier, Superpower, SoldierType, WeaponDef, Tower } from '../types/game';
import { WEAPONS, ARMOR_LEVELS, UPGRADES } from '../game/constants';
import { BASE_LEVELS } from '../game/baseLogic';
import { SOLDIER_DEFINITIONS } from '../game/soldierLogic';
import { playUpgradeSound, playHealSound } from '../audio/sound';

interface Props {
  atoms: number;
  player: PlayerState;
  tank: Tank;
  turretCount: number;
  base: BaseState;
  soldiers: Soldier[];
  superpowers: Record<string, Superpower>;
  towers?: Tower[];
  onBuyItem: (type: string, cost: number, payload?: any) => void;
  onUpgradeBase: () => void;
  onRecruitSoldier: (type: SoldierType) => void;
  onUpgradeSoldier: (id: string) => void;
  onRepairWeapon?: (slotIdx: number) => void;
  onRebuildWeapon?: (weaponId: string) => void;
  onUpgradeTank?: (component: 'armor' | 'cannon' | 'speed' | 'nanites') => void;
  onRepairTowers?: () => void;
  onToggleEquipSkill?: (id: string) => void;
  onClose: () => void;
}

export const ShopModal: React.FC<Props> = ({
  atoms,
  player,
  tank,
  turretCount,
  base,
  soldiers,
  superpowers,
  towers = [],
  onBuyItem,
  onUpgradeBase,
  onRecruitSoldier,
  onUpgradeSoldier,
  onRepairWeapon,
  onRebuildWeapon,
  onUpgradeTank,
  onRepairTowers,
  onToggleEquipSkill,
  onClose,
}) => {
  const [tab, setTab] = React.useState<'base' | 'soldiers' | 'repair' | 'tank' | 'superpowers' | 'upgrades' | 'gear' | 'armor'>('repair');

  const currentBaseDef = BASE_LEVELS[base.level] || BASE_LEVELS[1];

  return (
    <div className="absolute inset-0 z-50 bg-black/85 flex items-center justify-center p-3 md:p-4">
      <div className="w-[min(96vw,940px)] max-h-[92vh] overflow-y-auto bg-[#14141a] border border-[#3a3a46] rounded-2xl p-5 md:p-6 shadow-2xl flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-black text-[#ff4d5e] mb-0.5">
              MILITARY COMMAND POST & BARRACKS
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-[#c6ff6b] font-bold">Balance: {atoms} ⚛ Zomb Atoms</span>
              <span className="text-xs text-[#83d3e1] font-mono bg-white/5 px-2 py-0.5 rounded">
                Base Lv{base.level} • Squad: {soldiers.length}/{base.maxSoldiers} Max
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white px-3 py-1 bg-white/10 rounded-lg text-sm cursor-pointer"
          >
            ✕ Close (B)
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-800 pb-2">
          {[
            { id: 'repair', label: '🔧 Gun Repair & Rebuild Box', badge: 'WORKBENCH' },
            { id: 'soldiers', label: '👥 Squad Barracks', badge: `${soldiers.length}/${base.maxSoldiers}` },
            { id: 'base', label: '🏰 Base Bastion', badge: `Lv${base.level}` },
            { id: 'superpowers', label: '⚡ Skills', badge: `${(Object.values(superpowers) as Superpower[]).filter(s => s.unlocked).length}/1` },
            { id: 'upgrades', label: '⚙️ Core Upgrades', badge: '5' },
            { id: 'gear', label: '🔫 Arsenal & Tactics', badge: '6' },
            { id: 'armor', label: '🛡️ Armor Plating', badge: `Lv${player.armorLevel}` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                tab === t.id
                  ? 'bg-[#ff4d5e] text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{t.label}</span>
              {t.badge && (
                <span className="bg-black/30 px-1.5 py-0.2 rounded text-[10px] text-[#ffd166]">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Gun Repair & Rebuild Box Workbench */}
        {tab === 'repair' && (
          <div className="flex flex-col gap-4">
            <div className="bg-gradient-to-r from-[#2e2609] to-[#1c1917] border border-[#eab308]/40 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>🔧</span>
                    <span>WEAPON REPAIR & REBUILD WORKBENCH</span>
                  </h3>
                  <p className="text-xs text-yellow-200/80 mt-1">
                    Guns don't get destroyed permanently! When durability is depleted or a weapon is damaged, rebuild and repair it here to 100% condition and refill ammo.
                  </p>
                </div>
                {onRepairTowers && (
                  <button
                    disabled={atoms < 60}
                    onClick={() => {
                      onRepairTowers();
                    }}
                    className="px-3 py-1.5 bg-[#83d3e1] text-[#0f172a] font-bold text-xs rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    🗼 Repair All Towers (60 ⚛)
                  </button>
                )}
              </div>
            </div>

            {/* Currently Equipped Weapons in Slots */}
            <div>
              <h4 className="text-xs font-bold text-[#eab308] uppercase tracking-wider mb-2">Equipped Weapons Condition</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {player.slots.map((slot, idx) => {
                  if (!slot) return null;
                  const durMax = slot.durMax || 100;
                  const dur = slot.dur !== undefined ? slot.dur : durMax;
                  const isDamaged = dur <= 0 || slot.damaged;
                  const durPct = Math.max(0, Math.min(100, Math.round((dur / durMax) * 100)));
                  const repairCost = Math.max(10, Math.round((slot.repairCost || 25) * (1 - dur / durMax)));
                  const canRepair = dur < durMax && atoms >= repairCost;

                  return (
                    <div
                      key={idx}
                      className={`bg-white/5 border rounded-xl p-3.5 flex flex-col justify-between ${
                        isDamaged ? 'border-red-500/60 bg-red-950/20' : 'border-white/10'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            {slot.iconImg ? (
                              <img src={slot.iconImg} alt={slot.name} className="w-7 h-7 object-contain" style={{ imageRendering: 'pixelated' }} />
                            ) : (
                              <span className="text-2xl">{slot.icon}</span>
                            )}
                            <div>
                              <div className="font-bold text-sm text-white flex items-center gap-2">
                                <span>Slot {idx + 1}: {slot.name}</span>
                                {isDamaged && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-red-500/30 text-red-300 font-bold rounded">
                                    DAMAGED
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400">
                                Damage: {slot.dmg} • Rate: {slot.rate}ms
                              </div>
                            </div>
                          </div>
                          <span className={`text-xs font-mono font-bold ${durPct > 50 ? 'text-green-400' : durPct > 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {durPct}% HP
                          </span>
                        </div>

                        {/* Durability Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span>Durability / Integrity</span>
                            <span>{Math.round(dur)} / {durMax}</span>
                          </div>
                          <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                durPct > 50 ? 'bg-green-500' : durPct > 20 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${durPct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        disabled={!canRepair}
                        onClick={() => {
                          if (canRepair && onRepairWeapon) {
                            playUpgradeSound();
                            onRepairWeapon(idx);
                          }
                        }}
                        className="mt-3 py-1.5 bg-[#ffd166] text-black disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
                      >
                        {dur >= durMax ? '100% PRISTINE CONDITION' : `Repair & Recondition — ${repairCost} ⚛`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rebuild Catalog for Weapons */}
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Rebuild & Arsenal Catalog</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.values(WEAPONS).map((w) => {
                const isOwned = player.slots.some(s => s?.id === w.id);
                const cost = w.repairCost ? w.repairCost * 2 : 50;
                const canRebuild = !isOwned && atoms >= cost;

                return (
                  <div key={w.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {w.iconImg ? (
                          <img src={w.iconImg} alt={w.name} className="w-7 h-7 object-contain" style={{ imageRendering: 'pixelated' }} />
                        ) : (
                          <span className="text-2xl">{w.icon}</span>
                        )}
                        <div>
                          <div className="font-bold text-sm text-white">{w.name}</div>
                          <div className="text-[11px] text-gray-400">Dmg: {w.dmg} • Spd: {w.speed}</div>
                        </div>
                      </div>
                    </div>
                    <button
                      disabled={isOwned || !canRebuild}
                      onClick={() => {
                        if (canRebuild) {
                          playUpgradeSound();
                          if (onRebuildWeapon) {
                            onRebuildWeapon(w.id);
                          } else {
                            onBuyItem('weapon', cost, w);
                          }
                        }
                      }}
                      className="mt-2.5 py-1.5 bg-[#ffd166] text-black disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      {isOwned ? 'IN INVENTORY' : `Rebuild / Equip — ${cost} ⚛`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab: Assault Tank Workshop Bay */}
        {tab === 'tank' && (
          <div className="flex flex-col gap-4">
            <div className="bg-gradient-to-r from-[#14532d] to-[#052e16] border border-green-500/40 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🚜</span>
                    <span>HEAVY ASSAULT TANK GARAGE</span>
                  </h3>
                  <p className="text-xs text-green-200 mt-1">
                    Heavily armored tracked combat vehicle. Crushes zombie hordes on impact and fires continuous high-explosive tank missiles. Press <b>[F]</b> near the tank to mount/dismount!
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${tank.owned ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'}`}>
                  {tank.owned ? (tank.mounted ? 'ACTIVE (MOUNTED)' : 'DEPLOYED IN ARENA') : 'NOT OWNED'}
                </span>
              </div>

              {!tank.owned ? (
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs text-gray-300">Purchase Heavy Assault Tank</span>
                  <button
                    disabled={atoms < 800}
                    onClick={() => {
                      playUpgradeSound();
                      onBuyItem('tank', 800);
                    }}
                    className="px-4 py-2 bg-[#ffd166] text-black font-bold text-xs rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    Buy Assault Tank — 800 ⚛
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-white/10 text-xs">
                  <div className="bg-black/40 p-2.5 rounded-lg">
                    <div className="text-gray-400">Tank Health</div>
                    <div className="text-sm font-bold text-[#7ee787]">{Math.round(tank.hp)} / {tank.hpMax} HP</div>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-lg">
                    <div className="text-gray-400">Missile Damage</div>
                    <div className="text-sm font-bold text-[#ffcf5c]">{450 + (tank.cannonLevel || 1) * 200} Dmg</div>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-lg">
                    <div className="text-gray-400">Armor Level</div>
                    <div className="text-sm font-bold text-[#83d3e1]">Tier {tank.armorLevel || 1}/3</div>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-lg">
                    <div className="text-gray-400">Auto-Nanite Regen</div>
                    <div className="text-sm font-bold text-[#00f5d4]">+{40 * (tank.nanitesLevel || 1)} HP/s</div>
                  </div>
                </div>
              )}
            </div>

            {/* Tank Component Upgrades */}
            {tank.owned && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tank Component Upgrades</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Armor */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-sm text-white">🛡️ Reinforced Composite Armor Plating</div>
                      <p className="text-xs text-gray-300 mt-1">+8,000 Max HP & +25% Ramming Collision Damage.</p>
                      <div className="text-xs text-[#83d3e1] mt-2">Level: {tank.armorLevel || 1} / 3</div>
                    </div>
                    <button
                      disabled={(tank.armorLevel || 1) >= 3 || atoms < 350 * (tank.armorLevel || 1)}
                      onClick={() => {
                        if (onUpgradeTank) onUpgradeTank('armor');
                      }}
                      className="mt-3 py-2 bg-[#ffd166] text-black disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      {(tank.armorLevel || 1) >= 3 ? 'MAX LEVEL' : `Upgrade Armor — ${350 * (tank.armorLevel || 1)} ⚛`}
                    </button>
                  </div>

                  {/* Twin Cannon */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-sm text-white">🚀 Twin Heavy Plasma Cannons</div>
                      <p className="text-xs text-gray-300 mt-1">+200 Missile Damage & +40 Area Splash Radius.</p>
                      <div className="text-xs text-[#83d3e1] mt-2">Level: {tank.cannonLevel || 1} / 3</div>
                    </div>
                    <button
                      disabled={(tank.cannonLevel || 1) >= 3 || atoms < 400 * (tank.cannonLevel || 1)}
                      onClick={() => {
                        if (onUpgradeTank) onUpgradeTank('cannon');
                      }}
                      className="mt-3 py-2 bg-[#ffd166] text-black disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      {(tank.cannonLevel || 1) >= 3 ? 'MAX LEVEL' : `Upgrade Cannons — ${400 * (tank.cannonLevel || 1)} ⚛`}
                    </button>
                  </div>

                  {/* Engine */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-sm text-white">⚡ Turbo Overdrive Engine</div>
                      <p className="text-xs text-gray-300 mt-1">+35% Driving Speed and faster turret traverse.</p>
                      <div className="text-xs text-[#83d3e1] mt-2">Level: {tank.speedLevel || 1} / 3</div>
                    </div>
                    <button
                      disabled={(tank.speedLevel || 1) >= 3 || atoms < 300 * (tank.speedLevel || 1)}
                      onClick={() => {
                        if (onUpgradeTank) onUpgradeTank('speed');
                      }}
                      className="mt-3 py-2 bg-[#ffd166] text-black disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      {(tank.speedLevel || 1) >= 3 ? 'MAX LEVEL' : `Upgrade Engine — ${300 * (tank.speedLevel || 1)} ⚛`}
                    </button>
                  </div>

                  {/* Nanites */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-sm text-white">💚 Self-Healing Nanite Matrix</div>
                      <p className="text-xs text-gray-300 mt-1">Passively repairs +40 HP/s continuously.</p>
                      <div className="text-xs text-[#83d3e1] mt-2">Level: {tank.nanitesLevel || 1} / 3</div>
                    </div>
                    <button
                      disabled={(tank.nanitesLevel || 1) >= 3 || atoms < 350 * (tank.nanitesLevel || 1)}
                      onClick={() => {
                        if (onUpgradeTank) onUpgradeTank('nanites');
                      }}
                      className="mt-3 py-2 bg-[#ffd166] text-black disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      {(tank.nanitesLevel || 1) >= 3 ? 'MAX LEVEL' : `Upgrade Nanites — ${350 * (tank.nanitesLevel || 1)} ⚛`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Base Bastion */}
        {tab === 'base' && (
          <div className="flex flex-col gap-4">
            <div className="bg-gradient-to-r from-[#172554] to-[#1e1b4b] border border-[#3b82f6]/40 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">🏰</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {currentBaseDef.name} (Level {base.level}/4)
                      </h3>
                      <p className="text-xs text-blue-200 mt-0.5">{currentBaseDef.desc}</p>
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-green-500/20 text-[#7ee787] border border-green-500/40 rounded-lg text-xs font-bold">
                  ACTIVE COMMAND POST
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-white/10">
                <div className="bg-black/40 p-2.5 rounded-lg">
                  <div className="text-[11px] text-gray-400">Safe Radius</div>
                  <div className="text-base font-bold text-[#83d3e1]">{base.safeRadius}m Barrier</div>
                </div>
                <div className="bg-black/40 p-2.5 rounded-lg">
                  <div className="text-[11px] text-gray-400">HP Regeneration</div>
                  <div className="text-base font-bold text-[#7ee787]">+{base.healingRate} HP/sec</div>
                </div>
                <div className="bg-black/40 p-2.5 rounded-lg">
                  <div className="text-[11px] text-gray-400">Squad Capacity</div>
                  <div className="text-base font-bold text-[#ffcf5c]">{base.maxSoldiers} Soldiers Max</div>
                </div>
                <div className="bg-black/40 p-2.5 rounded-lg">
                  <div className="text-[11px] text-gray-400">Defensive Turrets</div>
                  <div className="text-base font-bold text-[#ff70a6]">{base.turrets} Tesla Coils</div>
                </div>
              </div>
            </div>

            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Base Upgrade Tiers</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[2, 3, 4].map((lvl) => {
                const def = BASE_LEVELS[lvl];
                const isPast = base.level >= lvl;
                const isNext = base.level === lvl - 1;
                const canBuy = isNext && atoms >= def.cost;

                return (
                  <div
                    key={lvl}
                    className={`rounded-xl p-3.5 flex flex-col justify-between border ${
                      isPast
                        ? 'bg-green-950/20 border-green-700/50'
                        : isNext
                        ? 'bg-white/5 border-[#ffd166]/50'
                        : 'bg-black/40 border-white/5 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-[#ffd166]">Tier {lvl}</span>
                        {isPast && <span className="text-[10px] text-green-400 font-bold">UNLOCKED</span>}
                      </div>
                      <div className="font-bold text-sm text-white">{def.name}</div>
                      <p className="text-xs text-gray-300 mt-1">{def.desc}</p>
                    </div>

                    <button
                      disabled={!canBuy}
                      onClick={() => {
                        if (canBuy) {
                          playUpgradeSound();
                          onUpgradeBase();
                        }
                      }}
                      className="mt-3 py-2 bg-[#ffcf5c] text-[#1a1305] disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      {isPast ? 'ACTIVE' : isNext ? `Upgrade Base — ${def.cost} ⚛` : `Requires Level ${lvl - 1}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab: Squad Soldiers */}
        {tab === 'soldiers' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex justify-between items-center">
              <div className="text-xs text-gray-300">
                <span className="font-bold text-white">Squad Barracks ({soldiers.length}/{base.maxSoldiers} Max)</span>:
                Recruit up to 7 soldiers with distinct weapons & superpowers. Soldiers fight hordes with you, level up, and respawn inside the Base!
              </div>
            </div>

            {/* Currently Recruited */}
            {soldiers.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-[#7ee787] uppercase tracking-wider mb-2">Active Squad Soldiers</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {soldiers.map((s) => {
                    const nextCost = s.level < 3 ? s.upgradeCosts[s.level - 1] : 0;
                    const canUp = s.level < 3 && atoms >= nextCost;

                    return (
                      <div
                        key={s.id}
                        className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{s.icon}</span>
                              <div>
                                <div className="font-bold text-sm text-white flex items-center gap-1.5">
                                  <span>{s.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-[#ffd166]">
                                    {s.level === 3 ? '★★★ MAX ELITE' : s.level === 2 ? '★★ LV2' : '★ LV1'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-400">{s.weaponName}</div>
                              </div>
                            </div>
                            <span className="text-xs font-bold" style={{ color: s.color }}>
                              {s.hasSuperpower ? '⚡ HERO' : 'SOLDIER'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-white/5 text-[11px] text-gray-300">
                            <div>HP: <b className="text-white">{Math.round(s.hp)}/{s.hpMax}</b></div>
                            <div>DMG: <b className="text-white">{s.dmg}</b></div>
                            <div>Rate: <b className="text-white">{s.fireRate}ms</b></div>
                          </div>

                          {s.hasSuperpower && (
                            <div className="mt-2 text-[11px] text-[#ffd166] bg-black/30 p-1.5 rounded">
                              ⚡ <b>Superpower:</b> {s.superpowerName}
                            </div>
                          )}
                        </div>

                        <button
                          disabled={!canUp}
                          onClick={() => {
                            if (canUp) {
                              playUpgradeSound();
                              onUpgradeSoldier(s.id);
                            }
                          }}
                          className="mt-3 py-1.5 bg-[#ffcf5c] text-[#1a1305] disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
                        >
                          {s.level >= 3 ? 'MAX LEVEL (ELITE 3★)' : `Upgrade to Level ${s.level + 1} — ${nextCost} ⚛`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Catalog */}
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recruitment Barracks (Max 7 Soldiers)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.keys(SOLDIER_DEFINITIONS) as SoldierType[]).map((type) => {
                const def = SOLDIER_DEFINITIONS[type];
                const isRecruited = soldiers.some((s) => s.type === type);
                const isFull = soldiers.length >= base.maxSoldiers;
                const canRecruit = !isRecruited && !isFull && atoms >= def.cost;

                return (
                  <div
                    key={type}
                    className={`bg-white/5 border rounded-xl p-3.5 flex flex-col justify-between ${
                      def.hasSuperpower ? 'border-[#ffd166]/40 shadow-[0_0_10px_rgba(255,209,102,0.1)]' : 'border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{def.icon}</span>
                          <div>
                            <div className="font-bold text-sm text-white">{def.name}</div>
                            <div className="text-[11px] text-gray-400">{def.title}</div>
                          </div>
                        </div>
                        {def.hasSuperpower && (
                          <span className="px-1.5 py-0.5 bg-[#ffd166]/20 text-[#ffd166] text-[10px] font-bold rounded">
                            HERO
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-300 mt-2">
                        <div>🔫 <b>Weapon:</b> {def.weaponName}</div>
                        {def.superpowerDesc && (
                          <div className="text-[#ffd166] text-[11px] mt-1">
                            ⚡ {def.superpowerDesc}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      disabled={!canRecruit}
                      onClick={() => {
                        if (canRecruit) {
                          playUpgradeSound();
                          onRecruitSoldier(type);
                        }
                      }}
                      className="mt-3 py-2 bg-[#ffcf5c] text-[#1a1305] disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      {isRecruited ? 'ALREADY RECRUITED' : isFull ? 'SQUAD FULL (Upgrade Base)' : `Recruit — ${def.cost} ⚛`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab: Skills — Solar Beam only, plus base-kit Ground Slam */}
        {tab === 'superpowers' && (
          <div className="flex flex-col gap-4">
            <div className="bg-gradient-to-r from-[#3b0764] to-[#1e1b4b] border border-purple-500/40 rounded-xl p-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>⚡</span>
                <span>SKILLS</span>
              </h3>
              <p className="text-xs text-purple-200 mt-1">
                Defeat gate bosses to power up your Solar Beam (hotkey [Z]). Ground Slam (hotkey [C]) is always available — no unlock needed.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-white">🔥 Active Skill</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(Object.values(superpowers) as Superpower[])
                  .filter((sp) => sp.id === 'orbital_beam')
                  .map((sp) => (
                    <div
                      key={sp.id}
                      onClick={() => sp.unlocked && onToggleEquipSkill?.(sp.id)}
                      className={`rounded-xl p-4 border flex flex-col justify-between transition ${
                        !sp.unlocked
                          ? 'bg-black/40 border-white/5 opacity-60'
                          : sp.equipped
                          ? 'bg-white/10 border-purple-400 shadow-[0_0_14px_rgba(168,85,247,0.35)] cursor-pointer'
                          : 'bg-white/5 border-purple-500/30 hover:border-purple-400/60 cursor-pointer'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2.5">
                            <span className="text-3xl">{sp.icon}</span>
                            <div>
                              <div className="font-bold text-sm text-white flex items-center gap-1.5">
                                <span>{sp.name}</span>
                                {sp.unlocked && (
                                  <span className="px-1.5 py-0.2 bg-purple-500/30 text-purple-300 text-[10px] font-bold rounded">
                                    LV{sp.level}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-mono" style={{ color: sp.color }}>
                                Hotkey: [Z] • Cooldown: {sp.cooldown / 1000}s
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              !sp.unlocked
                                ? 'bg-red-500/20 text-red-400'
                                : sp.equipped
                                ? 'bg-purple-500/30 text-purple-200'
                                : 'bg-green-500/20 text-green-400'
                            }`}
                          >
                            {!sp.unlocked ? 'LOCKED' : sp.equipped ? 'EQUIPPED' : 'UNLOCKED'}
                          </span>
                        </div>

                        <p className="text-xs text-gray-300 mt-2">{sp.desc}</p>
                        {sp.unlocked && (
                          <p className="text-[10px] text-gray-500 mt-1">Unlocked from: {sp.bossSource}</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-white">👊 Base Kit</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl p-4 border bg-white/5 border-purple-500/30">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl">👊</span>
                    <div>
                      <div className="font-bold text-sm text-white">Ground Slam</div>
                      <div className="text-xs font-mono text-[#ffcf5c]">Hotkey: [C] • Cooldown: 6s</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-300 mt-2">
                    8-directional shockwave smash with knockback. Always equipped — no unlock required.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Upgrades */}
        {tab === 'upgrades' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.values(UPGRADES).map((u) => {
              const currentLvl = (player.upgrades as any)[u.id] || 0;
              const cost = u.cost * (currentLvl + 1);
              const isMax = currentLvl >= u.maxLevel;
              const canBuy = atoms >= cost && !isMax;

              return (
                <div key={u.id} className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{u.icon}</span>
                        <div>
                          <div className="font-bold text-sm text-white">{u.name}</div>
                          <div className="text-[11px] text-[#83d3e1] font-mono">
                            Level {currentLvl} / {u.maxLevel}
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 mt-2">{u.desc}</p>
                  </div>
                  <button
                    disabled={!canBuy}
                    onClick={() => {
                      if (canBuy) {
                        playUpgradeSound();
                        onBuyItem('upgrade', cost, u.id);
                      }
                    }}
                    className="mt-3 py-2 bg-[#ffcf5c] text-[#1a1305] disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    {isMax ? 'MAX LEVEL' : `Upgrade Lv${currentLvl + 1} — ${cost} ⚛`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab: Gear */}
        {tab === 'gear' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <div className="font-bold text-sm text-white">💊 Medkit (+400 HP)</div>
                <div className="text-xs text-gray-400 mt-1">Instant first aid kit. Use with E key.</div>
              </div>
              <button
                disabled={atoms < 15}
                onClick={() => onBuyItem('medkit', 15)}
                className="mt-3 py-2 bg-[#ffcf5c] text-[#1a1305] disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
              >
                Buy — 15 ⚛
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <div className="font-bold text-sm text-white">💣 Grenades x2</div>
                <div className="text-xs text-gray-400 mt-1">High explosive blast. Use with G key.</div>
              </div>
              <button
                disabled={atoms < 15}
                onClick={() => onBuyItem('grenades', 15)}
                className="mt-3 py-2 bg-[#ffcf5c] text-[#1a1305] disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
              >
                Buy — 15 ⚛
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <div className="font-bold text-sm text-white">🔧 Sentry Turret (250 HP)</div>
                <div className="text-xs text-gray-400 mt-1">Automated perimeter defense turret.</div>
              </div>
              <button
                disabled={atoms < 50 * (turretCount + 1)}
                onClick={() => onBuyItem('turret', 50 * (turretCount + 1))}
                className="mt-3 py-2 bg-[#ffcf5c] text-[#1a1305] disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
              >
                Buy — {50 * (turretCount + 1)} ⚛
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <div className="font-bold text-sm text-white">📦 Deployable Climb Crate (1000 HP)</div>
                <div className="text-xs text-gray-400 mt-1">Platform for elevated tactical defense.</div>
              </div>
              <button
                disabled={atoms < 45}
                onClick={() => onBuyItem('crate', 45)}
                className="mt-3 py-2 bg-[#ffcf5c] text-[#1a1305] disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
              >
                Buy — 45 ⚛
              </button>
            </div>
          </div>
        )}

        {/* Tab: Armor */}
        {tab === 'armor' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5].map((lvl) => {
              const def = ARMOR_LEVELS[lvl]!;
              const isOwned = player.armorLevel >= lvl;
              const canBuy = player.armorLevel === lvl - 1 && atoms >= def.cost;
              return (
                <div key={lvl} className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-sm text-white">🛡️ Titanium Armor Level {lvl}</div>
                    <div className="text-xs text-gray-300 mt-1">
                      +{def.hpBonus} Max HP, {Math.round(def.reduction * 100)}% global damage reduction.
                    </div>
                  </div>
                  <button
                    disabled={!canBuy || isOwned}
                    onClick={() => onBuyItem('armor', def.cost, lvl)}
                    className="mt-3 py-2 bg-[#ffcf5c] text-[#1a1305] disabled:bg-gray-800 disabled:text-gray-500 font-bold text-xs rounded-lg cursor-pointer"
                  >
                    {isOwned ? 'OWNED' : `Buy Lv${lvl} — ${def.cost} ⚛`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
