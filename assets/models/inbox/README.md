# Inbox for 3D models John finds

Drop downloaded models here (`.glb` / `.gltf` preferred, `.obj` OK) with a `.txt` of the same name holding the page link and licence.
Then tell Claude "new models in the inbox". Claude checks licence + size, moves accepted files to `../src/found/`, adds them to
`../MANIFEST.json`, bakes, and shows them in `tools/model_gallery.html`. Files left here are not committed (see .gitignore).
Rules and shopping list: `docs/ASSET_PIPELINE.md`.
