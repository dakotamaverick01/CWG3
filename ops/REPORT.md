# REPORT (Claude's result for the last brief) — overwritten after each task
Brief: John: "living landscape turned off, 44 ms" (also on main)
Branch / commit: perf-ground-shader (off main)
Result: DONE (Mac speed not measured by me)

## What changed (≤5 lines)
- Ground shader: pixels inside a hex skip 16 noise lookups (exactly identical result). Software bench ~1.8 s -> ~1.0 s per frame.
- On slow frames the board drops resolution (1 -> 0.8 -> 0.65) before Living landscape is switched off. ?fullres turns the step-down off.

## Files touched
src/render3d.js (about 20 lines), STATUS.md, ops/NOTES_FOR_GROK.md (John's 3 UI notes, not started)

## How to revert
Delete the branch, or revert the one commit.

## Evidence (screenshot path / measurements)
Software GL, same view: main 1.75-1.93 s/frame, patched 0.96-1.01 s/frame. Pixel diff vs main on the board: only a moving unit differs. Step-down verified in console (0.8 then 0.65).
The real number on John's Mac is unmeasured: the headless renderer is a CPU proxy for shader work.

## Open questions for John / Grok
1. Does the warning still appear on the Mac? If yes, next cuts: creek-bank taps (16 per pixel) and the two big-noise fields. Those change the look slightly, so a visual check is needed.
2. This branch is off main; it touches different lines from the T1/T2 branches but both edit render3d.js, so merge in any order and expect at most a small conflict.

## Suggested next brief (one line)
Test on the Mac; then T3 (Ground set) if T2 is accepted.
