import bpy
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SOURCE = os.path.join(ROOT, "assets", "models", "source", "standing-cat-cc0.glb")
OUTPUT_DIR = os.path.join(ROOT, "assets", "models", "source", "previews")


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=SOURCE)

for obj in list(bpy.context.scene.objects):
    if obj.type in {"LIGHT", "CAMERA"} or obj.name == "Cube":
        bpy.data.objects.remove(obj, do_unlink=True)

body = bpy.data.objects.get("Cat continuous body")
if body is None:
    raise RuntimeError("Standing-cat source body was not found")

for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True

world = bpy.context.scene.world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.015, 0.02, 0.028, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22

bpy.ops.mesh.primitive_plane_add(size=5, location=(0, 0, -0.001))
ground = bpy.context.object
ground_mat = bpy.data.materials.new("Ground")
ground_mat.diffuse_color = (0.08, 0.095, 0.105, 1)
ground.data.materials.append(ground_mat)

for location, energy, size, color in (
    ((-1.2, -1.3, 2.0), 850, 1.5, (1.0, 0.82, 0.65)),
    ((1.4, 0.4, 1.45), 620, 1.3, (0.55, 0.72, 1.0)),
    ((0.0, 1.1, 2.2), 470, 1.0, (1.0, 0.96, 0.88)),
):
    data = bpy.data.lights.new("Area", "AREA")
    data.energy = energy
    data.size = size
    data.color = color
    light = bpy.data.objects.new("Area", data)
    light.location = location
    bpy.context.collection.objects.link(light)
    look_at(light, (0, 0, 0.35))

camera_data = bpy.data.cameras.new("Camera")
camera = bpy.data.objects.new("Camera", camera_data)
bpy.context.collection.objects.link(camera)
bpy.context.scene.camera = camera
camera_data.lens = 72

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.use_gtao = True
scene.eevee.gtao_distance = 3
scene.eevee.gtao_factor = 1.2
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.look = "Medium High Contrast"
scene.render.film_transparent = False
os.makedirs(OUTPUT_DIR, exist_ok=True)

views = {
    "front": (0, -1.72, 0.47),
    "side": (1.72, 0, 0.47),
    "rear": (0, 1.72, 0.47),
    "three-quarter": (-1.25, -1.25, 0.62),
}
for name, location in views.items():
    camera.location = location
    look_at(camera, (0, 0, 0.38))
    scene.render.filepath = os.path.join(OUTPUT_DIR, f"source-{name}.png")
    bpy.ops.render.render(write_still=True)

print("SOURCE_PREVIEWS", OUTPUT_DIR)
