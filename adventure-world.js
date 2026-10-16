import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BossEncounter } from "./adventure-rules.js";

const gold = 0xe7b961;
const mint = 0x99e0b0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function mesh(parent, geometry, color, position, options = {}) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35, ...options });
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  parent.add(object);
  return object;
}

function rounded(parent, size, color, position, radius = 0.12, options) {
  return mesh(parent, new RoundedBoxGeometry(...size, 3, radius), color, position, options);
}

function collectible(parent, kind, x, z) {
  const group = new THREE.Group();
  group.name = `${kind}Reward`;
  group.userData.ownsMaterials = true;
  group.position.set(x, 0.45, z);
  const color = kind === "collar" ? 0x73c4d1 : kind === "charm" ? gold : 0xe29264;
  const halo = mesh(group, new THREE.TorusGeometry(0.38, 0.018, 8, 48), color, [0, -0.32, 0], { emissive: color, emissiveIntensity: 0.65 });
  halo.rotation.x = -Math.PI / 2;
  if (kind === "collar") {
    mesh(group, new THREE.TorusGeometry(0.22, 0.065, 12, 48), color, [0, 0, 0]);
    mesh(group, new THREE.SphereGeometry(0.075, 20, 12), gold, [0, -0.24, 0.02]);
  } else if (kind === "charm") {
    mesh(group, new THREE.OctahedronGeometry(0.22, 1), gold, [0, 0, 0], { emissive: 0x624115, emissiveIntensity: 0.4 });
    mesh(group, new THREE.TorusGeometry(0.06, 0.016, 8, 20), gold, [0, 0.26, 0]);
  } else {
    const fish = mesh(group, new THREE.SphereGeometry(0.23, 24, 14), color, [0, 0, 0]);
    fish.scale.set(1.5, 0.65, 0.7);
    mesh(group, new THREE.ConeGeometry(0.17, 0.23, 3), color, [-0.36, 0, 0]).rotation.z = -Math.PI / 2;
  }
  parent.add(group);
  return group;
}

function clockworkMouse(parent, x, z, tier) {
  const group = new THREE.Group();
  group.name = "ClockworkMouse";
  group.position.set(x, 0, z);
  group.userData.ownsMaterials = true;
  const body = mesh(group, new THREE.SphereGeometry(0.38, 28, 18), tier > 1 ? 0xa66b4b : 0x84938d, [0, 0.28, 0]);
  body.scale.set(0.8, 0.7, 1.3);
  for (const x of [-0.22, 0.22]) {
    const ear = mesh(group, new THREE.SphereGeometry(0.15, 18, 12), gold, [x, 0.49, 0.25]);
    ear.scale.z = 0.4;
    mesh(group, new THREE.SphereGeometry(0.045, 12, 8), 0xe69e59, [x * 0.66, 0.33, 0.45], { emissive: 0xff723f, emissiveIntensity: 0.8 });
  }
  mesh(group, new THREE.SphereGeometry(0.06, 14, 8), 0x242727, [0, 0.25, 0.53]);
  const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.2, -0.4), new THREE.Vector3(0.2, 0.15, -0.7), new THREE.Vector3(0.4, 0.2, -0.85)]);
  mesh(group, new THREE.TubeGeometry(tailCurve, 20, 0.025, 8, false), gold, [0, 0, 0]);
  const key = mesh(group, new THREE.TorusGeometry(0.14, 0.028, 8, 20), gold, [0, 0.6, -0.14]);
  const warning = mesh(group, new THREE.TorusGeometry(0.72, 0.024, 8, 48), 0xe9a45c, [0, 0.04, 0], { emissive: 0xd45b32, emissiveIntensity: 0.8 });
  warning.rotation.x = -Math.PI / 2;
  warning.visible = false;
  parent.add(group);
  return { group, key, warning, body };
}

function sector(radius, inner, center, half) {
  const positions = [];
  const point = (r, a) => [Math.sin(a) * r, 0.035, Math.cos(a) * r];
  for (let i = 0; i < 48; i++) {
    const a = center - half + i / 48 * half * 2, b = center - half + (i + 1) / 48 * half * 2;
    positions.push(...point(inner, a), ...point(radius, a), ...point(radius, b), ...point(inner, a), ...point(radius, b), ...point(inner, b));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: mint, transparent: true, opacity: 0.20, depthWrite: false, side: THREE.DoubleSide }));
}

