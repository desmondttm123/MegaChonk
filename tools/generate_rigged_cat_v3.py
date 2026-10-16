import bpy
import math
import os
import sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import generate_rigged_cat_v2 as legacy


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_DIR = os.path.join(ROOT, "assets", "models")
PREVIEW_DIR = os.path.join(MODEL_DIR, "game-cat-previews")
SOURCE_PATH = os.path.join(MODEL_DIR, "source", "standing-cat-cc0.glb")
GLB_PATH = os.path.join(MODEL_DIR, "turkish-van-game-cat-v3.glb")
BLEND_PATH = os.path.join(MODEL_DIR, "turkish-van-game-cat-v3.blend")
MIN_EXPORTED_TRIANGLES = 195_000


# The source tail points vertically. Reposing its actual vertices into this lower
# S-curve produces a readable third-person silhouette without adding a fake tail.
SOURCE_TAIL = [
    Vector((0.00, 0.46, 0.61)),
    Vector((0.02, 0.59, 0.78)),
    Vector((0.035, 0.70, 0.93)),
    Vector((0.043, 0.76, 1.10)),
    Vector((0.045, 0.77, 1.25)),
    Vector((0.035, 0.73, 1.39)),
    Vector((-0.005, 0.66, 1.49)),
]

GAME_TAIL = [
    Vector((0.00, 0.46, 0.61)),
    Vector((0.02, 0.61, 0.64)),
    Vector((0.07, 0.77, 0.69)),
    Vector((0.15, 0.91, 0.76)),
    Vector((0.24, 1.01, 0.84)),
    Vector((0.31, 1.05, 0.93)),
    Vector((0.30, 1.01, 1.02)),
]


BONE_SPECS = [
    ("Root", (0, 0, 0.035), (0, 0, 0.22), None, False),
    ("Pelvis", (0, 0.34, 0.54), (0, 0.13, 0.62), "Root", True),
    ("Spine", (0, 0.13, 0.62), (0, -0.10, 0.69), "Pelvis", True),
    ("Chest", (0, -0.10, 0.69), (0, -0.31, 0.77), "Spine", True),
    ("Neck", (0, -0.31, 0.77), (0, -0.46, 0.89), "Chest", True),
    ("Head", (0, -0.46, 0.89), (0, -0.67, 1.00), "Neck", True),
    ("Jaw", (0, -0.67, 0.88), (0, -0.78, 0.84), "Head", True),
    ("Ear.L", (-0.115, -0.55, 1.04), (-0.135, -0.55, 1.29), "Head", True),
    ("Ear.R", (0.115, -0.55, 1.04), (0.135, -0.55, 1.29), "Head", True),
    ("Front.L.Upper", (-0.14, -0.25, 0.62), (-0.145, -0.32, 0.36), "Chest", True),
    ("Front.L.Lower", (-0.145, -0.32, 0.36), (-0.145, -0.37, 0.13), "Front.L.Upper", True),
    ("Front.L.Paw", (-0.145, -0.37, 0.13), (-0.145, -0.48, 0.055), "Front.L.Lower", True),
    ("Front.R.Upper", (0.14, -0.25, 0.62), (0.145, -0.32, 0.36), "Chest", True),
    ("Front.R.Lower", (0.145, -0.32, 0.36), (0.145, -0.37, 0.13), "Front.R.Upper", True),
    ("Front.R.Paw", (0.145, -0.37, 0.13), (0.145, -0.48, 0.055), "Front.R.Lower", True),
    ("Hind.L.Upper", (-0.18, 0.28, 0.54), (-0.19, 0.21, 0.34), "Pelvis", True),
    ("Hind.L.Lower", (-0.19, 0.21, 0.34), (-0.19, 0.35, 0.14), "Hind.L.Upper", True),
    ("Hind.L.Paw", (-0.19, 0.35, 0.14), (-0.19, 0.23, 0.055), "Hind.L.Lower", True),
    ("Hind.R.Upper", (0.18, 0.28, 0.54), (0.19, 0.21, 0.34), "Pelvis", True),
    ("Hind.R.Lower", (0.19, 0.21, 0.34), (0.19, 0.35, 0.14), "Hind.R.Upper", True),
    ("Hind.R.Paw", (0.19, 0.35, 0.14), (0.19, 0.23, 0.055), "Hind.R.Lower", True),
]

