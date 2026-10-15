import bpy
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_DIR = os.path.join(ROOT, "assets", "models")
PREVIEW_DIR = os.path.join(MODEL_DIR, "game-cat-previews")
GLB_PATH = os.path.join(MODEL_DIR, "turkish-van-game-cat.glb")
BLEND_PATH = os.path.join(MODEL_DIR, "turkish-van-game-cat.blend")
BODY_SEGMENTS = 80
BODY_RINGS = 56
MIN_EXPORTED_TRIANGLES = 200_000


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def make_material(name, color, roughness=0.72, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def uv_part(
    name,
    location,
    scale,
    material,
    segments=BODY_SEGMENTS,
    rings=BODY_RINGS,
    rotation=(0, 0, 0),
):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def cone_part(name, location, radius, depth, material, rotation=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cone_add(
        vertices=72,
        radius1=radius,
        radius2=0.008,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("SoftEar", "BEVEL")
    bevel.width = 0.012
    bevel.segments = 5
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def create_armature():
    arm_data = bpy.data.armatures.new("CatRig")
    arm = bpy.data.objects.new("CatRig", arm_data)
    bpy.context.collection.objects.link(arm)
    arm.show_in_front = True
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    specs = {
        "Root": ((0, 0, 0.06), (0, 0, 0.22), None),
        "Spine": ((0, 0.18, 0.56), (0, -0.14, 0.78), "Root"),
        "Neck": ((0, -0.22, 0.76), (0, -0.34, 0.91), "Spine"),
        "Head": ((0, -0.34, 0.91), (0, -0.53, 0.96), "Neck"),
        "Jaw": ((0, -0.58, 0.91), (0, -0.78, 0.87), "Head"),
        "Front.L.Upper": ((-0.19, -0.22, 0.61), (-0.19, -0.27, 0.36), "Spine"),
        "Front.L.Lower": ((-0.19, -0.27, 0.36), (-0.19, -0.31, 0.10), "Front.L.Upper"),
        "Front.R.Upper": ((0.19, -0.22, 0.61), (0.19, -0.27, 0.36), "Spine"),
        "Front.R.Lower": ((0.19, -0.27, 0.36), (0.19, -0.31, 0.10), "Front.R.Upper"),
        "Hind.L.Upper": ((-0.25, 0.29, 0.55), (-0.25, 0.38, 0.32), "Spine"),
        "Hind.L.Lower": ((-0.25, 0.38, 0.32), (-0.25, 0.40, 0.11), "Hind.L.Upper"),
        "Hind.R.Upper": ((0.25, 0.29, 0.55), (0.25, 0.38, 0.32), "Spine"),
        "Hind.R.Lower": ((0.25, 0.38, 0.32), (0.25, 0.40, 0.11), "Hind.R.Upper"),
        "Tail.1": ((0, 0.48, 0.62), (0, 0.70, 0.69), "Spine"),
        "Tail.2": ((0, 0.70, 0.69), (0, 0.88, 0.79), "Tail.1"),
        "Tail.3": ((0, 0.88, 0.79), (0, 1.03, 0.88), "Tail.2"),
    }
    edit_bones = {}
    for name, (head, tail, parent) in specs.items():
        bone = arm_data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        edit_bones[name] = bone
        if parent:
            bone.parent = edit_bones[parent]

    bpy.ops.object.mode_set(mode="POSE")
    for bone in arm.pose.bones:
        bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def parent_to_bone(obj, arm, bone_name):
    world = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world


def build_cat():
    white = make_material("Fur_White", (0.82, 0.82, 0.77, 1), 0.88)
    brown = make_material("Fur_Chestnut", (0.18, 0.052, 0.014, 1), 0.86)
    pink = make_material("Nose_Pink", (0.72, 0.24, 0.23, 1), 0.6)
    eye = make_material("Eyes_Gold", (0.31, 0.17, 0.025, 1), 0.28)
    pupil = make_material("Pupil", (0.006, 0.004, 0.003, 1), 0.2)
    arm = create_armature()
    parts = []

    def add(obj, bone):
        parent_to_bone(obj, arm, bone)
        parts.append(obj)
        return obj

    add(uv_part("Body", (0, 0.10, 0.65), (0.31, 0.52, 0.285), white), "Spine")
    add(uv_part("Chest", (0, -0.27, 0.66), (0.27, 0.29, 0.31), white), "Spine")
    add(uv_part("NeckMass", (0, -0.34, 0.81), (0.23, 0.22, 0.24), white), "Neck")
    add(uv_part("HeadMass", (0, -0.49, 0.96), (0.29, 0.255, 0.245), white), "Head")
    add(uv_part("Cheek.L", (-0.15, -0.67, 0.91), (0.16, 0.11, 0.14), white), "Head")
    add(uv_part("Cheek.R", (0.15, -0.67, 0.91), (0.16, 0.11, 0.14), white), "Head")
    add(uv_part("Muzzle.L", (-0.075, -0.755, 0.88), (0.105, 0.073, 0.075), white), "Jaw")
    add(uv_part("Muzzle.R", (0.075, -0.755, 0.88), (0.105, 0.073, 0.075), white), "Jaw")
    add(cone_part("Ear.L", (-0.17, -0.47, 1.21), 0.14, 0.34, brown, rotation=(0.04, -0.10, -0.05), scale=(0.75, 0.56, 1)), "Head")
    add(cone_part("Ear.R", (0.17, -0.47, 1.21), 0.14, 0.34, brown, rotation=(0.04, 0.10, 0.05), scale=(0.75, 0.56, 1)), "Head")
    add(uv_part("Nose", (0, -0.825, 0.895), (0.057, 0.035, 0.043), pink, segments=32, rings=20), "Head")
    for x in (-0.105, 0.105):
        side = "L" if x < 0 else "R"
        add(uv_part(f"Eye.{side}", (x, -0.705, 0.995), (0.055, 0.025, 0.071), eye, segments=32, rings=20), "Head")
        add(uv_part(f"Pupil.{side}", (x, -0.728, 0.998), (0.015, 0.009, 0.045), pupil, segments=24, rings=16), "Head")

    leg_specs = [
        ("Front.L", -0.19, -0.26, "Front.L.Upper", "Front.L.Lower"),
        ("Front.R", 0.19, -0.26, "Front.R.Upper", "Front.R.Lower"),
        ("Hind.L", -0.25, 0.36, "Hind.L.Upper", "Hind.L.Lower"),
        ("Hind.R", 0.25, 0.36, "Hind.R.Upper", "Hind.R.Lower"),
    ]
    for name, x, y, upper_bone, lower_bone in leg_specs:
        hind = name.startswith("Hind")
        upper_z = 0.45 if hind else 0.48
        add(uv_part(f"{name}.Upper", (x, y, upper_z), (0.105 if hind else 0.09, 0.13, 0.23), white), upper_bone)
        add(uv_part(f"{name}.Lower", (x, y - (0.02 if not hind else -0.015), 0.235), (0.082, 0.09, 0.18), white), lower_bone)
        add(uv_part(f"{name}.Paw", (x, y - 0.07, 0.075), (0.11, 0.17, 0.075), white), lower_bone)

    tail_points = [
        ((0, 0.60, 0.66), (0.105, 0.23, 0.10), "Tail.1"),
        ((0.02, 0.78, 0.74), (0.09, 0.22, 0.085), "Tail.2"),
        ((0.035, 0.96, 0.84), (0.072, 0.20, 0.07), "Tail.3"),
    ]
    for index, (location, scale, bone) in enumerate(tail_points, 1):
        add(uv_part(f"Tail.{index}.Mesh", location, scale, brown, rotation=(math.radians(64), 0, 0)), bone)

    # Turkish Van body markings: thin intersecting chestnut caps.
    add(uv_part("Patch.Back", (-0.12, 0.05, 0.91), (0.15, 0.21, 0.035), brown), "Spine")
    add(uv_part("Patch.Flank", (0.295, 0.22, 0.66), (0.035, 0.18, 0.14), brown), "Spine")
    return arm, parts


def key_pose(arm, frame, rotations=None, root_z=0.0, root_y=0.0):
    rotations = rotations or {}
    for bone in arm.pose.bones:
        bone.rotation_euler = rotations.get(bone.name, (0, 0, 0))
        bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)
    root = arm.pose.bones["Root"]
    root.location = (0, root_y, root_z)
    root.keyframe_insert(data_path="location", frame=frame, group="Root")


def create_action(arm, name, frame_end, poses):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = action
    for pose in poses:
        key_pose(arm, **pose)
    for fcurve in action.fcurves:
        for point in fcurve.keyframe_points:
            point.interpolation = "BEZIER" if name != "Walk" else "SINE"
    action.frame_range = (1, frame_end)
    arm.animation_data.action = None
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, action)
    strip.action_frame_start = 1
    strip.action_frame_end = frame_end
    return action


def animate(arm):
    create_action(
        arm,
        "Idle",
        120,
        [
            {"frame": 1, "root_z": 0.0, "rotations": {"Tail.1": (0, 0, -0.10), "Head": (0.01, 0, 0)}},
            {"frame": 60, "root_z": 0.012, "rotations": {"Tail.1": (0, 0, 0.13), "Tail.2": (0, 0, 0.08), "Head": (-0.025, 0.03, 0.02)}},
            {"frame": 120, "root_z": 0.0, "rotations": {"Tail.1": (0, 0, -0.10), "Head": (0.01, 0, 0)}},
        ],
    )
    walk_poses = []
    for frame, phase in [(1, 0), (7, math.pi / 2), (13, math.pi), (19, 3 * math.pi / 2), (25, 2 * math.pi)]:
        swing = math.sin(phase) * 0.48
        opposite = math.sin(phase + math.pi) * 0.48
        knee_a = max(0, math.sin(phase)) * 0.38
        knee_b = max(0, math.sin(phase + math.pi)) * 0.38
        walk_poses.append({
            "frame": frame,
            "root_z": abs(math.sin(phase * 2)) * 0.026,
            "rotations": {
                "Front.L.Upper": (swing, 0, 0),
                "Front.R.Upper": (opposite, 0, 0),
                "Hind.L.Upper": (opposite * 0.85, 0, 0),
                "Hind.R.Upper": (swing * 0.85, 0, 0),
                "Front.L.Lower": (-knee_a, 0, 0),
                "Front.R.Lower": (-knee_b, 0, 0),
                "Hind.L.Lower": (knee_b * 0.65, 0, 0),
                "Hind.R.Lower": (knee_a * 0.65, 0, 0),
                "Spine": (0, 0, math.sin(phase * 2) * 0.025),
                "Head": (-0.03 + abs(math.sin(phase * 2)) * 0.035, 0, -math.sin(phase) * 0.018),
                "Tail.1": (0, 0, math.sin(phase) * 0.15),
                "Tail.2": (0, 0, math.sin(phase + 0.5) * 0.12),
            },
        })
    create_action(arm, "Walk", 25, walk_poses)
    create_action(
        arm,
        "Groom",
        150,
        [
            {"frame": 1, "rotations": {}},
            {"frame": 35, "root_z": -0.035, "rotations": {"Head": (0.48, -0.04, 0.10), "Neck": (0.22, 0, 0), "Front.L.Upper": (-0.72, 0, -0.22), "Front.L.Lower": (-0.68, 0, 0), "Tail.1": (0, 0, 0.18)}},
            {"frame": 70, "root_z": -0.04, "rotations": {"Head": (0.62, 0.05, -0.08), "Neck": (0.28, 0, 0), "Front.L.Upper": (-0.82, 0, -0.25), "Front.L.Lower": (-0.78, 0, 0), "Tail.1": (0, 0, -0.10)}},
            {"frame": 105, "root_z": -0.035, "rotations": {"Head": (0.48, -0.04, 0.10), "Neck": (0.22, 0, 0), "Front.L.Upper": (-0.72, 0, -0.22), "Front.L.Lower": (-0.68, 0, 0), "Tail.1": (0, 0, 0.18)}},
            {"frame": 150, "rotations": {}},
        ],
    )
    create_action(
        arm,
        "Jump",
        42,
        [
            {"frame": 1, "rotations": {}},
            {"frame": 8, "root_z": -0.045, "rotations": {"Spine": (0.10, 0, 0), "Hind.L.Upper": (0.48, 0, 0), "Hind.R.Upper": (0.48, 0, 0), "Hind.L.Lower": (-0.36, 0, 0), "Hind.R.Lower": (-0.36, 0, 0), "Front.L.Upper": (-0.20, 0, 0), "Front.R.Upper": (-0.20, 0, 0)}},
            {"frame": 18, "root_z": 0.11, "rotations": {"Spine": (-0.12, 0, 0), "Head": (-0.10, 0, 0), "Front.L.Upper": (-0.66, 0, 0), "Front.R.Upper": (-0.66, 0, 0), "Front.L.Lower": (-0.22, 0, 0), "Front.R.Lower": (-0.22, 0, 0), "Hind.L.Upper": (-0.48, 0, 0), "Hind.R.Upper": (-0.48, 0, 0)}},
            {"frame": 29, "root_z": 0.055, "rotations": {"Spine": (0.06, 0, 0), "Front.L.Upper": (0.34, 0, 0), "Front.R.Upper": (0.34, 0, 0), "Hind.L.Upper": (0.22, 0, 0), "Hind.R.Upper": (0.22, 0, 0), "Hind.L.Lower": (-0.30, 0, 0), "Hind.R.Lower": (-0.30, 0, 0)}},
            {"frame": 42, "rotations": {}},
        ],
    )
    sit_pose = {
        "root_z": -0.16,
        "root_y": 0.065,
        "rotations": {
            "Spine": (0.10, 0, 0),
            "Neck": (-0.06, 0, 0),
            "Hind.L.Upper": (-0.88, 0, 0),
            "Hind.R.Upper": (-0.88, 0, 0),
            "Hind.L.Lower": (0.92, 0, 0),
            "Hind.R.Lower": (0.92, 0, 0),
            "Tail.1": (0, 0, 0.26),
            "Tail.2": (0, 0, 0.20),
        },
    }
    create_action(
        arm,
        "Sit",
        60,
        [
            {"frame": 1, "rotations": {}},
            {"frame": 26, **sit_pose},
            {"frame": 60, **sit_pose},
        ],
    )
    create_action(
        arm,
        "Claw",
        34,
        [
            {"frame": 1, "rotations": {}},
            {"frame": 8, "root_z": 0.025, "rotations": {"Spine": (-0.08, 0, 0.08), "Head": (-0.10, 0, -0.10), "Front.R.Upper": (-0.72, 0, -0.18), "Front.R.Lower": (-0.80, 0, 0)}},
            {"frame": 15, "root_z": 0.035, "rotations": {"Spine": (-0.12, 0, -0.10), "Head": (0.05, 0, 0.13), "Front.R.Upper": (-1.20, 0, 0.24), "Front.R.Lower": (0.32, 0, 0)}},
            {"frame": 23, "root_z": 0.02, "rotations": {"Spine": (-0.08, 0, 0.07), "Head": (-0.05, 0, -0.08), "Front.L.Upper": (-0.98, 0, -0.18), "Front.L.Lower": (0.20, 0, 0)}},
            {"frame": 34, "rotations": {}},
        ],
    )
    create_action(
        arm,
        "Bite",
        30,
        [
            {"frame": 1, "rotations": {}},
            {"frame": 8, "root_y": -0.035, "rotations": {"Spine": (-0.08, 0, 0), "Neck": (0.18, 0, 0), "Head": (0.22, 0, 0), "Jaw": (-0.10, 0, 0)}},
            {"frame": 14, "root_y": -0.085, "rotations": {"Spine": (-0.15, 0, 0), "Neck": (0.30, 0, 0), "Head": (0.36, 0, 0), "Jaw": (0.30, 0, 0), "Front.L.Upper": (-0.16, 0, 0), "Front.R.Upper": (-0.16, 0, 0)}},
            {"frame": 21, "root_y": -0.045, "rotations": {"Neck": (0.15, 0, 0), "Head": (0.14, 0, 0), "Jaw": (-0.04, 0, 0)}},
            {"frame": 30, "rotations": {}},
        ],
    )


def setup_preview():
    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.02, 0.032, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.3
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "PreviewGround"
    ground.data.materials.append(make_material("PreviewGround", (0.06, 0.085, 0.07, 1), 0.95))
    bpy.ops.object.light_add(type="AREA", location=(3.5, -4.5, 5.5))
    bpy.context.object.data.energy = 750
    bpy.context.object.data.size = 4
    bpy.ops.object.light_add(type="AREA", location=(-3, 1.5, 3))
    bpy.context.object.data.energy = 420
    bpy.context.object.data.size = 3
    bpy.ops.object.camera_add(location=(3.0, -4.4, 2.5))
    camera = bpy.context.object
    camera.rotation_euler = ((Vector((0, -0.05, 0.66)) - camera.location).to_track_quat("-Z", "Y").to_euler())
    camera.data.lens = 62
    bpy.context.scene.camera = camera
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 3
    scene.eevee.gtao_factor = 1.4
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "Medium High Contrast"
    return ground, camera


def export_model(arm, parts, ground, camera):
    os.makedirs(MODEL_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    bpy.context.scene.frame_set(1)
    bpy.context.scene.render.filepath = os.path.join(PREVIEW_DIR, "game-cat.png")
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_nla_strips=True,
        export_frame_range=True,
        export_yup=True,
        export_apply=False,
    )


def verify_glb():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)
    actions = sorted(action.name for action in bpy.data.actions)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    triangles = sum(sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons) for obj in meshes)
    materials = sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material})
    print("GLB_VERIFY", {"actions": actions, "meshes": len(meshes), "triangles": triangles, "materials": materials, "bytes": os.path.getsize(GLB_PATH)})
    required_actions = ("Idle", "Walk", "Groom", "Jump", "Sit", "Claw", "Bite")
    if not all(any(action.startswith(required) for action in actions) for required in required_actions):
        raise RuntimeError("Animated GLB is missing one or more required actions")
    if triangles < MIN_EXPORTED_TRIANGLES:
        raise RuntimeError(
            f"Animated GLB is below the high-detail target: {triangles} triangles"
        )


def main():
    clean_scene()
    arm, parts = build_cat()
    animate(arm)
    ground, camera = setup_preview()
    export_model(arm, parts, ground, camera)
    verify_glb()
    print("COMPLETE", GLB_PATH, BLEND_PATH)


if __name__ == "__main__":
    main()