function vacuum(parent) {
  const group = new THREE.Group();
  group.name = "GrandSuckVacuumBoss";
  group.userData.ownsMaterials = true;
  rounded(group, [3.05, 0.44, 2.2], 0x323b3d, [0, 0.36, 0.25], 0.18);
  const body = mesh(group, new THREE.CylinderGeometry(0.82, 1.05, 1.8, 64), 0x954a38, [0, 1.36, -0.1]);
  const cap = mesh(group, new THREE.SphereGeometry(0.83, 48, 24), 0xb16c4b, [0, 2.24, -0.1]);
  cap.scale.y = 0.42;
  for (const x of [-1.2, 1.2]) {
    const wheel = mesh(group, new THREE.CylinderGeometry(0.55, 0.55, 0.25, 48), 0x252c2e, [x, 0.55, -0.3]);
    wheel.rotation.z = Math.PI / 2;
    mesh(group, new THREE.SphereGeometry(0.15, 20, 12), gold, [x * 1.13, 0.55, -0.3]);
  }
  rounded(group, [2.4, 0.48, 0.55], 0x4d5b5b, [0, 0.38, 1.45], 0.12);
  rounded(group, [2.12, 0.23, 0.08], 0x101b1c, [0, 0.4, 1.76], 0.025);
  for (let x = -0.92; x < 1; x += 0.23) rounded(group, [0.045, 0.24, 0.1], 0xa3b0aa, [x, 0.4, 1.82], 0.012);
  const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(0.65, 1.8, 0), new THREE.Vector3(1.2, 2.1, 0.5), new THREE.Vector3(1.4, 1.1, 1.1), new THREE.Vector3(0.7, 0.6, 1.4)]);
  mesh(group, new THREE.TubeGeometry(hose, 48, 0.17, 16, false), 0x3b4445, [0, 0, 0]);
  const handleCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.8, -0.55), new THREE.Vector3(0, 3.1, -1.05), new THREE.Vector3(0, 3.25, -0.8)]);
  mesh(group, new THREE.TubeGeometry(handleCurve, 24, 0.095, 12, false), 0x949f98, [0, 0, 0]);
  rounded(group, [0.8, 0.19, 0.24], 0x263332, [0, 3.23, -0.8], 0.08);
  const core = rounded(group, [0.83, 0.75, 0.16], mint, [0, 1.24, -1.04], 0.1, { emissive: 0x438961, emissiveIntensity: 1.2 });
  for (let y = 1; y < 1.6; y += 0.15) rounded(group, [0.62, 0.04, 0.03], 0x325746, [0, y, -1.14], 0.01);
  const lamp = mesh(group, new THREE.SphereGeometry(0.10, 24, 12), gold, [0, 2.57, -0.1], { emissive: 0xffa83c, emissiveIntensity: 2 });
  const front = sector(6.4, 1.8, 0, Math.acos(0.78));
  const rear = sector(2.65, 1.55, Math.PI, Math.acos(0.35));
  const suctionGeometry = new THREE.BufferGeometry();
  suctionGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(48 * 3), 3));
  const suction = new THREE.Points(suctionGeometry, new THREE.PointsMaterial({ color: 0xf3d8a7, size: 0.05, transparent: true, opacity: 0.75, depthWrite: false }));
  group.add(suction);
  group.add(front, rear);
  parent.add(group);
  return { group, body, core, lamp, front, rear, suction };
}