for index in range(6):
    BONE_SPECS.append((
        f"Tail.{index + 1}",
        tuple(GAME_TAIL[index]),
        tuple(GAME_TAIL[index + 1]),
        "Pelvis" if index == 0 else f"Tail.{index}",
        True,
    ))


def smoothstep(edge0, edge1, value):
    if edge0 == edge1:
        return 0.0
    amount = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return amount * amount * (3.0 - 2.0 * amount)


def sample_polyline(points, parameter):
    position = max(0.0, min(0.999999, parameter)) * (len(points) - 1)
    segment = min(len(points) - 2, int(position))
    local = position - segment
    return points[segment].lerp(points[segment + 1], local)


def closest_polyline(points, coordinate):
    best_distance = float("inf")
    best_parameter = 0.0
    best_point = points[0]
    for index, (start, end) in enumerate(zip(points, points[1:])):
        direction = end - start
        denominator = direction.length_squared
        local = 0.0 if denominator == 0 else max(0.0, min(1.0, (coordinate - start).dot(direction) / denominator))
        point = start + direction * local
        distance = (coordinate - point).length
        if distance < best_distance:
            best_distance = distance
            best_point = point
            best_parameter = (index + local) / (len(points) - 1)
    return best_point, best_parameter, best_distance


def reshape_head(coordinate):
    point = coordinate.copy()
    blend = smoothstep(-0.30, -0.48, point.y) * smoothstep(0.61, 0.79, point.z)
    if blend > 0:
        center = Vector((0, -0.58, 0.91))
        target = center + Vector((
            (point.x - center.x) * 0.87,
            (point.y - center.y) * 0.93,
            (point.z - center.z) * 0.91,
        ))
        point = point.lerp(target, blend)

    # Keep the ears long and thin after reducing the round cranium.
    ear_blend = smoothstep(1.02, 1.14, point.z) * smoothstep(-0.38, -0.52, point.y)
    if ear_blend > 0:
        target = Vector((point.x * 1.08, point.y, 1.00 + (point.z - 1.00) * 1.08))
        point = point.lerp(target, ear_blend)
    return point


def reshape_body(body):
    tail_vertices = set()
    for vertex in body.data.vertices:
        point = vertex.co.copy()

        old_center, tail_parameter, tail_distance = closest_polyline(SOURCE_TAIL, point)
        tail_candidate = (
            tail_distance < 0.135
            and point.y > 0.39
            and point.z > 0.53
            and (tail_parameter > 0.06 or point.z > 0.61)
        )
        if tail_candidate:
            new_center = sample_polyline(GAME_TAIL, tail_parameter)
            radial = (point - old_center) * (0.80 - tail_parameter * 0.08)
            warped = new_center + radial
            base_blend = smoothstep(0.04, 0.17, tail_parameter)
            distance_blend = smoothstep(0.14, 0.09, tail_distance)
            point = point.lerp(warped, max(0.30, base_blend) * distance_blend)
            if distance_blend > 0.52:
                tail_vertices.add(vertex.index)

        point = reshape_head(point)

        torso_blend = (
            smoothstep(-0.30, -0.05, point.y)
            * (1.0 - smoothstep(0.48, 0.68, point.y))
            * smoothstep(0.23, 0.42, point.z)
            * (1.0 - smoothstep(0.79, 0.94, point.z))
        )
        if torso_blend > 0:
            point.x *= 1.0 - 0.10 * torso_blend

        belly_blend = (
            smoothstep(-0.22, -0.02, point.y)
            * (1.0 - smoothstep(0.37, 0.58, point.y))
            * (1.0 - smoothstep(0.20, 0.39, point.z))
            * (1.0 - smoothstep(0.15, 0.24, abs(point.x)))
        )
        point.z += 0.045 * belly_blend
        vertex.co = point

    body.data.update()
    return tail_vertices


