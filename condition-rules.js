const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const CONDITION = Object.freeze({ slimLimit: 60, plateWeight: 64, lives: 9, starvationGrace: 6 });
export const NUTRITION = Object.freeze({
  meal: Object.freeze({ energy: 8, weight: 0.8, points: 0, ceiling: 80 }),
  snack: Object.freeze({ energy: 10, weight: 9, points: 25, ceiling: 100 }),
  bonus: Object.freeze({ energy: 6, weight: 3, points: 60, ceiling: 100 }),
  lean: Object.freeze({ energy: 14, weight: 0, points: 0, ceiling: 80 }),
  catnip: Object.freeze({ energy: 2, weight: 0, points: 0, ceiling: 100 }),
});

// Apply nutrition proportionally, including fat, so interrupting meals is safe
// without allowing unlimited energy from repeated partial bites.
export function nourish(condition, kind, fraction = 1) {
  const recipe = NUTRITION[kind];
  if (!recipe) throw new Error(`Unknown nutrition: ${kind}`);
  const portion = clamp(fraction, 0, 1);
  return {
    satiety: condition.satiety + Math.min(recipe.energy * portion, Math.max(0, recipe.ceiling - condition.satiety)),
    chonk: clamp(condition.chonk + recipe.weight * portion, 0, 100),
  };
}

export function metabolize(condition, delta, speed = 0, trotting = false, efficiency = 1) {
  const moving = speed > 0.06;
  return {
    satiety: clamp(condition.satiety - delta * (0.025 + (moving ? trotting ? 0.42 : 0.30 : 0)) * efficiency, 0, 100),
    chonk: clamp(condition.chonk - (moving ? delta * (0.035 + speed * 0.012) : 0), 26, 100),
  };
}

export function workOut(condition) {
  if (condition.satiety <= 16 || condition.chonk <= 28) return null;
  return { satiety: Math.max(0, condition.satiety - 1.5), chonk: Math.max(26, condition.chonk - 4) };
}

export function bodyRadius(chonk) {
  return 0.22 + clamp((chonk - 35) / 65, 0, 1) * 0.13;
}

export class SnackWallet {
  constructor(storage) {
    this.storage = storage;
    let saved = 0;
    try { saved = Number(storage?.getItem("megachonk.snack-points.v1")); } catch { /* Private browsing may deny storage. */ }
    this.points = Number.isSafeInteger(saved) && saved > 0 ? Math.min(saved, 999999999) : 0;
  }

  award(points) {
    if (!Number.isSafeInteger(points) || points <= 0) return;
    this.points = Math.min(999999999, this.points + points);
    try { this.storage?.setItem("megachonk.snack-points.v1", String(this.points)); } catch { /* Keep a session wallet if saving is unavailable. */ }
  }
}
