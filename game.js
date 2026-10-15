import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.querySelector("#game");
const ui = {
  boot: document.querySelector("#boot"),
  enter: document.querySelector("#enter-game"),
  loadStatus: document.querySelector("#load-status"),
  hud: document.querySelector("#hud"),
  satiety: document.querySelector("#satiety-value"),
  satietyFill: document.querySelector("#satiety-fill"),
  chonk: document.querySelector("#chonk-value"),
  chonkFill: document.querySelector("#chonk-fill"),
  condition: document.querySelector("#condition-value"),
  state: document.querySelector("#state-value"),
  pace: document.querySelector("#pace-value"),
  objective: document.querySelector("#objective-text"),
  levelIndex: document.querySelector("#level-index"),
  levelName: document.querySelector("#level-name"),
  levelProgress: document.querySelector("#level-progress"),
  jumpReadiness: document.querySelector("#jump-readiness"),
  prompt: document.querySelector("#prompt"),
  toast: document.querySelector("#toast"),
  coatName: document.querySelector("#coat-name"),
  coatButtons: [...document.querySelectorAll("[data-coat]")],
  transition: document.querySelector("#level-transition"),
  transitionKicker: document.querySelector("#transition-kicker"),
  transitionTitle: document.querySelector("#transition-title"),
  transitionCopy: document.querySelector("#transition-copy"),
  completion: document.querySelector("#completion-screen"),
  completionStats: document.querySelector("#completion-stats"),
  restart: document.querySelector("#restart-game"),
};

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x34271f, 0.018);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 140);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.26;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.38, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const clock = new THREE.Clock();
const keys = new Set();
const colliders = [];
const surfaces = [];
const cameraOccluders = [];
const lamps = [];
const foods = [];
const animatedPlants = [];
const movingPlatforms = [];
const hazards = [];
const checkpointMarkers = [];
const levelRoot = new THREE.Group();
levelRoot.name = "GeneratedLevel";
scene.add(levelRoot);
const temp = {
  forward: new THREE.Vector3(),
  right: new THREE.Vector3(),
  desired: new THREE.Vector3(),
  targetVelocity: new THREE.Vector3(),
  cameraTarget: new THREE.Vector3(),
  cameraDesired: new THREE.Vector3(),
  rayDirection: new THREE.Vector3(),
};

const state = {
  started: false,
  ready: false,
  pointerLocked: false,
  yaw: 0,
  pitch: 0.27,
  satiety: 62,
  idleTime: 0,
  eaten: 0,
  toastTime: 0,
  eatingTime: 0,
  coat: "van",
  chonk: 48,
  xp: 0,
  level: 0,
  levelFoodEaten: 0,
  runSeed: Math.floor(Math.random() * 900000) + 100000,
  grounded: true,
  jumpBuffer: 0,
  coyoteTime: 0.12,
  sitting: false,
  forcedAction: null,
  actionTime: 0,
  transitioning: false,
  gameComplete: false,
  bonks: 0,
  jumps: 0,
  runStartedAt: 0,
  invulnerable: 0,
};

const character = {
  root: new THREE.Group(),
  model: null,
  mixer: null,
  actions: {},
  currentAction: null,
  velocity: new THREE.Vector3(),
  heading: Math.PI,
  radius: 0.36,
  triangleCount: 0,
  verticalVelocity: 0,
  currentPlatform: null,
  checkpoint: new THREE.Vector3(0, 0, 7.2),
};
character.root.position.set(0, 0, 7.2);
character.root.rotation.y = character.heading;
scene.add(character.root);

let dust;

const COAT_ORDER = ["van", "tuxedo", "calico", "orangeTabby"];
const COAT_LABELS = {
  van: "Van",
  tuxedo: "Tuxedo",
  calico: "Calico",
  orangeTabby: "Orange tabby",
};
const coatMaterialCache = new Map();
const GRAVITY = 15.8;
const LEVELS = [
  {
    name: "Living Room Zoomies",
    description: "Clear the cushions, raid the bowls, and stay ahead of the robot vacuum.",
    foods: 3,
    spawn: [0, 0, 10.8],
    goal: [0, -11.15],
    theme: "living",
  },
  {
    name: "Kitchen Counter Caper",
    description: "Cross the spills, climb the ottoman, and hunt supper between the counters.",
    foods: 4,
    spawn: [0, 0, 11.1],
    goal: [0, -11.15],
    theme: "kitchen",
  },
  {
    name: "Attic Midnight Run",
    description: "Bound through the playroom and find the last bowls among the storage trunks.",
    foods: 5,
    spawn: [0, 0, 11.1],
    goal: [0, -11.15],
    theme: "attic",
  },
];
const FOOD_LABELS = ["KIBBLE", "FISH", "SARDINES", "TREAT", "SUPPER", "CHICKEN", "TUNA"];
const TRANSIENT_ACTIONS = new Set(["Jump", "Claw", "Bite"]);

let activeGoal = null;
let transitionTimer = null;

function seededRandom(seed) {
  const value = Math.sin(seed * 91.173) * 43758.5453;
  return value - Math.floor(value);
}

