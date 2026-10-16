import * as THREE from "three";

// A torso-only blend shape leaves the existing head, paws, rig and coat intact.
// It is generated from the canonical rig rather than replacing the artist asset.
export function installChonkMorph(model) {
  const targets = [];
  model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh || !/TurkishVan.*Body/.test(mesh.name)) return;
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    const joints = geometry.attributes.skinIndex;
    const weights = geometry.attributes.skinWeight;
    if (!joints || !weights || geometry.morphAttributes.position?.length) return;
    const torso = new Set(mesh.skeleton.bones.map((bone, index) => /^(Spine|Chest|Pelvis)$/.test(bone.name) ? index : -1));
    const shaped = geometry.clone();
    const delta = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      let influence = 0;
      for (let component = 0; component < 4; component++) {
        if (torso.has(joints.getComponent(i, component))) influence += weights.getComponent(i, component);
      }
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const belly = influence * THREE.MathUtils.smoothstep(y, 0.28, 0.48)
        * THREE.MathUtils.smoothstep(z, -0.40, -0.20)
        * (1 - THREE.MathUtils.smoothstep(z, 0.18, 0.43));
      delta[i * 3] = x * 0.85 * belly;
      delta[i * 3 + 1] = (y - 0.69) * 0.30 * belly;
      delta[i * 3 + 2] = z * 0.12 * belly;
      shaped.attributes.position.setXYZ(i, x + delta[i * 3], y + delta[i * 3 + 1], z + delta[i * 3 + 2]);
    }
    shaped.computeVertexNormals();
    const normalDelta = new Float32Array(position.count * 3);
    for (let i = 0; i < normalDelta.length; i++) normalDelta[i] = shaped.attributes.normal.array[i] - geometry.attributes.normal.array[i];
    geometry.morphTargetsRelative = true;
    geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(delta, 3)];
    geometry.morphAttributes.normal = [new THREE.Float32BufferAttribute(normalDelta, 3)];
    mesh.updateMorphTargets();
    shaped.dispose();
    targets.push(mesh);
  });
  let value = 0;
  return {
    targets,
    update(chonk, delta) {
      value = THREE.MathUtils.damp(value, THREE.MathUtils.clamp((chonk - 40) / 60, 0, 1), 5, delta);
      for (const mesh of targets) mesh.morphTargetInfluences[0] = value;
    },
    snapshot: () => ({ meshes: targets.length, influence: value }),
  };
}
