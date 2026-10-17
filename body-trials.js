import * as THREE from "three";
import { CONDITION, workOut } from "./condition-rules.js";

export class BodyTrials {
  constructor({ box, sign, food, materials, toast }) {
    Object.assign(this, { box, sign, food, materials, toast });
    this.clear();
  }
  clear() { this.nooks = []; this.plate = null; this.post = null; }
  build() {
    const { wood, woodLight, upholsteryGold, trim, checkpoint } = this.materials;
    const box = (name, x, y, z, w, h, d, mat, solid = true) => this.box(name, new THREE.Vector3(x, y, z), new THREE.Vector3(w, h, d), mat, { collider: solid, radius: 0.035 });
    for (const [kind, x] of [["slim", -11], ["heavy", 11]]) {
      box("BonusCabinetBack", x, 1.1, 5.4, 3.2, 2.2, 0.18, wood);
      for (const side of [-1, 1]) {
        box("BonusCabinetSide", x + side * 1.6, 1.1, 7, 0.18, 2.2, 3.4, wood);
        box("BonusCabinetFront", x + side * 1.0, 1.1, 8.6, 1.2, 2.2, 0.18, woodLight);
      }
      box("BonusCabinetRoof", x, 2.23, 7, 3.4, 0.16, 3.5, wood);
      const door = box(kind === "slim" ? "SlimFilter" : "WeightGate", x, 1.1, 8.6, 0.8, 2.2, 0.18, kind === "slim" ? trim : upholsteryGold);
      const trial = { kind, x, door, latched: false, hold: 0, open: false };
      this.nooks.push(trial);
      this.food(x, 6.6, kind === "slim" ? "SLIM STASH" : "HEAVY STASH", 0, { required: false, nutrition: "bonus", xp: 0 });
      this.sign(kind === "slim" ? "SLIM STASH / CHONK 60 OR LESS" : "HEAVY STASH / PLATE NEEDS 64", x, 2.9, 8.4);
      if (kind === "heavy") {
        this.plate = box("HeavyPressurePlate", x, 0.045, 10.3, 1.8, 0.09, 1.4, checkpoint, false);
        this.food(8.8, 11.8, "CREAM BITES", 0, { required: false, xp: 0, regrow: CONDITION.richFoodRegrow });
        this.food(12.6, 11.8, "SALMON PUFFS", 0, { required: false, xp: 0, regrow: CONDITION.richFoodRegrow });
        this.sign(`RICH FOOD / +9 CHONK / REFILLS ${CONDITION.richFoodRegrow}S`, 10.7, 1.25, 12.7);
      }
    }
    this.post = box("WorkoutScratchPost", 4.3, 0.65, 14.3, 0.45, 1.3, 0.45, woodLight);
    box("ScratchPostBase", 4.3, 0.06, 14.3, 1.05, 0.12, 0.85, upholsteryGold, false);
    this.sign("CLAW POST / TRIM 4 CHONK", 4.3, 1.9, 14.3);
    this.food(-1.5, 15, "LEAN SUPPER", 0, { required: false, nutrition: "lean", xp: 0, regrow: 32 });
    this.sign("LEAN SUPPER / ENERGY, NO FAT", -1.5, 1.2, 15);
  }
  update(delta, position, grounded, chonk) {
    for (const trial of this.nooks) {
      const inside = Math.abs(position.x - trial.x) < 1.5 && position.z < 8.65 && position.z > 5.3;
      if (trial.kind === "heavy" && !trial.latched) {
        const onPlate = grounded && position.y < 0.12 && Math.abs(position.x - trial.x) < 0.8 && Math.abs(position.z - 10.3) < 0.6;
        trial.hold = onPlate && chonk >= CONDITION.plateWeight ? trial.hold + delta : 0;
        if (trial.hold >= 0.6) { trial.latched = true; this.toast("Weight plate latched! The heavy stash stays open this room.", 3.5); }
      }
      // Always allow an occupant out, even if eating the reward changes its size.
      trial.open = inside || (trial.kind === "slim" ? chonk <= CONDITION.slimLimit : trial.latched);
      trial.door.userData.collider.enabled = !trial.open;
      trial.door.position.y = THREE.MathUtils.damp(trial.door.position.y, trial.open ? 3.4 : 1.1, 8, delta);
    }
  }
  prompt(position, chonk) {
    if (this.post && position.distanceTo(this.post.position) < 1.65) return "CLAW SCRATCH POST / -4 CHONK, -1.5 ENERGY";
    for (const trial of this.nooks) {
      if (Math.hypot(position.x - trial.x, position.z - (trial.kind === "heavy" ? 10.3 : 9.2)) < 2)
        return trial.kind === "slim" ? `SLIM FILTER / ${Math.round(chonk)} CHONK / MAX 60` : trial.latched ? "WEIGHT GATE OPEN / BONUS INSIDE" : `HOLD PLATE / ${Math.round(chonk)} CHONK / NEED 64`;
    }
    return "";
  }
  attack(player, kind, condition) {
    if (kind !== "Claw" || !this.post || player.y > 0.25) return false;
    const dx = this.post.position.x - player.x, dz = this.post.position.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 1.55 || (Math.sin(player.heading) * dx + Math.cos(player.heading) * dz) / Math.max(0.01, distance) < 0.4) return false;
    const next = workOut(condition);
    if (next) { Object.assign(condition, next); this.toast("Scratch workout / -4 chonk. Lean supper restores energy without fat.", 2.6); }
    else this.toast(condition.satiety <= 16 ? "Too tired to work out. Try lean supper first." : "Already lean enough. Save your energy.", 2.6);
    return true;
  }
  get protectedAreas() {
    return [
      { minX: -13.2, maxX: -8.8, minZ: 4.8, maxZ: 11 },
      { minX: 8.5, maxX: 14, minZ: 4.8, maxZ: 13 },
      { minX: 2.8, maxX: 5.8, minZ: 12.8, maxZ: 15.8 },
      { minX: -2.6, maxX: -0.4, minZ: 13.8, maxZ: 16.2 },
    ];
  }
  snapshot() {
    return {
      nooks: this.nooks.map(({ kind, x, open, latched, hold }) => ({ kind, entry: [x, 0, 9.3], reward: [x, 0, 6.6], plate: kind === "heavy" ? [x, 0, 10.3] : null, open, latched, hold })),
      workout: this.post ? [4.3, 0, 14.3] : null,
    };
  }
}
