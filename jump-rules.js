export const JUMP_PHYSICS = Object.freeze({ gravity: 15.8, walk: 3.15, trot: 4.95, airPace: 1.12, catnipSpeed: 1.32, catnipLeap: 1.18 });

const smoothstep = (value, low, high) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

export function speedMultiplier(satiety, chonk) {
  return (0.30 + 0.82 * Math.exp(-Math.pow((satiety - 58) / 33, 2)))
    * (1 - smoothstep(chonk, 55, 100) * 0.52);
}

export function getJumpProfile(satiety, chonk, boosted = false) {
  if (satiety <= 8) return { allowed: false, impulse: 0, label: "TOO HUNGRY TO LEAP" };
  if (chonk >= 90) return { allowed: false, impulse: 0, label: "TOO CHONKY TO LEAP" };
  const fed = smoothstep(satiety, 8, 48);
  const heavy = 1 - smoothstep(chonk, 55, 90) * 0.66;
  const full = 1 - smoothstep(satiety, 84, 100) * 0.22;
  const impulse = (4.15 + 2.95 * fed * heavy * full) * (boosted ? JUMP_PHYSICS.catnipLeap : 1);
  return { allowed: true, impulse, label: boosted ? "CATNIP LEAP READY" : impulse > 5.75 ? "LEAP READY" : impulse > 4.75 ? "SHORT LEAP" : "WEAK LEAP" };
}

// Plan below peak height and theoretical range to allow for acceleration, discrete
// integration, the collision capsule, and imperfect player takeoff timing.
export function assessJump({ rise = 0, gap = 0, satiety = 38, chonk = 75, boosted = false } = {}) {
  const profile = getJumpProfile(satiety, chonk, boosted);
  const gravity = JUMP_PHYSICS.gravity;
  const peak = profile.impulse ** 2 / (2 * gravity);
  const discriminant = profile.impulse ** 2 - 2 * gravity * (rise + 0.12);
  const airTime = discriminant > 0 ? (profile.impulse + Math.sqrt(discriminant)) / gravity : 0;
  const speed = JUMP_PHYSICS.trot * JUMP_PHYSICS.airPace * speedMultiplier(satiety, chonk) * (boosted ? JUMP_PHYSICS.catnipSpeed : 1);
  const safeRange = airTime * speed * 0.76;
  return { allowed: profile.allowed && rise + 0.12 < peak && gap + 0.48 < safeRange, rise, gap, peak, safeRange, runup: 1.8, landing: 1.4 };
}
