# CWG3 session 19b — Blender (headless): seamless, looping flipbook of a wheat field bending in the wind, seen from above.
# One tile = 1x1 unit. The same stalk set is copied into the 8 neighbouring tiles (only the ones whose stalks can reach in),
# so stalks leaning over an edge reappear on the other side: the tile repeats with no seam. The wind is periodic in space
# and moves exactly one tile per loop, so the last frame runs straight back into the first.
import bpy, bmesh, math, random, sys
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
FR = int(argv[0]) if argv else 48
RES = int(argv[1]) if len(argv) > 1 else 256
OUT = argv[2] if len(argv) > 2 else '/home/claude/cwg3_water/wheat/w_'
N = int(argv[3]) if len(argv) > 3 else 1400
rng = random.Random(7)

sc = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
sc.render.resolution_x = sc.render.resolution_y = RES; sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
sc.view_settings.view_transform = 'Standard'
sc.render.film_transparent = False
# light: the game's low golden-hour sun from the west, plus a soft sky
sc.world = sc.world or bpy.data.worlds.new('w'); sc.world.use_nodes = True
bg = sc.world.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.55, 0.62, 0.72, 1); bg.inputs[1].default_value = 0.55
sun_d = bpy.data.lights.new('sun', 'SUN'); sun_d.energy = 4.2; sun_d.color = (1.0, 0.88, 0.72); sun_d.angle = math.radians(2)
sun = bpy.data.objects.new('sun', sun_d); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(0), math.radians(-68), math.radians(-12))   # from the west, ~22° above the horizon
cam_d = bpy.data.cameras.new('c'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = 1.0
cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); cam.location = (0.5, 0.5, 3); sc.camera = cam

def mat(name, col, rough=0.75, var=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    if var:   # per-stalk colour variation from the vertex colour layer
        a = m.node_tree.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'tint'
        mx = m.node_tree.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
        mx.inputs[6].default_value = (*col, 1); m.node_tree.links.new(a.outputs['Color'], mx.inputs[7]); m.node_tree.links.new(mx.outputs[2], b.inputs['Base Color'])
    return m
M_SOIL = mat('soil', (0.30, 0.24, 0.12), 0.95)
M_STALK = mat('stalk', (0.62, 0.52, 0.24), 0.7, var=True)
M_EAR = mat('ear', (0.86, 0.66, 0.30), 0.55, var=True)

bpy.ops.mesh.primitive_plane_add(size=3, location=(0.5, 0.5, 0)); bpy.context.object.data.materials.append(M_SOIL)

# stalk set (one tile), jittered grid so cover is even
side = int(math.sqrt(N)); stalks = []
for i in range(side):
    for j in range(side):
        x = (i + rng.random()) / side; y = (j + rng.random()) / side
        stalks.append(dict(x=x, y=y, h=0.07 + 0.03 * rng.random(), ph=rng.random() * 0.25, lean=(rng.random() - .5) * .25,
                           az=(rng.random() - .5) * .5, tint=(0.82 + 0.3 * rng.random(), 0.85 + 0.2 * rng.random(), 0.8 + 0.25 * rng.random())))
REACH = 0.36
copies = [(dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]

def wind(x, y, t):
    """bend angle (radians) toward +x (east): a broad gust band rolling across + a finer cross ripple; periodic in x, y and t"""
    p = 2 * math.pi * (x - t + 0.18 * math.sin(2 * math.pi * y))
    g = 0.5 + 0.5 * math.sin(p)
    r = math.sin(2 * math.pi * (2 * x + y - 2 * t))
    return 0.10 + 0.55 * g ** 2 + 0.07 * r

SEG = 4
def build(t):
    bm = bmesh.new(); tint = bm.loops.layers.color.new('tint')
    for s in stalks:
        for dx, dy in copies:
            x, y = s['x'] + dx, s['y'] + dy
            if not (-REACH < x < 1 + REACH and -REACH < y < 1 + REACH): continue
            th = wind(s['x'], s['y'], t + s['ph'] * 0.0) + s['lean']
            dirx, diry = math.cos(s['az']), math.sin(s['az'])           # mostly east, a little scatter
            # stalk: bent polyline, a thin 3-sided tube
            pts = []
            for k in range(SEG + 1):
                u = k / SEG; a = th * u * u                               # bends more toward the top
                L = s['h'] * u
                pts.append((x + dirx * L * math.sin(a) * 0.9, y + diry * L * math.sin(a) * 0.9, L * math.cos(a)))
            rad = 0.0016; ring_prev = None
            for k, (px, py, pz) in enumerate(pts):
                ring = [bm.verts.new((px + rad * math.cos(q), py + rad * math.sin(q), pz)) for q in (0, 2.094, 4.189)]
                if ring_prev:
                    for q in range(3):
                        f = bm.faces.new((ring_prev[q], ring_prev[(q + 1) % 3], ring[(q + 1) % 3], ring[q])); f.material_index = 0
                        for l in f.loops: l[tint] = (*s['tint'], 1)
                ring_prev = ring
            # ear: elongated, slightly flattened spindle along the stalk's top direction
            (ax, ay, az_), (bx, by, bz) = pts[-2], pts[-1]; d = np.array([bx - ax, by - ay, bz - az_]); d /= np.linalg.norm(d)
            perp = np.cross(d, [0, 0, 1.0]); perp = perp / (np.linalg.norm(perp) + 1e-9); perp2 = np.cross(d, perp)
            base = np.array([bx, by, bz]); EL, EW = 0.034, 0.0085
            top = bm.verts.new(tuple(base + d * EL)); bot = bm.verts.new(tuple(base - d * 0.003))
            mid = [bm.verts.new(tuple(base + d * EL * .45 + (perp * math.cos(q) * EW + perp2 * math.sin(q) * EW * .7))) for q in np.linspace(0, 2 * math.pi, 7)[:-1]]
            for q in range(6):
                for f in (bm.faces.new((bot, mid[(q + 1) % 6], mid[q])), bm.faces.new((mid[q], mid[(q + 1) % 6], top))):
                    f.material_index = 1
                    for l in f.loops: l[tint] = (*s['tint'], 1)
    me = bpy.data.meshes.new('wheat'); bm.to_mesh(me); bm.free()
    me.materials.append(M_STALK); me.materials.append(M_EAR)
    return me

ob = None
for f in range(FR):
    t = f / FR
    me = build(t)
    if ob is None: ob = bpy.data.objects.new('wheat', me); sc.collection.objects.link(ob)
    else: old = ob.data; ob.data = me; bpy.data.meshes.remove(old)
    sc.render.filepath = f'{OUT}{f:04d}.png'; bpy.ops.render.render(write_still=True)
    print('FRAME', f, flush=True)
print('RENDER_DONE', FR)
