# CWG3: Batch 3 work plan and image prompts (the 3D world)

_Written 27 Sep 2026, end of session 16. For John: paste the prompts into Gemini (Nano Banana) or Grok Imagine. Upload `HANDOFF_OTHER_AI.md` to ChatGPT/Gemini for the non-image jobs (maps, sounds, research)._

## What's done
- The battlefield is now 2.5D: the painted map is draped over real hills, with sun shadows, haze, a tilt camera (`[` `]`) and a flat-map switch (`3`).
- It looks too red/orange because the lighting is always golden hour, the painting is graded gold, and the trees are autumn orange. Fixing this is item 1 of the next Claude session.

## Plan

### Tonight / between sessions (you + another AI, no Claude usage)
1. Generate the image sheets below, in priority order. Stop whenever you run out. Every sheet you make is useful on its own.
2. Save each image with the **exact file name given**, into **Documents/CWG3/assets/incoming/batch3/** (the folder is already created). No need to go through Downloads.
3. Optional: upload `HANDOFF_OTHER_AI.md` to ChatGPT or Gemini and have it do the jobs listed there (new battlefield maps, a free sound list, fictional officer roster). It saves its files to the folders named in that handoff.

### Next Claude session (Opus), in this order
1. **Lighting follows the clock** (dawn cool and misty, midday neutral, evening gold, night blue moonlight) plus **summer green trees** (sheet 28). This fixes the orange.
2. **Intake batch 3**: register the new sheets in `tools/intake.py`, run it, and review the contact sheets.
3. **Part 2a, living landscape**: drifting cloud shadows, flowing creek, sky backdrop (sheets 34–37) and countryside beyond the board edge (sheet 30).
4. **Part 2b, battle smoke and light**: 3D smoke particles from sheets 31–33, muzzle flashes that light the ground.
5. **Part 2c, period interface**: title painting (44), officer portraits (42–43), parchment/brass panels, IM Fell type, units gliding between hexes.
6. Import any new maps the other AI designed (validate, then build them into playable battlefields).

## Rules every sheet follows (already built into each prompt)
- **Objects:** flat pure magenta background (#FF00FF), a 3×3 grid, nothing touching another object or the edge, no text or labels, warm afternoon sun from the upper left, high three-quarter view looking down about 55°.
- **Ground textures:** a 2×2 grid, each quarter filling its square edge to edge, thin white gutters, camera looking straight down.
- **Smoke and fire:** pure BLACK background (the game turns black into transparency for glowing and soft things; magenta would leave pink fringes on soft smoke).
- **Never** ask for a "transparent background". Grok paints a fake checkerboard.
- If a Union sheet comes out grey-blue, redo it with the Union-blue sentence included.
- **Consistency trick:** after a sheet you like, say "the exact same sheet as the previous one, but …" for its sister sheet.

---

## Prompts (copy one whole block per generation)

### 28_Summer_trees.jpg (PRIORITY 1: fixes the orange)
```
A 3x3 sprite sheet of nine separate painted trees for a strategy game, in the rich oil-painting style of Mort Kunstler Civil War paintings. Lush deep-green high-summer foliage, NOT autumn: no orange, red or yellow leaves. Row 1: a large spreading white oak, a tall tulip poplar, a broad sugar maple. Row 2: a dense clump of three mixed hardwoods, a dark eastern white pine, a pair of hickories. Row 3: an apple tree in summer leaf, a small young oak, a thicket of low scrub bushes. Every tree is seen from a high three-quarter bird's-eye view looking down about 55 degrees, lit by warm afternoon sun from the upper left, each casting a soft dark shadow down and to the right onto the background. Flat solid pure magenta (#FF00FF) background filling the whole image. The nine trees are evenly spaced in a 3x3 grid, never touching each other or the edges of the image. No ground patches, no text, no labels, no border.
```

### 29_Summer_ground.jpg
```
A 2x2 grid of four seamless ground textures for a top-down strategy game map, painted in a rich realistic oil-painting style. Camera looks STRAIGHT DOWN like a satellite photo, with even soft daylight, no vignette, no shadows from objects, no perspective. Top-left: lush green summer meadow grass with small clover and wildflower flecks. Top-right: grazed pasture, shorter green grass with a few worn dusty patches. Bottom-left: tall uncut green hayfield grass swaying in one direction. Bottom-right: green grass trampled flat and muddy by marching troops. Natural greens, not yellow or orange. Each texture fills its quarter edge to edge, separated by thin straight white gutters. No objects, no text, no labels.
```

### 31_Musket_smoke.jpg
```
A 3x3 sprite sheet of nine separate puffs of black-powder musket smoke for a game particle system, realistic and softly painted. Off-white to pale warm grey smoke, soft billowing edges, some puffs dense and round, some thin and wispy, one long drifting streak, one ring-shaped burst. Each puff is isolated and centered in its cell, never touching another puff or the image edge. Pure solid BLACK (#000000) background everywhere, with no gradient, no ground, no text, no labels, no border.
```

### 32_Cannon_smoke_dust.jpg
```
A 3x3 sprite sheet of nine separate effects for a game particle system, realistic and softly painted. Row 1: three large dense cannon-smoke clouds of grey-white black-powder smoke, each different in shape. Row 2: three clouds of tan-brown dust kicked up by marching troops and horses. Row 3: a dark brown dirt spray from a shell burst, a tall thin column of grey smoke from a burning building, a low flat bank of drifting battle haze. Each effect is isolated and centered in its cell, never touching another or the image edge. Pure solid BLACK (#000000) background everywhere, with no gradient, no ground, no text, no labels, no border.
```

### 33_Flashes_fire.jpg
```
A 3x3 sprite sheet of nine separate bright light effects for a game, painted realistically. Row 1: three small rifle muzzle flashes (bright yellow-white core, orange tongue of flame), each pointing a different direction. Row 2: three big cannon muzzle blasts with an orange fireball and bright core. Row 3: a shell explosion flash with sparks, a small campfire flame, a burst of glowing orange sparks. Each effect is isolated and centered in its cell, never touching another or the image edge. Pure solid BLACK (#000000) background everywhere, with no gradient, no ground, no text, no labels, no border.
```

### 35_Sky_day.jpg (make this one wide: 3:1 or the widest ratio offered)
```
A very wide panoramic painting of a summer midday sky over distant Virginia countryside, in the style of Mort Kunstler Civil War paintings. The top two thirds are a clear blue sky with a few soft white cumulus clouds. The bottom third is a hazy line of distant blue-green rolling hills and tree lines fading into atmospheric haze, with no buildings, no people, no roads. The horizon is perfectly level and straight across the whole image, so the left and right edges could join into a loop. Soft natural light. No text, no border.
```

### 36_Sky_dusk.jpg (wide)
```
A very wide panoramic painting of a golden evening sky over distant Virginia countryside, in the style of Mort Kunstler Civil War paintings. The top two thirds are a warm sunset sky, deep blue at the top fading to gold and rose near the horizon, with long thin glowing clouds. The bottom third is a hazy silhouette of distant rolling hills and tree lines, dark blue-purple, fading into golden haze, with no buildings, no people, no roads. The horizon is perfectly level and straight across the whole image, so the left and right edges could join into a loop. No text, no border.
```

### 34_Sky_dawn.jpg (wide)
```
A very wide panoramic painting of an early dawn sky over distant Virginia countryside, in the style of Mort Kunstler Civil War paintings. The top two thirds are a cool pale sky, soft blue-grey at the top warming to pale peach at the horizon, with a few thin clouds. The bottom third is misty distant rolling hills and tree lines, soft blue-grey, with low white fog lying in the valleys, with no buildings, no people, no roads. The horizon is perfectly level and straight across the whole image, so the left and right edges could join into a loop. No text, no border.
```

### 37_Sky_night.jpg (wide)
```
A very wide panoramic painting of a moonlit night sky over distant Virginia countryside, in the style of Mort Kunstler Civil War paintings. The top two thirds are a deep blue night sky with a bright moon, scattered stars and moonlit clouds. The bottom third is dark silhouetted rolling hills and tree lines with faint blue moonlight on them, with no buildings, no people, no roads. The horizon is perfectly level and straight across the whole image, so the left and right edges could join into a loop. No text, no border.
```

### 44_Title_painting.jpg (16:9)
```
A dramatic wide 16:9 oil painting in the style of Mort Kunstler: a fictional American Civil War battle at golden hour in summer. In the foreground, a line of Confederate infantry in grey and butternut, with slouch hats, advances across a wheat field behind a red battle flag. In the middle distance, Union infantry in strong, clearly saturated dark blue coats and sky-blue trousers hold a stone wall on a low ridge, under drifting white musket smoke. A white farmhouse and a stone bridge over a creek sit in the valley, and warm sunlight breaks through the smoke. Painterly, heroic, historically plausible uniforms. No real historical people, no text, no title, no logo, no border. Keep the upper third calmer (sky and smoke) so a title can be placed there later.
```

### 30_Countryside_far.jpg
```
A 2x2 grid of four seamless ground textures for the far countryside around a strategy-game battlefield, painted in a rich realistic oil-painting style, summer. Camera looks STRAIGHT DOWN like a satellite photo from high up, with even soft daylight, no vignette, no perspective. Top-left: patchwork of small green and gold farm fields with hedgerows. Top-right: dense green forest canopy seen from above. Bottom-left: rolling green pasture with scattered small trees. Bottom-right: mix of woodland edge and meadow. Colors slightly muted and hazy as if seen from far away. Each texture fills its quarter edge to edge, separated by thin straight white gutters. No buildings, no roads, no text, no labels.
```

### 38_Landmarks.jpg
```
A 3x3 sprite sheet of nine separate 1860s rural Virginia buildings for a strategy game, in the rich oil-painting style of Mort Kunstler Civil War paintings. Row 1: a white clapboard country church with a small steeple, a stone grist mill with a wooden waterwheel, a red covered wooden bridge. Row 2: a small cemetery with headstones and a low iron fence, a small wooden railroad depot, a blacksmith shop with an open front. Row 3: a large weathered wooden barn, a log cabin with a stone chimney, a two-story brick tavern. Every building is seen from a high three-quarter bird's-eye view looking down about 55 degrees, lit by warm afternoon sun from the upper left, each casting a soft dark shadow down and to the right. Flat solid pure magenta (#FF00FF) background filling the whole image. The nine buildings are evenly spaced in a 3x3 grid, never touching each other or the edges. No ground patches, no people, no text, no labels, no border.
```

### 39_Military_features.jpg
```
A 3x3 sprite sheet of nine separate American Civil War battlefield features for a strategy game, in the rich oil-painting style of Mort Kunstler. Row 1: a straight section of single-track railroad (wooden ties and iron rails) running diagonally from upper-left to lower-right at a shallow 30 degree slope, the same railroad section running straight away from the viewer (vertical on the page), a line of wooden telegraph poles. Row 2: a curved earthwork artillery redoubt of packed dirt with log revetments, a short line of rifle pits with dirt parapets, an abatis of sharpened felled trees. Row 3: a cluster of three haystacks, the burned-out ruin of a small farmhouse with a standing chimney, a stacked pile of fence rails and lumber. Every object is seen from a high three-quarter bird's-eye view looking down about 55 degrees, lit by warm afternoon sun from the upper left, each casting a soft dark shadow down and to the right. Flat solid pure magenta (#FF00FF) background filling the whole image. The nine objects are evenly spaced in a 3x3 grid, never touching each other or the edges. No people, no text, no labels, no border.
```

### 42_Portraits_CS.jpg
```
A 3x3 sheet of nine separate painted head-and-shoulders portraits of FICTIONAL Confederate officers for a strategy game, in the style of 1860s oil portraits and Mort Kunstler paintings. Each is a different invented man (not any real historical person): mixed ages from 25 to 60, varied beards, moustaches and hairstyles, grey or butternut officer frock coats with gold collar insignia and buttons, some with slouch hats, some bareheaded. Each portrait faces three-quarters toward the viewer against a plain dark warm-brown painted background, centered in its own square cell. Thin straight white gutters separate the cells. No text, no names, no frames, no labels.
```

### 43_Portraits_US.jpg (make right after 42, as an edit of it if your tool allows)
```
The exact same kind of 3x3 portrait sheet as before, nine separate head-and-shoulders portraits of FICTIONAL Union officers (not any real historical person): mixed ages from 25 to 60, varied beards, moustaches and hairstyles, strong, clearly saturated dark navy-blue Union officer frock coats with gold shoulder straps and brass buttons, some with dark blue forage caps or black slouch hats, some bareheaded. Each portrait faces three-quarters toward the viewer against a plain dark warm-brown painted background, centered in its own square cell, in the style of 1860s oil portraits and Mort Kunstler paintings. Thin straight white gutters separate the cells. No text, no names, no frames, no labels.
```

### 40_Winter_ground.jpg (for future maps: visual diversity)
```
A 2x2 grid of four seamless ground textures for a top-down strategy game map, painted in a rich realistic oil-painting style, winter. Camera looks STRAIGHT DOWN like a satellite photo, with even soft daylight, no vignette, no shadows from objects, no perspective. Top-left: thin snow over a meadow with dry brown grass poking through. Top-right: deep smooth snow with soft drifts. Bottom-left: a snowy dirt road churned into brown slush and wheel ruts. Bottom-right: a frozen creek, grey-blue ice with snow at the edges. Each texture fills its quarter edge to edge, separated by thin straight white gutters. No objects, no text, no labels.
```

### 41_Winter_trees.jpg
```
A 3x3 sprite sheet of nine separate painted winter trees for a strategy game, in the rich oil-painting style of Mort Kunstler Civil War paintings. Row 1: a large bare white oak with snow on its branches, a bare tulip poplar, a bare maple. Row 2: a clump of three bare hardwoods, a dark snow-dusted eastern white pine, a pair of snowy cedars. Row 3: a bare apple tree, a small bare young oak, a low thicket of bare brown bushes with snow. Every tree is seen from a high three-quarter bird's-eye view looking down about 55 degrees, lit by pale low winter sun from the upper left, each casting a soft blue-grey shadow down and to the right. Flat solid pure magenta (#FF00FF) background filling the whole image. The nine trees are evenly spaced in a 3x3 grid, never touching each other or the edges. No ground patches, no text, no labels, no border.
```

### 45_Camp_painting.jpg (16:9, loading / after-action screen)
```
A quiet wide 16:9 oil painting in the style of Mort Kunstler: a fictional American Civil War army camp at dusk after a battle. Rows of white canvas tents on a gentle hillside, campfires glowing orange, soldiers resting in small groups, a regimental flag hanging still on a pole, smoke rising into a deep blue and gold evening sky. Muted, reflective mood. No real historical people, no text, no logo, no border. Keep the left third calmer (sky and tents) so text can be placed there later.
```

## Quick checks before you save each image
- Background is flat magenta (objects) or pure black (smoke/fire), with no checkerboard.
- 9 separate things in a 3×3 grid, none touching each other or the border.
- No writing anywhere in the image.
- Trees are green (summer sheets). Union blue is clearly blue.
- File name exactly as above, saved into **Documents/CWG3/assets/incoming/batch3/**.
