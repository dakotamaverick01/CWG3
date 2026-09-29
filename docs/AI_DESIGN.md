# CWG3 — Computer opponent, AI v1 (Phase F) · 27 Sep 2026

## Goal
A 1998 CWG2 veteran plays Millbrook against the computer and feels an opponent that holds good ground, attacks together rather than piecemeal, finishes off weak units and doesn't throw brigades away. It must play by the same rules and see only what its troops see (no fog cheating).

## Principles
1. **Commands like you do.** The AI gives the same standing orders a human gives (brigade/division lines via `CW.ORD`), then fights battalion by battalion. The code paths for moving, firing and assaulting are the player's.
2. **Honest fog.** It only reacts to enemies its own units can see, plus a short memory of where it last saw them (fades after 3 turns).
3. **Utility scoring.** Every decision is "score each option, pick the best". Weights live in one table (`AI.W`) so tuning is one edit.
4. **Watchable.** Brigades move one at a time with short pauses, volleys animate, and a banner says "Union is moving…". Input is locked until it's done.

## Turn structure (one AI side-turn)
1. **Assess:** visible enemies + memory; objectives (who holds what); force ratio; VP gap.
2. **Posture per side:** *attack* if behind on VP, or strong enough (force ratio ≥ 1.2); otherwise *defend*. At Millbrook this makes the Union the attacker and the Confederates the defender by default.
3. **Tasks → brigades (greedy by score):**
   - **Hold** objective X: our objective, threatened or valuable. Pick the anchor near X with the most cover (walls/fences/woods/height) facing the enemy's approach.
   - **Attack** objective X: enemy or neutral objective. Two stages: *stage* 3 hexes short, then *assault wave* once the brigades on that task have gathered (or after 2 turns of waiting).
   - **Reserve:** behind the most threatened held objective.
   - Score = objective value × need − travel time − danger along the way. Each objective gets a cap on brigades so it doesn't stack everything on one place.
4. **Artillery first:** unlimbered guns with a full turn fire at the best target. Limbered/idle batteries move to the highest nearby hex with line of sight over enemies/approaches, not adjacent to the enemy, then unlimber.
5. **Brigade orders:** each brigade gets its task's order (anchor, facing, frontage). The order is kept while the target doesn't change, so formation slots stay stable; brigades halted by contact get re-ordered.
6. **Fire phase:** every unit that can fire chooses a target by expected result (`CW.predict`): casualties dealt − taken × caution + break chance × value, with a bonus for focusing on already-hurt targets and for flank/rear shots.
7. **Assault phase (attackers, or defenders counter-attacking routed/weak units):** assault or charge only if predicted carry chance ≥ threshold and losses are acceptable. Cavalry charges routed units, limbered guns and disordered infantry.
8. **Housekeeping:** rally routed units if army morale allows; units that didn't act rest and resupply (like your end-turn); end the turn.

## Difficulty
| | Beginner | Intermediate | Advanced |
|---|---|---|---|
| Uses the odds preview | coarse (fewer samples) | yes | yes |
| Focus fire / flank bonus | no | yes | yes |
| Waits to attack together | no (piecemeal) | 1 turn | up to 2 turns |
| Assault threshold (carry %) | 60 | 50 | 40 + counter-attacks |
| Artillery siting | nearest height | best height | best height + keeps out of rifle range |

## Wiring
- `src/ai.js` (new) · `CW.AI.takeTurn()`.
- New battle: Opponent = **Computer (default)** or hotseat. Saved in games (`G.opp`).
- `game.js`: `endTurn()` split so the AI can finish a turn without the dialog. After the side switch, if the new side is the computer's it plays. Draw/HUD render from the player's point of view during the AI turn (fog stays on the AI's units). Input is locked while it moves.

## Test plan (headless)
- Full game AI vs AI, both sides, to the end: no errors, turns always end, both sides move and fight.
- Player CS vs AI US and player US vs AI CS: the AI takes the first turn when needed; fog respected; save/load mid-AI-turn resumes.
- Sanity numbers per run: objectives changing hands, casualties per side, brigades never idle for more than N turns when in attack posture.