def replace_material(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


def scale_mesh_about_center(obj, scale):
    center = sum((vertex.co for vertex in obj.data.vertices), Vector()) / len(obj.data.vertices)
    for vertex in obj.data.vertices:
        relative = vertex.co - center
        vertex.co = center + Vector((relative.x * scale[0], relative.y * scale[1], relative.z * scale[2]))
    obj.data.update()


def import_and_prepare(materials):
    white, brown, pink, eye, pupil, mouth, whisker = materials
    bpy.ops.import_scene.gltf(filepath=SOURCE_PATH)

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.name != "Cube"]
    for obj in list(bpy.context.scene.objects):
        if obj not in meshes:
            bpy.data.objects.remove(obj, do_unlink=True)

    for obj in meshes:
        legacy.select_only([obj], obj)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for vertex in obj.data.vertices:
            vertex.co *= 2.0
        obj.data.update()
        for polygon in obj.data.polygons:
            polygon.use_smooth = True

    body = bpy.data.objects.get("Cat continuous body")
    if body is None:
        raise RuntimeError("CC0 standing-cat body was not found")
    body.name = "MegaChonk.TurkishVan.Body"

    minimum_z = min(vertex.co.z for vertex in body.data.vertices)
    for obj in meshes:
        for vertex in obj.data.vertices:
            vertex.co.z -= minimum_z

    tail_vertices = reshape_body(body)
    for obj in meshes:
        if obj != body:
            for vertex in obj.data.vertices:
                vertex.co = reshape_head(vertex.co)

    # Pull the source's intentionally cartoon facial pieces toward natural cat proportions.
    for obj in meshes:
        if obj.name.startswith("Eye") and "glint" not in obj.name:
            scale_mesh_about_center(obj, (0.80, 0.68, 0.82))
        elif obj.name.startswith("Muzzle pad"):
            scale_mesh_about_center(obj, (0.84, 0.74, 0.80))
        elif obj.name == "Nose":
            scale_mesh_about_center(obj, (0.82, 0.76, 0.82))
        elif obj.name.startswith("Vertical pupil"):
            scale_mesh_about_center(obj, (0.78, 0.72, 0.84))

    body.data.materials.clear()
    body.data.materials.append(white)
    body.data.materials.append(brown)
    for polygon in body.data.polygons:
        center = sum((body.data.vertices[index].co for index in polygon.vertices), Vector()) / len(polygon.vertices)
        is_tail = sum(index in tail_vertices for index in polygon.vertices) >= 2
        ear = center.y < -0.43 and center.z > 1.04 and abs(center.x) > 0.045
        crown = center.y < -0.42 and center.z > 0.94 and abs(center.x) > 0.035
        right_flank = (
            center.x > 0.105
            and ((center.y - 0.01) / 0.24) ** 2 + ((center.z - 0.64) / 0.20) ** 2 < 1
        )
        left_rump = (
            center.x < -0.105
            and ((center.y - 0.27) / 0.22) ** 2 + ((center.z - 0.58) / 0.19) ** 2 < 1
        )
        polygon.material_index = 1 if is_tail or ear or crown or right_flank or left_rump else 0

    detail_materials = {
        "Eye glint": white,
        "Eye": eye,
        "Inner ear": pink,
        "Mouth": mouth,
        "Muzzle pad": white,
        "Nose": pink,
        "Vertical pupil": pupil,
        "Whisker": whisker,
    }
    details = []
    for obj in meshes:
        if obj == body:
            continue
        selected = next((material for prefix, material in detail_materials.items() if obj.name.startswith(prefix)), white)
        replace_material(obj, selected)
        details.append(obj)

    legacy.select_only([body], body)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006)
    bpy.ops.object.mode_set(mode="OBJECT")
    return body, details, tail_vertices


