# CWG3 ROADMAP (v4, 2026-10-09) — short; John picks priorities, Grok writes briefs
Old v3 plan: `docs/archive/WORK_PLAN_v3.md` (stale on 3D direction).

## Fixed decisions
- V1 = one battle (Millbrook) vs the computer. No new maps/battles until Millbrook looks right. Daytime summer only.
- Tilted 3D view (three.js) over a hex map; painted map stays for minimap and flat fallback.
- Runs by double-click (file://), art base64-embedded. Assets own/open-source/CC0 only.

## Done
Tilted camera, living landscape, battle smoke, mesh ground, 3D trees + mill, CC0 meadow textures (branch `world-objects`, awaiting John's review before merge to `main`).

## Known open items (not yet prioritised — John chooses order)
- Wire title/menu/after-action art (`assets/incoming/title/`).
- AI moves glide one at a time.
- Check sluggishness on the Mac.
- Next world pass (what to improve) — TBD.
- Rules/AI polish — specs in `docs/RULES_SPEC.md`, `docs/AI_DESIGN.md`, `docs/COMBAT.md`.

## Workflow
Grok (Chief of Staff) writes `ops/BRIEF.md` → Claude executes → Claude writes `ops/REPORT.md`. See `ops/GROK_PRIMER.md`.
