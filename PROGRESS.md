# Perception Arena — Progress Notes

This tracks what's been done across sessions and what's still left, so nothing
gets lost. Everything below is verified against `npx tsc --noEmit` and
`npm run build` (both pass clean as of this drop).

## ✅ Done

### Visuals
- **Real sprite art replaces the old colored-blob rendering** for bosses,
  zombies, and soldiers (`src/game/sprites.ts`).
  - 4 boss rigs cycling across the 10 gates, each with a per-boss color
    tint so gates still feel distinct: `caveman`, `goblin`, `viking`
    (4-directional, animated idle/walk/attack) + `necromancer` (flip-only
    side rig) + `troll` (static image, procedural lean during attacks —
    the troll pack had no animation frames, just 4 color variants).
  - Zombies use the 3 Craftpix zombie types (Man/Woman/Wild), animated
    idle/walk/run/attack/hurt, flipped to face movement.
  - Soldiers use the 3 Gangster sprite sets, one per squad seat.
  - All source art lives in `public/sprites/...`; see "Asset pipeline" below
    if you add more packs later.
- **Tiled forest ground** (`public/sprites/backgrounds/`) replaces the flat
  fill — a real (cropped, tileable) grass/battleground texture + scatter
  decor layer, repeated via `ctx.createPattern`, swapped for a grittier
  variant inside gate arenas. No more stretching/distortion.
- **Real gun icons** (Craftpix 32×32 pack) on weapon slots in the HUD and
  shop, replacing emoji (emoji still used as fallback for melee/unmapped).

### Skills system (replaces the old "2 actives" setup)
- `src/game/superpowerLogic.ts` + `src/types/game.ts` (`Superpower.category`)
- 1 **Active** skill equippable at a time (hotkey **Z**): Solar Beam,
  Chronoshift, Earth Shatter, Divine Aegis (unchanged effects).
- Up to 2 **Passives** equippable, always-on: Iron Skin (+15% dmg
  reduction), Vampiric Strikes (10% lifesteal), Berserker's Instinct (+30%
  dmg under 40% HP), Second Wind (survive a killing blow once, 90s
  internal cooldown).
- Unlock order: 4 actives from gate bosses 1–4, 4 passives from bosses 5–8.
- Shop → Skills tab shows Active/Passive sections with equip caps and a
  tap-to-equip/unequip card, same visual language as the rest of the shop.
- HUD skill bar now shows only what's actually equipped instead of every
  unlocked power.

### Player "boss-style" moves
- **Dash / Dodge** — `[Shift]`, direction-aware (uses movement keys, or aim
  direction if standing still), short i-frame window, ~1.4s cooldown. This
  existed as dead fields in the type (`dashVx`/`dashLockedUntil` etc.) but
  was never wired to input — it's live now.
- **Ground Slam** — `[C]`, a boss-style AOE smash: 8-directional shockwave
  ring + direct damage + knockback in a ~190px radius, big screen shake,
  6s cooldown. Part of the base kit (not skill-gated), so it's always
  available once you're past the tutorial — meant to give the player some
  of the same "impact" the boss telegraphs have.

### Other
- Finished the boss/soldier sprite wiring that was left half-done last
  session (zombies were done, boss + soldier weren't).
- Checked the linked `agent-skills-hub` 2D-games `SKILL.md` — it's a
  generic high-level checklist (sprite atlases, tile layers, camera/screen
  shake guidance, platformer vs top-down patterns). Confirms things this
  project already does; nothing project-specific to adopt from it, so I
  didn't change anything based on it.

## 🚧 Not done yet (from your original asks, oldest first)

1. **Normal vs Hardcore mode + 3-respawn system.** Currently death always
   = full restart. Needs: a mode-select screen, a `lives` counter in
   state, and a "respawn at base" path in the game-over flow instead of
   a hard reset for Normal mode.
2. **Boss freeze beam + "summon gunned zombies" + a dedicated funny
   jump-attack move.** The boss AI (`src/game/bossLogic.ts`) already has
   charge/leap/solar/laser/teleport/spin/summon — summon currently only
   picks shambler/runner, and there's no freeze/slow attack yet.
3. **Gate recommended-level warning.** Doors currently just cost atoms to
   unlock; there's no "Base Lv. X recommended for this boss" confirmation
   step.
4. **Base-level → player dmg/HP bonus**, distinct from soldier upgrades
   (you already have Base/Soldiers/Upgrades/Armor as separate shop tabs —
   this would add a small direct player buff tied specifically to Base
   level, on top of that).
5. **Tank War mode** (on hold per your message — not started). When you're
   ready, the design I'd use: reuses the existing `CoverObstacle` system
   (already in the game for base defense) for cover-based tank combat,
   the existing `Tank` type/garage for the vehicle, and the
   arena/door pattern for a new "dimension." Two variants:
   - **Infinite Tank War**: endless waves of enemy tanks in a cover-dense
     arena, survive as long as possible, score-based.
   - **Story mode**: capture a location → hints unlock the next objective
     → find & escort rescued civilians back through a tank gauntlet that
     blocks the return path. This is the bigger lift (needs a small
     mission/objective state machine) — happy to start whenever you say go.
6. The two big "prototype ability" packs (Jump_Strike, Ground_Slam,
   Ice_Charge, Time_Slow, Resurrection, etc.) were the visual reference
   for the Skills work above — only Ground Slam got a real move built
   from them so far. If you want more of those specific animations (e.g.
   an actual Ice_Charge freeze-beam boss move, or a Stealth_Mode passive),
   say which ones and I'll build them next — there's a lot in those packs.

## Asset pipeline notes (if you add more Craftpix packs later)
- `public/sprites/bosses/<set>/<dir>_<anim>.png` — 4-directional rigs are
  160px square-frame horizontal strips.
- `public/sprites/bosses/necromancer/*.png` — flip-only rigs are 128px
  square-frame strips (no direction sheets, just flipped left/right).
- `public/sprites/bosses/troll/<color>.png` — static single-image rigs
  (no animation, just procedural lean/squash at draw time). Use this path
  for any pack that's concept art rather than a sprite sheet.
- `public/sprites/zombies/<folder>/<Anim>.png` and
  `public/sprites/soldiers/<folder>/<Anim>.png` — 96px / 128px strips.
- All of this is driven by `src/game/sprites.ts` — frame count is always
  `image.naturalWidth / frameSize`, so new animations just need a new file
  at the right frame size, no manifest to update.

## How to run
```
npm install
npm run dev      # local dev server
npm run build    # production build (verified passing)
```
