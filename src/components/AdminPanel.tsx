import { useState, type CSSProperties, type SyntheticEvent } from 'react';
import { WEAPONS } from '../game/constants';

interface Props {
  godMode: boolean;
  onStartBoss: (n: number) => void;
  onGiveAtoms: () => void;
  onUnlockAll: () => void;
  onToggleGod: () => void;
  onHeal: () => void;
  onBossPhase: (phase: 2 | 3) => void;
  onKillBoss: () => void;
  onEquipWeapon: (id: string) => void;
}

const btn: CSSProperties = {
  background: '#1c2233',
  color: '#e6ecff',
  border: '1px solid #3a4468',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

// Dev/test panel. Floating button bottom-left; stops mouse events so clicking it never fires the weapon.
export default function AdminPanel(p: Props) {
  const [open, setOpen] = useState(false);
  const stop = (e: SyntheticEvent) => e.stopPropagation();

  return (
    <div
      onMouseDown={stop}
      onMouseUp={stop}
      onClick={stop}
      style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 9999, fontFamily: 'sans-serif' }}
    >
      <button style={{ ...btn, background: open ? '#5b2a86' : '#2a1f3d' }} onClick={() => setOpen((o) => !o)}>
        🛠 ADMIN
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            width: 290,
            maxHeight: '70vh',
            overflowY: 'auto',
            background: 'rgba(12,14,24,0.96)',
            border: '1px solid #5b2a86',
            borderRadius: 10,
            padding: 10,
            color: '#cfd6f5',
          }}
        >
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>START BOSS FIGHT (gate 1–10)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} style={btn} onClick={() => p.onStartBoss(n)}>
                {n}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, opacity: 0.7, margin: '10px 0 6px' }}>BOSS TESTING</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button style={btn} onClick={() => p.onBossPhase(2)}>→ Phase 2</button>
            <button style={btn} onClick={() => p.onBossPhase(3)}>→ Phase 3 (clones)</button>
            <button style={btn} onClick={p.onKillBoss}>Kill boss</button>
          </div>

          <div style={{ fontSize: 11, opacity: 0.7, margin: '10px 0 6px' }}>PLAYER</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button style={btn} onClick={p.onGiveAtoms}>+1,000,000 atoms</button>
            <button style={btn} onClick={p.onUnlockAll}>Unlock everything</button>
            <button style={btn} onClick={p.onHeal}>Full heal</button>
            <button style={{ ...btn, background: p.godMode ? '#1f6b3a' : '#1c2233' }} onClick={p.onToggleGod}>
              God mode: {p.godMode ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ fontSize: 11, opacity: 0.7, margin: '10px 0 6px' }}>EQUIP WEAPON (active slot)</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {Object.values(WEAPONS).map((w) => (
              <button key={w.id} style={btn} onClick={() => p.onEquipWeapon(w.id)}>
                {w.icon} {w.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
