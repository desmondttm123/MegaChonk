import bmesh
import bpy
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_DIR = os.path.join(ROOT, "assets", "models")
PREVIEW_DIR = os.path.join(MODEL_DIR, "game-cat-previews")
GLB_PATH = os.path.join(MODEL_DIR, "turkish-van-game-cat-v2.glb")
BLEND_PATH = os.path.join(MODEL_DIR, "turkish-van-game-cat-v2.blend")
MIN_EXPORTED_TRIANGLES = 280_000
MAX_EXPORTED_TRIANGLES = 520_000
VOXEL_SIZE = 0.012


TAIL_CONTROL_POINTS = [
    Vector((0.0, 0.47, 0.68)),
    Vector((0.015, 0.64, 0.74)),
    Vector((0.03, 0.82, 0.84)),
    Vector((0.06, 0.99, 0.94)),
    Vector((0.10, 1.14, 1.03)),
    Vector((0.16, 1.26, 1.07)),
    Vector((0.23, 1.34, 1.02)),
]


BONE_SPECS = [
    ("Root", (0, 0, 0.04), (0, 0, 0.22), None, False),
    ("Pelvis", (0, 0.34, 0.58), (0, 0.10, 0.66), "Root", True),
    ("Spine", (0, 0.12, 0.65), (0, -0.18, 0.72), "Pelvis", True),
    ("Chest", (0, -0.16, 0.70), (0, -0.38, 0.81), "Spine", True),
    ("Neck", (0, -0.36, 0.80), (0, -0.52, 0.94), "Chest", True),
    ("Head", (0, -0.50, 0.94), (0, -0.67, 1.08), "Neck", True),
    ("Jaw", (0, -0.68, 0.96), (0, -0.86, 0.91), "Head", True),
    ("Ear.L", (-0.15, -0.56, 1.12), (-0.18, -0.55, 1.40), "Head", True),
    ("Ear.R", (0.15, -0.56, 1.12), (0.18, -0.55, 1.40), "Head", True),
    ("Front.L.Upper", (-0.17, -0.22, 0.62), (-0.18, -0.31, 0.39), "Chest", True),
    ("Front.L.Lower", (-0.18, -0.31, 0.39), (-0.18, -0.40, 0.15), "Front.L.Upper", True),
    ("Front.L.Paw", (-0.18, -0.40, 0.15), (-0.18, -0.54, 0.07), "Front.L.Lower", True),
    ("Front.R.Upper", (0.17, -0.22, 0.62), (0.18, -0.31, 0.39), "Chest", True),
    ("Front.R.Lower", (0.18, -0.31, 0.39), (0.18, -0.40, 0.15), "Front.R.Upper", True),
    ("Front.R.Paw", (0.18, -0.40, 0.15), (0.18, -0.54, 0.07), "Front.R.Lower", True),
    ("Hind.L.Upper", (-0.22, 0.27, 0.58), (-0.23, 0.18, 0.38), "Pelvis", True),
    ("Hind.L.Lower", (-0.23, 0.18, 0.38), (-0.23, 0.40, 0.16), "Hind.L.Upper", True),
    ("Hind.L.Paw", (-0.23, 0.40, 0.16), (-0.23, 0.22, 0.07), "Hind.L.Lower", True),
    ("Hind.R.Upper", (0.22, 0.27, 0.58), (0.23, 0.18, 0.38), "Pelvis", True),
    ("Hind.R.Lower", (0.23, 0.18, 0.38), (0.23, 0.40, 0.16), "Hind.R.Upper", True),
    ("Hind.R.Paw", (0.23, 0.40, 0.16), (0.23, 0.22, 0.07), "Hind.R.Lower", True),
]

