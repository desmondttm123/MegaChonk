import bpy
import math
import os
from mathutils import Matrix, Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_DIR = os.path.join(ROOT, "assets", "models")
PREVIEW_DIR = os.path.join(MODEL_DIR, "game-cat-previews")
SOURCE_PATH = os.path.join(MODEL_DIR, "source", "jonas-dichelle-cat", "cat.fbx")
GLB_PATH = os.path.join(MODEL_DIR, "turkish-van-game-cat.glb")
BLEND_PATH = os.path.join(MODEL_DIR, "turkish-van-game-cat.blend")
SCALE = 0.13
MIN_TRIANGLES = 175_000


BONE_SPECS = [
    ("Root", (0, 0.02, 0.035), (0, 0.02, 0.16), None, False),
    ("Pelvis", (0, 0.320, 0.500), (0, 0.125, 0.530), "Root", True),
    ("Spine", (0, 0.125, 0.530), (0, -0.065, 0.545), "Pelvis", True),
    ("Chest", (0, -0.065, 0.545), (0, -0.245, 0.565), "Spine", True),
    ("Neck", (0, -0.245, 0.565), (0, -0.405, 0.700), "Chest", True),
    ("Head", (0, -0.405, 0.700), (0, -0.535, 0.785), "Neck", True),
    ("Jaw", (0, -0.515, 0.690), (0, -0.615, 0.665), "Head", True),
    ("Tongue", (0, -0.615, 0.690), (0, -0.650, 0.685), "Jaw", True),
    ("Eyelid.L", (-0.060, -0.553, 0.762), (-0.060, -0.553, 0.792), "Head", True),
    ("Eyelid.R", (0.060, -0.553, 0.762), (0.060, -0.553, 0.792), "Head", True),
    ("Ear.L", (-0.085, -0.445, 0.795), (-0.115, -0.455, 0.970), "Head", True),
    ("Ear.R", (0.085, -0.445, 0.795), (0.115, -0.455, 0.970), "Head", True),
    ("Scapula.L", (-0.090, -0.080, 0.555), (-0.090, -0.175, 0.490), "Chest", True),
    ("Scapula.R", (0.090, -0.080, 0.555), (0.090, -0.175, 0.490), "Chest", True),
    ("Front.L.Upper", (-0.090, -0.175, 0.490), (-0.090, -0.160, 0.345), "Scapula.L", True),
    ("Front.L.Lower", (-0.090, -0.160, 0.345), (-0.090, -0.205, 0.075), "Front.L.Upper", True),
    ("Front.L.Paw", (-0.090, -0.205, 0.075), (-0.093, -0.280, 0.025), "Front.L.Lower", True),
    ("Front.R.Upper", (0.090, -0.175, 0.490), (0.090, -0.160, 0.345), "Scapula.R", True),
    ("Front.R.Lower", (0.090, -0.160, 0.345), (0.090, -0.205, 0.075), "Front.R.Upper", True),
    ("Front.R.Paw", (0.090, -0.205, 0.075), (0.093, -0.280, 0.025), "Front.R.Lower", True),
    ("Hind.L.Upper", (-0.120, 0.340, 0.490), (-0.115, 0.445, 0.250), "Pelvis", True),
    ("Hind.L.Lower", (-0.115, 0.445, 0.250), (-0.100, 0.365, 0.080), "Hind.L.Upper", True),
    ("Hind.L.Paw", (-0.100, 0.365, 0.080), (-0.103, 0.260, 0.025), "Hind.L.Lower", True),
    ("Hind.R.Upper", (0.120, 0.340, 0.490), (0.115, 0.445, 0.250), "Pelvis", True),
    ("Hind.R.Lower", (0.115, 0.445, 0.250), (0.100, 0.365, 0.080), "Hind.R.Upper", True),
    ("Hind.R.Paw", (0.100, 0.365, 0.080), (0.103, 0.260, 0.025), "Hind.R.Lower", True),
    ("Tail.1", (0, 0.450, 0.560), (0, 0.505, 0.670), "Pelvis", True),
    ("Tail.2", (0, 0.505, 0.670), (0, 0.530, 0.780), "Tail.1", True),
    ("Tail.3", (0, 0.530, 0.780), (0, 0.540, 0.890), "Tail.2", True),
    ("Tail.4", (0, 0.540, 0.890), (0, 0.545, 1.000), "Tail.3", True),
    ("Tail.5", (0, 0.545, 1.000), (0, 0.545, 1.110), "Tail.4", True),
    ("Tail.6", (0, 0.545, 1.110), (0, 0.520, 1.205), "Tail.5", True),
]


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.armatures, bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.actions):
        for item in list(block):
            block.remove(item)


def select_only(objects, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or objects[0]


def smoothstep(edge0, edge1, value):
    if edge0 == edge1:
        return 0.0
    amount = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return amount * amount * (3.0 - 2.0 * amount)


def triangle_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def make_material(name, color, roughness=0.72, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    return material


def make_fur_material():
    material = make_material("TurkishVan.Fur", (1, 1, 1, 1), 0.84)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    color = nodes.new("ShaderNodeVertexColor")
    color.name = "Turkish Van Coat"
    color.layer_name = "VanCoat"
    links.new(color.outputs["Color"], principled.inputs["Base Color"])

    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 165
    noise.inputs["Detail"].default_value = 2.5
    noise.inputs["Roughness"].default_value = 0.72
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.11
    bump.inputs["Distance"].default_value = 0.0014
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], principled.inputs["Normal"])
    return material


