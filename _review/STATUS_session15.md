
## Session 15 (27 Sep) — V1 reset to CWG2 scale ✅ (plan/WORK_PLAN.md v3)
- John (after talking it through with Gemini): scrap large-formation movement for V1; play like CWG2 (brigade/regiment) + only true modernizations; maybe "much bigger maps" later. Answers: 1 regiment = 1 unit · simplify terrain extras toward CWG2 · art style = Claude's call · tag tasks Opus/Haiku.
- oob.js: regiments are no longer split into wings/battalions (each regiment = one unit; ~19 units per side at start).
- core.js `CW.CLASSIC = true`: click a unit → click hex / enemy. Brigade/division selection, drag orders, block moves and the Brigade cmd button (J) are off. Tab / Next / top-bar jumps cycle every unit that can still act. Coach + help text rewritten; leaders get their own coach tip (command radius).
- Kept: ready rings, counters, End-turn glow, odds preview, focus outline, fog, coach, saves. orders.js stays loaded — the AI still uses it internally so its brigades attack together.
- Tests: hover, clean display, ready cues, coach, player-vs-AI (save/resume), full AI-vs-AI battle to Day 2 noon: no errors. CS won 61–26 again; late game the US attack stalls ("0/3 in place") → R5 balance.
- Terrain simplification deferred to R3 (compare rules to the CWG2 manual first).
- NEXT: R2 unit art (figure kit from John's new sheets, recolor per side, procedural units). Haiku can do: R3 rules table, doc updates, committing files.
