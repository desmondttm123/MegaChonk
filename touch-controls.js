const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export class TouchControls {
  constructor({ canvas, root, toggle, onAction, onModeChange }) {
    this.canvas = canvas;
    this.root = root;
    this.toggle = toggle;
    this.onAction = onAction;
    this.onModeChange = onModeChange;
    this.stick = root.querySelector("[data-touch-stick]");
    this.buttons = [...root.querySelectorAll("[data-touch-action]")];
    this.enabled = false;
    this.autoDetect = true;
    this.playing = false;
    this.x = this.z = 0;
    this.trotting = false;
    this.pointers = new Map();
    this.pendingYaw = this.pendingPitch = this.remainingYaw = this.remainingPitch = 0;

    document.addEventListener("pointerdown", (event) => {
      if (this.autoDetect && event.pointerType === "touch" && event.target !== toggle) this.setEnabled(true);
    }, { capture: true });
    toggle.addEventListener("click", () => {
      this.autoDetect = false;
      this.setEnabled(!this.enabled);
      this.canvas.focus({ preventScroll: true });
    });
    this.stick.addEventListener("pointerdown", (event) => this.begin(event, "move"));
    canvas.addEventListener("pointerdown", (event) => {
      if (event.clientX >= innerWidth * 0.42) this.begin(event, "look");
    });
    for (const button of this.buttons) {
      button.addEventListener("pointerdown", (event) => this.begin(event, button.dataset.touchAction));
      button.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        if (event.detail === 0 && !event.pointerType && !event.sourceCapabilities?.firesTouchEvents && this.enabled && this.playing) this.activate(button.dataset.touchAction);
      });
    }
    for (const element of [canvas, this.stick, ...this.buttons]) {
      element.addEventListener("pointermove", (event) => this.move(event));
      element.addEventListener("pointerup", (event) => {
        this.move(event);
        this.end(event.pointerId);
      });
      for (const name of ["pointercancel", "lostpointercapture"]) {
        element.addEventListener(name, (event) => this.end(event.pointerId, true));
      }
      element.addEventListener("contextmenu", (event) => { if (this.enabled) event.preventDefault(); });
    }
    addEventListener("blur", () => this.reset());
    addEventListener("resize", () => this.reset());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.reset(); });
    this.setEnabled(matchMedia("(pointer: coarse)").matches);
  }

  setEnabled(enabled) {
    if (this.enabled !== enabled) this.reset();
    const changed = this.enabled !== enabled;
    this.enabled = enabled;
    document.body.classList.toggle("touch-mode", enabled);
    document.body.classList.toggle("touch-playing", enabled && this.playing);
    this.toggle.setAttribute("aria-pressed", String(enabled));
    this.toggle.setAttribute("aria-label", enabled ? "Disable touch controls" : "Enable touch controls");
    this.toggle.textContent = `Touch: ${enabled ? "on" : "off"}`;
    this.root.hidden = !enabled || !this.playing;
    if (changed) this.onModeChange(enabled);
  }

  setPlaying(playing) {
    if (this.playing === playing) return;
    this.playing = playing;
    document.body.classList.toggle("touch-playing", this.enabled && playing);
    if (!playing) this.reset();
    this.root.hidden = !this.enabled || !playing;
  }

  begin(event, role) {
    if (!this.enabled || !this.playing || (event.pointerType === "mouse" && event.button !== 0)) return;
    if ([...this.pointers.values()].some((pointer) => pointer.role === role)) return;
    event.preventDefault();
    const element = event.currentTarget;
    this.pointers.set(event.pointerId, { role, element, x: event.clientX, y: event.clientY });
    element.setPointerCapture(event.pointerId);
    element.classList.add("is-held");
    if (role === "move") this.updateStick(event.clientX, event.clientY);
    else if (role !== "look") this.activate(role);
  }

  move(event) {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer || !this.playing) return;
    event.preventDefault();
    if (pointer.role === "move") this.updateStick(event.clientX, event.clientY);
    if (pointer.role === "look") {
      const x = event.clientX - pointer.x;
      const y = event.clientY - pointer.y;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        this.pendingYaw = clamp(this.pendingYaw - x * 0.006, -0.4, 0.4);
        this.pendingPitch = clamp(this.pendingPitch + y * 0.0045, -0.25, 0.25);
      }
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }

  updateStick(x, y) {
    const bounds = this.stick.getBoundingClientRect();
    const radius = bounds.width * 0.34;
    const dx = (x - bounds.left - bounds.width / 2) / radius;
    const dy = (y - bounds.top - bounds.height / 2) / radius;
    const length = Math.hypot(dx, dy);
    const amount = clamp((length - 0.13) / 0.87, 0, 1);
    this.x = length ? dx / length * amount : 0;
    this.z = length ? -dy / length * amount : 0;
    this.stick.style.setProperty("--stick-x", `${length ? dx / length * Math.min(length, 1) * radius : 0}px`);
    this.stick.style.setProperty("--stick-y", `${length ? dy / length * Math.min(length, 1) * radius : 0}px`);
  }

  activate(action) {
    if (action === "trot") {
      this.trotting = !this.trotting;
      this.root.querySelector('[data-touch-action="trot"]').setAttribute("aria-pressed", String(this.trotting));
    } else this.onAction(action);
  }

  end(id, cancelled = false) {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    this.pointers.delete(id);
    pointer.element.classList.remove("is-held");
    if (pointer.element.hasPointerCapture(id)) pointer.element.releasePointerCapture(id);
    if (pointer.role === "move") {
      this.x = this.z = 0;
      this.stick.style.setProperty("--stick-x", "0px");
      this.stick.style.setProperty("--stick-y", "0px");
    }
    if (pointer.role === "look" && cancelled) this.pendingYaw = this.pendingPitch = this.remainingYaw = this.remainingPitch = 0;
  }

  reset() {
    for (const id of [...this.pointers.keys()]) this.end(id, true);
    this.x = this.z = 0;
    this.pendingYaw = this.pendingPitch = this.remainingYaw = this.remainingPitch = 0;
    this.trotting = false;
    this.root.querySelector('[data-touch-action="trot"]').setAttribute("aria-pressed", "false");
  }

  consumeLook(delta) {
    if (!this.enabled || !this.playing || !Number.isFinite(delta) || delta <= 0) return { yaw: 0, pitch: 0 };
    const dt = Math.min(delta, 0.05);
    const yawBudget = 4.2 * dt;
    const pitchBudget = 2.4 * dt;
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

  snapshot() {
    return { enabled: this.enabled, playing: this.playing, x: this.x, z: this.z, trotting: this.trotting, pointers: [...this.pointers.values()].map((pointer) => pointer.role) };
  }
}