def tail_weight(coordinate):
    _, parameter, distance = closest_polyline(GAME_TAIL, coordinate)
    if distance > 0.16:
        return None
    if not (coordinate.y > 0.43 and coordinate.z > 0.42):
        return None
    position = parameter * 5.999
    first = min(5, int(position))
    blend = position - first
    second = min(5, first + 1)
    weights = {f"Tail.{first + 1}": 1.0 - blend}
    weights[f"Tail.{second + 1}"] = weights.get(f"Tail.{second + 1}", 0) + blend
    if parameter < 0.12:
        pelvis = 1.0 - smoothstep(0.02, 0.12, parameter)
        weights = {name: value * (1.0 - pelvis * 0.55) for name, value in weights.items()}
        weights["Pelvis"] = pelvis * 0.55
    return legacy.normalize_weights(weights)


def body_weights(coordinate):
    x, y, z = coordinate
    side = "L" if x < 0 else "R"

    tail = tail_weight(coordinate)
    if tail:
        return tail

    if y < -0.42 and z > 1.03 and abs(x) > 0.045:
        return {f"Ear.{side}": 0.90, "Head": 0.10}

    if y < -0.63 and z < 0.92:
        jaw = smoothstep(-0.63, -0.79, y)
        return legacy.normalize_weights({"Head": 0.78 - jaw * 0.43, "Jaw": 0.22 + jaw * 0.78})

    front_leg = abs(x) > 0.055 and y < -0.17 and z < 0.62
    if front_leg:
        if z < 0.12:
            return {f"Front.{side}.Paw": 0.86, f"Front.{side}.Lower": 0.14}
        if z < 0.34:
            lower = 1.0 - smoothstep(0.25, 0.37, z)
            return legacy.normalize_weights({
                f"Front.{side}.Paw": max(0.0, 0.20 * (1.0 - smoothstep(0.12, 0.22, z))),
                f"Front.{side}.Lower": 0.60 + lower * 0.30,
                f"Front.{side}.Upper": 0.34 - lower * 0.16,
            })
        shoulder = smoothstep(0.46, 0.62, z)
        return legacy.normalize_weights({
            f"Front.{side}.Lower": max(0.0, 0.18 * (1.0 - shoulder)),
            f"Front.{side}.Upper": 0.88 - shoulder * 0.38,
            "Chest": shoulder * 0.58,
        })

    hind_leg = abs(x) > 0.060 and y > 0.07 and z < 0.59
    if hind_leg:
        if z < 0.12:
            return {f"Hind.{side}.Paw": 0.84, f"Hind.{side}.Lower": 0.16}
        if z < 0.34:
            return legacy.normalize_weights({
                f"Hind.{side}.Paw": max(0.0, 0.22 * (1.0 - smoothstep(0.13, 0.24, z))),
                f"Hind.{side}.Lower": 0.72,
                f"Hind.{side}.Upper": 0.27 * smoothstep(0.20, 0.34, z),
            })
        hip = smoothstep(0.43, 0.59, z)
        return legacy.normalize_weights({
            f"Hind.{side}.Lower": max(0.0, 0.15 * (1.0 - hip)),
            f"Hind.{side}.Upper": 0.88 - hip * 0.34,
            "Pelvis": hip * 0.58,
        })

    if y < -0.34 and z > 0.68:
        head = smoothstep(-0.34, -0.49, y)
        return legacy.normalize_weights({"Neck": 1.0 - head * 0.72, "Head": 0.28 + head * 0.72})
    if y > 0.17:
        spine = smoothstep(0.48, 0.12, y)
        return legacy.normalize_weights({"Pelvis": 1.0 - spine * 0.58, "Spine": 0.20 + spine * 0.64})
    if y > -0.16:
        chest = smoothstep(0.14, -0.19, y)
        return legacy.normalize_weights({"Spine": 1.0 - chest * 0.60, "Chest": 0.25 + chest * 0.62})
    neck = smoothstep(-0.16, -0.38, y)
    return legacy.normalize_weights({"Chest": 1.0 - neck * 0.58, "Neck": 0.20 + neck * 0.66})


def rigid_skin(obj, armature, bone):
    group = obj.vertex_groups.new(name=bone)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    obj.parent = armature
    modifier = obj.modifiers.new("MegaChonkRigidDeform", "ARMATURE")
    modifier.object = armature
    modifier.use_deform_preserve_volume = True


