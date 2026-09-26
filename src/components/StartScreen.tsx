import { useEffect, useState } from 'react';
import { getBgmVolume, getSfxVolume, setBgmVolume, setSfxVolume } from '../audio/sound';

type Tab = 'play' | 'guide' | 'settings';

interface StartScreenProps {
  highScore: number;
  hasSavedGame: boolean;
  onStart: () => void;
  onContinue: () => void;
}

const SETTINGS_KEY = 'perception_arena_settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as { bgm: number; sfx: number; screenShake: boolean };
  } catch {
    /* corrupt/missing settings — fall through to defaults */
  }
  return { bgm: getBgmVolume(), sfx: getSfxVolume(), screenShake: true };
}

export default function StartScreen({ highScore, hasSavedGame, onStart, onContinue }: StartScreenProps) {
  const [tab, setTab] = useState<Tab>('play');
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    setBgmVolume(settings.bgm);
    setSfxVolume(settings.sfx);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable — settings just won't persist across sessions */
    }
  }, [settings]);

  return (
    <div className="screen-overlay">
      <div className="w-full max-w-3xl">
        {/* Title banner */}
        <div className="relative text-center mb-4">
          <h1 className="font-display text-4xl md:text-6xl font-black text-[#ff4d5e] neon-text-red tracking-wider">
            PERCEPTION ARENA
          </h1>
          <p className="text-[#83d3e1] text-[11px] md:text-xs tracking-[0.3em] uppercase mt-1">
            Survive · Build · Dominate the Boss Titans
          </p>
        </div>

        {/* GTA-style tab bar */}
        <div className="flex border-b-2 border-[#ff4d5e]/40 mb-4">
          {(['play', 'guide', 'settings'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 font-display text-sm md:text-base uppercase tracking-widest transition-all border-b-4 ${
                tab === t
                  ? 'text-[#ffd166] border-[#ffd166] bg-white/5'
                  : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              {t === 'play' ? '▶ Play' : t === 'guide' ? '📖 Guide' : '⚙ Settings'}
            </button>
          ))}
        </div>

        <div className="bg-gray-900/90 border border-gray-700 rounded-xl shadow-2xl min-h-[320px] max-h-[60vh] overflow-y-auto">
          {tab === 'play' && (
            <div className="p-6 text-left text-xs md:text-sm leading-relaxed text-gray-300">
              <p className="mb-3 text-center text-[#83d3e1] font-bold tracking-widest uppercase">
                Safe Base • 7 Squad Soldiers • Boss Superpowers
              </p>
              <ul className="list-disc pl-5 space-y-1.5 mb-4">
                <li>
                  <strong className="text-[#83d3e1]">🏰 Safe Base Sanctuary</strong>: Zombies can't enter or spawn
                  nearby. You and your squad rapidly regenerate HP inside.
                </li>
                <li>
                  <strong className="text-[#7ee787]">👥 Squad Soldiers (Max 7)</strong>: Recruit riflemen,
                  shotgunners, snipers, demolitionists — plus 3 legendary Superpower Heroes.
                </li>
                <li>
                  <strong className="text-[#ffd166]">⚡ Boss-Unlocked Superpowers [Z, X, C, V]</strong>: Solar Flare
                  Orbital Laser, Chronoshift Time Freeze, Earth Shatter, Divine Aegis.
                </li>
                <li>
                  <strong className="text-[#ff4d5e]">👹 Reworked Boss Fights</strong>: Every telegraphed attack now
                  has a real tell — a red danger lane, a windup animation, a punishable recovery window. Tank a hit
                  mid-attack and it barely scratches them; dodge clean and their recovery is wide open for bonus
                  damage.
                </li>
              </ul>
              <p className="text-center text-[#ffcf5c] text-xs">
                High Score (Best Wave): <span className="font-bold text-white">{highScore}</span>
              </p>
            </div>
          )}

          {tab === 'guide' && (
            <div className="p-6 text-left text-xs md:text-sm leading-relaxed text-gray-300 space-y-4">
              <div>
                <h3 className="text-[#83d3e1] font-bold uppercase tracking-widest text-xs mb-2">Movement</h3>
                <ul className="space-y-1 pl-1">
                  <li><Key>WASD</Key> / <Key>Arrows</Key> — Move</li>
                  <li><Key>Shift</Key> — Dash (brief invulnerability, use it on telegraphed attacks)</li>
                  <li><Key>Mouse</Key> — Aim &amp; fire your active weapon</li>
                </ul>
              </div>
              <div>
                <h3 className="text-[#83d3e1] font-bold uppercase tracking-widest text-xs mb-2">Combat</h3>
                <ul className="space-y-1 pl-1">
                  <li><Key>Q</Key> — Melee strike</li>
                  <li><Key>G</Key> — Throw grenade</li>
                  <li><Key>C</Key> — Ground slam</li>
                  <li><Key>E</Key> — Use consumable</li>
                  <li><Key>Z X C V</Key> — Boss-unlocked superpowers, once earned</li>
                </ul>
              </div>
              <div>
                <h3 className="text-[#83d3e1] font-bold uppercase tracking-widest text-xs mb-2">World</h3>
                <ul className="space-y-1 pl-1">
                  <li><Key>F</Key> — Mount / dismount the Assault Tank</li>
                  <li><Key>R</Key> — Unlock a Gate / interact with doors</li>
                  <li><Key>B</Key> — Open the Shop &amp; Upgrades menu</li>
                </ul>
              </div>
              <div>
                <h3 className="text-[#ff4d5e] font-bold uppercase tracking-widest text-xs mb-2">Reading a Boss Fight</h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>A <strong className="text-[#ff4d5e]">red lane</strong> means a charge is locked onto that exact
                    path — step outside the box before it fires.</li>
                  <li>A <strong className="text-[#f4a261]">dashed orange circle</strong> filling in is a ground-spike
                    eruption about to land where you're standing — it will re-target your position after each hit, so
                    keep relocating between bursts instead of tanking the whole sequence.</li>
                  <li>A <strong className="text-[#b98bff]">glowing portal</strong> on the ground is a summon in
                    progress — kill it or run before it finishes ("EMERGING") or a fresh zombie spawns already
                    aggroed on you.</li>
                  <li>Bosses take <strong className="text-[#7ee787]">extra damage</strong> while recovering from a
                    charge, a trip, or a landing — that's your punish window (shown by a pulsing green ring).</li>
                  <li>Bosses take <strong className="text-gray-400">reduced damage</strong> mid-attack (charging,
                    spinning, beaming — shown by a dull metallic tint) — standing still and spraying through an
                    attack is no longer the optimal play.</li>
                  <li>Stand still too long and every boss will <strong className="text-[#ff4d5e]">force a fast
                    charge</strong> straight at you — camping in one spot gets punished, not rewarded.</li>
                  <li>Below 40% HP every boss enrages: faster, angrier, shorter attack cooldowns.</li>
                </ul>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="p-6 text-left text-xs md:text-sm text-gray-300 space-y-6">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[#83d3e1] font-bold uppercase tracking-widest text-xs">Music Volume</label>
                  <span className="text-white">{Math.round(settings.bgm * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.bgm}
                  onChange={(e) => setSettings((s) => ({ ...s, bgm: parseFloat(e.target.value) }))}
                  className="w-full accent-[#ff4d5e]"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[#83d3e1] font-bold uppercase tracking-widest text-xs">Sound Effects Volume</label>
                  <span className="text-white">{Math.round(settings.sfx * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.sfx}
                  onChange={(e) => setSettings((s) => ({ ...s, sfx: parseFloat(e.target.value) }))}
                  className="w-full accent-[#ff4d5e]"
                />
              </div>
              <div className="flex items-center justify-between border-t border-gray-700 pt-4">
                <label className="text-[#83d3e1] font-bold uppercase tracking-widest text-xs">Screen Shake</label>
                <button
                  onClick={() => setSettings((s) => ({ ...s, screenShake: !s.screenShake }))}
                  className={`px-4 py-1.5 rounded-md font-display text-xs uppercase tracking-widest border ${
                    settings.screenShake
                      ? 'bg-[#7ee787]/20 border-[#7ee787] text-[#7ee787]'
                      : 'bg-gray-800 border-gray-600 text-gray-400'
                  }`}
                >
                  {settings.screenShake ? 'On' : 'Off'}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 pt-2">Settings are saved on this device automatically.</p>
            </div>
          )}
        </div>

        {/* Action buttons — always visible regardless of tab */}
        <div className="flex justify-center gap-3 mt-5">
          {hasSavedGame && (
            <button onClick={onContinue} className="btn-arcade">
              ▶ CONTINUE SAVED RUN
            </button>
          )}
          <button onClick={onStart} className="btn-arcade">
            {hasSavedGame ? 'START NEW GAME' : 'ENTER SANCTUARY & START COMBAT'}
          </button>
        </div>
        {hasSavedGame && (
          <p className="text-center text-[#83d3e1] text-[11px] mt-2 opacity-80">
            Starting a new game erases your saved progress.
          </p>
        )}
      </div>
    </div>
  );
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-block bg-black/70 border border-[#83d3e1]/50 text-[#83d3e1] rounded px-1.5 py-0.5 text-[11px] font-mono mr-1">
      {children}
    </kbd>
  );
}
