const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export class RunProgress {
  constructor() { this.reset(); }
  reset() {
    this.collar = null;
    this.charm = null;
    this.claimed = new Set();
    this.defeatedEnemies = new Set();
    this.deaths = 0;
    this.bossDefeated = false;
  }
  equip(item) {
    if (!["collar", "charm"].includes(item.kind) || this.claimed.has(item.id)) return false;
    this.claimed.add(item.id);
    const tier = clamp(Math.round(item.tier || 1), 1, 3);
    if (!this[item.kind] || tier > this[item.kind].tier) this[item.kind] = { id: item.id, tier };
    return true;
  }
  die() {
    const lostCharm = Boolean(this.charm);
    this.charm = null;
    this.deaths += 1;
    return lostCharm;
  }
  get stats() {
    return { speed: 1 + (this.collar?.tier ?? 0) * 0.03, clawDamage: this.charm ? 2 : 1, hungerDrain: 1 - (this.charm?.tier ?? 0) * 0.1 };
  }
  snapshot() {
    return { collar: this.collar, charm: this.charm, stats: this.stats, kills: this.defeatedEnemies.size, deaths: this.deaths, bossDefeated: this.bossDefeated };
  }
}

export const BOSS_DEFINITIONS = Object.freeze({
  vacuum: {
    id: "vacuum", name: "THE GRAND SUCK", maxHealth: 8, maxLives: 9,
    weakPoint: "rear-filter", maxDamagePerHit: 2,
    bodyRadius: 1.35, clawReach: 2.65, suctionRange: 6.4, catchRange: 2.85,
    frontDot: 0.78, rearDot: -0.35, turnRate: 1.05,
    phases: [
      { id: "track", label: "CIRCLING / GET BEHIND", duration: 2.2, tracking: true },
      { id: "warn", label: "INTAKE CHARGING / MOVE ASIDE", duration: 1.15, tracking: false },
      { id: "inhale", label: "SUCTION / STAY OUT OF THE RED CONE", duration: 2.0, attack: "suction" },
      { id: "recover", label: "COOLING / CLAW THE GREEN REAR", duration: 4.2 },
    ],
  },
});

// Attack handlers produce effects; rendering and physics stay outside the rules.
// Another boss can supply different phases, stats, and attack handlers.
export const BOSS_ATTACKS = {
  suction(boss, player, delta) {
    const geometry = boss.geometry(player);
    if (player.y > 1.0 || geometry.dot < boss.definition.frontDot || geometry.distance > boss.definition.suctionRange) {
      boss.exposure = 0;
      return [];
    }
    boss.exposure = geometry.distance < boss.definition.catchRange ? boss.exposure + delta : 0;
    if (boss.exposure >= 0.24) { boss.exposure = 0; return [{ type: "caught" }]; }
    return [{ type: "pull", x: -geometry.dx / geometry.distance, z: -geometry.dz / geometry.distance, speed: 2.1 }];
  },
};

export const BOSS_WEAK_POINTS = {
  "rear-filter": (boss, player, kind) => {
    const geometry = boss.geometry(player);
    if (kind !== "Claw") return "claws-only";
    if (player.y > 0.8 || geometry.distance > boss.definition.clawReach) return "range";
    if (geometry.dot > boss.definition.rearDot) return "armored-front";
    const facing = (-geometry.dx * Math.sin(player.heading) - geometry.dz * Math.cos(player.heading)) / geometry.distance;
    return facing < 0.15 ? "face-target" : null;
  },
};

export class BossEncounter {
  constructor(definition = BOSS_DEFINITIONS.vacuum, attacks = BOSS_ATTACKS, weakPoints = BOSS_WEAK_POINTS) {
    if (!(definition.maxHealth > 0) || !(definition.maxLives > 0) || !weakPoints[definition.weakPoint] || !definition.phases?.length || definition.phases.some((phase) => !(phase.duration > 0) || (phase.attack && !attacks[phase.attack]))) throw new Error("Invalid boss phase/attack/weak-point definition");
    this.definition = definition;
    this.attacks = attacks;
    this.weakPoints = weakPoints;
    this.reset();
  }
  reset() {
    this.x = 0; this.z = -2; this.yaw = 0;
    this.health = this.definition.maxHealth;
    this.lives = this.definition.maxLives;
    this.phaseIndex = 0; this.time = 0; this.exposure = 0; this.hitCooldown = 0;
    this.status = "active";
  }
  get phase() { return this.definition.phases[this.phaseIndex]; }
  geometry(player) {
    const dx = player.x - this.x, dz = player.z - this.z;
    const distance = Math.max(0.0001, Math.hypot(dx, dz));
    return { dx, dz, distance, dot: (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / distance };
  }
  update(delta, player) {
    if (this.status !== "active") return [];
    this.hitCooldown = Math.max(0, this.hitCooldown - delta);
    if (this.phase.tracking) this.yaw += clamp(angleDelta(this.yaw, Math.atan2(player.x - this.x, player.z - this.z)), -this.definition.turnRate * delta, this.definition.turnRate * delta);
    this.time += delta;
    const duration = this.phase.duration * (this.health <= this.definition.maxHealth / 2 && this.phase.tracking ? 0.8 : 1);
    if (this.time >= duration) {
      this.time %= duration;
      this.phaseIndex = (this.phaseIndex + 1) % this.definition.phases.length;
      this.exposure = 0;
    }
    return this.phase.attack ? this.attacks[this.phase.attack](this, player, delta) : [];
  }
  strike(player, kind = "Claw", damage = 1) {
    if (this.status !== "active" || this.hitCooldown > 0) return { hit: false, reason: "cooldown" };
    const reason = this.weakPoints[this.definition.weakPoint](this, player, kind);
    if (reason) return { hit: false, reason };
    this.health = Math.max(0, this.health - clamp(damage, 1, this.definition.maxDamagePerHit ?? 2));
    this.hitCooldown = 0.72;
    if (!this.health) this.status = "defeated";
    return { hit: true, defeated: this.status === "defeated" };
  }
  loseLife() {
    if (this.status !== "active") return false;
    this.lives = Math.max(0, this.lives - 1);
    this.exposure = 0;
    this.phaseIndex = 0; this.time = 0;
    if (!this.lives) this.status = "retry";
    return true;
  }
  snapshot() {
    return { id: this.definition.id, name: this.definition.name, x: this.x, z: this.z, yaw: this.yaw, health: this.health, maxHealth: this.definition.maxHealth, lives: this.lives, maxLives: this.definition.maxLives, phase: this.phase.id, phaseTime: this.time, phaseLabel: this.phase.label, status: this.status };
  }
}