export class AdventureWorld {
  constructor({ root, progress, onToast, onFood, onDeath, onVictory, onRetry }) {
    Object.assign(this, { root, progress, onToast, onFood, onDeath, onVictory, onRetry });
    this.clear();
  }
  clear() { this.items = []; this.enemies = []; this.reservations = []; this.boss = null; this.bossView = null; }
  addItem(id, kind, tier, x, z) {
    if (this.progress.claimed.has(id)) return;
    this.items.push({ id, kind, tier, x, z, group: collectible(this.root, kind, x, z), active: true });
  }
  buildRoom(level, boxes) {
    const clear = (x, z, radius) => !boxes.some((box) => box.maxY > 0.1 && box.minY < 1 && x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius);
    const find = (x, z, radius) => {
      for (let ring = 0; ring < 7; ring++) for (let i = 0; i < 16; i++) {
        const px = x + Math.cos(i * Math.PI / 8) * ring * 0.65, pz = z + Math.sin(i * Math.PI / 8) * ring * 0.65;
        if (Math.abs(px) < 19 && Math.abs(pz) < 17 && clear(px, pz, radius)) return [px, pz];
      }
      return null;
    };
    for (const [kind, x, z] of [["collar", -2.4, 13.1], ["charm", 2.4, 11.7]]) {
      const position = find(x, z, 0.9);
      if (!position) throw new Error(`No reachable ${kind} placement`);
      this.addItem(`room-${level}-${kind}`, kind, level + 1, ...position);
    }
    const anchors = [[-16, 11], [16, -5], [-16, -13]];
    for (let index = 0; index <= level; index++) {
      const id = `room-${level}-mouse-${index}`;
      if (this.progress.defeatedEnemies.has(id)) continue;
      const position = find(...anchors[index], 2.3);
      if (!position) continue;
      const [x, z] = position;
      const view = clockworkMouse(this.root, x, z, level + 1);
      this.enemies.push({ id, ...view, x, z, health: level === 2 ? 2 : 1, state: "patrol", time: 0, tier: level + 1, loot: (level + index) % 2 ? "charm" : "food", active: true, hitTime: 0 });
      this.reservations.push({ minX: x - 2.5, maxX: x + 2.5, minZ: z - 2.5, maxZ: z + 2.5, minY: 0, maxY: 2 });
    }
  }
  buildBoss() {
    this.boss = new BossEncounter();
    this.bossView = vacuum(this.root);
    this.syncBoss(0);
  }
  blocks(x, z, y) { return Boolean(this.boss && this.boss.status !== "defeated" && y < 2.5 && Math.hypot(x - this.boss.x, z - this.boss.z) < 1.65); }
  attack(player, kind) {
    if (this.boss) {
      const result = this.boss.strike(player, kind, this.progress.stats.clawDamage);
      if (result.hit) {
        this.onToast(result.defeated ? "Motor stopped. The house is yours!" : "Rear filter clawed! Keep circling.", 1.5);
        if (result.defeated) { this.progress.bossDefeated = true; this.onVictory(); }
      } else if (result.reason !== "cooldown" && distance(player, this.boss) < 3.2) this.onToast(kind !== "Claw" ? "Metal casing: use Claw on the green rear filter." : "Armored front! Circle behind the green filter.", 1.5);
      return result.hit;
    }
    const target = this.enemies.filter((enemy) => enemy.active && Math.abs(player.y) < 0.8 && distance(player, enemy.group.position) < 1.45)
      .sort((a, b) => distance(player, a.group.position) - distance(player, b.group.position))[0];
    if (!target) return false;
    const dx = target.group.position.x - player.x, dz = target.group.position.z - player.z;
    if ((dx * Math.sin(player.heading) + dz * Math.cos(player.heading)) / Math.max(0.001, Math.hypot(dx, dz)) < 0.1) return false;
    target.health -= kind === "Claw" ? this.progress.stats.clawDamage : 1;
    target.hitTime = 0.3;
    if (target.health <= 0) {
      target.active = false;
      target.group.visible = false;
      this.progress.defeatedEnemies.add(target.id);
      this.addItem(`${target.id}-loot`, target.loot, target.tier, target.group.position.x, target.group.position.z);
      this.onToast(`Clockwork mouse defeated. ${target.loot === "food" ? "Fish snack" : "Pendant"} dropped!`, 2.5);
    }
    return true;
  }
  update(delta, elapsed, player, active) {
    for (const item of this.items) {
      if (!item.active) continue;
      item.group.position.y = 0.48 + Math.sin(elapsed * 2.5 + item.x) * 0.09;
      item.group.rotation.y += delta * 0.7;
      if (!active || Math.abs(player.y) > 0.65 || distance(player, item) > 0.8) continue;
      item.active = false; item.group.visible = false;
      if (item.kind === "food") { this.progress.claimed.add(item.id); this.onFood(); }
      else {
        this.progress.equip(item);
        this.onToast(item.kind === "collar" ? `Collar ${item.tier}: +${item.tier * 3}% pace. Kept through deaths.` : `Pendant ${item.tier}: stronger claws, slower hunger. Lost on death.`, 3.5);
      }
    }
    if (!active) { this.syncBoss(elapsed); return; }
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.time += delta;
      enemy.hitTime = Math.max(0, enemy.hitTime - delta);
      enemy.body.material.emissive.setHex(enemy.hitTime ? 0x9b4b23 : 0x000000);
      enemy.key.rotation.z += delta * 3;
      const near = distance(player, enemy.group.position);
      if (enemy.state === "patrol") {
        enemy.group.position.x = enemy.x + Math.sin(elapsed * 0.6 + enemy.x) * 0.55;
        enemy.group.position.z = enemy.z + Math.cos(elapsed * 0.6 + enemy.z) * 0.55;
        if (near < 2.0 && player.y < 0.7 && !player.invulnerable) { enemy.state = "warn"; enemy.time = 0; enemy.target = { x: player.x, z: player.z }; }
      } else if (enemy.state === "warn" && enemy.time >= 0.9) { enemy.state = "lunge"; enemy.time = 0; }
      else if (enemy.state === "lunge") {
        const direction = new THREE.Vector3(enemy.target.x - enemy.group.position.x, 0, enemy.target.z - enemy.group.position.z);
        if (direction.length() > 0.08) enemy.group.position.addScaledVector(direction.normalize(), delta * 2.2);
        enemy.group.position.x = THREE.MathUtils.clamp(enemy.group.position.x, enemy.x - 1.2, enemy.x + 1.2);
        enemy.group.position.z = THREE.MathUtils.clamp(enemy.group.position.z, enemy.z - 1.2, enemy.z + 1.2);
        if (near < 0.52 && player.y < 0.6 && !player.invulnerable) { enemy.state = "rest"; enemy.time = 0; this.onDeath("A clockwork mouse pounced"); }
        if (enemy.time > 0.7) { enemy.state = "rest"; enemy.time = 0; }
      } else if (enemy.state === "rest" && enemy.time > 2.5) { enemy.state = "patrol"; enemy.time = 0; }
      enemy.warning.visible = enemy.state === "warn";
      enemy.group.rotation.y = Math.atan2(player.x - enemy.group.position.x, player.z - enemy.group.position.z);
    }
    if (this.boss) {
      const events = this.boss.update(delta, player);
      if (player.invulnerable) this.boss.exposure = 0;
      for (const event of events) {
        if (player.invulnerable) continue;
        if (event.type === "caught") this.onDeath("The vacuum sucked you in");
        if (event.type === "pull") player.pull(event.x * event.speed * delta, event.z * event.speed * delta);
      }
    }
    this.syncBoss(elapsed);
  }
  syncBoss(elapsed) {
    if (!this.bossView) return;
    const view = this.bossView, boss = this.boss;
    view.group.position.set(boss.x, 0, boss.z);
    view.group.rotation.y = boss.yaw;
    view.front.visible = ["warn", "inhale"].includes(boss.phase.id) && boss.status === "active";
    view.front.material.color.setHex(boss.phase.id === "inhale" ? 0xe35e3c : 0xf0bd6b);
    view.front.material.opacity = 0.16 + Math.sin(elapsed * 10) * 0.035;
    view.rear.visible = boss.status === "active";
    view.core.material.emissiveIntensity = boss.hitCooldown ? 3.5 : 1.1 + Math.sin(elapsed * 4) * 0.35;
    view.lamp.material.emissiveIntensity = boss.status === "defeated" ? 0 : 1.5 + Math.sin(elapsed * 8) * 0.8;
    view.body.rotation.z = boss.phase.id === "inhale" ? Math.sin(elapsed * 45) * 0.012 : 0;
    view.suction.visible = boss.phase.id === "inhale" && boss.status === "active";
    if (view.suction.visible) {
      const positions = view.suction.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const amount = (elapsed * 0.7 + i / positions.count) % 1;
        const z = 6.2 - amount * 4.4;
        positions.setXYZ(i, Math.sin(i * 2.4 + elapsed * 5) * z * 0.24, 0.35 + (1 - amount) * 0.55 + Math.cos(i) * 0.08, z);
      }
      positions.needsUpdate = true;
    }
  }
  snapshot() {
    return { ...this.progress.snapshot(), boss: this.boss?.snapshot() ?? null, items: this.items.map(({ id, kind, tier, x, z, active }) => ({ id, kind, tier, x, z, active })), enemies: this.enemies.map((enemy) => ({ id: enemy.id, x: enemy.group.position.x, z: enemy.group.position.z, health: enemy.health, active: enemy.active, state: enemy.state, loot: enemy.loot })) };
  }
}
