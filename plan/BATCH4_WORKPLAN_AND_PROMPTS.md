# CWG3: Batch 4 work plan and image prompts

_Updated 27 Sep 2026 after batch 3 was processed. Same routine: paste one prompt per generation into Gemini or Grok. Save with the exact file name into **Documents/CWG3/assets/incoming/batch4/**. The prompt rules from batch 3 still apply: magenta for objects, black for smoke and fire, no "transparent background", no text._

## Batch 3: what came in and what happened to it
| Sheet | Result |
|---|---|
| 5 summer tree sheets (28a–e) | ✅ 45 trees, **now used on the map**. Forests, forest edges, lone trees, farmyards and orchards all draw from them, plus a rare red maple or dogwood accent. |
| 3 summer ground sheets (29a–c) | ✅ 12 textures. **The meadow now blends five of them**, which removed most of the orange. |
| 4 countryside sheets (30a–d) | ✅ 16 far-distance textures, ready for the land beyond the board edge (next session). |
| 3 skies (2 day, 1 golden) | ✅ Edges blended so they can wrap around the horizon. The sky backdrop gets built next session. |
| Title painting, camp painting | ✅ Processed. The camp painting had a fake "Mort Kunstler" signature painted in; it's cropped off. |
| 4 portrait sheets | ✅ **43 portraits** (25 Confederate, 18 Union); the "25yo" labels were painted out. The 4×4 Confederate sheet repeats itself a lot (same face, different hats). |
| Winter trees (41) | ✅ 8 of 9. The small young oak was too thin to cut out. Magenta tint removed from the branches. |
| Military features (39) | ✅ 8 of 9. The telegraph poles were too thin to cut out. |
| Intake tool | Fixed for Gemini-style sheets, which paint shadows as dark maroon: they now become neutral see-through shade. Winter twigs get a "de-pink" pass. |

**Not received yet:** smoke (31), cannon smoke and dust (32), flashes (33), dawn sky (34), night sky (37), landmarks (38), winter ground (40). They're carried over below.

## How we'll blend the art for high quality (what Claude will build)
1. **Noise-mask blending** (already running). Several textures are mixed through large soft random patterns, so no tile ever repeats in an obvious grid. Every extra variant makes the ground richer, so more ground sheets are always useful.
2. **Height- and slope-driven ground** (the new big one). The 3D map knows every hill. Steep slopes get rock and clay, crests get worn sun-bleached grass, hollows get lush hay, creek banks get mud and reeds. This needs the **slope/rock sheet (46)**.
3. **Scatter decals.** Small painted details (flower clumps, stones, ruts, stumps, puddles) are sprinkled by rules to break up large areas. That's sheet **48**.
4. **Close-up detail layer.** When you zoom in, a fine realistic grass texture (sheet 29a) fades in on top of the painting, so the ground stays crisp instead of going soft.
5. **One art set, many looks.** Time of day and season come from lighting, color grading and mixing tree sets, not from repainting. Summer = 97% green trees; early autumn = 70/30 green/autumn; late autumn = mostly the old autumn trees; winter = winter trees + snow ground. That's why the **autumn ground (47)** and **winter ground (40)** sheets matter.
6. **Sky matches haze.** The haze color on the distant ground is sampled from the horizon of the current sky, so sky and land always match.
7. **Wider skies by outpainting.** Gemini can "extend this image left and right". Two extensions turn a 16:9 sky into a real panorama (prompt 51).
8. **Portrait variety.** Mirroring, slight crops and tints turn 43 portraits into about 80 distinct-looking commanders. More varied source faces still help (prompt 52).

## Prompts, in priority order

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

### 46_Slopes_rock.jpg (for hills: height- and slope-driven ground)
```
A 2x2 grid of four seamless ground textures for a top-down strategy game map, painted in a rich realistic oil-painting style, summer. Camera looks STRAIGHT DOWN like a satellite photo, with even soft daylight, no vignette, no shadows from objects, no perspective. Top-left: a steep grassy hillside with patches of exposed red-brown Virginia clay. Top-right: grey limestone rock outcrop with moss and tufts of grass in the cracks. Bottom-left: loose scree and small broken stones with sparse weeds. Bottom-right: a muddy creek bank with reeds, wet dark earth and a few pebbles. Each texture fills its quarter edge to edge, separated by thin straight white gutters. No objects, no text, no labels.
```

### 48_Ground_details.jpg (scatter decals that break up big fields)
```
A 3x3 sprite sheet of nine separate small ground details for a strategy game map, painted in a rich oil-painting style, summer. Row 1: a clump of white and yellow wildflowers, a clump of purple thistles and tall weeds, a patch of dark green clover. Row 2: a small cluster of grey boulders, an old tree stump with moss, a fallen log. Row 3: a muddy puddle, a short stretch of wagon-wheel ruts in the grass, a scatter of flat fieldstones. Every item is seen from a high three-quarter bird's-eye view looking down about 55 degrees, lit by warm afternoon sun from the upper left, each casting a soft dark shadow down and to the right. Flat solid pure magenta (#FF00FF) background filling the whole image. The nine items are evenly spaced in a 3x3 grid, never touching each other or the edges. No text, no labels, no border.
```

### 38_Landmarks.jpg
```
A 3x3 sprite sheet of nine separate 1860s rural Virginia buildings for a strategy game, in the rich oil-painting style of Mort Kunstler Civil War paintings. Row 1: a white clapboard country church with a small steeple, a stone grist mill with a wooden waterwheel, a red covered wooden bridge. Row 2: a small cemetery with headstones and a low iron fence, a small wooden railroad depot, a blacksmith shop with an open front. Row 3: a large weathered wooden barn, a log cabin with a stone chimney, a two-story brick tavern. Every building is seen from a high three-quarter bird's-eye view looking down about 55 degrees, lit by warm afternoon sun from the upper left, each casting a soft dark shadow down and to the right. Flat solid pure magenta (#FF00FF) background filling the whole image. The nine buildings are evenly spaced in a 3x3 grid, never touching each other or the edges. No ground patches, no people, no text, no labels, no border.
```

### 34_Sky_dawn.jpg
```
A very wide panoramic painting of an early dawn sky over distant Virginia countryside, in the style of Mort Kunstler Civil War paintings. The top two thirds are a cool pale sky, soft blue-grey at the top warming to pale peach at the horizon, with a few thin clouds. The bottom third is misty distant rolling hills and tree lines, soft blue-grey, with low white fog lying in the valleys, with no buildings, no people, no roads. The horizon is perfectly level and straight across the whole image. No text, no border.
```

### 37_Sky_night.jpg
```
A very wide panoramic painting of a moonlit night sky over distant Virginia countryside, in the style of Mort Kunstler Civil War paintings. The top two thirds are a deep blue night sky with a bright moon, scattered stars and moonlit clouds. The bottom third is dark silhouetted rolling hills and tree lines with faint blue moonlight on them, with no buildings, no people, no roads. The horizon is perfectly level and straight across the whole image. No text, no border.
```

### 51 (edit, not a new image): widen any sky
Upload one of your sky images to Gemini, then paste this. Save the result with the same name plus `_wide` (e.g. `35a_Sky_day_wide.jpg`).
```
Extend this painting to the left and to the right so it becomes a very wide panorama about three times as wide as it is tall. Continue the same sky, clouds, light and distant hills seamlessly, keep the horizon perfectly level at the same height, same painting style, no new buildings or people, no text, no border.
```

### 47_Autumn_ground.jpg (for early-autumn maps like "Hollis Gap")
```
A 2x2 grid of four seamless ground textures for a top-down strategy game map, painted in a rich realistic oil-painting style, early autumn. Camera looks STRAIGHT DOWN like a satellite photo, with even soft daylight, no vignette, no shadows from objects, no perspective. Top-left: meadow grass turning gold and green, with a few fallen leaves. Top-right: short dry pasture, tan and olive, with worn dusty patches. Bottom-left: grass thickly covered in fallen orange, red and brown leaves. Bottom-right: grass trampled into brown mud by troops, with scattered leaves. Each texture fills its quarter edge to edge, separated by thin straight white gutters. No objects, no text, no labels.
```

### 40_Winter_ground.jpg
```
A 2x2 grid of four seamless ground textures for a top-down strategy game map, painted in a rich realistic oil-painting style, winter. Camera looks STRAIGHT DOWN like a satellite photo, with even soft daylight, no vignette, no shadows from objects, no perspective. Top-left: thin snow over a meadow with dry brown grass poking through. Top-right: deep smooth snow with soft drifts. Bottom-left: a snowy dirt road churned into brown slush and wheel ruts. Bottom-right: a frozen creek, grey-blue ice with snow at the edges. Each texture fills its quarter edge to edge, separated by thin straight white gutters. No objects, no text, no labels.
```

### 49_Summer_crops.jpg (greener crop fields to match summer)
```
A 2x2 grid of four seamless crop-field textures for a top-down strategy game map, painted in a rich realistic oil-painting style, high summer. Camera looks STRAIGHT DOWN like a satellite photo, with even soft daylight, no vignette, no perspective. Top-left: tall green corn in straight rows. Top-right: ripening wheat, green-gold, in straight rows. Bottom-left: freshly cut hay lying in long windrows on short stubble. Bottom-right: a freshly plowed brown field with straight furrows. All rows run straight up and down the image. Each texture fills its quarter edge to edge, separated by thin straight white gutters. No objects, no text, no labels.
```

### 50_Thin_props.jpg (redo of the pieces that were too thin to cut out)
```
A 3x3 sprite sheet of nine separate objects for a strategy game, in the rich oil-painting style of Mort Kunstler Civil War paintings, drawn LARGE and chunky so each fills most of its cell. Row 1: a single thick wooden telegraph pole with crossbar and glass insulators, a short row of three thick telegraph poles joined by wire, a tall wooden flagpole with a furled flag. Row 2: a small young oak tree in summer leaf, a wooden signpost with two blank arrow boards, a split-rail gate. Row 3: a well with a wooden roof and bucket, a hand pump on a stone slab, a wooden water trough. Every object is seen from a high three-quarter bird's-eye view looking down about 55 degrees, lit by warm afternoon sun from the upper left, each casting a SOFT GREY shadow down and to the right. Flat solid pure magenta (#FF00FF) background filling the whole image. The nine objects are evenly spaced in a 3x3 grid, never touching each other or the edges. No people, no text, no labels, no border.
```

### 52_Portraits_CS_varied.jpg (more distinct faces)
```
A 3x3 sheet of nine separate painted head-and-shoulders portraits of FICTIONAL Confederate officers for a strategy game, in the style of 1860s oil portraits. Make every man clearly different (not any real historical person): one very young clean-shaven lieutenant, one heavyset older colonel with white mutton-chop whiskers, one thin gaunt man with a long grey beard, one red-haired freckled captain, one bald man with a fringe of dark hair, one man with round spectacles and a neat goatee, one weathered cavalryman with a drooping moustache and plumed hat, one man with a bandaged forehead, one elderly general with short white hair and no beard. Grey or butternut officer coats with gold insignia. Each faces three-quarters toward the viewer against a plain dark warm-brown painted background, centered in its own square cell. Thin straight white gutters separate the cells. No text, no names, no numbers, no frames, no labels.
```

### 53_Portraits_US_varied.jpg (make right after 52)
```
The exact same kind of 3x3 portrait sheet as before, nine clearly different FICTIONAL Union officers (not any real historical person): one very young clean-shaven lieutenant, one heavyset older colonel with white side-whiskers, one tall thin man with a long dark beard, one blond captain with a small moustache, one bald man with glasses, one man with a thick black beard and a slouch hat, one weathered cavalryman with a drooping moustache and forage cap, one man with his arm in a sling, one elderly general with a short white beard. Strong, clearly saturated dark navy-blue Union officer coats with gold shoulder straps and brass buttons. Each faces three-quarters toward the viewer against a plain dark warm-brown painted background, centered in its own square cell, in the style of 1860s oil portraits. Thin straight white gutters separate the cells. No text, no names, no numbers, no frames, no labels.
```

## Quick checks before saving
- Flat magenta (objects) or pure black (smoke/fire), with no checkerboard.
- Separate items in a clean grid, none touching each other or the border.
- **No writing anywhere**: no labels, ages, numbers or signatures. If one sneaks in, just say so and Claude removes it.
- File name as given, saved into **Documents/CWG3/assets/incoming/batch4/**.

## Next Claude session (Opus), in order
1. Lighting follows the clock (cool dawn, neutral day, golden evening, moonlit night) + sky backdrop from the skies + countryside beyond the board edge.
2. Slope-driven ground and the close-up detail layer (needs 46).
3. Smoke, flash and dust particles (needs 31–33).
4. Portraits in the unit panel, and the title painting on the start screen.
5. Intake batch 4. Import the maps from the other AI if they're ready.