for index in range(6):
    parent = "Pelvis" if index == 0 else f"Tail.{index}"
    BONE_SPECS.append((
        f"Tail.{index + 1}",
        tuple(TAIL_CONTROL_POINTS[index]),
        tuple(TAIL_CONTROL_POINTS[index + 1]),
        parent,
        True,
    ))


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.actions,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def make_fur_material(name, color, roughness=0.82):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular"].default_value = 0.32
    bsdf.inputs["Sheen"].default_value = 0.24

    noise = nodes.new("ShaderNodeTexNoise")
    noise.name = f"{name}.MicroFur"
    noise.inputs["Scale"].default_value = 175
    noise.inputs["Detail"].default_value = 2.4
    noise.inputs["Roughness"].default_value = 0.72
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.10
    bump.inputs["Distance"].default_value = 0.004
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def make_material(name, color, roughness=0.65, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material


def add_ellipsoid(name, location, scale, components, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    components.append(obj)
    return obj


def add_capsule(name, start, end, radius, components, radius_y=None):
    start = Vector(start)
    end = Vector(end)
    direction = end - start
    length = direction.length
    midpoint = (start + end) * 0.5
    radius_y = radius if radius_y is None else radius_y
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.scale = (radius, radius_y, length * 0.5 + radius * 0.62)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    components.append(obj)
    return obj


def add_ear_wedge(name, side, components):
    outer_x = 0.27 * side
    inner_x = 0.065 * side
    tip_x = 0.18 * side
    front_y = -0.625
    back_y = -0.55
    vertices = [
        (inner_x, front_y, 1.105),
        (outer_x, front_y + 0.025, 1.105),
        (tip_x, front_y + 0.015, 1.43),
        (inner_x, back_y, 1.105),
        (outer_x, back_y + 0.025, 1.105),
        (tip_x, back_y + 0.015, 1.43),
    ]
    faces = [
        (0, 2, 1),
        (3, 4, 5),
        (0, 3, 5, 2),
        (1, 2, 5, 4),
        (0, 1, 4, 3),
    ]
    mesh = bpy.data.meshes.new(f"{name}.Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    components.append(obj)
    return obj


def select_only(objects, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or objects[0]


def triangle_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def build_body(white, brown):
    components = []

    # Overlapping anatomical masses become one continuous skin after voxel remeshing.
    add_ellipsoid("Ribcage", (0, -0.02, 0.67), (0.275, 0.47, 0.285), components)
    add_ellipsoid("Abdomen", (0, 0.23, 0.63), (0.295, 0.35, 0.285), components)
    add_ellipsoid("PelvisMass", (0, 0.36, 0.60), (0.305, 0.27, 0.27), components)
    add_ellipsoid("ChestMass", (0, -0.31, 0.70), (0.25, 0.25, 0.29), components)
    add_ellipsoid("Breast", (0, -0.43, 0.75), (0.215, 0.19, 0.26), components)
    add_ellipsoid("NeckMass", (0, -0.46, 0.88), (0.205, 0.19, 0.205), components)
    add_ellipsoid("Cranium", (0, -0.61, 1.055), (0.235, 0.225, 0.215), components)
    add_ellipsoid("Face", (0, -0.755, 1.015), (0.175, 0.145, 0.145), components)
    add_ellipsoid("Muzzle.L", (-0.072, -0.855, 0.96), (0.105, 0.09, 0.075), components)
    add_ellipsoid("Muzzle.R", (0.072, -0.855, 0.96), (0.105, 0.09, 0.075), components)
    add_ellipsoid("Chin", (0, -0.825, 0.905), (0.12, 0.105, 0.072), components)
    add_ellipsoid("Shoulder.L", (-0.15, -0.245, 0.64), (0.15, 0.20, 0.22), components)
    add_ellipsoid("Shoulder.R", (0.15, -0.245, 0.64), (0.15, 0.20, 0.22), components)

    for side, suffix in ((-1, "L"), (1, "R")):
        x = 0.18 * side
        add_capsule(f"Front.{suffix}.UpperMass", (x, -0.25, 0.61), (x, -0.32, 0.38), 0.105, components, 0.12)
        add_ellipsoid(f"Front.{suffix}.Elbow", (x, -0.32, 0.38), (0.105, 0.11, 0.12), components)
        add_capsule(f"Front.{suffix}.LowerMass", (x, -0.32, 0.39), (x, -0.40, 0.14), 0.078, components, 0.085)
        add_ellipsoid(f"Front.{suffix}.Paw", (x, -0.485, 0.075), (0.105, 0.15, 0.07), components)

        hx = 0.225 * side
        add_ellipsoid(f"Hind.{suffix}.Thigh", (hx, 0.27, 0.46), (0.17, 0.21, 0.235), components, (0.08, 0, 0))
        add_capsule(f"Hind.{suffix}.Shank", (hx, 0.24, 0.40), (hx, 0.41, 0.17), 0.105, components, 0.12)
        add_ellipsoid(f"Hind.{suffix}.Hock", (hx, 0.405, 0.17), (0.095, 0.105, 0.105), components)
        add_capsule(f"Hind.{suffix}.Metatarsal", (hx, 0.40, 0.16), (hx, 0.27, 0.085), 0.072, components, 0.08)
        add_ellipsoid(f"Hind.{suffix}.Paw", (hx, 0.205, 0.068), (0.115, 0.17, 0.064), components)

    add_ear_wedge("Ear.L.Outer", -1, components)
    add_ear_wedge("Ear.R.Outer", 1, components)

    select_only(components, components[0])
    bpy.ops.object.join()
    body = bpy.context.object
    body.name = "TurkishVan.Body"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    body.data.remesh_voxel_size = VOXEL_SIZE
    body.data.remesh_voxel_adaptivity = 0.0
    body.data.use_remesh_fix_poles = True
    body.data.use_remesh_preserve_volume = True
    bpy.ops.object.voxel_remesh()

    smooth = body.modifiers.new("SculptRelax", "SMOOTH")
    smooth.factor = 0.24
    smooth.iterations = 2
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=smooth.name)

    for polygon in body.data.polygons:
        polygon.use_smooth = True

    body.data.materials.append(white)
    body.data.materials.append(brown)

    # Generate UVs before subdivision so the dense runtime mesh inherits them.
    select_only([body], body)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(64), island_margin=0.008)
    bpy.ops.object.mode_set(mode="OBJECT")

    if triangle_count(body) < MIN_EXPORTED_TRIANGLES:
        subdivision = body.modifiers.new("SculptDensity", "SUBSURF")
        subdivision.subdivision_type = "CATMULL_CLARK"
        subdivision.levels = 1
        subdivision.render_levels = 1
        bpy.ops.object.modifier_apply(modifier=subdivision.name)

    count = triangle_count(body)
    if count > MAX_EXPORTED_TRIANGLES:
        decimate = body.modifiers.new("RuntimeDensityLimit", "DECIMATE")
        decimate.decimate_type = "COLLAPSE"
        decimate.ratio = MAX_EXPORTED_TRIANGLES / count
        decimate.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=decimate.name)

    for polygon in body.data.polygons:
        polygon.use_smooth = True
    assign_body_materials(body)
    print("BODY_MESH", {"triangles": triangle_count(body), "vertices": len(body.data.vertices)})
    return body


def assign_body_materials(body):
    vertices = body.data.vertices
    for polygon in body.data.polygons:
        center = sum((vertices[index].co for index in polygon.vertices), Vector()) / len(polygon.vertices)
        x, y, z = center
        ear_or_cap = y < -0.45 and z > 1.115 and abs(x) > 0.045
        right_flank = ((x - 0.255) / 0.075) ** 2 + ((y - 0.04) / 0.22) ** 2 + ((z - 0.75) / 0.18) ** 2 < 1
        left_rump = ((x + 0.25) / 0.07) ** 2 + ((y - 0.28) / 0.16) ** 2 + ((z - 0.68) / 0.15) ** 2 < 1
        polygon.material_index = 1 if ear_or_cap or right_flank or left_rump else 0


def create_armature():
    armature_data = bpy.data.armatures.new("MegaChonkRig")
    armature = bpy.data.objects.new("MegaChonkRig", armature_data)
    bpy.context.collection.objects.link(armature)
    armature.show_in_front = True
    select_only([armature], armature)
    bpy.ops.object.mode_set(mode="EDIT")

    edit_bones = {}
    for name, head, tail, parent, deform in BONE_SPECS:
        bone = armature_data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.use_deform = deform
        edit_bones[name] = bone
        if parent:
            bone.parent = edit_bones[parent]

    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    return armature


def smoothstep(edge0, edge1, value):
    if edge0 == edge1:
        return 0.0
    amount = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return amount * amount * (3 - 2 * amount)


def normalize_weights(weights):
    total = sum(weights.values())
    if total <= 0:
        return {"Spine": 1.0}
    return {name: value / total for name, value in weights.items() if value > 0.0001}


def body_weights(coordinate):
    x, y, z = coordinate
    side = "L" if x < 0 else "R"

    if y < -0.46 and z > 1.11 and abs(x) > 0.055:
        return {f"Ear.{side}": 0.9, "Head": 0.1}

    if y < -0.74 and z < 0.99:
        jaw_amount = smoothstep(-0.74, -0.88, y)
        return normalize_weights({"Head": 1 - jaw_amount, "Jaw": 0.45 + jaw_amount})

    front_leg = abs(x) > 0.065 and y < -0.12 and z < 0.61
    if front_leg:
        if z < 0.13:
            return {f"Front.{side}.Paw": 0.84, f"Front.{side}.Lower": 0.16}
        if z < 0.34:
            lower = 1 - smoothstep(0.27, 0.37, z)
            return normalize_weights({
                f"Front.{side}.Paw": max(0, smoothstep(0.13, 0.18, z) * (1 - smoothstep(0.18, 0.25, z))),
                f"Front.{side}.Lower": 0.62 + lower * 0.26,
                f"Front.{side}.Upper": 0.34 - lower * 0.18,
            })
        shoulder_blend = smoothstep(0.48, 0.61, z)
        return normalize_weights({
            f"Front.{side}.Lower": max(0, 0.24 * (1 - shoulder_blend)),
            f"Front.{side}.Upper": 0.9 - shoulder_blend * 0.38,
            "Chest": shoulder_blend * 0.58,
        })

    hind_leg = abs(x) > 0.085 and y > 0.075 and z < 0.56
    if hind_leg:
        if z < 0.13:
            return {f"Hind.{side}.Paw": 0.82, f"Hind.{side}.Lower": 0.18}
        if z < 0.34:
            return normalize_weights({
                f"Hind.{side}.Paw": max(0, 0.28 * (1 - smoothstep(0.14, 0.25, z))),
                f"Hind.{side}.Lower": 0.76,
                f"Hind.{side}.Upper": 0.22 * smoothstep(0.22, 0.34, z),
            })
        hip_blend = smoothstep(0.45, 0.56, z)
        return normalize_weights({
            f"Hind.{side}.Lower": max(0, 0.18 * (1 - hip_blend)),
            f"Hind.{side}.Upper": 0.9 - hip_blend * 0.36,
            "Pelvis": hip_blend * 0.58,
        })

    if y < -0.43 and z > 0.78:
        head_amount = smoothstep(-0.43, -0.58, y)
        return normalize_weights({"Neck": 1 - head_amount, "Head": 0.38 + head_amount})

    if y > 0.17:
        spine_amount = smoothstep(0.42, 0.13, y)
        return normalize_weights({"Pelvis": 1 - spine_amount * 0.55, "Spine": spine_amount * 0.7})
    if y > -0.18:
        chest_amount = smoothstep(0.15, -0.20, y)
        return normalize_weights({"Spine": 1 - chest_amount * 0.58, "Chest": 0.25 + chest_amount * 0.55})
    neck_amount = smoothstep(-0.18, -0.44, y)
    return normalize_weights({"Chest": 1 - neck_amount * 0.55, "Neck": 0.18 + neck_amount * 0.62})


def apply_weight_function(obj, armature, weight_function):
    group_indices = {}
    for bone in armature.data.bones:
        if bone.use_deform:
            group_indices[bone.name] = obj.vertex_groups.new(name=bone.name).index

    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    deform_layer = bm.verts.layers.deform.verify()
    for vertex in bm.verts:
        weights = weight_function(vertex.co)
        for name, weight in weights.items():
            group_index = group_indices.get(name)
            if group_index is not None and weight > 0:
                vertex[deform_layer][group_index] = weight
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    obj.parent = armature
    modifier = obj.modifiers.new("MegaChonkDeform", "ARMATURE")
    modifier.object = armature
    modifier.use_deform_preserve_volume = True


def catmull_rom(points, samples_per_segment=12):
    output = []
    extended = [points[0]] + points + [points[-1]]
    for segment in range(1, len(extended) - 2):
        p0, p1, p2, p3 = extended[segment - 1:segment + 3]
        for sample in range(samples_per_segment):
            t = sample / samples_per_segment
            t2 = t * t
            t3 = t2 * t
            point = 0.5 * (
                2 * p1
                + (-p0 + p2) * t
                + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
            )
            output.append(point)
    output.append(points[-1])
    return output


def build_tail(brown, armature):
    centers = catmull_rom(TAIL_CONTROL_POINTS, 12)
    sides = 48
    vertices = []
    faces = []
    parameters = []
    previous_normal = Vector((1, 0, 0))

    for ring, center in enumerate(centers):
        t = ring / (len(centers) - 1)
        if ring == 0:
            tangent = (centers[1] - center).normalized()
        elif ring == len(centers) - 1:
            tangent = (center - centers[ring - 1]).normalized()
        else:
            tangent = (centers[ring + 1] - centers[ring - 1]).normalized()
        normal = previous_normal - tangent * previous_normal.dot(tangent)
        if normal.length < 0.001:
            normal = tangent.cross(Vector((0, 1, 0)))
        normal.normalize()
        binormal = tangent.cross(normal).normalized()
        previous_normal = normal
        radius = 0.075 + 0.035 * math.sin(math.pi * t) ** 0.72 - 0.023 * t
        for side_index in range(sides):
            angle = side_index / sides * math.tau
            fur_ripple = 1 + 0.018 * math.sin(angle * 7 + t * 31)
            point = center + (normal * math.cos(angle) + binormal * math.sin(angle)) * radius * fur_ripple
            vertices.append(tuple(point))
            parameters.append(t)

    for ring in range(len(centers) - 1):
        for side_index in range(sides):
            next_side = (side_index + 1) % sides
            a = ring * sides + side_index
            b = ring * sides + next_side
            c = (ring + 1) * sides + next_side
            d = (ring + 1) * sides + side_index
            faces.append((a, b, c, d))
    faces.append(tuple(reversed(range(sides))))
    last_start = (len(centers) - 1) * sides
    faces.append(tuple(last_start + index for index in range(sides)))

    mesh = bpy.data.meshes.new("TurkishVan.Tail.Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    tail = bpy.data.objects.new("TurkishVan.Tail", mesh)
    bpy.context.collection.objects.link(tail)
    tail.data.materials.append(brown)
    for polygon in tail.data.polygons:
        polygon.use_smooth = True

    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            ring = min(len(centers) - 1, vertex_index // sides)
            side_index = vertex_index % sides
            uv_layer.data[loop_index].uv = (side_index / sides, ring / (len(centers) - 1))

    def tail_weights(coordinate):
        closest_ring = min(range(len(centers)), key=lambda index: (coordinate - centers[index]).length_squared)
        t = closest_ring / (len(centers) - 1)
        if t < 0.055:
            return {"Pelvis": 0.42, "Tail.1": 0.58}
        scaled = min(5.999, t * 6)
        first = min(5, int(scaled))
        second = min(5, first + 1)
        blend = scaled - first
        weights = {f"Tail.{first + 1}": 1 - blend}
        weights[f"Tail.{second + 1}"] = weights.get(f"Tail.{second + 1}", 0) + blend
        return normalize_weights(weights)

    apply_weight_function(tail, armature, tail_weights)
    print("TAIL_MESH", {"triangles": triangle_count(tail), "vertices": len(tail.data.vertices)})
    return tail


def parent_to_bone(obj, armature, bone_name):
    matrix = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = matrix


def add_uv_detail(name, location, scale, material, armature, bone="Head", segments=48, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    parent_to_bone(obj, armature, bone)
    return obj


def add_triangle_detail(name, vertices, material, armature, bone):
    mesh = bpy.data.meshes.new(f"{name}.Mesh")
    mesh.from_pydata(vertices, [], [(0, 1, 2)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("SoftEdge", "SOLIDIFY")
    bevel.thickness = 0.008
    parent_to_bone(obj, armature, bone)
    return obj


def add_curve_detail(name, points, material, armature, bone, radius=0.004):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    select_only([obj], obj)
    bpy.ops.object.convert(target="MESH")
    parent_to_bone(obj, armature, bone)
    return obj


def build_face(armature, materials):
    white, brown, pink, eye, pupil, mouth, whisker = materials
    details = []
    for side, x in (("L", -0.092), ("R", 0.092)):
        details.append(add_uv_detail(f"Eye.{side}", (x, -0.842, 1.055), (0.061, 0.021, 0.072), eye, armature))
        details.append(add_uv_detail(f"Pupil.{side}", (x, -0.861, 1.056), (0.017, 0.008, 0.046), pupil, armature, segments=32, rings=20))

    details.append(add_triangle_detail(
        "Nose",
        [(-0.055, -0.929, 0.982), (0.055, -0.929, 0.982), (0, -0.938, 0.937)],
        pink,
        armature,
        "Head",
    ))

    for side, sign in (("L", -1), ("R", 1)):
        inner = 0.085 * sign
        outer = 0.235 * sign
        tip = 0.18 * sign
        details.append(add_triangle_detail(
            f"Ear.{side}.Inner",
            [(inner, -0.636, 1.13), (outer, -0.61, 1.13), (tip, -0.61, 1.38)],
            pink,
            armature,
            f"Ear.{side}",
        ))

    details.append(add_curve_detail(
        "Mouth.Center",
        [(0, -0.936, 0.942), (0, -0.936, 0.922)],
        mouth,
        armature,
        "Jaw",
        0.0035,
    ))
    details.append(add_curve_detail(
        "Mouth.L",
        [(0, -0.936, 0.922), (-0.04, -0.922, 0.908), (-0.085, -0.895, 0.914)],
        mouth,
        armature,
        "Jaw",
        0.0035,
    ))
    details.append(add_curve_detail(
        "Mouth.R",
        [(0, -0.936, 0.922), (0.04, -0.922, 0.908), (0.085, -0.895, 0.914)],
        mouth,
        armature,
        "Jaw",
        0.0035,
    ))

    for side, sign in (("L", -1), ("R", 1)):
        for index, z_offset in enumerate((-0.025, 0.0, 0.025)):
            start = Vector((0.075 * sign, -0.905, 0.955 + z_offset))
            middle = Vector((0.22 * sign, -0.91, 0.97 + z_offset * 1.3))
            end = Vector((0.40 * sign, -0.84 + index * 0.008, 0.99 + z_offset * 2.1))
            details.append(add_curve_detail(
                f"Whisker.{side}.{index + 1}",
                [start, middle, end],
                whisker,
                armature,
                "Head",
                0.0022,
            ))
    return details


def key_pose(armature, frame, rotations=None, locations=None, scales=None, root=(0, 0, 0)):
    rotations = rotations or {}
    locations = locations or {}
    scales = scales or {}
    for bone in armature.pose.bones:
        bone.rotation_euler = rotations.get(bone.name, (0, 0, 0))
        bone.location = locations.get(bone.name, (0, 0, 0))
        bone.scale = scales.get(bone.name, (1, 1, 1))
        if bone.name == "Root":
            bone.location = root
        bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)
        bone.keyframe_insert(data_path="location", frame=frame, group=bone.name)
        bone.keyframe_insert(data_path="scale", frame=frame, group=bone.name)


def create_action(armature, name, frame_end, poses, interpolation="BEZIER"):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action
    for pose in poses:
        key_pose(armature, **pose)
    for curve in action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = interpolation
    action.frame_range = (1, frame_end)
    armature.animation_data.action = None
    track = armature.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, action)
    strip.action_frame_start = 1
    strip.action_frame_end = frame_end
    return action, track


def sit_rotations(extra=None):
    rotations = {
        "Pelvis": (0.13, 0, 0),
        "Spine": (0.10, 0, 0),
        "Chest": (-0.05, 0, 0),
        "Neck": (-0.08, 0, 0),
        "Hind.L.Upper": (-0.95, 0.05, -0.08),
        "Hind.R.Upper": (-0.95, -0.05, 0.08),
        "Hind.L.Lower": (1.02, 0, 0),
        "Hind.R.Lower": (1.02, 0, 0),
        "Hind.L.Paw": (-0.22, 0, -0.08),
        "Hind.R.Paw": (-0.22, 0, 0.08),
        "Tail.1": (0.05, 0, 0.24),
        "Tail.2": (0.02, 0, 0.18),
    }
    if extra:
        rotations.update(extra)
    return rotations


def animate(armature):
    tracks = []
    idle_poses = [
        {"frame": 1, "rotations": {"Tail.1": (0, 0, -0.05), "Tail.2": (0, 0, 0.04)}},
        {"frame": 30, "root": (0, 0, 0.006), "rotations": {"Chest": (-0.012, 0, 0), "Head": (0.012, 0, -0.015), "Tail.1": (0, 0, 0.02)}, "scales": {"Chest": (1.012, 1.012, 1.018)}},
        {"frame": 60, "rotations": {"Head": (-0.018, 0.025, 0.035), "Neck": (0, 0, 0.018), "Tail.1": (0, 0, 0.10), "Tail.2": (0, 0, 0.08)}},
        {"frame": 90, "root": (0, 0, 0.008), "rotations": {"Head": (-0.012, -0.018, 0.075), "Ear.L": (0.05, 0, -0.08), "Tail.1": (0, 0, 0.15)}, "scales": {"Chest": (1.015, 1.015, 1.02)}},
        {"frame": 112, "rotations": {"Head": (0.006, 0, 0.03), "Ear.L": (-0.075, 0.03, 0.09), "Ear.R": (0.035, 0, -0.03), "Tail.2": (0, 0, -0.03)}},
        {"frame": 128, "rotations": {"Head": (0.008, 0, 0.01), "Ear.L": (0.02, 0, -0.02), "Tail.1": (0, 0, 0.02)}},
        {"frame": 160, "root": (0, 0, 0.007), "rotations": {"Pelvis": (0, 0, -0.012), "Spine": (0.01, 0, 0.014), "Head": (-0.018, 0.02, -0.055), "Tail.1": (0, 0, -0.11)}, "scales": {"Chest": (1.013, 1.013, 1.019)}},
        {"frame": 196, "rotations": {"Head": (0.005, -0.02, -0.025), "Ear.R": (-0.06, -0.02, -0.07), "Tail.1": (0, 0, -0.16), "Tail.2": (0, 0, -0.09)}},
        {"frame": 220, "rotations": {"Head": (0.006, 0, -0.01), "Tail.1": (0, 0, -0.09)}},
        {"frame": 240, "rotations": {"Tail.1": (0, 0, -0.05), "Tail.2": (0, 0, 0.04)}},
    ]
    idle, track = create_action(armature, "Idle", 240, idle_poses)
    tracks.append(track)

    walk_poses = []
    leg_offsets = {
        "Front.L": 0,
        "Hind.R": math.pi / 2,
        "Front.R": math.pi,
        "Hind.L": 3 * math.pi / 2,
    }
    for frame in range(1, 50, 4):
        phase = (frame - 1) / 48 * math.tau
        rotations = {
            "Pelvis": (math.sin(phase * 2) * 0.018, 0, math.sin(phase) * 0.032),
            "Spine": (-0.018 + math.cos(phase * 2) * 0.022, 0, -math.sin(phase) * 0.018),
            "Chest": (0.012 - math.cos(phase * 2) * 0.012, 0, math.sin(phase) * 0.012),
            "Neck": (-0.018, 0, -math.sin(phase) * 0.012),
            "Head": (-0.025 + abs(math.sin(phase * 2)) * 0.022, 0, math.sin(phase) * 0.018),
            "Tail.1": (0, math.sin(phase) * 0.018, -math.sin(phase) * 0.09),
            "Tail.2": (0, 0, -math.sin(phase - 0.45) * 0.075),
            "Tail.3": (0, 0, -math.sin(phase - 0.8) * 0.055),
        }
        for leg, offset in leg_offsets.items():
            swing = math.sin(phase + offset)
            lift = max(0, math.sin(phase + offset + 0.38))
            upper_scale = 0.42 if leg.startswith("Front") else 0.36
            rotations[f"{leg}.Upper"] = (swing * upper_scale, 0, 0)
            rotations[f"{leg}.Lower"] = (-lift * (0.52 if leg.startswith("Front") else 0.44), 0, 0)
            rotations[f"{leg}.Paw"] = (lift * 0.24 - swing * 0.08, 0, 0)
        walk_poses.append({
            "frame": frame,
            "root": (0, 0, 0.008 + abs(math.sin(phase * 2)) * 0.018),
            "rotations": rotations,
        })
    walk_poses.append(walk_poses[0] | {"frame": 49})
    _, track = create_action(armature, "Walk", 49, walk_poses, "BEZIER")
    tracks.append(track)

    sit_base = sit_rotations()
    _, track = create_action(armature, "Sit", 72, [
        {"frame": 1, "rotations": {}},
        {"frame": 18, "root": (0, 0.025, -0.07), "rotations": sit_rotations({"Hind.L.Upper": (-0.48, 0, 0), "Hind.R.Upper": (-0.48, 0, 0)})},
        {"frame": 42, "root": (0, 0.065, -0.16), "rotations": sit_base},
        {"frame": 72, "root": (0, 0.065, -0.16), "rotations": sit_base},
    ])
    tracks.append(track)

    groom_poses = []
    lick_frames = [(1, 0.0), (30, 0.4), (54, 1.0), (78, 0.25), (102, 1.0), (126, 0.25), (150, 1.0), (174, 0.25), (198, 0.8), (222, 0.2), (240, 0.0)]
    for frame, lick in lick_frames:
        extra = {
            "Head": (0.38 + lick * 0.20, -0.06 + lick * 0.08, 0.14 - lick * 0.18),
            "Neck": (0.18 + lick * 0.08, 0, 0.03),
            "Front.L.Upper": (-0.72 - lick * 0.10, 0, -0.24),
            "Front.L.Lower": (-0.66 - lick * 0.12, 0, 0),
            "Front.L.Paw": (0.30 + lick * 0.16, 0, 0.10),
            "Tail.1": (0.02, 0, 0.26 + math.sin(frame * 0.08) * 0.06),
            "Ear.L": (-0.03 + lick * 0.05, 0, 0.02),
        }
        groom_poses.append({"frame": frame, "root": (0, 0.065, -0.16), "rotations": sit_rotations(extra)})
    _, track = create_action(armature, "Groom", 240, groom_poses)
    tracks.append(track)

    _, track = create_action(armature, "Jump", 54, [
        {"frame": 1, "rotations": {}},
        {"frame": 10, "root": (0, 0.015, -0.045), "rotations": {"Pelvis": (0.11, 0, 0), "Spine": (0.12, 0, 0), "Hind.L.Upper": (0.50, 0, 0), "Hind.R.Upper": (0.50, 0, 0), "Hind.L.Lower": (-0.42, 0, 0), "Hind.R.Lower": (-0.42, 0, 0), "Front.L.Upper": (-0.18, 0, 0), "Front.R.Upper": (-0.18, 0, 0)}},
        {"frame": 22, "root": (0, -0.02, 0.095), "rotations": {"Spine": (-0.14, 0, 0), "Head": (-0.10, 0, 0), "Front.L.Upper": (-0.68, 0, 0), "Front.R.Upper": (-0.68, 0, 0), "Front.L.Lower": (-0.25, 0, 0), "Front.R.Lower": (-0.25, 0, 0), "Hind.L.Upper": (-0.52, 0, 0), "Hind.R.Upper": (-0.52, 0, 0), "Tail.1": (-0.08, 0, 0)}},
        {"frame": 38, "root": (0, 0, 0.045), "rotations": {"Spine": (0.07, 0, 0), "Front.L.Upper": (0.32, 0, 0), "Front.R.Upper": (0.32, 0, 0), "Hind.L.Upper": (0.22, 0, 0), "Hind.R.Upper": (0.22, 0, 0), "Hind.L.Lower": (-0.34, 0, 0), "Hind.R.Lower": (-0.34, 0, 0), "Tail.1": (0.10, 0, 0)}},
        {"frame": 54, "rotations": {}},
    ])
    tracks.append(track)

    _, track = create_action(armature, "Claw", 42, [
        {"frame": 1, "rotations": {}},
        {"frame": 9, "root": (0, -0.015, 0.02), "rotations": {"Spine": (-0.08, 0, 0.07), "Head": (-0.10, 0, -0.10), "Front.R.Upper": (-0.72, 0, -0.18), "Front.R.Lower": (-0.82, 0, 0), "Tail.1": (0, 0, -0.12)}},
        {"frame": 18, "root": (0, -0.045, 0.035), "rotations": {"Spine": (-0.14, 0, -0.10), "Head": (0.04, 0, 0.14), "Front.R.Upper": (-1.16, 0, 0.25), "Front.R.Lower": (0.34, 0, 0), "Front.R.Paw": (-0.30, 0, 0)}},
        {"frame": 29, "root": (0, -0.02, 0.02), "rotations": {"Spine": (-0.09, 0, 0.08), "Head": (-0.05, 0, -0.08), "Front.L.Upper": (-0.98, 0, -0.18), "Front.L.Lower": (0.22, 0, 0), "Front.L.Paw": (-0.22, 0, 0)}},
        {"frame": 42, "rotations": {}},
    ])
    tracks.append(track)

    _, track = create_action(armature, "Bite", 38, [
        {"frame": 1, "rotations": {}},
        {"frame": 9, "root": (0, -0.035, 0), "rotations": {"Spine": (-0.08, 0, 0), "Neck": (0.17, 0, 0), "Head": (0.20, 0, 0), "Jaw": (-0.10, 0, 0)}},
        {"frame": 18, "root": (0, -0.085, 0.006), "rotations": {"Spine": (-0.15, 0, 0), "Neck": (0.29, 0, 0), "Head": (0.35, 0, 0), "Jaw": (0.31, 0, 0), "Front.L.Upper": (-0.14, 0, 0), "Front.R.Upper": (-0.14, 0, 0)}},
        {"frame": 27, "root": (0, -0.045, 0), "rotations": {"Neck": (0.14, 0, 0), "Head": (0.13, 0, 0), "Jaw": (-0.05, 0, 0)}},
        {"frame": 38, "rotations": {}},
    ])
    tracks.append(track)
    return idle, tracks


def setup_preview(materials):
    ground_material = make_material("PreviewGround", (0.055, 0.066, 0.073, 1), 0.92)
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.015))
    ground = bpy.context.object
    ground.name = "PreviewGround"
    ground.data.materials.append(ground_material)

    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.008, 0.012, 0.02, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.34

    bpy.ops.object.light_add(type="AREA", location=(3.4, -4.4, 5.2))
    key = bpy.context.object
    key.name = "KeyLight"
    key.data.energy = 980
    key.data.size = 3.8
    bpy.ops.object.light_add(type="AREA", location=(-3.0, -1.2, 2.7))
    fill = bpy.context.object
    fill.name = "FillLight"
    fill.data.energy = 520
    fill.data.size = 3.0
    bpy.ops.object.light_add(type="AREA", location=(0.8, 3.2, 3.8))
    rim = bpy.context.object
    rim.name = "RimLight"
    rim.data.energy = 760
    rim.data.size = 2.5

    bpy.ops.object.camera_add(location=(2.8, -4.3, 2.15))
    camera = bpy.context.object
    camera.name = "PreviewCamera"
    camera.data.lens = 68
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 3
    scene.eevee.gtao_factor = 1.35
    scene.eevee.use_soft_shadows = True
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0.35
    return ground, camera, [key, fill, rim]


def point_camera(camera, location, target=(0, -0.04, 0.72)):
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def render_previews(armature, idle_action, camera):
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    for track in armature.animation_data.nla_tracks:
        track.mute = True
    armature.animation_data.action = idle_action
    bpy.context.scene.frame_set(60)

    views = {
        "game-cat.png": ((2.8, -4.3, 2.15), (0, -0.05, 0.74)),
        "game-cat-v2-front.png": ((0, -4.7, 1.55), (0, -0.10, 0.73)),
        "game-cat-v2-side.png": ((4.2, -0.05, 1.65), (0, -0.03, 0.72)),
        "game-cat-v2-rear.png": ((0, 4.3, 1.65), (0, 0.04, 0.73)),
        "game-cat-v2-three-quarter.png": ((2.8, -4.3, 2.15), (0, -0.05, 0.74)),
    }
    for filename, (location, target) in views.items():
        point_camera(camera, location, target)
        bpy.context.scene.render.filepath = os.path.join(PREVIEW_DIR, filename)
        bpy.ops.render.render(write_still=True)

    armature.animation_data.action = None
    for track in armature.animation_data.nla_tracks:
        track.mute = False


def export_model(armature, export_objects, ground, camera, lights):
    os.makedirs(MODEL_DIR, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    select_only([armature] + export_objects, armature)
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_nla_strips=True,
        export_frame_range=True,
        export_frame_step=1,
        export_force_sampling=True,
        export_skins=True,
        export_def_bones=True,
        export_yup=True,
        export_apply=False,
    )


def verify_glb():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)
    actions = sorted(action.name for action in bpy.data.actions)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    triangles = sum(triangle_count(obj) for obj in meshes)
    materials = sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material})
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    print("GLB_VERIFY", {
        "actions": actions,
        "meshes": len(meshes),
        "triangles": triangles,
        "materials": materials,
        "armatures": len(armatures),
        "bytes": os.path.getsize(GLB_PATH),
    })
    required = ("Idle", "Walk", "Groom", "Jump", "Sit", "Claw", "Bite")
    if not all(any(name in action for action in actions) for name in required):
        raise RuntimeError(f"Animated GLB is missing actions: {actions}")
    if triangles < MIN_EXPORTED_TRIANGLES:
        raise RuntimeError(f"Animated GLB is below density target: {triangles}")
    if not armatures:
        raise RuntimeError("Animated GLB has no armature")


