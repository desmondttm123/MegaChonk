import bpy
import json
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SOURCE_DIR = os.path.join(ROOT, "assets", "models", "source", "jonas-dichelle-cat")
SOURCE_PATH = os.path.join(SOURCE_DIR, "cat.fbx")
PREVIEW_DIR = os.path.join(SOURCE_DIR, "previews")
REPORT_PATH = os.path.join(SOURCE_DIR, "inspection.json")


def world_bounds(objects):
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    return minimum, maximum


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def create_material(name, color, roughness):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Roughness"].default_value = roughness
    return material


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=SOURCE_PATH, automatic_bone_orientation=False)

meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
if not meshes:
    raise RuntimeError("FBX import produced no mesh objects")

for obj in meshes:
    for polygon in obj.data.polygons:
        polygon.use_smooth = True

minimum, maximum = world_bounds(meshes)
size = maximum - minimum
center = (minimum + maximum) * 0.5

report = {
    "source": os.path.relpath(SOURCE_PATH, ROOT).replace("\\", "/"),
    "bounds": {
        "minimum": list(minimum),
        "maximum": list(maximum),
        "size": list(size),
    },
    "meshes": [
        {
            "name": obj.name,
            "vertices": len(obj.data.vertices),
            "polygons": len(obj.data.polygons),
            "triangles": sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons),
            "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
            "vertex_groups": [group.name for group in obj.vertex_groups],
            "modifiers": [modifier.type for modifier in obj.modifiers],
        }
        for obj in meshes
    ],
    "armatures": [
        {
            "name": obj.name,
            "bones": [bone.name for bone in obj.data.bones],
        }
        for obj in armatures
    ],
    "actions": [
        {
            "name": action.name,
            "frame_range": list(action.frame_range),
            "fcurves": len(action.fcurves),
        }
        for action in bpy.data.actions
    ],
    "scene_frame_range": [bpy.context.scene.frame_start, bpy.context.scene.frame_end],
}

os.makedirs(PREVIEW_DIR, exist_ok=True)
with open(REPORT_PATH, "w", encoding="utf-8") as report_file:
    json.dump(report, report_file, indent=2)

# Use a neutral clay material for an anatomy-first silhouette review. Eyes retain
# a darker material when they are separate objects.
clay = create_material("Inspection Fur", (0.48, 0.43, 0.36), 0.82)
dark = create_material("Inspection Eyes", (0.012, 0.016, 0.012), 0.28)
for obj in meshes:
    obj.data.materials.clear()
    obj.data.materials.append(dark if "eye" in obj.name.lower() else clay)

world = bpy.context.scene.world
world.use_nodes = True
background = world.node_tree.nodes["Background"]
background.inputs["Color"].default_value = (0.11, 0.14, 0.18, 1.0)
background.inputs["Strength"].default_value = 0.7

ground_size = max(size.x, size.y) * 7.0
bpy.ops.mesh.primitive_plane_add(size=ground_size, location=(center.x, center.y, minimum.z - 0.002 * max(size.z, 1.0)))
ground = bpy.context.object
ground.data.materials.append(create_material("Inspection Ground", (0.055, 0.066, 0.075), 0.92))

light_specs = (
    ((-2.2, -2.8, 3.4), 7200, 2.5, (1.0, 0.82, 0.68)),
    ((2.8, 0.7, 2.5), 5200, 2.1, (0.58, 0.72, 1.0)),
    ((0.3, 2.7, 3.7), 4200, 1.8, (1.0, 0.96, 0.88)),
)
scale = max(size.x, size.y, size.z)
for index, (relative, energy, area_size, color) in enumerate(light_specs):
    data = bpy.data.lights.new(f"Inspection Key {index}", "AREA")
    data.energy = energy
    data.size = area_size * scale
    data.color = color
    light = bpy.data.objects.new(data.name, data)
    light.location = center + Vector(relative) * scale
    bpy.context.collection.objects.link(light)
    look_at(light, center)

camera_data = bpy.data.cameras.new("Inspection Camera")
camera = bpy.data.objects.new("Inspection Camera", camera_data)
bpy.context.collection.objects.link(camera)
bpy.context.scene.camera = camera
camera_data.lens = 62

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.use_gtao = True
scene.eevee.gtao_distance = scale * 2.0
scene.eevee.gtao_factor = 1.25
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.look = "Medium High Contrast"

target = Vector((center.x, center.y, minimum.z + size.z * 0.48))
radius = max(size.x, size.y) * 1.75
height = minimum.z + size.z * 0.62
for degrees in (0, 45, 90, 135, 180, 225, 270, 315):
    angle = math.radians(degrees)
    camera.location = Vector((
        center.x + math.sin(angle) * radius,
        center.y - math.cos(angle) * radius,
        height,
    ))
    look_at(camera, target)
    scene.render.filepath = os.path.join(PREVIEW_DIR, f"source-{degrees:03d}.png")
    bpy.ops.render.render(write_still=True)

print("INSPECTION_REPORT", REPORT_PATH)
print("INSPECTION_PREVIEWS", PREVIEW_DIR)
