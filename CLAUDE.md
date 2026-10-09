# CWG3 — instructions for Claude (auto-loaded every session)

Project: browser remake of *Robert E. Lee: Civil War Generals 2*. Owner: John (hobby, non-programmer; keep replies short, explain jargon).

1. Read `STATUS.md` → "START HERE" block first. Then `ops/BRIEF.md` (the current directive from John/Grok). Read nothing else unless the brief needs it.
2. Do exactly what `BRIEF.md` says; respect its "Do not touch" list and "Done when". If it's ambiguous or contradicts the code, stop and ask John (multiple choice).
3. When finished, overwrite `ops/REPORT.md` (template inside), update the START HERE block only if the state changed, commit, push the branch. Work and push directly on `main` (John's standing OK, 9 Oct: he wants branches only when absolutely necessary). Before any big or risky change push a backup copy of main (`git push origin main:refs/heads/backup-main-<date>`; tags fail from the cloud workspace); use a branch only if John asks or the change is risky enough to review first. Never force-push.
4. Run/screenshot/push recipe: skill `cwg3-run-and-verify`. Gitignored build outputs (`assets/art/art.js`, `kit.js`, `scenery.js`) are NOT in a fresh clone: rebuild with `python3 -I tools/intake.py && python3 -I tools/build_kit.py` (~1 min), then `git checkout -- assets && git clean -fdq assets` to drop rewritten tracked files.
5. John opens `play.html` by double-click (file://): art must be base64-embedded; test as file://.
6. Assets: own, open-source or CC0 only; log in `ASSET_CREDITS.md`.
7. Budget rules: read only needed files, screenshots once at the end, stop and ask after 2 failed fixes, keep chat short.
8. Old docs live in `docs/archive/` — don't trust them. Specs in `docs/` (RULES_SPEC, COMBAT, AI_DESIGN, TERRAIN_DESIGN, ART_PIPELINE) are current references.
9. Suggest the use of plugins, tools, connectors, skills or other open-source content or utilities to improve our workflow and output.