def main():
    clean_scene()
    white = make_fur_material("Fur.White", (0.84, 0.81, 0.75, 1), 0.84)
    brown = make_fur_material("Fur.Chestnut", (0.33, 0.095, 0.025, 1), 0.80)
    pink = make_material("Skin.Pink", (0.66, 0.23, 0.22, 1), 0.62)
    eye = make_material("Eye.Amber", (0.35, 0.19, 0.028, 1), 0.22)
    pupil = make_material("Eye.Pupil", (0.003, 0.002, 0.001, 1), 0.16)
    mouth = make_material("Mouth.Dark", (0.055, 0.012, 0.009, 1), 0.76)
    whisker = make_material("Whisker", (0.72, 0.70, 0.66, 1), 0.58)

    body = build_body(white, brown)
    armature = create_armature()
    apply_weight_function(body, armature, body_weights)
    tail = build_tail(brown, armature)
    details = build_face(armature, (white, brown, pink, eye, pupil, mouth, whisker))
    idle_action, tracks = animate(armature)
    ground, camera, lights = setup_preview((white, brown))
    render_previews(armature, idle_action, camera)
    export_model(armature, [body, tail] + details, ground, camera, lights)
    verify_glb()
    print("COMPLETE", {"glb": GLB_PATH, "blend": BLEND_PATH})


if __name__ == "__main__":
    main()