def coat_color(point):
    white = Vector((0.76, 0.73, 0.68))
    chestnut = Vector((0.205, 0.050, 0.012))

    tail_core = smoothstep(0.34, 0.42, point.y) * smoothstep(0.56, 0.66, point.z)
    tail_base = (
        smoothstep(0.33, 0.40, point.y)
        * smoothstep(0.45, 0.57, point.z)
        * (1.0 - smoothstep(0.045, 0.12, abs(point.x)))
    )
    tail = max(tail_core, tail_base)
    ear_height = smoothstep(0.80, 0.87, point.z)
    ear_side = smoothstep(0.035, 0.085, abs(point.x))
    ear_front = 1.0 - smoothstep(-0.39, -0.30, point.y)
    ears = ear_height * ear_side * ear_front

    crown_height = smoothstep(0.75, 0.81, point.z) * (1.0 - smoothstep(0.93, 0.99, point.z))
    crown_depth = (1.0 - smoothstep(-0.39, -0.29, point.y)) * smoothstep(-0.62, -0.52, point.y)
    white_blaze = 1.0 - smoothstep(0.018, 0.065, abs(point.x))
    crown = crown_height * crown_depth * (1.0 - white_blaze * 0.94)

    right_radius = ((point.y - 0.10) / 0.17) ** 2 + ((point.z - 0.455) / 0.085) ** 2
    right_patch = smoothstep(0.09, 0.145, point.x) * (1.0 - smoothstep(0.72, 1.24, right_radius))
    left_radius = ((point.y + 0.13) / 0.13) ** 2 + ((point.z - 0.47) / 0.07) ** 2
    left_patch = smoothstep(0.085, 0.14, -point.x) * (1.0 - smoothstep(0.70, 1.20, left_radius)) * 0.72
    brown = max(tail, ears, crown, right_patch, left_patch)
    edge_noise = math.sin(point.x * 181 + point.y * 97 + point.z * 131) * 0.035
    brown = max(0.0, min(1.0, brown + edge_noise * brown * (1.0 - brown)))
    color = white.lerp(chestnut, brown)
    fur_variation = 0.993 + 0.007 * math.sin(point.x * 311 + point.y * 157 + point.z * 229)
    return (*[max(0.0, min(1.0, component * fur_variation)) for component in color], 1.0)


def apply_coat_colors(body):
    for name in [attribute.name for attribute in body.data.color_attributes]:
        body.data.color_attributes.remove(body.data.color_attributes[name])
    # Blender 3.4's glTF exporter indexes CORNER colors by vertex index. POINT
    # colors avoid that exporter bug and remain attached to the skinned surface.
    colors = body.data.color_attributes.new(name="VanCoat", type="FLOAT_COLOR", domain="POINT")
    for vertex in body.data.vertices:
        colors.data[vertex.index].color = coat_color(vertex.co)
    body.data.color_attributes.active_color = colors
    body.data.color_attributes.render_color_index = body.data.color_attributes.find("VanCoat")


def import_body(fur_material):
    bpy.ops.import_scene.fbx(filepath=SOURCE_PATH, automatic_bone_orientation=False)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected one continuous source mesh, found {len(meshes)}")
    body = meshes[0]
    body.name = "MegaChonk.TurkishVan.Body"
    for obj in list(bpy.context.scene.objects):
        if obj != body:
            bpy.data.objects.remove(obj, do_unlink=True)

    select_only([body], body)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    minimum_z = min(vertex.co.z for vertex in body.data.vertices)
    for vertex in body.data.vertices:
        vertex.co = Vector((vertex.co.x * SCALE, vertex.co.y * SCALE, (vertex.co.z - minimum_z) * SCALE))
    refine_anatomy(body)
    body.data.update()
    body.data.materials.clear()
    body.data.materials.append(fur_material)
    for polygon in body.data.polygons:
        polygon.use_smooth = True
    return body


def refine_anatomy(body):
    for vertex in body.data.vertices:
        point = vertex.co
        # Sculpt the existing continuous surface rather than layering fake limbs.
        if -0.34 < point.y < -0.08 and point.z < 0.47:
            mask = smoothstep(-0.34, -0.27, point.y) * (1 - smoothstep(-0.14, -0.08, point.y))
            mask *= smoothstep(0.025, 0.055, abs(point.x))
            upper = math.exp(-((point.z - 0.32) / 0.115) ** 2)
            wrist = math.exp(-((point.z - 0.115) / 0.045) ** 2)
            paw = 1 - smoothstep(0.045, 0.085, point.z)
            center_x = math.copysign(0.09, point.x)
            point.x = center_x + (point.x - center_x) * (1 + mask * (-0.12 * upper + 0.10 * wrist + 0.14 * paw))
            point.y = -0.19 + (point.y + 0.19) * (1 - mask * 0.10 * upper)
        if point.y < -0.48:
            face_mask = 1 - smoothstep(-0.55, -0.48, point.y)
            for sign in (-1, 1):
                socket = math.exp(-((point.x - sign * 0.060) / 0.030) ** 4 - ((point.z - 0.762) / 0.021) ** 4)
                point.y += 0.008 * socket * face_mask
            cheek = math.exp(-((abs(point.x) - 0.055) / 0.045) ** 2 - ((point.z - 0.710) / 0.029) ** 2)
            point.x += math.copysign(0.006 * cheek * face_mask, point.x)
            point.y -= 0.005 * cheek * face_mask
    body.data.update()


def create_armature():
    data = bpy.data.armatures.new("MegaChonk.AnatomicalRig")
    armature = bpy.data.objects.new("MegaChonk.AnatomicalRig", data)
    bpy.context.collection.objects.link(armature)
    armature.show_in_front = True
    data.display_type = "OCTAHEDRAL"
    select_only([armature], armature)
    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones = {}
    for name, head, tail, parent_name, deform in BONE_SPECS:
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.use_deform = deform
        bone.roll = 0
        if parent_name:
            bone.parent = edit_bones[parent_name]
        edit_bones[name] = bone
    bpy.ops.object.mode_set(mode="POSE")
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    return armature