def parent_details(details, armature):
    for obj in details:
        name = obj.name
        if name.startswith("Inner ear"):
            center_x = sum(vertex.co.x for vertex in obj.data.vertices) / len(obj.data.vertices)
            bone = "Ear.L" if center_x < 0 else "Ear.R"
        elif name == "Mouth":
            bone = "Jaw"
        else:
            bone = "Head"
        rigid_skin(obj, armature, bone)


def render_action_previews(armature, actions, camera):
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    if armature.animation_data:
        for track in armature.animation_data.nla_tracks:
            track.mute = True
    legacy.point_camera(camera, (2.8, -4.3, 2.15), (0, -0.02, 0.70))
    frames = {"Idle": 90, "Walk": 17, "Groom": 126, "Jump": 22, "Sit": 72, "Claw": 18, "Bite": 18}
    for name, frame in frames.items():
        action = actions[name]
        armature.animation_data.action = action
        bpy.context.scene.frame_set(frame)
        bpy.context.scene.render.filepath = os.path.join(PREVIEW_DIR, f"game-cat-v3-{name.lower()}.png")
        bpy.ops.render.render(write_still=True)
    armature.animation_data.action = None
    for track in armature.animation_data.nla_tracks:
        track.mute = False


def verify_glb():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)
    actions = sorted(action.name for action in bpy.data.actions)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    triangles = sum(legacy.triangle_count(obj) for obj in meshes)
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    required = ("Idle", "Walk", "Groom", "Jump", "Sit", "Claw", "Bite")
    report = {
        "actions": actions,
        "armatures": len(armatures),
        "meshes": len(meshes),
        "triangles": triangles,
        "bytes": os.path.getsize(GLB_PATH),
    }
    print("GLB_VERIFY_V3", report)
    if not all(any(required_name in action for action in actions) for required_name in required):
        raise RuntimeError(f"Animated GLB is missing actions: {actions}")
    if triangles < MIN_EXPORTED_TRIANGLES:
        raise RuntimeError(f"Animated GLB is below density target: {triangles}")
    if len(armatures) != 1:
        raise RuntimeError(f"Expected one armature, found {len(armatures)}")


def main():
    legacy.clean_scene()
    white = legacy.make_fur_material("Fur.White", (0.91, 0.88, 0.82, 1), 0.86)
    brown = legacy.make_fur_material("Fur.Chestnut", (0.42, 0.13, 0.035, 1), 0.82)
    pink = legacy.make_material("Skin.Pink", (0.72, 0.31, 0.31, 1), 0.64)
    eye = legacy.make_material("Eye.Amber", (0.42, 0.28, 0.035, 1), 0.21)
    pupil = legacy.make_material("Eye.Pupil", (0.002, 0.001, 0.001, 1), 0.14)
    mouth = legacy.make_material("Mouth.Dark", (0.045, 0.008, 0.007, 1), 0.76)
    whisker = legacy.make_material("Whisker", (0.82, 0.80, 0.75, 1), 0.56)
    materials = (white, brown, pink, eye, pupil, mouth, whisker)

    body, details, tail_vertices = import_and_prepare(materials)
    legacy.BONE_SPECS = BONE_SPECS
    armature = legacy.create_armature()
    legacy.apply_weight_function(body, armature, body_weights)
    parent_details(details, armature)

    idle_action, tracks = legacy.animate(armature)
    actions = {track.name: track.strips[0].action for track in tracks}
    ground, camera, lights = legacy.setup_preview((white, brown))
    legacy.PREVIEW_DIR = PREVIEW_DIR
    legacy.render_previews(armature, idle_action, camera)
    render_action_previews(armature, actions, camera)

    legacy.GLB_PATH = GLB_PATH
    legacy.BLEND_PATH = BLEND_PATH
    legacy.MODEL_DIR = MODEL_DIR
    legacy.export_model(armature, [body] + details, ground, camera, lights)
    verify_glb()
    print("CAT_V3_COMPLETE", {
        "blend": BLEND_PATH,
        "glb": GLB_PATH,
        "tail_vertices": len(tail_vertices),
    })


if __name__ == "__main__":
    main()
