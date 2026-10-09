# CWG3 — Work Plan v3 (2026-09-27)

Supersedes v2. **Direction change:** V1 plays like CWG2 (one regiment = one unit, each moved on its own) plus only the modern touches that clearly add value. The brigade/division standing-order layer is switched off for V1 (code kept: the AI still uses it internally, and it may return with "much bigger maps" later).

## Decisions (27 Sep, v3)
- Scale: **one regiment = one unit** (no more wings/battalions). Brigade = colonel + his regiments, a command group only.
- Command: CWG2-style, click a unit → click a hex / enemy. Tab cycles units that can still act. Leaders move as ordinary units; command radius stays.
- Kept modern value-adds: ready rings (gold = can move, crimson = can fire), "N can fire / N can move" counters, End-turn glow, odds preview, on-screen coach, focus outline, fog + honest AI, save/load.
- Terrain extras (true-height sight/dead ground, hexside walls, facing/flanks): **simplify toward CWG2**, but only after R3 checks the CWG2 manual, so we cut from evidence rather than guesses.
- Unit art: adopt John's new clean illustrated style; build units from a cut-out figure kit, recolored per side in code.
- CWG2 EXE: not used (no help to us, legal risk). Screenshots/recordings of John playing CWG2 are the reference.

## Model key
**Opus** = design + tricky code. **Haiku** = running scripts, table checks, doc edits, follow-a-recipe work. **Other AI** = Gemini/Grok/ChatGPT (free) for art sheets, research, Q&A. **John** = judging looks, playtests.

## Tasks
| # | Task | Who | State |
|---|---|---|---|
| R1 | Reset to CWG2 scale: regiments as single units, classic single-unit control, coach/help text rewritten | Opus | ✅ 27 Sep (`CW.CLASSIC = true` in core.js) |
| R1b | AI still commands via internal formation orders (cohesive attacks). Verified: full AI-vs-AI battle, no errors | Opus | ✅ |
| R2a | Design the figure kit: which figures to cut from the new sheets, recolor rules (Union strong blue; CS grey/butternut; fix blue figures in CS sheets) | Opus | next |
| R2b | Run the cutting + intake scripts on new sheets, check the contact sheet | **Haiku** | after R2a |
| R2c | Procedural unit assembly (line / column / skirmish / limbered + unlimbered guns / generals), sized to fill the hex, bright enough on the painted ground | Opus | after R2a |
| R2d | Generate missing figure poses (Grok via Claude in Chrome, or Gemini by hand) | Other AI + John | as gaps appear |
| R3 | Rules check vs the CWG2 manual (`reference/cwg2_game_manual.md`): movement costs, ranges, combat, facing, walls, LOS → table of "match / differs / keep because". Includes the leftover-movement-point fix | **Haiku** (or any chat AI) builds the table; Opus applies changes | open |
| R4 | First five minutes: parchment menus, tooltips, after-action report | Opus design, Haiku for text | later |
| R5 | Playtest + balance (defender usually wins Millbrook AI-vs-AI; late-game attacker stalls) | John + Opus | later |
| — | Doc/STATUS updates, committing files to the Mac | **Haiku** | ongoing |

## When to switch to Haiku
Now fine for: R3 table, doc edits, running `tools/grab_downloads.sh` / intake and reporting results. Switch back to Opus for R2a/R2c and any bug hunt.

## Working rules (unchanged)
STATUS.md is the memory. Small targeted edits. Hover included in every UI test. Multiple-choice check-ins. Watch token budget.