def skin_body(body, armature):
    select_only([body, armature], armature)
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    if len(body.vertex_groups) < 20:
        raise RuntimeError(f"Automatic skinning produced only {len(body.vertex_groups)} vertex groups")

    for vertex in body.data.vertices:
        removed = 0
        memberships = [(membership.group, membership.weight) for membership in vertex.groups]
        for group_index, original_weight in memberships:
            group = body.vertex_groups[group_index]
            if not group.name.startswith("Hind."):
                continue
            if group.name.endswith("Upper"):
                factor = 1.0 - smoothstep(0.28, 0.46, vertex.co.z)
            elif group.name.endswith("Lower"):
                factor = 1.0 - smoothstep(0.23, 0.36, vertex.co.z)
            else:
                factor = 1.0 - smoothstep(0.08, 0.16, vertex.co.z)
            weight = original_weight * factor
            removed += original_weight - weight
            group.add([vertex.index], weight, "REPLACE")
        if removed > 0:
            torso_name = "Chest" if vertex.co.y < -0.08 else "Pelvis" if vertex.co.y > 0.18 else "Spine"
            body.vertex_groups[torso_name].add([vertex.index], removed, "ADD")

    # Localized anatomical weights keep the elbow flexible without pulling the
    # chest down with the paw. Heat weights remain on the torso and hindquarters.
    for vertex in body.data.vertices:
        x, y, z = vertex.co
        if not (-0.35 < y < 0.04 and z < 0.49):
            continue
        back_limit = -0.02 - 0.08 * smoothstep(0.31, 0.46, z)
        mask = smoothstep(-0.35, -0.27, y) * (1 - smoothstep(back_limit - 0.07, back_limit + 0.03, y))
        mask *= smoothstep(0.014, 0.045, abs(x)) * (1 - smoothstep(0.35, 0.49, z))
        if mask < 0.001:
            continue
        side = "L" if x < 0 else "R"
        paw = 1 - smoothstep(0.065, 0.125, z)
        upper = smoothstep(0.295, 0.390, z)
        scapula = smoothstep(0.34, 0.47, z) * 0.35
        desired = {
            f"Front.{side}.Paw": paw,
            f"Front.{side}.Lower": (1 - paw) * (1 - upper),
            f"Front.{side}.Upper": (1 - paw) * upper * (1 - scapula),
            f"Scapula.{side}": (1 - paw) * upper * scapula,
        }
        for group_index, weight in [(item.group, item.weight) for item in vertex.groups]:
            body.vertex_groups[group_index].add([vertex.index], weight * (1 - mask), "REPLACE")
        for name, weight in desired.items():
            body.vertex_groups[name].add([vertex.index], weight * mask, "ADD")

    neighbors = [[] for _ in body.data.vertices]
    for edge in body.data.edges:
        a, b = edge.vertices
        neighbors[a].append(b)
        neighbors[b].append(a)
    weights = [{item.group: item.weight for item in vertex.groups if item.weight > 0.00001} for vertex in body.data.vertices]
    region = [vertex.index for vertex in body.data.vertices if -0.38 < vertex.co.y < 0.08 and vertex.co.z < 0.58]
    for _ in range(5):
        previous = weights
        weights = list(previous)
        for index in region:
            if not neighbors[index]:
                continue
            average = {}
            for adjacent in neighbors[index]:
                for group, weight in previous[adjacent].items():
                    average[group] = average.get(group, 0) + weight / len(neighbors[index])
            weights[index] = {group: previous[index].get(group, 0) * 0.65 + average.get(group, 0) * 0.35 for group in previous[index].keys() | average.keys()}
    for index in region:
        for group, weight in weights[index].items():
            body.vertex_groups[group].add([index], weight, "REPLACE")

    subdivision = body.modifiers.new("Production Surface", "SUBSURF")
    subdivision.subdivision_type = "CATMULL_CLARK"
    subdivision.levels = 1
    subdivision.render_levels = 1
    select_only([body], body)
    while body.modifiers[0] != subdivision:
        bpy.ops.object.modifier_move_up(modifier=subdivision.name)
    bpy.ops.object.modifier_apply(modifier=subdivision.name)
    # Match glTF's four-influence skinning in Blender inspection renders too.
    for vertex in body.data.vertices:
        weights = sorted(((group.group, group.weight) for group in vertex.groups if group.weight > 0.0001), key=lambda entry: entry[1], reverse=True)[:4]
        total = sum(weight for _, weight in weights)
        kept = {index for index, _ in weights}
        for group_index in [group.group for group in vertex.groups]:
            if group_index not in kept:
                body.vertex_groups[group_index].remove([vertex.index])
        if total > 0:
            for index, weight in weights:
                body.vertex_groups[index].add([vertex.index], weight / total, "REPLACE")
    apply_coat_colors(body)
    print("SKINNED_BODY", {"vertices": len(body.data.vertices), "triangles": triangle_count(body), "groups": len(body.vertex_groups)})


