# CWG3 session 19 — Blender (headless) renders a seamless, looping flipbook of a flowing-creek height field.
# Tile: x = across the creek (0..1, not periodic: bank to bank), y = along the flow (periodic, one tile).
# Each noise layer lives on a 4D torus in y (cos/sin of 2*pi*y) so the tile repeats seamlessly downstream, and it
# slides an integer number of tiles per loop, so frame N wraps back to frame 0 with no jump.
import bpy, math, sys
FR = int(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else 48
W, H = 128, 256
OUT = '/home/claude/cwg3_water/frames/h_'

sc = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.use_denoising = False; sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '16'; sc.render.image_settings.color_mode = 'BW'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.display_settings.display_device = 'sRGB'
sc.sequencer_colorspace_settings.name = 'Non-Color'
sc.frame_start, sc.frame_end = 0, FR - 1
sc.render.filepath = OUT
sc.world = sc.world or bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0

bpy.ops.mesh.primitive_plane_add(size=1); pl = bpy.context.object; pl.scale = (1, 2, 1)
cam_d = bpy.data.cameras.new('c'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = 2.0
cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); cam.location = (0, 0, 5); sc.camera = cam

m = bpy.data.materials.new('flow'); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
for n in list(N): N.remove(n)
def node(t, **kw):
    n = N.new(t)
    for k, v in kw.items(): setattr(n, k, v)
    return n
def math_(op, a, b=None):
    n = node('ShaderNodeMath', operation=op)
    for i, x in enumerate([a, b]):
        if x is None: continue
        if isinstance(x, (int, float)): n.inputs[i].default_value = x
        else: L.new(x, n.inputs[i])
    return n.outputs[0]
tc = node('ShaderNodeTexCoord'); sep = node('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Generated'], sep.inputs[0])
u, v = sep.outputs[0], sep.outputs[1]
tv = node('ShaderNodeValue'); tdr = tv.outputs[0].driver_add('default_value'); tdr.driver.expression = f'frame/{FR}'
t = tv.outputs[0]
# layers: (across scale, torus radius along, tiles slid per loop, seed, amplitude, detail)
LAYERS = [(5.0, 0.55, 1, 1.3, 1.00, 2), (11.0, 1.4, 2, 7.1, 0.55, 3), (24.0, 3.2, 3, 13.7, 0.28, 2), (2.2, 0.25, 1, 21.0, 0.45, 1)]
acc = None
for sx, r, k, seed, amp, det in LAYERS:
    y2 = math_('SUBTRACT', v, math_('MULTIPLY', t, float(k)))
    ang = math_('MULTIPLY', y2, 2 * math.pi)
    wob = math_('MULTIPLY', math_('SINE', math_('MULTIPLY', t, 2 * math.pi)), 0.04 * k)   # a little sideways swirl, loops too
    cx = math_('MULTIPLY', math_('ADD', u, wob), sx)
    comb = node('ShaderNodeCombineXYZ')
    L.new(cx, comb.inputs[0]); L.new(math_('MULTIPLY', math_('COSINE', ang), r), comb.inputs[1]); L.new(math_('MULTIPLY', math_('SINE', ang), r), comb.inputs[2])
    nz = node('ShaderNodeTexNoise', noise_dimensions='4D'); nz.inputs['Scale'].default_value = 1.0; nz.inputs['Detail'].default_value = det
    nz.inputs['Roughness'].default_value = 0.55; nz.inputs['W'].default_value = seed
    L.new(comb.outputs[0], nz.inputs['Vector'])
    term = math_('MULTIPLY', math_('SUBTRACT', nz.outputs['Fac'], 0.5), amp)
    acc = term if acc is None else math_('ADD', acc, term)
h = math_('ADD', math_('MULTIPLY', acc, 0.9), 0.5)       # height ~0..1 around 0.5
em = node('ShaderNodeEmission'); L.new(h, em.inputs['Color']); em.inputs['Strength'].default_value = 1
out = node('ShaderNodeOutputMaterial'); L.new(em.outputs[0], out.inputs['Surface'])
pl.data.materials.append(m)
bpy.ops.render.render(animation=True)
print('RENDER_DONE', FR)
