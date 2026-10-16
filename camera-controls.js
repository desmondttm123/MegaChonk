const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export class MouseLookController {
  constructor() {
    this.locked = false;
    this.ignoreUntil = 0;
    this.skipFirstMotion = false;
    this.pendingYaw = this.pendingPitch = 0;
    this.remainingYaw = this.remainingPitch = 0;
    this.rejectedSamples = 0;
  }

  setLocked(locked, now = performance.now()) {
    this.locked = locked;
    this.ignoreUntil = now + 100;
    this.skipFirstMotion = locked;
    this.pendingYaw = this.pendingPitch = 0;
    this.remainingYaw = this.remainingPitch = 0;
  }

  addMovement(x, y, now = performance.now()) {
    if (!this.locked) return;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 512 || Math.abs(y) > 512) {
      this.rejectedSamples += 1;
      return;
    }
    if (!x && !y) return;
    // Pointer lock/focus changes may report a cursor warp as the first delta.
    if (this.skipFirstMotion || now < this.ignoreUntil) {
      this.skipFirstMotion = false;
      return;
    }
    this.pendingYaw = clamp(this.pendingYaw - x * 0.00145, -0.4, 0.4);
    this.pendingPitch = clamp(this.pendingPitch + y * 0.00110, -0.25, 0.25);
  }

  consume(delta) {
    if (!this.locked || !Number.isFinite(delta) || delta <= 0) return { yaw: 0, pitch: 0 };
    const dt = Math.min(delta, 0.05);
    const yawBudget = 4.2 * dt;
    const pitchBudget = 2.4 * dt;
    // Drop excess input for this frame; never replay a large backlog later.
    this.remainingYaw = clamp(this.remainingYaw + clamp(this.pendingYaw, -yawBudget, yawBudget), -0.168, 0.168);
    this.remainingPitch = clamp(this.remainingPitch + clamp(this.pendingPitch, -pitchBudget, pitchBudget), -0.096, 0.096);
    this.pendingYaw = this.pendingPitch = 0;
    const response = 1 - Math.exp(-40 * dt);
    const yaw = clamp(this.remainingYaw * response, -yawBudget, yawBudget);
    const pitch = clamp(this.remainingPitch * response, -pitchBudget, pitchBudget);
    this.remainingYaw -= yaw;
    this.remainingPitch -= pitch;
    return { yaw, pitch };
  }
}
