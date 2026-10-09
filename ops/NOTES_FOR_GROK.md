# Notes from John for Grok (not yet scheduled; outside WORLD_PLAN until T8 is done)
Logged 2026-10-09. Claude does not start these; Grok/John decide when.

1. **Unit movement graphics are unreliable.** They show only some of the time, they are too fast, and the game jumps to the next unit so quickly you cannot tell what happened. Wants: always show the move, slower, and a beat before the next unit is selected. (Likely game.js move animation + auto-select; Sonnet first, Opus only if two fix attempts fail.)
2. **Post-volley box** should be a dismissable window in the middle of the screen. Today it is a corner toast that vanishes after a few seconds. (Small UI change; Sonnet.)
3. **Selected unit vs units that still have move points** are hard to tell apart. Wants a clearer visual way to separate "selected" from "can still move". (Design choice: show 2-3 options first; Sonnet.)

Model guidance given to John: Sonnet for all three; Opus only if the movement-graphics fix stalls.