def rigid_skin_to_bone(obj, armature, bone_name):
    select_only([obj], obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    group = obj.vertex_groups.new(name=bone_name)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    modifier = obj.modifiers.new("Anatomical Rig", "ARMATURE")
    modifier.object = armature
    obj.parent = armature


def add_uv_detail(name, location, scale, material, armature, bone="Head", segments=40, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    rigid_skin_to_bone(obj, armature, bone)
    return obj


def add_triangle_detail(name, vertices, material, armature, bone="Head"):
    mesh = bpy.data.meshes.new(f"{name}.Mesh")
    mesh.from_pydata(vertices, [], [(0, 1, 2)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    solidify = obj.modifiers.new("Soft surface", "SOLIDIFY")
    solidify.thickness = 0.003
    bevel = obj.modifiers.new("Soft edge", "BEVEL")
    bevel.width = 0.002
    bevel.segments = 2
    rigid_skin_to_bone(obj, armature, bone)
    return obj


def add_curve_detail(name, points, material, armature, bone="Head", radius=0.0007):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for index, (control, coordinate) in enumerate(zip(spline.bezier_points, points)):
        control.co = coordinate
        control.handle_left_type = "AUTO"
        control.handle_right_type = "AUTO"
        if name.startswith("Whisker."):
            control.radius = 1.0 - 0.94 * index / max(1, len(points) - 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    select_only([obj], obj)
    bpy.ops.object.convert(target="MESH")
    rigid_skin_to_bone(obj, armature, bone)
    return obj


def build_almond_eye(side, sign, armature, material):
    vertices, faces, colors = [], [], []
    columns, rows = 65, 25
    for column in range(columns):
        u = -1 + 2 * column / (columns - 1)
        half_height = 0.0155 * max(0.0001, 1 - u * u) ** 0.68
        for row in range(rows):
            v = -1 + 2 * row / (rows - 1)
            vertices.append((sign * (0.060 + u * 0.029), -0.560 + u * 0.020 - 0.009 * (1 - u * u) * (1 - v * v), 0.762 + u * 0.003 + v * half_height))
            radial = math.sqrt((u * 1.05) ** 2 + (v * 0.80) ** 2)
            streak = 0.5 + 0.5 * math.sin(math.atan2(v, u) * 71 + radial * 19)
            iris = Vector((0.24, 0.115, 0.024)).lerp(Vector((0.48, 0.31, 0.085)), streak * 0.55)
            iris *= 0.62 + 0.38 * (1 - smoothstep(0.65, 1.0, radial))
            pupil_mask = 1 - smoothstep(0.92, 1.08, (u / 0.115) ** 2 + (v / 0.89) ** 2)
            iris = iris.lerp(Vector((0.0015, 0.002, 0.001)), pupil_mask)
            colors.append((*iris, 1))
            if column and row:
                index = column * rows + row
                face = (index, index - rows, index - rows - 1, index - 1)
                faces.append(face if sign > 0 else tuple(reversed(face)))
    mesh = bpy.data.meshes.new(f"Eye.{side}.Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(f"Eye.{side}", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    attribute = mesh.color_attributes.new(name="Iris", type="FLOAT_COLOR", domain="POINT")
    for index, color in enumerate(colors):
        attribute.data[index].color = color
    mesh.color_attributes.active_color = attribute
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    rigid_skin_to_bone(obj, armature, f"Eyelid.{side}")
    return obj


def build_face(armature, materials):
    amber, pupil, pink, mouth, whisker, soft_fur = materials
    details = []
    for side, sign in (("L", -1), ("R", 1)):
        details.append(build_almond_eye(side, sign, armature, amber))
        details.append(add_uv_detail(f"EyeHighlight.{side}", (sign * 0.054, -0.573, 0.768), (0.0015, 0.0009, 0.0015), whisker, armature, f"Eyelid.{side}", segments=20, rings=12))
        for upper in (False, True):
            points = []
            for step in range(13):
                u = -1 + step / 6
                height = 0.0155 * max(0, 1 - u * u) ** 0.68
                points.append((sign * (0.060 + u * 0.029), -0.561 + u * 0.020, 0.762 + u * 0.003 + height * (1 if upper else -1)))
            details.append(add_curve_detail(f"Eyelid{'Upper' if upper else 'Lower'}.{side}", points, mouth, armature, f"Eyelid.{side}", 0.0011 if upper else 0.00065))

    nose = add_uv_detail("Nose", (0, -0.634, 0.716), (0.017, 0.005, 0.009), pink, armature)
    for vertex in nose.data.vertices:
        vertex.co.x *= 0.40 + 0.60 * smoothstep(0.707, 0.721, vertex.co.z)
    details.append(nose)
    details.append(add_curve_detail("Philtrum", [(0, -0.638, 0.709), (0, -0.635, 0.699), (0, -0.629, 0.694)], mouth, armature, radius=0.0007))
    for sign in (-1, 1):
        details.append(add_curve_detail(f"MuzzleLine.{sign}", [(0, -0.629, 0.694), (sign * 0.016, -0.626, 0.688), (sign * 0.038, -0.611, 0.693)], mouth, armature, radius=0.00065))
    details.append(add_uv_detail("Tongue", (0, -0.645, 0.689), (0.008, 0.019, 0.003), pink, armature, "Tongue", segments=24, rings=16))

    for side, sign in (("L", -1), ("R", 1)):
        for index, z_offset in enumerate((-0.013, -0.006, 0.002, 0.010, 0.017)):
            start = Vector((0.040 * sign, -0.619, 0.700 + z_offset))
            middle = Vector((0.115 * sign, -0.632, 0.696 + z_offset * 1.3))
            end = Vector(((0.192 + index * 0.004) * sign, -0.562 + index * 0.009, 0.705 + z_offset * 1.9))
            details.append(add_curve_detail(f"Whisker.{side}.{index + 1}", [start, middle, end], whisker, armature, "Head", 0.00045))
    return details


def aim_bone(bone, head, tail):
    rest_direction = bone.bone.tail_local - bone.bone.head_local
    rotation = rest_direction.rotation_difference(tail - head).to_matrix().to_4x4()
    orientation = bone.bone.matrix_local.to_3x3().to_4x4()
    bone.matrix = Matrix.Translation(head) @ rotation @ orientation
    bpy.context.view_layer.update()


def solve_leg(armature, leg, target, paw_pitch=0):
    upper = armature.pose.bones[f"{leg}.Upper"]
    lower = armature.pose.bones[f"{leg}.Lower"]
    paw = armature.pose.bones[f"{leg}.Paw"]
    head = upper.head.copy()
    offset = target - head
    length_a = upper.bone.length
    length_b = lower.bone.length
    distance = max(abs(length_a - length_b) + 0.001, min(offset.length, length_a + length_b - 0.001))
    direction = offset.normalized()
    along = (length_a * length_a - length_b * length_b + distance * distance) / (2 * distance)
    altitude = math.sqrt(max(0, length_a * length_a - along * along))
    pole = Vector((0, 1, 0))
    perpendicular = pole - direction * pole.dot(direction)
    if perpendicular.length < 0.001:
        perpendicular = Vector((0, 0, 1))
    perpendicular.normalize()
    knee = head + direction * along + perpendicular * altitude
    ankle = head + direction * distance
    aim_bone(upper, head, knee)
    aim_bone(lower, knee, ankle)
    paw.matrix = Matrix.Translation(ankle) @ Matrix.Rotation(paw_pitch, 4, "X") @ paw.bone.matrix_local.to_3x3().to_4x4()
    bpy.context.view_layer.update()


def resting_feet():
    return {
        "Front.L": (-0.090, -0.205, 0.075),
        "Front.R": (0.090, -0.205, 0.075),
        "Hind.L": (-0.100, 0.365, 0.080),
        "Hind.R": (0.100, 0.365, 0.080),
    }


def key_pose(armature, frame, rotations=None, locations=None, scales=None, root=(0, 0, 0), feet=None):
    tail_rest = {
        "Tail.1": (0.14, 0, 0.055),
        "Tail.2": (-0.17, 0, 0.065),
        "Tail.3": (0.13, 0, -0.045),
        "Tail.4": (-0.09, 0, -0.035),
        "Tail.5": (0.05, 0, 0.025),
        "Tail.6": (-0.025, 0, 0.015),
    }
    tail_rest.update(rotations or {})
    tail_base = tail_rest["Tail.1"]
    tail_rest["Tail.1"] = (tail_base[0] - 0.85, tail_base[1], tail_base[2])
    rotations = tail_rest
    locations = locations or {}
    scales = {"Tongue": (0.001, 0.001, 0.001), **(scales or {})}
    for bone in armature.pose.bones:
        bone.rotation_euler = rotations.get(bone.name, (0, 0, 0))
        bone.location = locations.get(bone.name, (0, 0, 0))
        bone.scale = scales.get(bone.name, (1, 1, 1))
        if bone.name == "Root":
            bone.location = bone.bone.matrix_local.to_3x3().inverted() @ Vector(root)
    bpy.context.view_layer.update()
    if feet:
        for leg, target in feet.items():
            solve_leg(armature, leg, Vector(target), rotations.get(f"{leg}.Paw", (0, 0, 0))[0])
    for bone in armature.pose.bones:
        bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)
        bone.keyframe_insert(data_path="location", frame=frame, group=bone.name)
        bone.keyframe_insert(data_path="scale", frame=frame, group=bone.name)


def create_action(armature, name, frame_end, poses, interpolation="BEZIER"):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action
    if any("feet" in pose for pose in poses):
        sampled = []
        segment = 0
        for frame in range(1, frame_end + 1):
            while segment + 1 < len(poses) - 1 and frame > poses[segment + 1]["frame"]:
                segment += 1
            start = poses[segment]
            end = poses[min(segment + 1, len(poses) - 1)]
            span = max(1, end["frame"] - start["frame"])
            amount = smoothstep(0, 1, (frame - start["frame"]) / span) if span > 1 else (frame - start["frame"]) / span
            pose = {"frame": frame, "root": tuple(Vector(start.get("root", (0, 0, 0))).lerp(Vector(end.get("root", (0, 0, 0))), amount))}
            for field in ("rotations", "locations", "scales", "feet"):
                left = start.get(field, {})
                right = end.get(field, {})
                values = {}
                for key in left.keys() | right.keys():
                    default = (1, 1, 1) if field == "scales" else (0, 0, 0)
                    if key == "Tongue" and field == "scales":
                        default = (0.001, 0.001, 0.001)
                    if field == "feet":
                        default = resting_feet()[key]
                    values[key] = tuple(Vector(left.get(key, default)).lerp(Vector(right.get(key, default)), amount))
                pose[field] = values
            sampled.append(pose)
        poses = sampled
        interpolation = "LINEAR"
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


def sitting_pose(extra=None):
    rotations = {
        "Pelvis": (-0.58, 0, 0),
        "Spine": (0.04, 0, 0),
        "Chest": (0.10, 0, 0),
        "Neck": (0.30, 0, 0),
        "Tail.1": (0.15, 0.08, 0.22),
        "Tail.2": (-0.18, 0.06, 0.18),
        "Tail.3": (0.14, 0.03, 0.12),
    }
    if extra:
        rotations.update(extra)
    return rotations


def animate(armature):
    actions = {}
    tracks = []

    idle_poses = [
        {"frame": 1, "rotations": {"Tail.1": (0.14, 0, -0.10), "Tail.2": (-0.17, 0, 0.06), "Tail.3": (0.13, 0, 0.05)}},
        {"frame": 30, "root": (0, 0, 0.004), "rotations": {"Chest": (-0.010, 0, 0), "Head": (0.008, 0.012, -0.015), "Tail.1": (0.15, 0, -0.02)}, "scales": {"Chest": (1.008, 1.008, 1.014)}},
        {"frame": 60, "rotations": {"Head": (-0.015, 0.025, 0.035), "Neck": (0, 0, 0.018), "Tail.1": (0.16, 0, 0.10), "Tail.2": (-0.18, 0, 0.08)}},
        {"frame": 88, "root": (0, 0, 0.005), "rotations": {"Head": (-0.010, -0.015, 0.065), "Ear.L": (0.045, 0, -0.09), "Tail.1": (0.16, 0, 0.16)}, "scales": {"Chest": (1.01, 1.01, 1.016)}},
        {"frame": 108, "rotations": {"Head": (0.004, 0, 0.025), "Ear.L": (-0.10, 0.03, 0.10), "Ear.R": (0.035, 0, -0.035), "Tail.2": (0, 0, -0.02)}},
        {"frame": 114, "scales": {"Eyelid.L": (1, 0.07, 1), "Eyelid.R": (1, 0.07, 1)}, "rotations": {"Head": (0.005, 0, 0.018)}},
        {"frame": 120, "scales": {"Eyelid.L": (1, 1, 1), "Eyelid.R": (1, 1, 1)}, "rotations": {"Head": (0.006, 0, 0.012)}},
        {"frame": 122, "rotations": {"Head": (0.007, 0, 0.010), "Ear.L": (0.015, 0, -0.015), "Tail.1": (0.15, 0, 0.03)}},
        {"frame": 156, "root": (0, 0, 0.004), "rotations": {"Pelvis": (0, 0, -0.012), "Spine": (0.008, 0, 0.014), "Head": (-0.014, 0.02, -0.050), "Tail.1": (0.15, 0, -0.11)}, "scales": {"Chest": (1.009, 1.009, 1.015)}},
        {"frame": 194, "rotations": {"Head": (0.004, -0.018, -0.022), "Ear.R": (-0.065, -0.02, -0.075), "Tail.1": (0.14, 0, -0.17), "Tail.2": (-0.17, 0, -0.10)}},
        {"frame": 218, "rotations": {"Head": (0.005, 0, -0.010), "Tail.1": (0.14, 0, -0.10)}},
        {"frame": 240, "rotations": {"Tail.1": (0.14, 0, -0.10), "Tail.2": (-0.17, 0, 0.06), "Tail.3": (0.13, 0, 0.05)}},
    ]
    for pose in idle_poses:
        pose["feet"] = resting_feet()
    actions["Idle"], track = create_action(armature, "Idle", 240, idle_poses)
    tracks.append(track)

    walk_poses = []
    leg_offsets = {
        "Front.L": 0.0,
        "Hind.R": math.pi * 0.5,
        "Front.R": math.pi,
        "Hind.L": math.pi * 1.5,
    }
    for frame in range(1, 50):
        phase = (frame - 1) / 48 * math.tau
        rotations = {
            "Pelvis": (math.sin(phase * 2) * 0.022, math.sin(phase) * 0.012, math.sin(phase) * 0.034),
            "Spine": (-0.012 + math.cos(phase * 2) * 0.024, 0, -math.sin(phase) * 0.022),
            "Chest": (0.010 - math.cos(phase * 2) * 0.015, 0, math.sin(phase) * 0.016),
            "Scapula.L": (math.sin(phase) * 0.045, 0, math.sin(phase) * 0.018),
            "Scapula.R": (-math.sin(phase) * 0.045, 0, math.sin(phase) * 0.018),
            "Neck": (-0.014, 0, -math.sin(phase) * 0.014),
            "Head": (-0.018 + abs(math.sin(phase * 2)) * 0.018, 0, math.sin(phase) * 0.018),
            "Tail.1": (0.15, math.sin(phase) * 0.02, -math.sin(phase) * 0.11),
            "Tail.2": (-0.18, 0, -math.sin(phase - 0.4) * 0.095),
            "Tail.3": (0.14, 0, -math.sin(phase - 0.8) * 0.075),
            "Tail.4": (-0.09, 0, -math.sin(phase - 1.1) * 0.045),
        }
        feet = resting_feet()
        for leg, offset in leg_offsets.items():
            cycle = ((phase + offset) / math.tau) % 1.0
            stride = 0.22 if leg.startswith("Front") else 0.30
            if cycle < 0.62:
                travel = cycle / 0.62
                forward = -stride * 0.5 + stride * travel
                lift = 0
            else:
                travel = (cycle - 0.62) / 0.38
                forward = stride * 0.5 * math.cos(travel * math.pi)
                lift = math.sin(travel * math.pi) * (0.040 if leg.startswith("Front") else 0.065)
                rotations[f"{leg}.Paw"] = (math.sin(travel * math.pi * 2) * 0.12, 0, 0)
            x, y, z = feet[leg]
            feet[leg] = (x, y + forward, z + lift)
        walk_poses.append({
            "frame": frame,
            "root": (0, 0, -0.010 + math.sin(phase * 2) * 0.004),
            "rotations": rotations,
            "feet": feet,
        })
    walk_poses.append({**walk_poses[0], "frame": 49})
    actions["Walk"], track = create_action(armature, "Walk", 49, walk_poses)
    tracks.append(track)

    actions["Sit"], track = create_action(armature, "Sit", 78, [
        {"frame": 1, "rotations": {}, "feet": resting_feet()},
        {"frame": 18, "root": (0, 0.012, -0.10), "rotations": {"Pelvis": (-0.20, 0, 0), "Chest": (0.04, 0, 0)}, "feet": resting_feet()},
        {"frame": 46, "root": (0, 0.018, -0.245), "rotations": sitting_pose(), "feet": resting_feet()},
        {"frame": 78, "root": (0, 0.018, -0.245), "rotations": sitting_pose({"Head": (-0.018, 0.015, 0.02), "Tail.3": (0.14, 0, 0.16)}), "feet": resting_feet()},
    ])
    tracks.append(track)

    groom_poses = []
    for frame, lick in ((1, 0), (26, 0.30), (50, 1), (72, 0.22), (94, 1), (116, 0.22), (138, 1), (162, 0.22), (188, 0.82), (218, 0.18), (240, 0)):
        extra = {
            "Head": (0.37 + lick * 0.18, -0.05 + lick * 0.07, 0.07 - lick * 0.10),
            "Neck": (0.34 + lick * 0.08, 0, 0.025),
            "Jaw": (0.10 + lick * 0.11, 0, 0),
            "Tail.1": (0.08, 0.08, 0.24 + math.sin(frame * 0.075) * 0.06),
            "Ear.L": (-0.025 + lick * 0.05, 0, 0.02),
            "Front.L.Paw": (-0.85, 0, 0),
        }
        feet = resting_feet()
        feet["Front.L"] = (-0.055, -0.42 + lick * 0.008, 0.640 + lick * 0.008)
        groom_poses.append({
            "frame": frame, "root": (0, 0.018, -0.245),
            "rotations": sitting_pose(extra), "feet": feet,
            "scales": {"Tongue": (lick, lick, lick), "Eyelid.L": (1, 0.72, 1), "Eyelid.R": (1, 0.72, 1)},
        })
    actions["Groom"], track = create_action(armature, "Groom", 240, groom_poses)
    tracks.append(track)

    actions["Jump"], track = create_action(armature, "Jump", 56, [
        {"frame": 1, "rotations": {}},
        {"frame": 10, "root": (0, 0.014, -0.035), "rotations": {"Pelvis": (0.10, 0, 0), "Spine": (0.10, 0, 0), "Hind.L.Upper": (0.42, 0, 0), "Hind.R.Upper": (0.42, 0, 0), "Hind.L.Lower": (-0.38, 0, 0), "Hind.R.Lower": (-0.38, 0, 0), "Front.L.Upper": (-0.15, 0, 0), "Front.R.Upper": (-0.15, 0, 0)}},
        {"frame": 23, "root": (0, -0.025, 0.075), "rotations": {"Spine": (-0.13, 0, 0), "Head": (-0.08, 0, 0), "Front.L.Upper": (-0.58, 0, 0), "Front.R.Upper": (-0.58, 0, 0), "Front.L.Lower": (-0.22, 0, 0), "Front.R.Lower": (-0.22, 0, 0), "Hind.L.Upper": (-0.48, 0, 0), "Hind.R.Upper": (-0.48, 0, 0), "Tail.1": (-0.08, 0, 0)}},
        {"frame": 40, "root": (0, 0, 0.035), "rotations": {"Spine": (0.06, 0, 0), "Front.L.Upper": (0.28, 0, 0), "Front.R.Upper": (0.28, 0, 0), "Hind.L.Upper": (0.20, 0, 0), "Hind.R.Upper": (0.20, 0, 0), "Hind.L.Lower": (-0.30, 0, 0), "Hind.R.Lower": (-0.30, 0, 0), "Tail.1": (0.10, 0, 0)}},
        {"frame": 56, "rotations": {}},
    ])
    tracks.append(track)

    actions["Claw"], track = create_action(armature, "Claw", 44, [
        {"frame": 1, "rotations": {}},
        {"frame": 10, "root": (0, -0.012, 0.014), "rotations": {"Spine": (-0.07, 0, 0.065), "Head": (-0.08, 0, -0.10), "Front.R.Upper": (-0.62, 0, -0.16), "Front.R.Lower": (-0.70, 0, 0), "Tail.1": (0, 0, -0.12)}},
        {"frame": 20, "root": (0, -0.038, 0.025), "rotations": {"Spine": (-0.12, 0, -0.09), "Head": (0.035, 0, 0.13), "Front.R.Upper": (-1.0, 0, 0.22), "Front.R.Lower": (0.30, 0, 0), "Front.R.Paw": (-0.26, 0, 0)}},
        {"frame": 31, "root": (0, -0.018, 0.015), "rotations": {"Spine": (-0.08, 0, 0.07), "Head": (-0.04, 0, -0.08), "Front.L.Upper": (-0.86, 0, -0.16), "Front.L.Lower": (0.20, 0, 0), "Front.L.Paw": (-0.20, 0, 0)}},
        {"frame": 44, "rotations": {}},
    ])
    tracks.append(track)

    actions["Bite"], track = create_action(armature, "Bite", 40, [
        {"frame": 1, "rotations": {}},
        {"frame": 10, "root": (0, -0.030, 0), "rotations": {"Spine": (-0.07, 0, 0), "Neck": (0.14, 0, 0), "Head": (0.16, 0, 0), "Jaw": (-0.08, 0, 0)}},
        {"frame": 20, "root": (0, -0.070, 0.004), "rotations": {"Spine": (-0.13, 0, 0), "Neck": (0.25, 0, 0), "Head": (0.30, 0, 0), "Jaw": (0.27, 0, 0), "Front.L.Upper": (-0.11, 0, 0), "Front.R.Upper": (-0.11, 0, 0)}},
        {"frame": 30, "root": (0, -0.035, 0), "rotations": {"Neck": (0.12, 0, 0), "Head": (0.10, 0, 0), "Jaw": (-0.04, 0, 0)}},
        {"frame": 40, "rotations": {}},
    ])
    tracks.append(track)

    for track in tracks:
        track.mute = True
    return actions, tracks


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_preview():
    ground_material = make_material("Preview.Ground", (0.07, 0.078, 0.08, 1), 0.94)
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.005))
    ground = bpy.context.object
    ground.name = "Preview.Ground"
    ground.data.materials.append(ground_material)

    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.025, 0.032, 0.038, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.38

    lights = []
    for name, location, energy, size, color in (
        ("Key", (-2.5, -3.2, 3.4), 900, 2.7, (1.0, 0.78, 0.60)),
        ("Fill", (2.6, -0.4, 2.0), 620, 2.4, (0.57, 0.73, 1.0)),
        ("Rim", (0.6, 2.8, 3.0), 780, 2.0, (1.0, 0.94, 0.82)),
    ):
        data = bpy.data.lights.new(f"Preview.{name}", "AREA")
        data.energy = energy
        data.size = size
        data.color = color
        light = bpy.data.objects.new(data.name, data)
        light.location = location
        bpy.context.collection.objects.link(light)
        look_at(light, (0, -0.04, 0.48))
        lights.append(light)

    camera_data = bpy.data.cameras.new("Preview.Camera")
    camera = bpy.data.objects.new("Preview.Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera_data.lens = 68
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.fps = 60
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 0.22
    scene.eevee.gtao_factor = 1.0
    scene.eevee.use_soft_shadows = True
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0.12
    return ground, camera, lights


def render_previews(armature, actions, camera):
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    views = [
        ("game-cat.png", "Idle", 88, (1.75, -2.55, 1.28), (0, -0.04, 0.53)),
        ("game-cat-realistic-front.png", "Idle", 88, (0, -2.65, 0.88), (0, -0.10, 0.52)),
        ("game-cat-realistic-side.png", "Idle", 156, (2.45, -0.02, 0.92), (0, -0.02, 0.50)),
        ("game-cat-realistic-rear.png", "Idle", 194, (0, 2.50, 0.94), (0, 0.04, 0.51)),
        ("game-cat-realistic-walk.png", "Walk", 13, (1.75, -2.55, 1.28), (0, -0.04, 0.52)),
        ("game-cat-realistic-groom.png", "Groom", 116, (1.75, -2.55, 1.28), (0, -0.04, 0.45)),
        ("game-cat-realistic-jump.png", "Jump", 23, (1.75, -2.55, 1.28), (0, -0.04, 0.55)),
        ("game-cat-realistic-sit.png", "Sit", 60, (1.75, -2.55, 1.28), (0, -0.04, 0.45)),
        ("game-cat-face-detail.png", "Idle", 60, (0.38, -1.20, 0.86), (0, -0.49, 0.765)),
        ("game-cat-front-legs-detail.png", "Walk", 13, (0.85, -1.20, 0.48), (0, -0.17, 0.29)),
    ]
    for filename, action_name, frame, camera_location, target in views:
        armature.animation_data.action = actions[action_name]
        bpy.context.scene.frame_set(frame)
        camera.location = camera_location
        look_at(camera, target)
        bpy.context.scene.render.filepath = os.path.join(PREVIEW_DIR, filename)
        bpy.ops.render.render(write_still=True)
    armature.animation_data.action = None
    bpy.context.scene.frame_set(1)


def export_model(armature, export_objects, tracks):
    for track in tracks:
        track.mute = False
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
    for track in tracks:
        track.mute = True
    armature.animation_data.action = bpy.data.actions.get("Idle")
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)


def verify_glb():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    actions = sorted(action.name for action in bpy.data.actions)
    triangles = sum(triangle_count(obj) for obj in meshes)
    skinned = [obj for obj in meshes if any(modifier.type == "ARMATURE" for modifier in obj.modifiers)]
    result = {
        "actions": actions,
        "armatures": len(armatures),
        "meshes": len(meshes),
        "skinned_meshes": len(skinned),
        "triangles": triangles,
        "bytes": os.path.getsize(GLB_PATH),
    }
    print("GLB_VERIFY", result)
    required = ("Idle", "Walk", "Groom", "Jump", "Sit", "Claw", "Bite")
    if not all(any(name in action for action in actions) for name in required):
        raise RuntimeError(f"Animated GLB is missing clips: {actions}")
    if not armatures or not skinned:
        raise RuntimeError("Animated GLB has no skinned armature")
    if triangles < MIN_TRIANGLES:
        raise RuntimeError(f"Animated GLB is below density target: {triangles}")


def main():
    clean_scene()
    fur = make_fur_material()
    amber = make_material("Eye.Hazel", (1, 1, 1, 1), 0.19)
    iris = amber.node_tree.nodes.new("ShaderNodeVertexColor")
    iris.layer_name = "Iris"
    amber.node_tree.links.new(iris.outputs["Color"], amber.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
    pupil = make_material("Eye.Pupil", (0.002, 0.0015, 0.001, 1), 0.12)
    pink = make_material("Skin.Pink", (0.57, 0.18, 0.16, 1), 0.58)
    mouth = make_material("Mouth.Dark", (0.035, 0.008, 0.006, 1), 0.76)
    whisker = make_material("Whisker", (0.62, 0.60, 0.56, 1), 0.52)
    soft_fur = make_material("Face.SoftFur", (0.76, 0.73, 0.68, 1), 0.88)

    body = import_body(fur)
    armature = create_armature()
    skin_body(body, armature)
    details = build_face(armature, (amber, pupil, pink, mouth, whisker, soft_fur))
    print("BAKING_ANIMATIONS", flush=True)
    for obj in [body] + details:
        obj.hide_viewport = True
    try:
        actions, tracks = animate(armature)
    finally:
        for obj in [body] + details:
            obj.hide_viewport = False
    print("RENDERING_PREVIEWS", flush=True)
    _, camera, _ = setup_preview()
    render_previews(armature, actions, camera)
    export_model(armature, [body] + details, tracks)
    verify_glb()
    print("COMPLETE", {"blend": BLEND_PATH, "glb": GLB_PATH})


if __name__ == "__main__":
    main()
