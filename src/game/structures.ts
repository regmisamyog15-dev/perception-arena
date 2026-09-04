import { Tower, CoverObstacle } from '../types/game';
import { WORLD_W, WORLD_H } from './constants';

export function generateWorldStructures(): { towers: Tower[]; covers: CoverObstacle[] } {
  const towers: Tower[] = [
    { id: 'tower-center-north', name: 'Alpha Watchtower', x: WORLD_W / 2 - 320, y: WORLD_H / 2 - 450, w: 120, h: 120, ladderX: WORLD_W / 2 - 320, ladderY: WORLD_H / 2 - 380, hp: 1000, hpMax: 1000, destroyed: false, repairTimer: 0, repairDuration: 240000, elevation: 60 },
    { id: 'tower-center-south', name: 'Bravo Watchtower', x: WORLD_W / 2 + 320, y: WORLD_H / 2 + 450, w: 120, h: 120, ladderX: WORLD_W / 2 + 320, ladderY: WORLD_H / 2 + 380, hp: 1000, hpMax: 1000, destroyed: false, repairTimer: 0, repairDuration: 240000, elevation: 60 },
    { id: 'tower-west-outpost', name: 'West Guard Post', x: WORLD_W * 0.22, y: WORLD_H * 0.35, w: 120, h: 120, ladderX: WORLD_W * 0.22, ladderY: WORLD_H * 0.35 + 45, hp: 1000, hpMax: 1000, destroyed: false, repairTimer: 0, repairDuration: 240000, elevation: 60 },
    { id: 'tower-east-outpost', name: 'East Citadel Tower', x: WORLD_W * 0.78, y: WORLD_H * 0.65, w: 120, h: 120, ladderX: WORLD_W * 0.78, ladderY: WORLD_H * 0.65 - 45, hp: 1000, hpMax: 1000, destroyed: false, repairTimer: 0, repairDuration: 240000, elevation: 60 },
    { id: 'tower-north-fort', name: 'North Fortress Tower', x: WORLD_W * 0.35, y: WORLD_H * 0.18, w: 130, h: 130, ladderX: WORLD_W * 0.35, ladderY: WORLD_H * 0.18 + 50, hp: 1000, hpMax: 1000, destroyed: false, repairTimer: 0, repairDuration: 240000, elevation: 60 },
    { id: 'tower-south-bunker', name: 'South Sniper Perch', x: WORLD_W * 0.65, y: WORLD_H * 0.82, w: 130, h: 130, ladderX: WORLD_W * 0.65, ladderY: WORLD_H * 0.82 - 50, hp: 1000, hpMax: 1000, destroyed: false, repairTimer: 0, repairDuration: 240000, elevation: 60 },
  ];

  const covers: CoverObstacle[] = [
    // Center battlefield sandbag bunkers
    { id: 'cov-c1', type: 'sandbag', x: WORLD_W / 2 - 160, y: WORLD_H / 2 - 120, w: 140, h: 36, hp: 800 },
    { id: 'cov-c2', type: 'sandbag', x: WORLD_W / 2 + 160, y: WORLD_H / 2 + 120, w: 140, h: 36, hp: 800 },
    { id: 'cov-c3', type: 'concrete', x: WORLD_W / 2 - 200, y: WORLD_H / 2 + 160, w: 40, h: 120, hp: 1600 },
    { id: 'cov-c4', type: 'concrete', x: WORLD_W / 2 + 200, y: WORLD_H / 2 - 160, w: 40, h: 120, hp: 1600 },

    // Heavy concrete bunkers & barricades across quadrant zones
    { id: 'bunker-nw', type: 'bunker', x: WORLD_W * 0.28, y: WORLD_H * 0.25, w: 180, h: 90, hp: 3000 },
    { id: 'bunker-ne', type: 'bunker', x: WORLD_W * 0.72, y: WORLD_H * 0.25, w: 180, h: 90, hp: 3000 },
    { id: 'bunker-sw', type: 'bunker', x: WORLD_W * 0.28, y: WORLD_H * 0.75, w: 180, h: 90, hp: 3000 },
    { id: 'bunker-se', type: 'bunker', x: WORLD_W * 0.72, y: WORLD_H * 0.75, w: 180, h: 90, hp: 3000 },

    // Additional perimeter defense sandbags
    { id: 'sandbag-w1', type: 'sandbag', x: WORLD_W * 0.15, y: WORLD_H * 0.5, w: 160, h: 38, hp: 900 },
    { id: 'sandbag-e1', type: 'sandbag', x: WORLD_W * 0.85, y: WORLD_H * 0.5, w: 160, h: 38, hp: 900 },
    { id: 'sandbag-n1', type: 'sandbag', x: WORLD_W * 0.5, y: WORLD_H * 0.12, w: 180, h: 38, hp: 900 },
    { id: 'sandbag-s1', type: 'sandbag', x: WORLD_W * 0.5, y: WORLD_H * 0.88, w: 180, h: 38, hp: 900 },
  ];

  return { towers, covers };
}
