import bpy
import bmesh
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_DIR = os.path.join(ROOT, "assets", "models")
PREVIEW_DIR = os.path.join(MODEL_DIR, "previews")
BLEND_PATH = os.path.join(MODEL_DIR, "sitting-turkish-van-cat.blend")
STL_PATH = os.path.join(MODEL_DIR, "sitting-turkish-van-cat.stl")
OBJ_PATH = os.path.join(MODEL_DIR, "sitting-turkish-van-cat.obj")

WHITE = (0.92, 0.88, 0.79, 1.0)
BROWN = (0.14, 0.032, 0.008, 1.0)
PINK = (0.63, 0.22, 0.20, 1.0)
DARK = (0.035, 0.025, 0.018, 1.0)


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        pass


def material(name, color, roughness=0.72):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def smooth_object(obj):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def uv_part(name, location, scale, mat, segments=64, rings=40, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    smooth_object(obj)
    bevel = obj.modifiers.new("SurfaceSoftening", "BEVEL")
    bevel.width = 0.00035
    bevel.segments = 2
    return obj


def cone_part(name, location, radius, depth, mat, rotation=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=radius, radius2=0.0015, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("RoundedEdges", "BEVEL")
    bevel.width = 0.0018
    bevel.segments = 4
    smooth_object(obj)
    return obj


def curve_part(name, points, radii, bevel_depth, mat):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 8
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for index, (point, radius) in enumerate(zip(points, radii)):
        bp = spline.bezier_points[index]
        bp.co = point
        bp.radius = radius
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def make_cat():
    white = material("Van_White", WHITE)
    brown = material("Van_Brown", BROWN)
    pink = material("Nose_Pink", PINK, 0.55)
    dark = material("Eye_Dark", DARK, 0.3)

    parts = []
    # Seated body and chest.
    parts.append(uv_part("Body", (0, 0.003, 0.092), (0.049, 0.041, 0.071), white))
    parts.append(uv_part("Chest", (0, -0.025, 0.112), (0.038, 0.030, 0.056), white))
    parts.append(uv_part("Neck", (0, -0.006, 0.142), (0.031, 0.029, 0.034), white))
    # Broad seated haunches.
    parts.append(uv_part("Haunch_L", (-0.034, 0.013, 0.052), (0.035, 0.041, 0.045), white))
    parts.append(uv_part("Haunch_R", (0.034, 0.013, 0.052), (0.035, 0.041, 0.045), white))
    # Head, cheeks, muzzle.
    parts.append(uv_part("Head", (0, -0.006, 0.164), (0.037, 0.034, 0.033), white))
    parts.append(uv_part("Cheek_L", (-0.021, -0.029, 0.157), (0.022, 0.016, 0.020), white))
    parts.append(uv_part("Cheek_R", (0.021, -0.029, 0.157), (0.022, 0.016, 0.020), white))
    parts.append(uv_part("Muzzle_L", (-0.010, -0.047, 0.153), (0.014, 0.010, 0.010), white))
    parts.append(uv_part("Muzzle_R", (0.010, -0.047, 0.153), (0.014, 0.010, 0.010), white))
    # Straight front legs and grounded paws.
    parts.append(uv_part("Foreleg_L", (-0.019, -0.027, 0.052), (0.013, 0.014, 0.052), white))
    parts.append(uv_part("Foreleg_R", (0.019, -0.027, 0.052), (0.013, 0.014, 0.052), white))
    parts.append(uv_part("Paw_L", (-0.019, -0.037, 0.010), (0.016, 0.025, 0.010), white))
    parts.append(uv_part("Paw_R", (0.019, -0.037, 0.010), (0.016, 0.025, 0.010), white))
    # Brown ears overlap the head for strong attachment and color separation.
    parts.append(cone_part("Ear_L", (-0.023, -0.006, 0.195), 0.018, 0.046, brown, rotation=(0.12, -0.18, -0.05), scale=(0.72, 0.62, 1)))
    parts.append(cone_part("Ear_R", (0.023, -0.006, 0.195), 0.018, 0.046, brown, rotation=(0.12, 0.18, 0.05), scale=(0.72, 0.62, 1)))
    # Curled tail begins inside the right haunch and rests around the paws.
    tail = curve_part(
        "Brown_Tail",
        [(0.031, 0.025, 0.055), (0.063, 0.019, 0.035), (0.079, -0.010, 0.016), (0.060, -0.047, 0.010), (0.022, -0.062, 0.009), (-0.010, -0.057, 0.010)],
        [1.15, 1.18, 1.12, 1.00, 0.82, 0.58],
        0.010,
        brown,
    )
    parts.append(tail)

    # Facial details remain separate in the colored source, but are excluded from the print union.
    details = []
    details.append(uv_part("Nose", (0, -0.057, 0.155), (0.007, 0.004, 0.005), pink, segments=48, rings=24))
    for x in (-0.0145, 0.0145):
        details.append(uv_part("Eye", (x, -0.038, 0.169), (0.0065, 0.0035, 0.008), dark, segments=48, rings=24, rotation=(math.radians(8), 0, 0)))

    return parts, details


def duplicate_and_apply(objects):
    bpy.ops.object.select_all(action="DESELECT")
    duplicates = []
    for obj in objects:
        dup = obj.copy()
        dup.data = obj.data.copy()
        bpy.context.collection.objects.link(dup)
        dup.hide_render = True
        dup.hide_viewport = True
        dup.select_set(False)
        duplicates.append(dup)
    return duplicates


def make_print_mesh(parts):
    duplicates = duplicate_and_apply(parts)
    for obj in duplicates:
        obj.hide_viewport = False
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        if obj.type == "CURVE":
            bpy.ops.object.convert(target="MESH")
        else:
            for modifier in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.context.view_layer.objects.active = duplicates[0]
    bpy.ops.object.join()
    print_mesh = bpy.context.object
    print_mesh.name = "Printable_Fused_Cat"
    print_mesh.hide_render = True
    print_mesh.data.materials.clear()

    remesh = print_mesh.modifiers.new("WatertightVoxelUnion", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = 0.00115
    remesh.use_smooth_shade = True
    bpy.context.view_layer.objects.active = print_mesh
    bpy.ops.object.modifier_apply(modifier=remesh.name)

    smooth_object(print_mesh)

    # Ground precisely and ensure nominal 180 mm height.
    min_z = min((print_mesh.matrix_world @ v.co).z for v in print_mesh.data.vertices)
    print_mesh.location.z -= min_z
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    target_height = 0.180
    scale = target_height / print_mesh.dimensions.z
    print_mesh.scale = (scale, scale, scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    return print_mesh


def validate_mesh(obj):
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.normal_update()
    non_manifold = [edge for edge in bm.edges if not edge.is_manifold]
    boundary = [edge for edge in bm.edges if edge.is_boundary]
    wire = [edge for edge in bm.edges if edge.is_wire]
    multi_face = [edge for edge in bm.edges if len(edge.link_faces) > 2]
    loose = [vert for vert in bm.verts if not vert.link_faces]
    degenerate = [face for face in bm.faces if face.calc_area() <= 1e-16]
    stats = {
        "vertices": len(bm.verts),
        "faces": len(bm.faces),
        "triangles": sum(max(1, len(face.verts) - 2) for face in bm.faces),
        "non_manifold_edges": len(non_manifold),
        "boundary_edges": len(boundary),
        "wire_edges": len(wire),
        "multi_face_edges": len(multi_face),
        "loose_vertices": len(loose),
        "degenerate_faces": len(degenerate),
        "height_mm": obj.dimensions.z * 1000,
        "min_z_mm": min((obj.matrix_world @ v.co).z for v in bm.verts) * 1000,
    }
    bm.free()
    print("VALIDATION", stats)
    if stats["non_manifold_edges"] or stats["loose_vertices"] or stats["degenerate_faces"]:
        raise RuntimeError("Printable mesh validation failed")
    return stats


def setup_render(parts, details):
    for obj in parts + details:
        obj.hide_render = False
        obj.hide_viewport = False
    world = bpy.context.scene.world
    world.color = (0.035, 0.045, 0.055)
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.025, 0.035, 0.045, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22

    bpy.ops.mesh.primitive_plane_add(size=1.2, location=(0, 0, -0.001))
    floor = bpy.context.object
    floor.name = "Preview_Ground"
    floor.data.materials.append(material("Ground", (0.12, 0.16, 0.14, 1), 0.9))

    bpy.ops.object.light_add(type="AREA", location=(0.32, -0.42, 0.42))
    key = bpy.context.object
    key.data.energy = 42
    key.data.shape = "DISK"
    key.data.size = 0.30
    bpy.ops.object.light_add(type="AREA", location=(-0.28, 0.06, 0.29))
    fill = bpy.context.object
    fill.data.energy = 24
    fill.data.size = 0.25

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.lens = 58
    bpy.context.scene.camera = camera
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 3
    scene.eevee.gtao_factor = 1.3
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = -0.4
    return camera, floor


def point_camera(camera, location, target=(0, 0, 0.10)):
    camera.location = location
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_previews(camera):
    views = {
        "front": (0, -0.48, 0.17),
        "side": (0.48, 0, 0.17),
        "rear": (0, 0.48, 0.17),
        "three-quarter": (0.34, -0.36, 0.20),
    }
    for name, location in views.items():
        point_camera(camera, location)
        bpy.context.scene.render.filepath = os.path.join(PREVIEW_DIR, f"{name}.png")
        bpy.ops.render.render(write_still=True)


def export_files(parts, details, print_mesh, floor, camera):
    # Save editable colored source while retaining the hidden printable mesh.
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    bpy.ops.object.select_all(action="DESELECT")
    print_mesh.hide_viewport = False
    print_mesh.select_set(True)
    bpy.context.view_layer.objects.active = print_mesh
    bpy.ops.export_mesh.stl(filepath=STL_PATH, use_selection=True, ascii=False)
    print_mesh.hide_viewport = True

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts + details:
        obj.select_set(True)
    bpy.ops.wm.obj_export(filepath=OBJ_PATH, export_selected_objects=True, export_materials=True, export_triangulated_mesh=True, export_normals=True, export_uv=False)


def reimport_verify():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_mesh.stl(filepath=STL_PATH)
    stl_obj = bpy.context.object
    print("REIMPORT_STL", len(stl_obj.data.vertices), len(stl_obj.data.polygons), tuple(round(v * 1000, 2) for v in stl_obj.dimensions))
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.wm.obj_import(filepath=OBJ_PATH)
    imported = list(bpy.context.selected_objects)
    material_names = sorted({slot.material.name for obj in imported for slot in obj.material_slots if slot.material})
    print("REIMPORT_OBJ", len(imported), material_names)
    has_white = any(name.startswith("Van_White") for name in material_names)
    has_brown = any(name.startswith("Van_Brown") for name in material_names)
    if not (has_white and has_brown):
        raise RuntimeError("OBJ color materials were not preserved")


def main():
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    clean_scene()
    parts, details = make_cat()
    print_mesh = make_print_mesh(parts)
    stats = validate_mesh(print_mesh)
    camera, floor = setup_render(parts, details)
    render_previews(camera)
    export_files(parts, details, print_mesh, floor, camera)
    reimport_verify()
    print("COMPLETE", BLEND_PATH, STL_PATH, OBJ_PATH, stats)


if __name__ == "__main__":
    main()