function makeTexture(kind, size = 512) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = size;
  textureCanvas.height = size;
  const ctx = textureCanvas.getContext("2d");

  if (kind === "woodFloor") {
    ctx.fillStyle = "#94633f";
    ctx.fillRect(0, 0, size, size);
    const plankHeight = size / 7;
    for (let row = 0; row < 7; row += 1) {
      const y = row * plankHeight;
      const offset = row % 2 ? size * 0.18 : -size * 0.08;
      ctx.fillStyle = row % 2 ? "rgba(255,225,181,.055)" : "rgba(49,22,12,.075)";
      ctx.fillRect(0, y, size, plankHeight);
      ctx.strokeStyle = "rgba(46,24,15,.34)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + 1);
      ctx.lineTo(size, y + 1);
      ctx.stroke();
      for (let col = -1; col < 5; col += 1) {
        const x = offset + col * size * 0.28;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + plankHeight);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 1500; i += 1) {
      ctx.fillStyle = seededRandom(i + 93) > 0.5 ? "#f0c38c" : "#3a1e14";
      const x = seededRandom(i + 203) * size;
      const y = seededRandom(i + 311) * size;
      ctx.fillRect(x, y, 4 + seededRandom(i + 407) * 16, 0.7);
    }
  } else if (kind === "tile") {
    ctx.fillStyle = "#c8b69e";
    ctx.fillRect(0, 0, size, size);
    const tile = size / 6;
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        ctx.fillStyle = (row + col) % 2 ? "#bfa98d" : "#d4c5ae";
        ctx.fillRect(col * tile + 2, row * tile + 2, tile - 4, tile - 4);
      }
    }
  } else if (kind === "carpet") {
    ctx.fillStyle = "#6f695d";
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 12000; i += 1) {
      ctx.fillStyle = seededRandom(i + 19) > 0.5 ? "#c2b8a4" : "#282b28";
      ctx.fillRect(seededRandom(i + 71) * size, seededRandom(i + 137) * size, 1, 1);
    }
  } else if (kind === "wallpaper") {
    ctx.fillStyle = "#c8b99e";
    ctx.fillRect(0, 0, size, size);
    const stripe = size / 12;
    for (let i = 0; i < 12; i += 1) {
      ctx.fillStyle = i % 2 ? "rgba(90,79,59,.075)" : "rgba(255,248,225,.055)";
      ctx.fillRect(i * stripe, 0, stripe, size);
    }
    ctx.globalAlpha = 0.14;
    for (let i = 0; i < 3200; i += 1) {
      ctx.fillStyle = seededRandom(i + 41) > 0.5 ? "#ffffff" : "#4c3d2f";
      ctx.fillRect(seededRandom(i + 81) * size, seededRandom(i + 121) * size, 1, 1);
    }
  } else if (kind === "stone") {
    ctx.fillStyle = "#59615b";
    ctx.fillRect(0, 0, size, size);
    const tile = size / 8;
    for (let row = 0; row < 8; row += 1) {
      for (let col = -1; col < 8; col += 1) {
        const offset = row % 2 ? tile * 0.5 : 0;
        const value = 70 + Math.floor(seededRandom(row * 17 + col + 9) * 22);
        ctx.fillStyle = `rgb(${value}, ${value + 8}, ${value + 3})`;
        ctx.fillRect(col * tile + offset + 2, row * tile + 2, tile - 4, tile - 4);
      }
    }
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 9000; i += 1) {
      const v = seededRandom(i + 200);
      ctx.fillStyle = v > 0.55 ? "#ffffff" : "#17231d";
      ctx.fillRect(seededRandom(i + 300) * size, seededRandom(i + 400) * size, 1, 1);
    }
  } else if (kind === "plaster") {
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "#788078");
    gradient.addColorStop(1, "#3f4c49");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 6000; i += 1) {
      ctx.fillStyle = seededRandom(i + 12) > 0.5 ? "#d4d3bd" : "#101a1b";
      const radius = 1 + seededRandom(i + 82) * 2;
      ctx.fillRect(seededRandom(i + 28) * size, seededRandom(i + 56) * size, radius, radius);
    }
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function nameSeed(name) {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function drawCoatBlob(ctx, x, y, radiusX, radiusY, color, seed) {
  ctx.beginPath();
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    const wobble = 0.78 + seededRandom(seed + i * 7.1) * 0.36;
    const px = x + Math.cos(angle) * radiusX * wobble;
    const py = y + Math.sin(angle) * radiusY * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function makeCoatTexture(style, role, variation, size = 384) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = size;
  textureCanvas.height = size;
  const ctx = textureCanvas.getContext("2d");
  const marked = role === "patch" || role === "tail" || role === "ear";
  const accent = role === "accent";
  const seed = variation * 997 + COAT_ORDER.indexOf(style) * 409;
  let base = "#ece8df";

  if (style === "van") base = marked ? "#6a2f17" : "#ece8df";
  if (style === "tuxedo") base = accent ? "#eeeae2" : "#171a1b";
  if (style === "calico") {
    if (accent) base = "#eeeae1";
    else if (role === "patch" || role === "ear") base = variation % 2 ? "#222120" : "#bd5b20";
    else base = "#eeeae1";
  }
  if (style === "orangeTabby") {
    if (accent) base = "#efd1a0";
    else if (role === "patch") base = "#8d3715";
    else base = "#cf6d27";
  }

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  if (style === "calico" && !accent && role !== "patch" && role !== "ear") {
    for (let i = 0; i < 10; i += 1) {
      const x = seededRandom(seed + i * 13 + 4) * size;
      const y = seededRandom(seed + i * 17 + 7) * size;
      const rx = size * (0.08 + seededRandom(seed + i * 19 + 2) * 0.13);
      const ry = size * (0.07 + seededRandom(seed + i * 23 + 8) * 0.15);
      drawCoatBlob(ctx, x, y, rx, ry, i % 2 ? "#242323" : "#bd5d21", seed + i * 31);
    }
  }

  if (style === "orangeTabby" && !accent) {
    ctx.strokeStyle = role === "patch" ? "rgba(74, 25, 9, .76)" : "rgba(101, 39, 14, .72)";
    ctx.lineCap = "round";
    const stripeCount = role === "tail" ? 13 : 9;
    for (let i = 0; i < stripeCount; i += 1) {
      const y = ((i + 0.55) / stripeCount) * size;
      const bend = (seededRandom(seed + i * 29) - 0.5) * size * 0.16;
      ctx.lineWidth = size * (0.018 + seededRandom(seed + i * 37) * 0.018);
      ctx.beginPath();
      ctx.moveTo(-12, y);
      ctx.bezierCurveTo(size * 0.28, y + bend, size * 0.67, y - bend, size + 12, y);
      ctx.stroke();
    }
    if (role === "base") {
      ctx.lineWidth = size * 0.018;
      for (const x of [size * 0.43, size * 0.5, size * 0.57]) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.quadraticCurveTo(x + (x - size * 0.5) * 0.7, size * 0.18, x, size * 0.3);
        ctx.stroke();
      }
    }
  }

  ctx.globalAlpha = style === "tuxedo" && !accent ? 0.10 : 0.065;
  for (let i = 0; i < 2600; i += 1) {
    ctx.fillStyle = seededRandom(seed + i * 3 + 101) > 0.52 ? "#ffffff" : "#140d08";
    const x = seededRandom(seed + i * 5 + 203) * size;
    const y = seededRandom(seed + i * 7 + 307) * size;
    const length = 1 + seededRandom(seed + i * 11 + 401) * 3;
    ctx.fillRect(x, y, length, 0.7);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.name = `Coat_${style}_${role}_${variation}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function coatRole(meshName) {
  const name = meshName.toLowerCase();
  if (name.includes("eye") || name.includes("pupil") || name.includes("nose")) return null;
  if (name.includes("muzzle") || name.includes("cheek") || name.includes("chest") || name.includes("paw")) return "accent";
  if (name.includes("patch")) return "patch";
  if (name.includes("tail")) return "tail";
  if (name.includes("ear")) return "ear";
  return "base";
}

function getCoatMaterial(style, role, variation) {
  const key = `${style}:${role}:${variation}`;
  if (coatMaterialCache.has(key)) return coatMaterialCache.get(key);
  const material = new THREE.MeshStandardMaterial({
    name: `Coat_${style}_${role}_${variation}`,
    color: 0xffffff,
    map: makeCoatTexture(style, role, variation),
    roughness: role === "accent" ? 0.9 : 0.84,
    metalness: 0,
    envMapIntensity: 0.48,
  });
  coatMaterialCache.set(key, material);
  return material;
}

function applyCoat(style, announce = true) {
  if (!COAT_ORDER.includes(style)) return false;
  state.coat = style;
  character.model?.traverse((obj) => {
    if (!obj.isMesh) return;
    const role = coatRole(obj.name);
    if (!role) return;
    const variation = nameSeed(obj.name) % 3;
    obj.material = getCoatMaterial(style, role, variation);
  });
  ui.coatName.textContent = COAT_LABELS[style].toUpperCase();
  for (const button of ui.coatButtons) {
    const selected = button.dataset.coat === style;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  if (announce && state.started) showToast(`${COAT_LABELS[style]} coat selected.`, 2.2);
  return true;
}

function cycleCoat() {
  const nextIndex = (COAT_ORDER.indexOf(state.coat) + 1) % COAT_ORDER.length;
  applyCoat(COAT_ORDER[nextIndex]);
}

function setupCoatControls() {
  for (const button of ui.coatButtons) {
    button.addEventListener("click", () => applyCoat(button.dataset.coat, false));
  }
}

function countTriangles(root) {
  let count = 0;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    count += obj.geometry.index
      ? obj.geometry.index.count / 3
      : obj.geometry.getAttribute("position").count / 3;
  });
  return Math.round(count);
}

const textures = {
  woodFloor: makeTexture("woodFloor"),
  tile: makeTexture("tile"),
  carpet: makeTexture("carpet"),
  wallpaper: makeTexture("wallpaper"),
};
textures.woodFloor.repeat.set(5, 8);
textures.tile.repeat.set(5, 5);
textures.carpet.repeat.set(8, 7);
textures.wallpaper.repeat.set(5, 2);

const materials = {
  floorWood: new THREE.MeshStandardMaterial({ map: textures.woodFloor, color: 0xb4835c, roughness: 0.62, metalness: 0.02 }),
  floorTile: new THREE.MeshStandardMaterial({ map: textures.tile, color: 0xd7c8b4, roughness: 0.58, metalness: 0.02 }),
  floorCarpet: new THREE.MeshStandardMaterial({ map: textures.carpet, color: 0x918575, roughness: 0.98 }),
  wallpaperSage: new THREE.MeshStandardMaterial({ map: textures.wallpaper, color: 0xa8aa88, roughness: 0.92 }),
  wallpaperCream: new THREE.MeshStandardMaterial({ map: textures.wallpaper, color: 0xd2bb99, roughness: 0.92 }),
  wallpaperAttic: new THREE.MeshStandardMaterial({ map: textures.wallpaper, color: 0x9b826d, roughness: 0.94 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xd8ccb8, roughness: 0.95, side: THREE.DoubleSide }),
  trim: new THREE.MeshStandardMaterial({ color: 0xe2d9ca, roughness: 0.76 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x56351f, roughness: 0.75 }),
  woodLight: new THREE.MeshStandardMaterial({ color: 0xa46f43, roughness: 0.72 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x3f4748, roughness: 0.34, metalness: 0.68 }),
  upholstery: new THREE.MeshStandardMaterial({ color: 0x496b65, roughness: 0.94 }),
  upholsteryWarm: new THREE.MeshStandardMaterial({ color: 0xa95d42, roughness: 0.93 }),
  upholsteryGold: new THREE.MeshStandardMaterial({ color: 0xc59b58, roughness: 0.91 }),
  cardboard: new THREE.MeshStandardMaterial({ color: 0xa97b4f, roughness: 0.9 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xe7ded0, roughness: 0.38 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x315b43, roughness: 0.86 }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x5d8060, roughness: 0.83 }),
  glow: new THREE.MeshStandardMaterial({ color: 0xffd18f, emissive: 0xff9d45, emissiveIntensity: 2.7, roughness: 0.3 }),
  spill: new THREE.MeshStandardMaterial({ color: 0x79b7c3, emissive: 0x244b56, emissiveIntensity: 0.34, transparent: true, opacity: 0.58, roughness: 0.16, metalness: 0.08 }),
  platform: new THREE.MeshStandardMaterial({ color: 0x668985, roughness: 0.82, metalness: 0.04 }),
  checkpoint: new THREE.MeshStandardMaterial({ color: 0xa9d5c2, emissive: 0x4eb68f, emissiveIntensity: 1.25, roughness: 0.72 }),
  goal: new THREE.MeshStandardMaterial({ color: 0xf0c77e, emissive: 0xe28b39, emissiveIntensity: 2.2, roughness: 0.32 }),
};

function addCollider(x, z, width, depth, padding = 0, minY = 0, maxY = 2, owner = null) {
  const collider = {
    minX: x - width / 2 - padding,
    maxX: x + width / 2 + padding,
    minZ: z - depth / 2 - padding,
    maxZ: z + depth / 2 + padding,
    minY,
    maxY,
    owner,
  };
  colliders.push(collider);
  return collider;
}

function addSurface(x, z, width, depth, topY, owner = null) {
  const surface = {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    topY,
    owner,
  };
  surfaces.push(surface);
  return surface;
}

function addBox(name, position, size, material, options = {}) {
  const radius = options.radius ?? Math.min(size.x, size.y, size.z) * 0.05;
  const geometry = new RoundedBoxGeometry(size.x, size.y, size.z, 3, Math.max(0.015, radius));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  (options.parent ?? levelRoot).add(mesh);
  let collider = null;
  let surface = null;
  if (options.collider) {
    collider = addCollider(
      position.x,
      position.z,
      size.x,
      size.z,
      options.padding ?? 0,
      position.y - size.y / 2,
      position.y + size.y / 2,
      mesh,
    );
  }
  if (options.surface) surface = addSurface(position.x, position.z, size.x, size.z, position.y + size.y / 2, mesh);
  if (options.occluder) cameraOccluders.push(mesh);
  mesh.userData.collider = collider;
  mesh.userData.surface = surface;
  return mesh;
}

function addCylinder(name, x, y, z, radiusTop, radiusBottom, height, material, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  levelRoot.add(mesh);
  return mesh;
}

function buildSky() {
  const geometry = new THREE.SphereGeometry(80, 48, 24);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x151921) },
      horizonColor: { value: new THREE.Color(0x4f5961) },
      glowColor: { value: new THREE.Color(0xe6ae76) },
    },
    vertexShader: "varying vec3 vWorld; void main(){ vec4 world=modelMatrix*vec4(position,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }",
    fragmentShader: "varying vec3 vWorld; uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 glowColor; void main(){ float h=normalize(vWorld).y; vec3 c=mix(horizonColor,topColor,smoothstep(-0.05,0.55,h)); float glow=pow(max(0.0,1.0-abs(h)*4.0),5.0); c=mix(c,glowColor,glow*0.18); gl_FragColor=vec4(c,1.0); }",
  });
  scene.add(new THREE.Mesh(geometry, material));
}

function addWindow(x, y, z, width, height, rotationY = 0) {
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x344b59,
    emissive: 0x152935,
    emissiveIntensity: 0.72,
    roughness: 0.18,
    metalness: 0.1,
  });
  const glass = addBox("WindowGlass", new THREE.Vector3(x, y, z + 0.03), new THREE.Vector3(width, height, 0.04), windowMaterial, { radius: 0.01, castShadow: false });
  glass.rotation.y = rotationY;
  for (const [offsetX, offsetY, frameWidth, frameHeight] of [
    [0, height / 2 + 0.07, width + 0.22, 0.14],
    [0, -height / 2 - 0.07, width + 0.22, 0.14],
    [-width / 2 - 0.07, 0, 0.14, height],
    [width / 2 + 0.07, 0, 0.14, height],
    [0, 0, 0.09, height],
  ]) {
    const frame = addBox("WindowFrame", new THREE.Vector3(x + offsetX, y + offsetY, z + 0.08), new THREE.Vector3(frameWidth, frameHeight, 0.11), materials.trim, { radius: 0.018 });
    frame.rotation.y = rotationY;
  }
}

function addHousePlant(x, z, scale = 1) {
  addCylinder("PlantPot", x, 0.28 * scale, z, 0.43 * scale, 0.34 * scale, 0.56 * scale, materials.ceramic, 32);
  addCollider(x, z, 0.86 * scale, 0.86 * scale, 0.04);
  const trunk = addCylinder("PlantStem", x, 0.82 * scale, z, 0.045 * scale, 0.065 * scale, 1.18 * scale, materials.wood, 12);
  trunk.castShadow = true;
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry((0.3 + seededRandom(i + x) * 0.13) * scale, 2), i % 2 ? materials.leaf : materials.leafLight);
    leaf.position.set(x + (seededRandom(i + 5) - 0.5) * 0.62 * scale, (1.04 + seededRandom(i + 9) * 0.72) * scale, z + (seededRandom(i + 18) - 0.5) * 0.58 * scale);
    leaf.scale.y = 0.7 + seededRandom(i + 90) * 0.34;
    leaf.castShadow = true;
    levelRoot.add(leaf);
    animatedPlants.push({ mesh: leaf, phase: seededRandom(i + 70) * Math.PI * 2, base: leaf.rotation.z });
  }
}

function addCeilingLight(x, z, color = 0xffc98d) {
  addCylinder("PendantCord", x, 5.16, z, 0.022, 0.022, 1.05, materials.metal, 12);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.5, 0.34, 28, 1, true), materials.woodLight);
  shade.position.set(x, 4.62, z);
  shade.castShadow = true;
  levelRoot.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), materials.glow);
  bulb.position.set(x, 4.47, z);
  levelRoot.add(bulb);
  const light = new THREE.PointLight(color, 18, 10.5, 1.65);
  light.position.set(x, 4.3, z);
  light.castShadow = false;
  levelRoot.add(light);
  lamps.push({ light, phase: seededRandom(x * 11 + z * 7) * Math.PI * 2 });
}

function addRug(x, z, width, depth, material) {
  addBox("AreaRug", new THREE.Vector3(x, 0.018, z), new THREE.Vector3(width, 0.035, depth), material, { castShadow: false, radius: 0.08 });
}

function addCouch(x, z, material = materials.upholstery) {
  addBox("SofaBase", new THREE.Vector3(x, 0.34, z), new THREE.Vector3(4.6, 0.68, 1.45), material, { collider: true, occluder: true, radius: 0.18 });
  addBox("SofaBack", new THREE.Vector3(x, 1.08, z + 0.58), new THREE.Vector3(4.6, 1.1, 0.34), material, { radius: 0.15 });
  for (const offset of [-1.45, 0, 1.45]) {
    addBox("SofaCushion", new THREE.Vector3(x + offset, 0.76, z - 0.14), new THREE.Vector3(1.34, 0.24, 1.02), offset === 0 ? materials.upholsteryGold : material, { radius: 0.12 });
  }
  for (const offset of [-2.18, 2.18]) {
    addBox("SofaArm", new THREE.Vector3(x + offset, 0.73, z), new THREE.Vector3(0.34, 0.75, 1.45), material, { radius: 0.14 });
  }
}

function addBookcase(x, z, height = 2.8) {
  addBox("Bookcase", new THREE.Vector3(x, height / 2, z), new THREE.Vector3(2.25, height, 0.65), materials.wood, { collider: true, occluder: true, radius: 0.06 });
  for (let shelf = 0; shelf < 3; shelf += 1) {
    const y = 0.55 + shelf * 0.76;
    for (let book = 0; book < 7; book += 1) {
      const color = book % 3 === 0 ? materials.upholsteryWarm : book % 2 ? materials.upholsteryGold : materials.upholstery;
      addBox("Book", new THREE.Vector3(x - 0.82 + book * 0.27, y, z - 0.37), new THREE.Vector3(0.17, 0.42 + (book % 2) * 0.12, 0.12), color, { radius: 0.015 });
    }
  }
}

function addKitchenCounter(x, z, width = 3.6) {
  addBox("KitchenCabinet", new THREE.Vector3(x, 0.48, z), new THREE.Vector3(width, 0.96, 1.72), materials.wallpaperCream, { collider: true, surface: true, occluder: true, radius: 0.07 });
  addBox("CounterTop", new THREE.Vector3(x, 1.02, z), new THREE.Vector3(width + 0.12, 0.12, 1.86), materials.ceramic, { radius: 0.045 });
  for (let door = -1; door <= 1; door += 1) {
    addBox("CabinetDoor", new THREE.Vector3(x + door * width * 0.27, 0.49, z - 0.87), new THREE.Vector3(width * 0.24, 0.72, 0.035), materials.trim, { castShadow: false, radius: 0.018 });
  }
}

function addStorageStack(x, z, random) {
  const levels = 2 + Math.floor(random() * 2);
  for (let i = 0; i < levels; i += 1) {
    const width = 1.7 - i * 0.13;
    addBox("StorageBox", new THREE.Vector3(x + (random() - 0.5) * 0.22, 0.38 + i * 0.72, z + (random() - 0.5) * 0.18), new THREE.Vector3(width, 0.7, 1.45), materials.cardboard, { collider: i === 0, occluder: true, radius: 0.055 });
    addBox("PackingTape", new THREE.Vector3(x, 0.74 + i * 0.72, z), new THREE.Vector3(0.16, 0.02, 1.48), materials.trim, { castShadow: false, radius: 0.008 });
  }
}

function addCatTree(x, z) {
  addBox("CatTreeBase", new THREE.Vector3(x, 0.1, z), new THREE.Vector3(1.9, 0.2, 1.5), materials.upholsteryGold, { collider: true, radius: 0.09 });
  for (const [offsetX, offsetZ, height] of [[-0.55, 0.3, 1.65], [0.5, -0.2, 2.5]]) {
    addCylinder("ScratchPost", x + offsetX, height / 2, z + offsetZ, 0.11, 0.11, height, materials.cardboard, 20);
    addBox("CatTreePerch", new THREE.Vector3(x + offsetX, height, z + offsetZ), new THREE.Vector3(1.15, 0.16, 0.9), materials.upholsteryGold, { radius: 0.08 });
  }
}

function createLevelRandom(levelIndex) {
  let value = (state.runSeed + levelIndex * 7919) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function clearLevel() {
  for (const child of [...levelRoot.children]) {
    levelRoot.remove(child);
    child.traverse((object) => object.geometry?.dispose?.());
  }
  colliders.length = 0;
  surfaces.length = 0;
  cameraOccluders.length = 0;
  lamps.length = 0;
  foods.length = 0;
  animatedPlants.length = 0;
  movingPlatforms.length = 0;
  hazards.length = 0;
  checkpointMarkers.length = 0;
  activeGoal = null;
  character.currentPlatform = null;
}

function buildLevelShell(definition, random) {
  const floorMaterial = definition.theme === "living"
    ? materials.floorWood
    : definition.theme === "kitchen"
      ? materials.floorTile
      : materials.floorCarpet;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(34, 29), floorMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  levelRoot.add(ground);
  addSurface(0, 0, 34, 29, 0, ground);

  const wallMaterial = definition.theme === "living"
    ? materials.wallpaperSage
    : definition.theme === "kitchen"
      ? materials.wallpaperCream
      : materials.wallpaperAttic;
  addBox("BackWall", new THREE.Vector3(0, 3, -13.35), new THREE.Vector3(30, 6, 0.9), wallMaterial, { collider: true, occluder: true, radius: 0.08 });
  addBox("LeftWall", new THREE.Vector3(-15.25, 3, 0), new THREE.Vector3(0.9, 6, 28), wallMaterial, { collider: true, occluder: true, radius: 0.08 });
  addBox("RightWall", new THREE.Vector3(15.25, 3, 0), new THREE.Vector3(0.9, 6, 28), wallMaterial, { collider: true, occluder: true, radius: 0.08 });
  addBox("EntryWallLeft", new THREE.Vector3(-9.2, 3, 13.65), new THREE.Vector3(12, 6, 0.8), wallMaterial, { collider: true, occluder: true });
  addBox("EntryWallRight", new THREE.Vector3(9.2, 3, 13.65), new THREE.Vector3(12, 6, 0.8), wallMaterial, { collider: true, occluder: true });
  addBox("Ceiling", new THREE.Vector3(0, 5.92, 0), new THREE.Vector3(30.4, 0.16, 28), materials.ceiling, { radius: 0.04 });
  for (const x of [-15.0, 15.0]) addBox("Baseboard", new THREE.Vector3(x + (x < 0 ? 0.48 : -0.48), 0.15, 0), new THREE.Vector3(0.12, 0.3, 27.4), materials.trim, { radius: 0.025 });
  addBox("BackBaseboard", new THREE.Vector3(0, 0.15, -12.86), new THREE.Vector3(29.1, 0.3, 0.12), materials.trim, { radius: 0.025 });

  for (const x of [-8.2, 8.2]) addWindow(x, 3.3, -12.84, 3.2, 2.15);
  for (const [x, z] of [[-7.6, 7.4], [7.6, 1.1], [-7.6, -6.0], [7.6, -9.0]]) addCeilingLight(x, z, definition.theme === "attic" ? 0xffb66e : 0xffd19c);

  if (definition.theme === "living") {
    addRug(0, 1.3, 11.2, 7.0, materials.upholsteryWarm);
    addCouch(-10.7, 4.4, materials.upholstery);
    addCouch(10.4, -4.6, materials.upholsteryWarm);
    addBookcase(11.8, 7.9, 2.75);
    addBookcase(-11.8, -7.8, 2.45);
    addHousePlant(-9.6, -1.8, 0.95);
    addHousePlant(10.2, 3.7, 0.82);
    addBox("CoffeeTable", new THREE.Vector3(8.7, 0.34, 7.4), new THREE.Vector3(2.8, 0.68, 1.55), materials.woodLight, { collider: true, surface: true, radius: 0.13 });
  }

  if (definition.theme === "kitchen") {
    for (const side of [-1, 1]) {
      for (const z of [7.0, 0.4, -6.4]) addKitchenCounter(side * (10.6 + random() * 0.35), z, 3.5);
    }
    addBox("Refrigerator", new THREE.Vector3(-12.0, 1.25, -10.2), new THREE.Vector3(2.15, 2.5, 1.8), materials.metal, { collider: true, occluder: true, radius: 0.11 });
    addBox("DiningTable", new THREE.Vector3(9.1, 0.72, 10.0), new THREE.Vector3(3.8, 0.18, 2.4), materials.woodLight, { collider: true, surface: true, radius: 0.08 });
    for (const x of [7.8, 10.4]) addBox("DiningChair", new THREE.Vector3(x, 0.46, 8.45), new THREE.Vector3(0.82, 0.92, 0.82), materials.wood, { collider: true, radius: 0.08 });
    addHousePlant(-11.8, 10.2, 0.68);
  }

  if (definition.theme === "attic") {
    addRug(0, 2.2, 10.4, 6.4, materials.upholsteryGold);
    for (const z of [9.0, 2.8, -3.5, -9.2]) {
      addStorageStack(-11.5 + random() * 0.5, z, random);
      addStorageStack(11.5 - random() * 0.5, z + (random() - 0.5) * 0.7, random);
    }
    for (const z of [8.5, 1.5, -5.5]) addBox("AtticBeam", new THREE.Vector3(0, 5.15, z), new THREE.Vector3(29.5, 0.3, 0.32), materials.wood, { radius: 0.05 });
    addCatTree(9.1, 5.7);
    addHousePlant(-9.3, -7.0, 0.72);
  }
}

function createJumpBarrier(x, z, width, height, material = materials.upholsteryWarm) {
  const barrier = addBox("CushionHurdle", new THREE.Vector3(x, height / 2, z), new THREE.Vector3(width, height, 0.4), material, { collider: true, radius: 0.11 });
  const marker = addBox("CushionPiping", new THREE.Vector3(x, height + 0.015, z), new THREE.Vector3(width * 0.92, 0.035, 0.42), materials.trim, { castShadow: false, radius: 0.015 });
  marker.userData.decorative = true;
  return barrier;
}

function createStaticPlatform(x, z, width, depth, height) {
  const ottoman = addBox("OttomanPlatform", new THREE.Vector3(x, height / 2, z), new THREE.Vector3(width, height, depth), materials.upholsteryGold, { collider: true, surface: true, occluder: true, radius: 0.16 });
  addBox("OttomanTop", new THREE.Vector3(x, height + 0.035, z), new THREE.Vector3(width * 0.92, 0.07, depth * 0.9), materials.upholsteryWarm, { radius: 0.08 });
  return ottoman;
}

function createMovingPlatform(x, z, width, depth, height, axis, amplitude, speed, phase) {
  const mesh = addBox("MovingFootstool", new THREE.Vector3(x, height / 2, z), new THREE.Vector3(width, height, depth), materials.platform, { collider: true, surface: true, radius: 0.12 });
  const cushion = new THREE.Mesh(new RoundedBoxGeometry(width * 0.88, 0.1, depth * 0.84, 3, 0.05), materials.upholsteryGold);
  cushion.position.y = height / 2 + 0.03;
  cushion.castShadow = true;
  mesh.add(cushion);
  const platform = {
    name: "MovingFootstool",
    mesh,
    base: mesh.position.clone(),
    previous: mesh.position.clone(),
    axis: new THREE.Vector3(...axis).normalize(),
    amplitude,
    speed,
    phase,
    collider: mesh.userData.collider,
    surface: mesh.userData.surface,
    halfWidth: width / 2,
    halfDepth: depth / 2,
    halfHeight: height / 2,
  };
  platform.surface.owner = platform;
  platform.collider.owner = platform;
  movingPlatforms.push(platform);
  return platform;
}

function createSpill(x, z, width, depth) {
  addBox("FloorSpill", new THREE.Vector3(x, 0.016, z), new THREE.Vector3(width, 0.032, depth), materials.spill, { castShadow: false, radius: Math.min(0.38, depth * 0.18) });
  for (let i = 0; i < 5; i += 1) {
    const droplet = new THREE.Mesh(new THREE.SphereGeometry(0.08 + i * 0.012, 14, 8), materials.spill);
    droplet.scale.y = 0.08;
    droplet.position.set(x + Math.sin(i * 2.3) * width * 0.52, 0.025, z + Math.cos(i * 1.7) * depth * 0.52);
    droplet.castShadow = false;
    levelRoot.add(droplet);
  }
  hazards.push({ type: "spill", minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, safeY: 0.2 });
}

function createRobotVacuum(x, z, length, speed, phase = 0) {
  const group = new THREE.Group();
  group.name = "RobotVacuum";
  group.position.set(x, 0, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.54, 0.22, 40), materials.metal);
  body.position.y = 0.12;
  body.castShadow = true;
  group.add(body);
  const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.09, 24), materials.glow);
  sensor.position.set(0.12, 0.275, 0);
  group.add(sensor);
  const arm = new THREE.Mesh(new RoundedBoxGeometry(length, 0.11, 0.16, 3, 0.05), materials.upholsteryWarm);
  arm.position.set(length / 2, 0.16, 0);
  arm.castShadow = true;
  group.add(arm);
  const light = new THREE.PointLight(0xff9d55, 3.2, 3.2, 2);
  light.position.set(length, 0.25, 0);
  group.add(light);
  levelRoot.add(group);
  hazards.push({ type: "vacuum", group, length, speed, phase, radius: 0.2, maxY: 0.62 });
}

function createCheckpoint(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0.025, z);
  const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.16, 40), materials.checkpoint);
  bed.position.y = 0.08;
  bed.scale.z = 0.78;
  bed.castShadow = true;
  group.add(bed);
  const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.57, 30, 14), materials.upholstery);
  cushion.scale.set(1, 0.18, 0.72);
  cushion.position.y = 0.17;
  cushion.castShadow = true;
  group.add(cushion);
  const beacon = new THREE.PointLight(0x70d7b1, 1.7, 2.6, 2);
  beacon.position.y = 0.42;
  group.add(beacon);
  levelRoot.add(group);
  checkpointMarkers.push({ group, position: new THREE.Vector3(x, 0, z), active: true, phase: x * 0.3 + z });
}

function createGoal(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z - 1.18);
  const door = new THREE.Mesh(new RoundedBoxGeometry(2.5, 3.25, 0.18, 3, 0.07), materials.wood);
  door.position.y = 1.63;
  door.castShadow = true;
  group.add(door);
  for (const [offsetX, offsetY, width, height] of [[-1.36, 1.65, 0.2, 3.5], [1.36, 1.65, 0.2, 3.5], [0, 3.34, 2.9, 0.2]]) {
    const frame = new THREE.Mesh(new RoundedBoxGeometry(width, height, 0.25, 3, 0.045), materials.trim);
    frame.position.set(offsetX, offsetY, 0.02);
    group.add(frame);
  }
  const marker = new THREE.Mesh(new RoundedBoxGeometry(1.18, 0.88, 0.12, 4, 0.13), materials.goal);
  marker.position.set(0, 0.65, 0.16);
  group.add(marker);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 12), materials.goal);
  knob.position.set(0.82, 1.72, 0.17);
  group.add(knob);
  const light = new THREE.PointLight(0xffb759, 0, 5.5, 1.5);
  light.position.set(0, 0.78, 0.48);
  group.add(light);
  levelRoot.add(group);
  activeGoal = { group, marker, light, position: new THREE.Vector3(x, 0, z), active: false };
}

function obstacleAreaIsClear(x, z, width, spawn) {
  const half = width / 2 + 0.28;
  if (colliders.some((box) => x + half > box.minX && x - half < box.maxX && z + half > box.minZ && z - half < box.maxZ)) return false;
  if (foods.some((food) => Math.hypot(x - food.group.position.x, z - food.group.position.z) < half + 1.45)) return false;
  if (activeGoal && Math.hypot(x - activeGoal.position.x, z - activeGoal.position.z) < half + 1.7) return false;
  if (Math.hypot(x - spawn[0], z - spawn[2]) < half + 1.8) return false;
  if (checkpointMarkers.some((checkpoint) => Math.hypot(x - checkpoint.position.x, z - checkpoint.position.z) < half + 1.25)) return false;
  for (const hazard of hazards) {
    if (hazard.type === "spill") {
      if (x + half > hazard.minX && x - half < hazard.maxX && z + half > hazard.minZ && z - half < hazard.maxZ) return false;
    } else if (Math.hypot(x - hazard.group.position.x, z - hazard.group.position.z) < half + hazard.length + 0.55) return false;
  }
  return true;
}

function addRandomObstacles(random, count, theme, spawn) {
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 40) {
    attempts += 1;
    const side = random() < 0.5 ? -1 : 1;
    const x = side * (4.6 + random() * 7.0);
    const z = -9.8 + random() * 19.6;
    const width = 0.75 + random() * 0.9;
    if (!obstacleAreaIsClear(x, z, width, spawn)) continue;
    if (theme === "living") {
      const height = 0.24 + random() * 0.22;
      addBox("FloorCushion", new THREE.Vector3(x, height / 2, z), new THREE.Vector3(width * 1.25, height, width), random() > 0.5 ? materials.upholsteryGold : materials.upholsteryWarm, { collider: true, surface: true, radius: 0.12 });
    } else if (theme === "kitchen") {
      const height = 0.62 + random() * 0.32;
      addBox("KitchenStool", new THREE.Vector3(x, height / 2, z), new THREE.Vector3(width, height, width), materials.woodLight, { collider: true, surface: true, radius: 0.08 });
      addBox("StoolSeat", new THREE.Vector3(x, height + 0.035, z), new THREE.Vector3(width * 1.05, 0.07, width * 1.05), materials.upholstery, { radius: 0.05 });
    } else {
      const height = 0.5 + random() * 0.68;
      addBox("MovingBox", new THREE.Vector3(x, height / 2, z), new THREE.Vector3(width, height, width), materials.cardboard, { collider: true, surface: height < 0.82, radius: 0.055 });
      addBox("BoxTape", new THREE.Vector3(x, height + 0.012, z), new THREE.Vector3(width * 0.18, 0.024, width * 0.96), materials.trim, { castShadow: false, radius: 0.008 });
    }
    placed += 1;
  }
}

function buildLevel(levelIndex, announce = true) {
  clearLevel();
  const definition = LEVELS[levelIndex];
  const random = createLevelRandom(levelIndex);
  const jitter = (amount = 1) => (random() - 0.5) * amount;
  state.level = levelIndex;
  state.levelFoodEaten = 0;
  state.eatingTime = 0;
  state.sitting = false;
  state.forcedAction = null;
  state.actionTime = 0;
  state.transitioning = false;
  buildLevelShell(definition, random);
  createGoal(definition.goal[0], definition.goal[1]);

  if (definition.theme === "living") {
    createJumpBarrier(jitter(1.4), 6.0 + jitter(0.5), 5.4, 0.52, materials.upholsteryGold);
    const platform = createStaticPlatform(-4.2 + jitter(0.5), 1.8, 2.7, 2.7, 0.58);
    createSpill(4.0, -1.9 + jitter(0.4), 4.8, 2.5);
    createMovingPlatform(4.0, -1.9 + jitter(0.4), 1.7, 1.35, 0.36, [1, 0, 0], 1.25, 1.05, random() * Math.PI * 2);
    createRobotVacuum(-3.1 + jitter(0.7), -5.1, 2.7, 1.15, random() * Math.PI * 2);
    createCheckpoint(0, 0.2);
    createFood(-5.4 + jitter(0.7), 8.1, FOOD_LABELS[0]);
    createFood(platform.position.x, platform.position.z, FOOD_LABELS[1], 0.58);
    createFood(6.5 + jitter(0.8), -7.7, FOOD_LABELS[2]);
    addRandomObstacles(random, 7, definition.theme, definition.spawn);
  } else if (definition.theme === "kitchen") {
    createSpill(0, 6.0 + jitter(0.4), 8.6, 2.25);
    createMovingPlatform(0, 6.0, 2.0, 1.4, 0.38, [1, 0, 0], 3.0, 0.78, random() * Math.PI * 2);
    createJumpBarrier(-2.5 + jitter(0.6), 2.4, 4.8, 0.68, materials.woodLight);
    createRobotVacuum(4.1, -0.7 + jitter(0.6), 3.0, -1.45, random() * Math.PI * 2);
    const platform = createStaticPlatform(-4.8, -4.8 + jitter(0.5), 3.0, 2.5, 0.72);
    createMovingPlatform(2.0, -7.4, 2.2, 1.45, 0.42, [0, 1, 0], 0.38, 0.9, random() * Math.PI * 2);
    createCheckpoint(0, -1.8);
    createFood(-6.2, 8.4, FOOD_LABELS[3]);
    createFood(6.1, 3.4, FOOD_LABELS[4]);
    createFood(platform.position.x, platform.position.z, FOOD_LABELS[5], 0.72);
    createFood(4.8, -9.2, FOOD_LABELS[1]);
    addRandomObstacles(random, 9, definition.theme, definition.spawn);
  } else {
    createJumpBarrier(jitter(0.8), 7.5, 7.0, 0.78, materials.upholsteryWarm);
    createSpill(-3.9, 3.9 + jitter(0.5), 5.2, 2.8);
    createMovingPlatform(-3.9, 3.9, 1.8, 1.45, 0.4, [1, 0, 0], 1.45, 1.15, random() * Math.PI * 2);
    const playTable = createStaticPlatform(4.6, 1.3 + jitter(0.4), 3.1, 3.1, 0.78);
    createRobotVacuum(-1.4, -2.0, 3.4, 1.75, random() * Math.PI * 2);
    createSpill(3.2, -5.2, 6.0, 2.8);
    createMovingPlatform(3.2, -5.2, 1.9, 1.5, 0.42, [1, 0, 0], 2.0, 1.25, random() * Math.PI * 2);
    createMovingPlatform(-4.7, -7.7, 2.2, 1.7, 0.5, [0, 1, 0], 0.48, 0.8, random() * Math.PI * 2);
    createCheckpoint(0, -2.8);
    createFood(-6.2, 9.0, FOOD_LABELS[2]);
    createFood(playTable.position.x, playTable.position.z, FOOD_LABELS[5], 0.78);
    createFood(-6.4, -0.8, FOOD_LABELS[0]);
    createFood(6.4, -7.8, FOOD_LABELS[1]);
    createFood(-2.3, -10.0, FOOD_LABELS[6]);
    addRandomObstacles(random, 11, definition.theme, definition.spawn);
  }

  const spawn = new THREE.Vector3(...definition.spawn);
  character.root.position.copy(spawn);
  character.checkpoint.copy(spawn);
  character.velocity.set(0, 0, 0);
  character.verticalVelocity = 0;
  state.grounded = true;
  state.idleTime = 0;
  ui.levelIndex.textContent = String(levelIndex + 1).padStart(2, "0");
  ui.levelName.textContent = definition.name;
  if (announce && state.started) showLevelCard(definition, levelIndex);
}

function createFood(x, z, label, y = 0) {
  const group = new THREE.Group();
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x886247, roughness: 0.55, metalness: 0.08 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.18, 32, 1, true), bowlMat);
  bowl.castShadow = true;
  bowl.position.y = 0.1;
  group.add(bowl);
  const foodMat = new THREE.MeshStandardMaterial({ color: label === "FISH" ? 0x9db6ad : 0xa75e35, roughness: 0.72, emissive: 0x27150c, emissiveIntensity: 0.4 });
  const food = new THREE.Mesh(new THREE.SphereGeometry(0.29, 22, 12), foodMat);
  food.scale.y = 0.32;
  food.position.y = 0.2;
  group.add(food);
  const halo = new THREE.PointLight(0xe7a25d, 2.2, 2.4, 2);
  halo.position.y = 0.65;
  group.add(halo);
  group.position.set(x, y, z);
  levelRoot.add(group);
  foods.push({
    group,
    label,
    active: true,
    baseY: y,
    phase: seededRandom(x + z + state.level * 31) * Math.PI * 2,
    satietyValue: label === "TREAT" ? 9 : 13,
    chonkValue: label === "TREAT" ? 2.2 : 3.5,
  });
}

function addAtmosphere() {
  const hemi = new THREE.HemisphereLight(0xffe2bd, 0x40352d, 1.85);
  scene.add(hemi);
  const windowLight = new THREE.DirectionalLight(0xffd0a0, 2.35);
  windowLight.position.set(-8, 13, 6);
  windowLight.castShadow = true;
  windowLight.shadow.mapSize.set(2048, 2048);
  windowLight.shadow.camera.left = -18;
  windowLight.shadow.camera.right = 18;
  windowLight.shadow.camera.top = 18;
  windowLight.shadow.camera.bottom = -18;
  windowLight.shadow.camera.near = 1;
  windowLight.shadow.camera.far = 45;
  windowLight.shadow.bias = -0.00035;
  scene.add(windowLight);

  const positions = new Float32Array(520 * 3);
  for (let i = 0; i < 520; i += 1) {
    positions[i * 3] = (seededRandom(i + 101) - 0.5) * 30;
    positions[i * 3 + 1] = 0.4 + seededRandom(i + 202) * 5.8;
    positions[i * 3 + 2] = (seededRandom(i + 303) - 0.5) * 27;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xe9d3a9, size: 0.025, transparent: true, opacity: 0.34, depthWrite: false }));
  scene.add(dust);
}

function makeFallbackCat() {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.85 });
  const brown = new THREE.MeshStandardMaterial({ color: 0x753918, roughness: 0.86 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 22), white);
  body.name = "Body";
  body.scale.set(0.7, 0.65, 1.15);
  body.position.y = 0.58;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 22), white);
  head.name = "HeadMass";
  head.position.set(0, 0.86, 0.38);
  group.add(head);
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.75, 8, 16), brown);
  tail.name = "Tail.Mesh";
  tail.rotation.x = Math.PI / 2.7;
  tail.position.set(0, 0.75, -0.65);
  group.add(tail);
  group.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
  return group;
}

function findClip(clips, name) {
  return clips.find((clip) => clip.name === name) || clips.find((clip) => clip.name.startsWith(name));
}

function setAction(name, fade = 0.28) {
  const next = character.actions[name];
  if (!next || next === character.currentAction) return;
  next.enabled = true;
  next.reset().fadeIn(fade).play();
  if (character.currentAction) character.currentAction.fadeOut(fade);
  character.currentAction = next;
}

function triggerAction(name, duration) {
  const next = character.actions[name];
  if (!next || state.transitioning || state.gameComplete) return false;
  state.sitting = false;
  state.forcedAction = name;
  state.actionTime = duration;
  next.enabled = true;
  next.reset().fadeIn(0.12).play();
  if (character.currentAction && character.currentAction !== next) character.currentAction.fadeOut(0.12);
  character.currentAction = next;
  return true;
}

async function loadCat() {
  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      "./assets/models/turkish-van-game-cat.glb",
      (gltf) => {
        character.model = gltf.scene;
        character.model.scale.setScalar(0.92);
        character.model.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            if (obj.material) obj.material.envMapIntensity = 0.55;
          }
        });
        character.root.add(character.model);
        character.triangleCount = countTriangles(character.model);
        applyCoat(state.coat, false);
        character.mixer = new THREE.AnimationMixer(character.model);
        for (const name of ["Idle", "Walk", "Groom", "Jump", "Sit", "Claw", "Bite"]) {
          const clip = findClip(gltf.animations, name);
          if (!clip) continue;
          const action = character.mixer.clipAction(clip);
          if (TRANSIENT_ACTIONS.has(name) || name === "Sit") {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          character.actions[name] = action;
        }
        setAction("Idle", 0);
        resolve();
      },
      (event) => {
        if (event.total) ui.loadStatus.textContent = `Loading cat ${Math.round((event.loaded / event.total) * 100)}%`;
      },
      (error) => {
        console.error("Animated cat failed to load; using fallback.", error);
        character.model = makeFallbackCat();
        character.root.add(character.model);
        character.triangleCount = countTriangles(character.model);
        applyCoat(state.coat, false);
        resolve();
      },
    );
  });
}

function speedMultiplier(satiety, chonk) {
  const hungerCurve = 0.50 + 0.50 * Math.exp(-Math.pow((satiety - 58) / 31, 2));
  const weightCurve = 0.58 + 0.42 * Math.exp(-Math.pow((chonk - 52) / 30, 2));
  return hungerCurve * weightCurve;
}

function jumpProfile() {
  if (state.satiety <= 8) return { allowed: false, impulse: 0, label: "TOO HUNGRY TO LEAP" };
  if (state.chonk >= 90) return { allowed: false, impulse: 0, label: "TOO CHONKY TO LEAP" };
  const fed = THREE.MathUtils.smoothstep(state.satiety, 8, 48);
  const heavyPenalty = 1 - THREE.MathUtils.smoothstep(state.chonk, 58, 90) * 0.54;
  const overfullPenalty = 1 - THREE.MathUtils.smoothstep(state.satiety, 84, 100) * 0.22;
  const impulse = 4.05 + 2.25 * fed * heavyPenalty * overfullPenalty;
  const label = impulse > 5.75 ? "LEAP READY" : impulse > 4.75 ? "SHORT LEAP" : "WEAK LEAP";
  return { allowed: true, impulse, label };
}

function requestJump() {
  if (state.gameComplete || state.transitioning) return;
  state.jumpBuffer = 0.16;
  if (state.sitting) state.sitting = false;
}

function toggleSit() {
  if (!state.grounded || state.transitioning || state.gameComplete || state.forcedAction) return;
  state.sitting = !state.sitting;
  state.idleTime = 0;
  character.velocity.set(0, 0, 0);
  setAction(state.sitting ? "Sit" : "Idle", 0.3);
}

function dampAngle(current, target, smoothing, dt) {
  let delta = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-smoothing * dt));
}

function circleHitsBox(x, z, radius, box) {
  const closestX = THREE.MathUtils.clamp(x, box.minX, box.maxX);
  const closestZ = THREE.MathUtils.clamp(z, box.minZ, box.maxZ);
  return (x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2;
}

function canOccupy(x, z, y = character.root.position.y) {
  if (x < -14.35 || x > 14.35 || z < -12.35 || z > 13.25) return false;
  return !colliders.some((box) => {
    if (!circleHitsBox(x, z, character.radius, box)) return false;
    const clearsTop = y >= box.maxY - 0.055;
    const clearsBottom = y + 1.08 <= box.minY + 0.03;
    return !clearsTop && !clearsBottom;
  });
}

function findSupport(x, z, minY, maxY) {
  let best = null;
  for (const surface of surfaces) {
    const inset = 0.08;
    if (x < surface.minX + inset || x > surface.maxX - inset || z < surface.minZ + inset || z > surface.maxZ - inset) continue;
    if (surface.topY < minY || surface.topY > maxY) continue;
    if (!best || surface.topY > best.topY) best = surface;
  }
  return best;
}

function updateVertical(delta) {
  const position = character.root.position;
  state.jumpBuffer = Math.max(0, state.jumpBuffer - delta);
  state.coyoteTime = state.grounded ? 0.12 : Math.max(0, state.coyoteTime - delta);

  if (state.jumpBuffer > 0 && state.coyoteTime > 0 && !state.forcedAction) {
    const profile = jumpProfile();
    state.jumpBuffer = 0;
    if (profile.allowed) {
      character.verticalVelocity = profile.impulse;
      state.grounded = false;
      state.coyoteTime = 0;
      character.currentPlatform = null;
      state.jumps += 1;
      state.sitting = false;
      setAction("Jump", 0.08);
    } else {
      showToast(profile.label, 2.1);
    }
  }

  if (state.grounded) {
    const support = findSupport(position.x, position.z, position.y - 0.18, position.y + 0.16);
    if (support) {
      position.y = support.topY;
      character.verticalVelocity = 0;
      character.currentPlatform = movingPlatforms.includes(support.owner) ? support.owner : null;
      return;
    }
    state.grounded = false;
    character.currentPlatform = null;
  }

  const previousY = position.y;
  character.verticalVelocity -= GRAVITY * delta;
  const nextY = previousY + character.verticalVelocity * delta;
  if (character.verticalVelocity <= 0) {
    const support = findSupport(position.x, position.z, nextY - 0.08, previousY + 0.06);
    if (support) {
      position.y = support.topY;
      character.verticalVelocity = 0;
      state.grounded = true;
      state.coyoteTime = 0.12;
      character.currentPlatform = movingPlatforms.includes(support.owner) ? support.owner : null;
      return;
    }
  }
  position.y = nextY;
  if (position.y < -2.2) respawnCharacter("Missed the landing");
}

function moveCharacter(delta) {
  const inputX = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const inputZ = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const hasInput = inputX !== 0 || inputZ !== 0;
  if (hasInput && state.sitting) state.sitting = false;
  if (state.actionTime > 0) {
    state.actionTime = Math.max(0, state.actionTime - delta);
    if (state.actionTime === 0) state.forcedAction = null;
  }

  temp.forward.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  temp.right.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  temp.desired.set(0, 0, 0);
  const movementLocked = state.sitting || state.transitioning || state.gameComplete || (state.forcedAction && state.forcedAction !== "Jump");
  if (hasInput && !movementLocked) {
    temp.desired.addScaledVector(temp.forward, inputZ).addScaledVector(temp.right, inputX).normalize();
  }

  const trotting = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const maxSpeed = (trotting ? 4.5 : 2.85) * speedMultiplier(state.satiety, state.chonk);
  temp.targetVelocity.copy(temp.desired).multiplyScalar(maxSpeed);
  const response = hasInput ? 7.2 : 10.5;
  character.velocity.lerp(temp.targetVelocity, 1 - Math.exp(-response * delta));
  if (character.velocity.lengthSq() < 0.0008) character.velocity.set(0, 0, 0);

  const current = character.root.position;
  const nextX = current.x + character.velocity.x * delta;
  if (canOccupy(nextX, current.z, current.y)) current.x = nextX;
  else character.velocity.x = 0;
  const nextZ = current.z + character.velocity.z * delta;
  if (canOccupy(current.x, nextZ, current.y)) current.z = nextZ;
  else character.velocity.z = 0;

  updateVertical(delta);

  const actualSpeed = character.velocity.length();
  if (actualSpeed > 0.06) {
    const targetHeading = Math.atan2(character.velocity.x, character.velocity.z);
    character.heading = dampAngle(character.heading, targetHeading, trotting ? 12 : 9, delta);
    character.root.rotation.y = character.heading;
    state.idleTime = 0;
    state.satiety = Math.max(0, state.satiety - delta * (trotting ? 0.13 : 0.075));
    state.chonk = Math.max(26, state.chonk - delta * actualSpeed * 0.0016);
  } else {
    state.idleTime += delta;
  }

  if (!state.grounded) {
    setAction("Jump", 0.08);
  } else if (state.forcedAction) {
    setAction(state.forcedAction, 0.1);
  } else if (state.sitting) {
    setAction("Sit", 0.3);
  } else if (actualSpeed > 0.06) {
    setAction("Walk", 0.2);
    if (character.currentAction) character.currentAction.timeScale = THREE.MathUtils.clamp(actualSpeed / 2.15, 0.72, 1.75);
  } else if (state.idleTime > 5 && character.actions.Groom) {
    setAction("Groom", 0.55);
    if (character.currentAction) character.currentAction.timeScale = 1;
  } else {
    setAction("Idle", 0.4);
    if (character.currentAction) character.currentAction.timeScale = 1;
  }

  return actualSpeed;
}

function updateFood(delta, speed) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const food of foods) {
    if (!food.active) continue;
    food.group.position.y = food.baseY + 0.015 + Math.sin(performance.now() * 0.0018 + food.phase) * 0.012;
    const distance = food.group.position.distanceTo(character.root.position);
    if (distance < nearestDistance) {
      nearest = food;
      nearestDistance = distance;
    }
  }

  ui.prompt.textContent = nearest && nearestDistance < 2.1 ? `${nearest.label}  ·  MOVE CLOSER` : "";
  const wrongHeight = nearest && Math.abs(nearest.baseY - character.root.position.y) > 0.34;
  if (!nearest || nearestDistance > 0.88 || wrongHeight || speed > 0.7 || !state.grounded) {
    state.eatingTime = 0;
    return;
  }

  ui.prompt.textContent = `EATING ${nearest.label}`;
  if (state.eatingTime === 0) triggerAction("Bite", 0.72);
  state.eatingTime += delta;
  state.satiety = Math.min(100, state.satiety + delta * (nearest.satietyValue / 1.25));
  nearest.group.scale.lerp(new THREE.Vector3(0.12, 0.12, 0.12), 1 - Math.exp(-4 * delta));
  if (state.eatingTime >= 1.25) {
    nearest.active = false;
    nearest.group.visible = false;
    state.eaten += 1;
    state.levelFoodEaten += 1;
    state.chonk = Math.min(100, state.chonk + nearest.chonkValue);
    state.xp += 25;
    state.eatingTime = 0;
    showToast(`${nearest.label.toLowerCase()} secured · +25 XP`, 2.8);
  }
}

function updateMovingPlatforms(elapsed) {
  for (const platform of movingPlatforms) {
    platform.previous.copy(platform.mesh.position);
    const offset = Math.sin(elapsed * platform.speed + platform.phase) * platform.amplitude;
    platform.mesh.position.copy(platform.base).addScaledVector(platform.axis, offset);
    const movement = platform.mesh.position.clone().sub(platform.previous);
    if (character.currentPlatform === platform && state.grounded) character.root.position.add(movement);
    const { x, y, z } = platform.mesh.position;
    Object.assign(platform.collider, {
      minX: x - platform.halfWidth,
      maxX: x + platform.halfWidth,
      minZ: z - platform.halfDepth,
      maxZ: z + platform.halfDepth,
      minY: y - platform.halfHeight,
      maxY: y + platform.halfHeight,
    });
    Object.assign(platform.surface, {
      minX: x - platform.halfWidth,
      maxX: x + platform.halfWidth,
      minZ: z - platform.halfDepth,
      maxZ: z + platform.halfDepth,
      topY: y + platform.halfHeight,
    });
  }
}

function pointSegmentDistance2D(px, pz, ax, az, bx, bz) {
  const abX = bx - ax;
  const abZ = bz - az;
  const lengthSquared = abX * abX + abZ * abZ || 1;
  const amount = THREE.MathUtils.clamp(((px - ax) * abX + (pz - az) * abZ) / lengthSquared, 0, 1);
  const dx = px - (ax + abX * amount);
  const dz = pz - (az + abZ * amount);
  return Math.hypot(dx, dz);
}

function respawnCharacter(reason) {
  if (state.invulnerable > 0 || state.transitioning || state.gameComplete) return;
  character.root.position.copy(character.checkpoint);
  character.velocity.set(0, 0, 0);
  character.verticalVelocity = 0;
  character.currentPlatform = null;
  state.grounded = true;
  state.sitting = false;
  state.forcedAction = null;
  state.actionTime = 0;
  state.invulnerable = 1.25;
  state.bonks += 1;
  state.satiety = Math.max(0, state.satiety - 0.8);
  setAction("Idle", 0.08);
  showToast(`${reason}. Back to the last scent marker.`, 2.7);
}

function updateHazards(delta, elapsed) {
  state.invulnerable = Math.max(0, state.invulnerable - delta);
  for (const hazard of hazards) {
    if (hazard.type === "spill") {
      const { x, y, z } = character.root.position;
      if (x > hazard.minX && x < hazard.maxX && z > hazard.minZ && z < hazard.maxZ && y < hazard.safeY) {
        respawnCharacter("Wet paws");
      }
      continue;
    }
    if (hazard.type === "vacuum") {
      const angle = elapsed * hazard.speed + hazard.phase;
      hazard.group.rotation.y = angle;
      if (character.root.position.y > hazard.maxY) continue;
      const ax = hazard.group.position.x;
      const az = hazard.group.position.z;
      const bx = ax + Math.cos(angle) * hazard.length;
      const bz = az - Math.sin(angle) * hazard.length;
      if (pointSegmentDistance2D(character.root.position.x, character.root.position.z, ax, az, bx, bz) < character.radius + hazard.radius) {
        respawnCharacter("The robot vacuum bumped you");
      }
    }
  }
}

function updateCheckpoints(elapsed) {
  for (const checkpoint of checkpointMarkers) {
    checkpoint.group.rotation.y = elapsed * 0.35;
    checkpoint.group.position.y = 0.03 + Math.sin(elapsed * 2.2 + checkpoint.phase) * 0.02;
    if (!checkpoint.active) continue;
    const dx = character.root.position.x - checkpoint.position.x;
    const dz = character.root.position.z - checkpoint.position.z;
    if (dx * dx + dz * dz < 0.9) {
      checkpoint.active = false;
      checkpoint.group.scale.setScalar(0.68);
      character.checkpoint.copy(checkpoint.position);
      state.xp += 15;
      showToast("Scent marker found · checkpoint saved · +15 XP", 3.0);
    }
  }
}

function showLevelCard(definition, index) {
  clearTimeout(transitionTimer);
  state.transitioning = true;
  ui.transitionKicker.textContent = `Level ${String(index + 1).padStart(2, "0")} of 03`;
  ui.transitionTitle.textContent = definition.name;
  ui.transitionCopy.textContent = definition.description;
  ui.transition.classList.remove("is-hidden");
  transitionTimer = setTimeout(() => {
    ui.transition.classList.add("is-hidden");
    state.transitioning = false;
  }, 1900);
}

function finishGame() {
  clearTimeout(transitionTimer);
  state.transitioning = true;
  state.gameComplete = true;
  state.started = false;
  ui.transitionKicker.textContent = "";
  ui.transitionTitle.textContent = "";
  ui.transitionCopy.textContent = "";
  ui.transition.classList.add("is-hidden");
  ui.hud.classList.add("is-hidden");
  ui.completion.classList.remove("is-hidden");
  const seconds = Math.max(1, Math.round((performance.now() - state.runStartedAt) / 1000));
  ui.completionStats.textContent = `${state.xp} XP · ${state.eaten} meals · ${state.jumps} jumps · ${state.bonks} bonks · ${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  document.exitPointerLock?.();
}

function completeLevel() {
  if (state.transitioning || state.gameComplete) return;
  state.transitioning = true;
  character.velocity.set(0, 0, 0);
  state.xp += 100;
  state.chonk = Math.max(28, state.chonk - 2.5);
  const definition = LEVELS[state.level];
  ui.transitionKicker.textContent = "Room clear · +100 XP";
  ui.transitionTitle.textContent = definition.name;
  ui.transitionCopy.textContent = state.level === LEVELS.length - 1 ? "The whole house belongs to its champion." : "Catching your breath before the next room.";
  ui.transition.classList.remove("is-hidden");
  transitionTimer = setTimeout(() => {
    if (state.level === LEVELS.length - 1) {
      finishGame();
      return;
    }
    const nextLevel = state.level + 1;
    buildLevel(nextLevel, false);
    showLevelCard(LEVELS[nextLevel], nextLevel);
  }, 1250);
}

function updateGoal(delta, elapsed) {
  if (!activeGoal) return;
  const allFoodFound = foods.every((food) => !food.active);
  if (allFoodFound && !activeGoal.active) {
    activeGoal.active = true;
    activeGoal.light.intensity = 8;
    showToast("Room searched. Reach the glowing pet door.", 3.2);
  }
  const pulse = 1 + Math.sin(elapsed * 2.8) * (activeGoal.active ? 0.055 : 0.015);
  activeGoal.marker.scale.set(pulse, pulse, 1);
  if (!activeGoal.active) return;
  const dx = character.root.position.x - activeGoal.position.x;
  const dz = character.root.position.z - activeGoal.position.z;
  if (dx * dx + dz * dz < 1.35 && character.root.position.y < 0.7) completeLevel();
}

function restartRun() {
  state.runSeed = Math.floor(Math.random() * 900000) + 100000;
  state.satiety = 62;
  state.chonk = 48;
  state.xp = 0;
  state.eaten = 0;
  state.jumps = 0;
  state.bonks = 0;
  state.gameComplete = false;
  state.started = true;
  state.runStartedAt = performance.now();
  ui.completion.classList.add("is-hidden");
  ui.hud.classList.remove("is-hidden");
  buildLevel(0, false);
  showLevelCard(LEVELS[0], 0);
  canvas.requestPointerLock?.();
}

function updateCamera(delta) {
  temp.cameraTarget.copy(character.root.position);
  temp.cameraTarget.y += 0.82;
  temp.cameraTarget.addScaledVector(character.velocity, 0.08);

  const distance = 4.8;
  const horizontal = Math.cos(state.pitch) * distance;
  temp.cameraDesired.set(
    temp.cameraTarget.x + Math.sin(state.yaw) * horizontal,
    temp.cameraTarget.y + 0.45 + Math.sin(state.pitch) * distance,
    temp.cameraTarget.z + Math.cos(state.yaw) * horizontal,
  );

  temp.rayDirection.copy(temp.cameraDesired).sub(temp.cameraTarget);
  const desiredDistance = temp.rayDirection.length();
  temp.rayDirection.normalize();
  const raycaster = updateCamera.raycaster || (updateCamera.raycaster = new THREE.Raycaster());
  raycaster.set(temp.cameraTarget, temp.rayDirection);
  raycaster.far = desiredDistance;
  const hits = raycaster.intersectObjects(cameraOccluders, false);
  if (hits.length) {
    const safeDistance = Math.max(1.25, hits[0].distance - 0.24);
    temp.cameraDesired.copy(temp.cameraTarget).addScaledVector(temp.rayDirection, safeDistance);
  }

  camera.position.lerp(temp.cameraDesired, 1 - Math.exp(-9.5 * delta));
  camera.lookAt(temp.cameraTarget);
}

function updateAtmosphere(delta, elapsed) {
  if (dust) {
    dust.rotation.y += delta * 0.012;
    dust.position.y = Math.sin(elapsed * 0.13) * 0.06;
  }
  for (const plant of animatedPlants) plant.mesh.rotation.z = plant.base + Math.sin(elapsed * 0.7 + plant.phase) * 0.014;
  for (const lamp of lamps) lamp.light.intensity = 18 + Math.sin(elapsed * 7 + lamp.phase) * 0.35 + Math.sin(elapsed * 17 + lamp.phase) * 0.16;
}

function updateHud(speed) {
  ui.satiety.textContent = Math.round(state.satiety);
  ui.satietyFill.style.width = `${state.satiety}%`;
  ui.chonk.textContent = Math.round(state.chonk);
  ui.chonkFill.style.width = `${state.chonk}%`;
  const profile = jumpProfile();
  const pace = state.satiety < 20
    ? "HUNGRY · LOW POWER"
    : state.chonk > 82
      ? "HEAVY · SHORT STRIDE"
      : state.satiety > 88
        ? "FULL · STEADY"
        : "BALANCED PACE";
  ui.pace.textContent = pace;
  ui.condition.textContent = !profile.allowed ? "LIMITED" : profile.impulse > 5.7 ? "OPTIMAL" : "MANAGING";
  ui.jumpReadiness.textContent = profile.label;
  ui.jumpReadiness.style.color = profile.allowed ? "#b9d6b8" : "#e48b6f";
  ui.state.textContent = !state.grounded
    ? "AIRBORNE"
    : state.forcedAction === "Claw"
      ? "CLAWING"
      : state.forcedAction === "Bite"
        ? "BITING"
        : state.sitting
          ? "SITTING"
          : speed > 3
            ? "TROTTING"
            : speed > 0.12
              ? "ROAMING"
              : state.idleTime > 5
                ? "GROOMING"
                : "CURIOUS";
  const left = foods.filter((food) => food.active).length;
  ui.objective.textContent = left ? `Find supper · ${left} scents remain` : "Reach the glowing pet door";
  ui.levelProgress.textContent = `LEVEL ${state.level + 1} OF ${LEVELS.length} · XP ${state.xp}`;
}

function showToast(text, duration = 3.4) {
  ui.toast.textContent = text;
  ui.toast.classList.add("is-visible");
  state.toastTime = duration;
}

function updateToast(delta) {
  if (state.toastTime <= 0) return;
  state.toastTime -= delta;
  if (state.toastTime <= 0) ui.toast.classList.remove("is-visible");
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;
  let speed = 0;
  updateMovingPlatforms(elapsed);
  if (state.started) {
    speed = moveCharacter(delta);
    updateFood(delta, speed);
    updateHazards(delta, elapsed);
    updateCheckpoints(elapsed);
    updateGoal(delta, elapsed);
  }
  if (character.mixer) character.mixer.update(delta);
  updateCamera(delta);
  updateAtmosphere(delta, elapsed);
  updateHud(speed);
  updateToast(delta);
  composer.render();
}

function setupInput() {
  addEventListener("keydown", (event) => {
    keys.add(event.code);
    if (event.code === "KeyC" && !event.repeat) {
      cycleCoat();
      event.preventDefault();
    }
    if (state.started && !event.repeat) {
      if (event.code === "Space") requestJump();
      if (event.code === "KeyQ") toggleSit();
      if (event.code === "KeyF") triggerAction("Claw", 0.85);
      if (event.code === "KeyE") triggerAction("Bite", 0.72);
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  });
  addEventListener("keyup", (event) => keys.delete(event.code));
  addEventListener("blur", () => keys.clear());

  document.addEventListener("pointerlockchange", () => {
    state.pointerLocked = document.pointerLockElement === canvas;
    if (state.started) ui.prompt.textContent = state.pointerLocked ? "" : "CLICK TO RESUME CAMERA";
  });
  document.addEventListener("mousemove", (event) => {
    if (!state.pointerLocked) return;
    state.yaw -= event.movementX * 0.00235;
    state.pitch = THREE.MathUtils.clamp(state.pitch + event.movementY * 0.00175, 0.08, 0.62);
  });
  canvas.addEventListener("click", () => {
    if (state.started && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  canvas.addEventListener("mousedown", (event) => {
    if (!state.started || document.pointerLockElement !== canvas) return;
    if (event.button === 0) triggerAction("Claw", 0.85);
    if (event.button === 2) triggerAction("Bite", 0.72);
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}

async function init() {
  buildSky();
  buildLevel(0, false);
  addAtmosphere();
  setupCoatControls();
  setupInput();
  camera.position.set(0, 2.2, 12);
  camera.lookAt(0, 0.8, 7);
  await loadCat();
  state.ready = true;
  ui.enter.disabled = false;
  ui.loadStatus.textContent = `${Math.round(character.triangleCount / 1000)}K-triangle cat · 3 generated levels · 7 actions`;
  ui.enter.addEventListener("click", () => {
    state.started = true;
    state.runStartedAt = performance.now();
    ui.boot.classList.add("is-gone");
    ui.hud.classList.remove("is-hidden");
    canvas.requestPointerLock?.();
    showLevelCard(LEVELS[0], 0);
  }, { once: true });
  ui.restart.addEventListener("click", restartRun);
  renderer.setAnimationLoop(animate);
}

addEventListener("resize", resize);
window.__megaChonk = {
  state,
  character,
  start: () => ui.enter.click(),
  aimAt: (x, z) => {
    const dx = x - character.root.position.x;
    const dz = z - character.root.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.0001) state.yaw = Math.atan2(-dx, -dz);
    return state.yaw;
  },
  setCoat: (style) => applyCoat(style),
  loadLevel: (index) => buildLevel(THREE.MathUtils.clamp(Math.round(index), 0, LEVELS.length - 1), false),
  setCondition: (satiety, chonk) => {
    state.satiety = THREE.MathUtils.clamp(satiety, 0, 100);
    state.chonk = THREE.MathUtils.clamp(chonk, 0, 100);
  },
  regenerate: (seed = Math.floor(Math.random() * 900000) + 100000) => {
    state.runSeed = seed;
    buildLevel(state.level, false);
  },
  completeLevel: () => {
    for (const food of foods) {
      food.active = false;
      food.group.visible = false;
    }
    if (activeGoal) activeGoal.active = true;
    completeLevel();
  },
  restart: restartRun,
  navigation: () => ({
    level: state.level,
    transitioning: state.transitioning,
    gameComplete: state.gameComplete,
    grounded: state.grounded,
    bonks: state.bonks,
    jumps: state.jumps,
    satiety: state.satiety,
    chonk: state.chonk,
    position: character.root.position.toArray(),
    checkpoint: character.checkpoint.toArray(),
    foods: foods
      .map((food, index) => ({
        index,
        label: food.label,
        active: food.active,
        position: [food.group.position.x, food.baseY, food.group.position.z],
      }))
      .filter((food) => food.active),
    goal: activeGoal
      ? { active: activeGoal.active, position: activeGoal.position.toArray() }
      : null,
    colliders: colliders.map((box) => ({
      minX: box.minX,
      maxX: box.maxX,
      minZ: box.minZ,
      maxZ: box.maxZ,
      minY: box.minY,
      maxY: box.maxY,
      name: box.owner?.name ?? "Collider",
    })),
    hazards: hazards.map((hazard) => (hazard.type === "spill"
      ? {
          type: hazard.type,
          minX: hazard.minX,
          maxX: hazard.maxX,
          minZ: hazard.minZ,
          maxZ: hazard.maxZ,
        }
      : {
          type: hazard.type,
          x: hazard.group.position.x,
          z: hazard.group.position.z,
          length: hazard.length,
        })),
  }),
  snapshot: () => ({
    position: character.root.position.toArray(),
    satiety: state.satiety,
    chonk: state.chonk,
    eaten: state.eaten,
    coat: state.coat,
    triangles: character.triangleCount,
    level: state.level,
    xp: state.xp,
    grounded: state.grounded,
    sitting: state.sitting,
    forcedAction: state.forcedAction,
    jumpAllowed: jumpProfile().allowed,
    jumpImpulse: Number(jumpProfile().impulse.toFixed(3)),
    foodsRemaining: foods.filter((food) => food.active).length,
    runSeed: state.runSeed,
    layoutSignature: colliders.slice(-6).map((box) => `${box.minX.toFixed(2)},${box.minZ.toFixed(2)}`).join("|"),
    levelObjects: levelRoot.children.length,
    colliders: colliders.length,
    movingPlatforms: movingPlatforms.length,
    hazards: hazards.length,
    availableActions: Object.keys(character.actions).sort(),
    activeAnimation: character.currentAction?._clip?.name ?? null,
  }),
};
init().catch((error) => {
  console.error(error);
  ui.loadStatus.textContent = "Mega Chonk failed to load. Check the console.";
});
