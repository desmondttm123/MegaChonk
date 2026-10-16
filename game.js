import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { footprint, generateCourse } from "./course-generator.js";
import { MouseLookController } from "./camera-controls.js";
import { TouchControls } from "./touch-controls.js";

const CAT_SCALE = 0.84;
const CAT_BODY_HEIGHT = 0.76;
const FOOD_SCALE = 0.70;
const HOUSE = { width: 46, depth: 42, height: 7.2 };
const WORLD_BOUNDS = { minX: -21.5, maxX: 21.5, minZ: -19.3, maxZ: 19.3 };
const COARSE_POINTER = matchMedia("(pointer: coarse)").matches;
let touchControls = null;

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
  boost: document.querySelector("#boost-status"),
  prompt: document.querySelector("#prompt"),
  toast: document.querySelector("#toast"),
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
renderer.setPixelRatio(Math.min(devicePixelRatio, COARSE_POINTER ? 1.25 : 1.8));
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
const mouseLook = new MouseLookController();
const cameraRig = { distance: null, desiredDistance: 3.35, obstructed: false };
const colliders = [];
const surfaces = [];
const cameraOccluders = [];
const lamps = [];
const foods = [];
const animatedPlants = [];
const movingPlatforms = [];
const hazards = [];
const checkpointMarkers = [];
const verticalRoutes = [];
const worldSigns = [];
let generatedCourse = null;
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
  pitch: 0.20,
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
  catnipTime: 0,
};

const character = {
  root: new THREE.Group(),
  model: null,
  mixer: null,
  shadow: null,
  actions: {},
  currentAction: null,
  velocity: new THREE.Vector3(),
  heading: Math.PI,
  radius: 0.24,
  triangleCount: 0,
  clipCount: 0,
  skinnedMeshCount: 0,
  visualMode: "loading",
  verticalVelocity: 0,
  currentPlatform: null,
  checkpoint: new THREE.Vector3(0, 0, 7.2),
};
character.root.position.set(0, 0, 7.2);
character.root.rotation.y = character.heading;
scene.add(character.root);

let dust;

const CAT_ACTIONS = ["Idle", "Walk", "Groom", "Jump", "Sit", "Claw", "Bite"];
const MOVEMENT_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];
const GRAVITY = 15.8;
const CATNIP_DURATION = 18;
const CATNIP_SPEED = 1.32;
const CATNIP_LEAP = 1.18;
const STEP_HEIGHT = 0.18;
const LEVELS = [
  {
    name: "Living Room Zoomies",
    description: "Raid the bowls upstairs. Follow the oak stairs, then try the catnip balcony leap.",
    foods: 3,
    spawn: [0, 0, 15.2],
    goal: [0, -18.4],
    theme: "living",
  },
  {
    name: "Kitchen Counter Caper",
    description: "Cross the spills and climb to the pantry loft. Catnip opens a longer shelf jump.",
    foods: 4,
    spawn: [0, 0, 15.2],
    goal: [0, -18.4],
    theme: "kitchen",
  },
  {
    name: "Attic Midnight Run",
    description: "Search the playroom and upper gallery. Take the stairs or leap between high perches.",
    foods: 5,
    spawn: [0, 0, 15.2],
    goal: [0, -18.4],
    theme: "attic",
  },
];
const FOOD_LABELS = ["KIBBLE", "FISH", "SARDINES", "TREAT", "SUPPER", "CHICKEN", "TUNA"];
let activeGoal = null;
let transitionTimer = null;
let eatingTarget = null;

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

const textures = {
  woodFloor: makeTexture("woodFloor"),
  tile: makeTexture("tile"),
  carpet: makeTexture("carpet"),
  wallpaper: makeTexture("wallpaper"),
};
textures.woodFloor.repeat.set(7, 12);
textures.tile.repeat.set(7, 7);
textures.carpet.repeat.set(11, 10);
textures.wallpaper.repeat.set(7, 2.4);

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
  const raised = z < -3;
  const offset = raised ? 0.8 : 0;
  const cordBottom = 4.79 + offset;
  addCylinder("PendantCord", x, (HOUSE.height + cordBottom) / 2, z, 0.022, 0.022, HOUSE.height - cordBottom, materials.metal, 12);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.5, 0.34, 28, 1, true), materials.woodLight);
  shade.position.set(x, 4.62 + offset, z);
  shade.castShadow = true;
  levelRoot.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), materials.glow);
  bulb.position.set(x, 4.47 + offset, z);
  levelRoot.add(bulb);
  const light = new THREE.PointLight(color, 18, 10.5, 1.65);
  light.position.set(x, 4.3 + offset, z);
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
    child.traverse((object) => {
      object.geometry?.dispose?.();
      if (child.userData.ownsMaterials) {
        const owned = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of owned) {
          material?.map?.dispose();
          material?.dispose();
        }
      }
    });
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
  verticalRoutes.length = 0;
  worldSigns.length = 0;
  generatedCourse = null;
  eatingTarget = null;
  activeGoal = null;
  character.currentPlatform = null;
}

function buildLevelShell(definition, random) {
  const floorMaterial = definition.theme === "living"
    ? materials.floorWood
    : definition.theme === "kitchen"
      ? materials.floorTile
      : materials.floorCarpet;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HOUSE.width, HOUSE.depth), floorMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  levelRoot.add(ground);
  addSurface(0, 0, HOUSE.width, HOUSE.depth, 0, ground);

  const wallMaterial = definition.theme === "living"
    ? materials.wallpaperSage
    : definition.theme === "kitchen"
      ? materials.wallpaperCream
      : materials.wallpaperAttic;
  addBox("BackWall", new THREE.Vector3(0, HOUSE.height / 2, -20.35), new THREE.Vector3(45, HOUSE.height, 0.9), wallMaterial, { collider: true, occluder: true, radius: 0.08 });
  for (const x of [-22.25, 22.25]) addBox("SideWall", new THREE.Vector3(x, HOUSE.height / 2, 0), new THREE.Vector3(0.9, HOUSE.height, 41.5), wallMaterial, { collider: true, occluder: true, radius: 0.08 });
  for (const x of [-12.8, 12.8]) addBox("EntryWall", new THREE.Vector3(x, HOUSE.height / 2, 20.35), new THREE.Vector3(19, HOUSE.height, 0.8), wallMaterial, { collider: true, occluder: true });
  addBox("Ceiling", new THREE.Vector3(0, HOUSE.height, 0), new THREE.Vector3(45, 0.16, 41.5), materials.ceiling, { radius: 0.04 });
  for (const x of [-21.74, 21.74]) addBox("Baseboard", new THREE.Vector3(x, 0.15, 0), new THREE.Vector3(0.12, 0.3, 40), materials.trim, { radius: 0.025 });
  addBox("BackBaseboard", new THREE.Vector3(0, 0.15, -19.86), new THREE.Vector3(43.5, 0.3, 0.12), materials.trim, { radius: 0.025 });

  for (const x of [-15, -7.5, 7.5, 15]) addWindow(x, 3.6, -19.84, 3.8, 2.5);
  for (const x of [-12, 0, 12]) for (const z of [-13, 1, 13]) addCeilingLight(x, z, definition.theme === "attic" ? 0xffb66e : 0xffd19c);

  if (definition.theme === "living") {
    addRug(0, 1.3, 11.2, 7.0, materials.upholsteryWarm);
    addCouch(-17.7, 5.4, materials.upholstery);
    addCouch(17.4, -6.6, materials.upholsteryWarm);
    addBookcase(19.2, 12.9, 2.75);
    addBookcase(-19.2, -14.8, 2.45);
    addHousePlant(-18.6, -3.8, 1.15);
    addHousePlant(18.2, 5.7, 1.12);
    addRug(-16.8, 4.2, 7.0, 5.0, materials.upholstery);
    addRug(16.8, -7.8, 7.0, 5.0, materials.upholsteryWarm);
    addBox("CoffeeTable", new THREE.Vector3(15.7, 0.34, 11.4), new THREE.Vector3(2.8, 0.68, 1.55), materials.woodLight, { collider: true, surface: true, radius: 0.13 });
  }

  if (definition.theme === "kitchen") {
    for (const side of [-1, 1]) {
      for (const z of [12.0, 4.4, -5.4, -14]) addKitchenCounter(side * (18.6 + random() * 0.35), z, 3.5);
    }
    addBox("Refrigerator", new THREE.Vector3(-19.0, 1.25, -17.2), new THREE.Vector3(2.15, 2.5, 1.8), materials.metal, { collider: true, occluder: true, radius: 0.11 });
    addBox("DiningTable", new THREE.Vector3(13.1, 0.72, 14.0), new THREE.Vector3(3.8, 0.18, 2.4), materials.woodLight, { collider: true, surface: true, radius: 0.08 });
    for (const x of [11.8, 14.4]) addBox("DiningChair", new THREE.Vector3(x, 0.46, 12.45), new THREE.Vector3(0.82, 0.92, 0.82), materials.wood, { collider: true, radius: 0.08 });
    addHousePlant(-19.8, 16.2, 1.08);
  }

  if (definition.theme === "attic") {
    addRug(0, 2.2, 10.4, 6.4, materials.upholsteryGold);
    for (const z of [15, 8.0, 0.8, -7.5, -16.2]) {
      addStorageStack(-19.5 + random() * 0.5, z, random);
      addStorageStack(19.5 - random() * 0.5, z + (random() - 0.5) * 0.7, random);
    }
    for (const z of [14.5, 5.5, -4.5, -14]) addBox("AtticBeam", new THREE.Vector3(0, 6.65, z), new THREE.Vector3(44, 0.3, 0.32), materials.wood, { radius: 0.05 });
    addCatTree(16.1, 5.7);
    addHousePlant(-16.3, -7.0, 1.02);
  }
}

function createJumpBarrier(x, z, width, height, material = materials.upholsteryWarm) {
  const barrier = addBox("CushionHurdle", new THREE.Vector3(x, height / 2, z), new THREE.Vector3(width, height, 0.4), material, { collider: true, surface: true, radius: 0.11 });
  const marker = addBox("CushionPiping", new THREE.Vector3(x, height + 0.015, z), new THREE.Vector3(width * 0.92, 0.035, 0.42), materials.trim, { castShadow: false, radius: 0.015 });
  marker.userData.decorative = true;
  return barrier;
}

function createStaticPlatform(x, z, width, depth, height) {
  const ottoman = addBox("OttomanPlatform", new THREE.Vector3(x, height / 2, z), new THREE.Vector3(width, height, depth), materials.upholsteryGold, { collider: true, surface: true, occluder: true, radius: 0.16 });
  addBox("OttomanTop", new THREE.Vector3(x, height + 0.035, z), new THREE.Vector3(width * 0.92, 0.07, depth * 0.9), materials.upholsteryWarm, { radius: 0.08 });
  return ottoman;
}

function addWorldSign(text, x, y, z, color = "#ead6a9") {
  const label = document.createElement("canvas");
  label.width = 512;
  label.height = 128;
  const context = label.getContext("2d");
  context.fillStyle = "rgba(32, 39, 30, 0.88)";
  context.fillRect(0, 0, 512, 128);
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.strokeRect(5, 5, 502, 118);
  context.fillStyle = color;
  context.font = "bold 29px Georgia";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 65);
  const texture = new THREE.CanvasTexture(label);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true }));
  sign.position.set(x, y, z);
  sign.scale.set(2.35, 0.59, 1);
  sign.userData.ownsMaterials = true;
  worldSigns.push(sign);
  levelRoot.add(sign);
  return sign;
}

function buildVerticalRoute(definition) {
  const height = 2.7;
  const stairX = -7.5;
  const deck = addBox("UpstairsGallery", new THREE.Vector3(0, height - 0.12, -10.2), new THREE.Vector3(18, 0.24, 4.8), materials.floorWood, { collider: true, surface: true, occluder: true, radius: 0.035 });
  deck.userData.collider.stepUp = true;
  deck.userData.surface.inset = 0;
  for (const x of [-8.65, 0, 8.65]) {
    addBox("GallerySupport", new THREE.Vector3(x, 1.25, -11.8), new THREE.Vector3(0.18, 2.5, 0.18), materials.wood, { collider: true, radius: 0.025 });
  }
  for (let step = 0; step < 18; step += 1) {
    const top = (step + 1) * 0.15;
    const z = -0.45 - step * 0.42;
    const tread = addBox("OakStair", new THREE.Vector3(stairX, top / 2, z), new THREE.Vector3(2.2, top, 0.43), materials.woodLight, { collider: true, surface: true, radius: 0.016 });
    tread.userData.collider.stepUp = true;
    tread.userData.surface.inset = 0;
    addBox("StairRunner", new THREE.Vector3(stairX, top + 0.004, z), new THREE.Vector3(1.32, 0.008, 0.39), materials.upholstery, { castShadow: false, radius: 0.004 });
    if (step % 3 === 0) {
      for (const x of [stairX - 1.18, stairX + 1.18]) {
        addBox("StairBaluster", new THREE.Vector3(x, top + 0.37, z), new THREE.Vector3(0.055, 0.74, 0.055), materials.trim, { radius: 0.012 });
      }
    }
  }
  for (const x of [stairX - 1.18, stairX + 1.18]) {
    const rail = addBox("StairHandrail", new THREE.Vector3(x, 2.14, -4.0), new THREE.Vector3(0.09, 0.09, 8.0), materials.wood, { radius: 0.025 });
    rail.rotation.x = Math.atan(0.15 / 0.42);
  }
  // Leave openings for the stairs and the marked long-jump launch lane.
  for (const [x, width] of [[-1.25, 9.8], [7.3, 3.3]]) {
    addBox("GalleryGuardrail", new THREE.Vector3(x, height + 0.64, -7.84), new THREE.Vector3(width, 0.08, 0.08), materials.wood, { radius: 0.025 });
    addBox("GallerySafetyRail", new THREE.Vector3(x, height + 0.31, -7.84), new THREE.Vector3(width, 0.62, 0.07), materials.trim, { collider: true, radius: 0.02 });
    for (let offset = -width / 2; offset < width / 2; offset += 0.72) {
      addBox("GalleryBaluster", new THREE.Vector3(x + offset, height + 0.32, -7.84), new THREE.Vector3(0.04, 0.64, 0.04), materials.wood, { radius: 0.01 });
    }
  }
  const rug = addBox("UpstairsRunner", new THREE.Vector3(-1.5, height + 0.006, -10.3), new THREE.Vector3(7.6, 0.012, 2.5), materials.upholsteryWarm, { castShadow: false, radius: 0.005 });
  rug.receiveShadow = true;
  addBox("LoftBench", new THREE.Vector3(0, height + 0.22, -12.0), new THREE.Vector3(3.4, 0.44, 0.6), materials.upholsteryGold, { collider: true, surface: true, radius: 0.13 });
  addBox("HighWindowPerch", new THREE.Vector3(4.5, height - 0.10, -2.9), new THREE.Vector3(2.4, 0.2, 2.2), materials.woodLight, { collider: true, surface: true, occluder: true, radius: 0.065 });
  addBox("PerchCushion", new THREE.Vector3(4.5, height + 0.015, -2.9), new THREE.Vector3(2.15, 0.03, 1.95), materials.upholstery, { castShadow: false, radius: 0.015 });
  for (const [x, z, top] of [[8.7, 0.1, 1.95], [8.7, 2.7, 1.20], [8.3, 4.8, 0.55]]) {
    addBox("DescendingCatShelf", new THREE.Vector3(x, top - 0.09, z), new THREE.Vector3(1.9, 0.18, 1.7), materials.woodLight, { collider: true, surface: true, radius: 0.055 });
    addBox("ShelfSupport", new THREE.Vector3(x, (top - 0.18) / 2, z), new THREE.Vector3(0.16, top - 0.18, 0.16), materials.wood, { collider: true, radius: 0.02 });
  }
  addWorldSign("UPSTAIRS / OAK STAIRS", stairX, 1.15, 0.60);
  addWorldSign("CATNIP / TROT + LEAP", 4.5, height + 1.15, -8.9, "#bde8ad");
  addWorldSign("BONUS PERCH", 4.5, height + 0.90, -2.9);
  createFood(4.5, -9.0, "CATNIP", height, { required: false, boost: true });
  createFood(4.5, -2.9, "TREAT", height, { required: false, xp: 50 });
  verticalRoutes.push({
    name: `${definition.theme} upstairs`, height,
    stairs: { x: stairX, entry: [stairX, 0, 0.5], top: [stairX, height, -8.5] },
    launch: [4.5, height, -8.25], landing: [4.5, height, -3.5], gap: 3.8,
    deck: { minX: -9, maxX: 9, minZ: -12.6, maxZ: -7.8 },
  });
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

function buildGeneratedCourse(definition, random, difficulty) {
  const jitter = (amount) => (random() - 0.5) * amount;
  const height = 0.58 + difficulty * 0.08;
  const platform = createStaticPlatform(-3.4 + jitter(2.0), 3.2 + jitter(1.5), 2.5, 2.5, height);
  const floorAnchors = [[-5.0, 11.2], [6.0, 7.4], [-12.0, -2.0]];
  for (let index = 0; index < definition.foods - 2; index += 1) {
    const [x, z] = floorAnchors[index];
    createFood(x + jitter(2.4), z + jitter(2.0), FOOD_LABELS[(difficulty + index) % FOOD_LABELS.length]);
  }
  createFood(platform.position.x, platform.position.z, "FISH", height);
  createFood(difficulty === 2 ? -2.3 : 6.1, -10.2, "SUPPER", 2.7);
  createCheckpoint(0, 0.2);

  const targets = [
    ...foods.filter((food) => food.required && food.baseY < 2).map((food) => [food.group.position.x, food.baseY, food.group.position.z]),
    verticalRoutes[0].stairs.entry,
    activeGoal.position.toArray(),
    [0, 0, 0.2],
  ];
  generatedCourse = generateCourse({
    random, difficulty, bounds: WORLD_BOUNDS, boxes: colliders,
    spawn: definition.spawn, targets, bodyHeight: CAT_BODY_HEIGHT,
    protectedAreas: [
      footprint(-7.5, -3.8, 3.8, 11.0),
      footprint(4.5, -5.3, 4.0, 8.5),
      footprint(8.7, 2.4, 4.0, 8.0),
    ],
  });
  for (const obstacle of generatedCourse.obstacles) {
    const { type, x, z, width, depth, height: top, phase } = obstacle;
    if (type === "bridge") {
      createSpill(x, z, width, depth);
      createMovingPlatform(x, z, 1.65, 1.4, top, [1, 0, 0], (width - 1.65) / 2 - 0.1, 0.8 + difficulty * 0.12, phase);
    } else if (type === "vacuum") {
      createRobotVacuum(x, z, obstacle.length, (difficulty % 2 ? -1 : 1) * (1.0 + difficulty * 0.22), phase);
    } else if (type === "hurdle") {
      createJumpBarrier(x, z, width, top, definition.theme === "kitchen" ? materials.woodLight : materials.upholsteryGold);
    } else {
      const style = (obstacle.style + difficulty) % 3;
      const material = [materials.upholsteryWarm, materials.woodLight, materials.cardboard][style];
      addBox(["FloorCushion", "KitchenStool", "MovingBox"][style], new THREE.Vector3(x, top / 2, z), new THREE.Vector3(width, top, depth), material, { collider: true, surface: true, radius: style === 0 ? 0.12 : 0.055 });
      if (style === 2) addBox("BoxTape", new THREE.Vector3(x, top + 0.012, z), new THREE.Vector3(width * 0.18, 0.024, depth * 0.96), materials.trim, { castShadow: false, radius: 0.008 });
      if (style === 1) addBox("StoolSeat", new THREE.Vector3(x, top + 0.025, z), new THREE.Vector3(width, 0.05, depth), materials.upholstery, { radius: 0.025 });
    }
  }
}

function buildLevel(levelIndex, announce = true) {
  clearLevel();
  const definition = LEVELS[levelIndex];
  const random = createLevelRandom(levelIndex);
  state.level = levelIndex;
  state.levelFoodEaten = 0;
  state.eatingTime = 0;
  state.sitting = false;
  state.forcedAction = null;
  state.actionTime = 0;
  state.catnipTime = 0;
  state.transitioning = false;
  buildLevelShell(definition, random);
  buildVerticalRoute(definition);
  createGoal(definition.goal[0], definition.goal[1]);

  buildGeneratedCourse(definition, random, levelIndex);

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

function createFood(x, z, label, y = 0, options = {}) {
  const group = new THREE.Group();
  group.userData.ownsMaterials = true;
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x886247, roughness: 0.55, metalness: 0.08 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.18, 32, 1, true), bowlMat);
  bowl.castShadow = true;
  bowl.position.y = 0.1;
  group.add(bowl);
  const foodMat = new THREE.MeshStandardMaterial({ color: options.boost ? 0x82b458 : label === "FISH" ? 0x9db6ad : 0xa75e35, roughness: 0.72, emissive: options.boost ? 0x346e24 : 0x27150c, emissiveIntensity: 0.4 });
  const food = new THREE.Mesh(new THREE.SphereGeometry(0.29, 22, 12), foodMat);
  food.scale.y = 0.32;
  food.position.y = 0.2;
  group.add(food);
  const halo = new THREE.PointLight(options.boost ? 0xacec83 : 0xe7a25d, 2.2, 2.4, 2);
  halo.position.y = 0.65;
  group.add(halo);
  group.position.set(x, y, z);
  group.scale.setScalar(FOOD_SCALE);
  levelRoot.add(group);
  foods.push({
    group,
    label,
    active: true,
    required: options.required ?? true,
    boost: options.boost ?? false,
    xp: options.xp ?? 25,
    cooldown: 0,
    consumed: 0,
    baseY: y,
    phase: seededRandom(x + z + state.level * 31) * Math.PI * 2,
    satietyValue: options.boost ? 3 : label === "TREAT" ? 9 : 13,
    chonkValue: options.boost ? 0 : label === "TREAT" ? 2.2 : 3.5,
  });
}

function addAtmosphere() {
  const hemi = new THREE.HemisphereLight(0xffe2bd, 0x40352d, 1.85);
  scene.add(hemi);
  const windowLight = new THREE.DirectionalLight(0xffd0a0, 2.35);
  windowLight.position.set(-8, 13, 6);
  windowLight.castShadow = true;
  windowLight.shadow.mapSize.set(2048, 2048);
  windowLight.shadow.camera.left = -26;
  windowLight.shadow.camera.right = 26;
  windowLight.shadow.camera.top = 26;
  windowLight.shadow.camera.bottom = -26;
  windowLight.shadow.camera.near = 1;
  windowLight.shadow.camera.far = 60;
  windowLight.shadow.bias = -0.00008;
  windowLight.shadow.normalBias = 0.025;
  scene.add(windowLight);

  const positions = new Float32Array(520 * 3);
  for (let i = 0; i < 520; i += 1) {
    positions[i * 3] = (seededRandom(i + 101) - 0.5) * HOUSE.width;
    positions[i * 3 + 1] = 0.4 + seededRandom(i + 202) * 5.8;
    positions[i * 3 + 2] = (seededRandom(i + 303) - 0.5) * HOUSE.depth;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xe9d3a9, size: 0.025, transparent: true, opacity: 0.34, depthWrite: false }));
  scene.add(dust);
}

function setAction(name, fadeDuration = 0.24) {
  const next = character.actions[name];
  if (!next || next === character.currentAction) return;
  const previous = character.currentAction;
  next.enabled = true;
  next.setEffectiveWeight(1);
  next.reset().fadeIn(fadeDuration).play();
  if (previous) previous.fadeOut(fadeDuration);
  character.currentAction = next;
}

function triggerAction(name, duration) {
  const next = character.actions[name];
  if (!next || state.transitioning || state.gameComplete) return false;
  state.sitting = false;
  state.forcedAction = name;
  state.actionTime = duration;
  if (next === character.currentAction) next.reset().play();
  setAction(name, 0.08);
  return true;
}

function makeCatShadowTexture() {
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const context = shadowCanvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 62);
  gradient.addColorStop(0, "rgba(20, 12, 8, .58)");
  gradient.addColorStop(0.48, "rgba(20, 12, 8, .31)");
  gradient.addColorStop(1, "rgba(20, 12, 8, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(shadowCanvas);
}

function makeCatFurDetail() {
  const surface = document.createElement("canvas");
  surface.width = surface.height = 512;
  const context = surface.getContext("2d");
  context.fillStyle = "#808080";
  context.fillRect(0, 0, 512, 512);
  for (let index = 0; index < 16000; index += 1) {
    const x = seededRandom(index + 27) * 512;
    const y = seededRandom(index + 47) * 512;
    const value = 95 + Math.floor(seededRandom(index + 91) * 65);
    context.strokeStyle = `rgb(${value},${value},${value})`;
    context.lineWidth = 0.55;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 1.5, y + 3 + seededRandom(index + 135) * 6);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(surface);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

async function loadCat() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(
    "./assets/models/turkish-van-game-cat.glb",
    ({ loaded, total }) => {
      if (total > 0) ui.loadStatus.textContent = `Loading skinned Turkish Van ${Math.round((loaded / total) * 100)}%`;
    },
  );

  character.model = gltf.scene;
  character.model.name = "TurkishVanSkinnedRig";
  character.model.scale.setScalar(CAT_SCALE);
  const furDetail = makeCatFurDetail();
  character.model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = false;
    object.frustumCulled = true;
    if (object.isSkinnedMesh) character.skinnedMeshCount += 1;
    const geometry = object.geometry;
    if (geometry.index) character.triangleCount += geometry.index.count / 3;
    else if (geometry.attributes.position) character.triangleCount += geometry.attributes.position.count / 3;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      if (material.name === "TurkishVan.Fur") {
        const fur = new THREE.MeshPhysicalMaterial({
          name: material.name,
          color: material.color,
          vertexColors: true,
          roughness: 0.94,
          sheen: 0.55,
          sheenColor: new THREE.Color(0xd1c5b0),
          sheenRoughness: 0.85,
          bumpMap: furDetail,
          bumpScale: 0.006,
        });
        object.material = fur;
      }
      if ("envMapIntensity" in material) material.envMapIntensity = 0.72;
      material.needsUpdate = true;
    }
  });
  character.root.add(character.model);

  character.mixer = new THREE.AnimationMixer(character.model);
  for (const name of CAT_ACTIONS) {
    const clip = gltf.animations.find((candidate) => candidate.name.toLowerCase().includes(name.toLowerCase()));
    if (!clip) throw new Error(`Turkish Van model is missing the ${name} animation clip`);
    const action = character.mixer.clipAction(clip);
    const once = ["Sit", "Jump", "Claw", "Bite"].includes(name);
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.enabled = true;
    character.actions[name] = action;
  }
  character.clipCount = Object.keys(character.actions).length;
  character.visualMode = "skinned-mesh";

  character.shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: makeCatShadowTexture(),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  character.shadow.name = "CatGroundShadow";
  character.shadow.rotation.x = -Math.PI / 2;
  character.shadow.scale.set(0.66, 0.52, 1);
  character.shadow.renderOrder = 1;
  scene.add(character.shadow);

  setAction("Idle", 0);
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
  const impulse = (4.05 + 2.25 * fed * heavyPenalty * overfullPenalty) * (state.catnipTime > 0 ? CATNIP_LEAP : 1);
  const label = state.catnipTime > 0 ? "CATNIP LEAP READY" : impulse > 5.75 ? "LEAP READY" : impulse > 4.75 ? "SHORT LEAP" : "WEAK LEAP";
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

function signedBoxDistance(x, z, box) {
  const dx = Math.max(box.minX - x, 0, x - box.maxX);
  const dz = Math.max(box.minZ - z, 0, z - box.maxZ);
  if (dx || dz) return Math.hypot(dx, dz);
  return -Math.min(x - box.minX, box.maxX - x, z - box.minZ, box.maxZ - z);
}

function canOccupy(x, z, y = character.root.position.y) {
  if (x < WORLD_BOUNDS.minX || x > WORLD_BOUNDS.maxX || z < WORLD_BOUNDS.minZ || z > WORLD_BOUNDS.maxZ) return false;
  return !colliders.some((box) => {
    if (!circleHitsBox(x, z, character.radius, box)) return false;
    const clearsTop = y >= box.maxY - 0.055;
    const clearsBottom = y + CAT_BODY_HEIGHT <= box.minY + 0.03;
    const walkableRiser = box.stepUp && state.grounded && box.maxY - y <= STEP_HEIGHT + 0.001;
    // A foot can leave a support before the collision capsule clears its edge.
    // Permit depenetrating motion rather than trapping the cat on that edge.
    const current = character.root.position;
    const escaping = circleHitsBox(current.x, current.z, character.radius, box)
      && signedBoxDistance(x, z, box) > signedBoxDistance(current.x, current.z, box) + 0.000001;
    return !clearsTop && !clearsBottom && !walkableRiser && !escaping;
  });
}

function findSupport(x, z, minY, maxY) {
  let best = null;
  for (const surface of surfaces) {
    const inset = surface.inset ?? 0.08;
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
    const support = findSupport(position.x, position.z, position.y - STEP_HEIGHT - 0.001, position.y + STEP_HEIGHT + 0.001);
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
  let nextY = previousY + character.verticalVelocity * delta;
  if (character.verticalVelocity > 0) {
    // Sweep the body against undersides so jumping cannot phase through a loft.
    const ceiling = colliders.filter((box) => (
      circleHitsBox(position.x, position.z, character.radius, box)
      && previousY + CAT_BODY_HEIGHT <= box.minY + 0.01
      && nextY + CAT_BODY_HEIGHT >= box.minY
    )).sort((a, b) => a.minY - b.minY)[0];
    if (ceiling) {
      nextY = ceiling.minY - CAT_BODY_HEIGHT;
      character.verticalVelocity = 0;
    }
  }
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
  const inputX = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) + (touchControls?.x ?? 0);
  const inputZ = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) + (touchControls?.z ?? 0);
  const hasInput = inputX !== 0 || inputZ !== 0;
  if (hasInput && eatingTarget) {
    eatingTarget.group.scale.setScalar(FOOD_SCALE);
    eatingTarget = null;
    state.eatingTime = 0;
    if (state.forcedAction === "Bite") {
      state.forcedAction = null;
      state.actionTime = 0;
    }
  }
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
    temp.desired.addScaledVector(temp.forward, inputZ).addScaledVector(temp.right, inputX).clampLength(0, 1);
  }

  const trotting = keys.has("ShiftLeft") || keys.has("ShiftRight") || touchControls?.trotting;
  const maxSpeed = (trotting ? 4.95 : 3.15) * speedMultiplier(state.satiety, state.chonk) * (state.catnipTime > 0 ? CATNIP_SPEED : 1);
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
    if (character.currentAction) character.currentAction.timeScale = THREE.MathUtils.clamp(actualSpeed / 1.55, 0.55, 3.3);
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
    if (!food.active) {
      if (food.boost && food.cooldown > 0) {
        food.cooldown = Math.max(0, food.cooldown - delta);
        if (food.cooldown === 0) {
          food.active = true;
          food.group.visible = true;
          food.group.scale.setScalar(FOOD_SCALE);
          food.consumed = 0;
        }
      }
      continue;
    }
    food.group.position.y = food.baseY + 0.015 + Math.sin(performance.now() * 0.0018 + food.phase) * 0.012;
    const distance = food.group.position.distanceTo(character.root.position);
    if (distance < nearestDistance) {
      nearest = food;
      nearestDistance = distance;
    }
  }

  ui.prompt.textContent = nearest && nearestDistance < 2.1 ? `${nearest.label}  ·  MOVE CLOSER` : "";
  const wrongHeight = nearest && Math.abs(nearest.baseY - character.root.position.y) > 0.34;
  const movementRequested = MOVEMENT_KEYS.some((key) => keys.has(key)) || Math.hypot(touchControls?.x ?? 0, touchControls?.z ?? 0) > 0;
  if (!nearest || nearestDistance > 0.88 || wrongHeight || speed > 0.7 || !state.grounded || movementRequested) {
    if (eatingTarget?.active) eatingTarget.group.scale.setScalar(FOOD_SCALE);
    state.eatingTime = 0;
    eatingTarget = null;
    return;
  }

  if (eatingTarget !== nearest) {
    if (eatingTarget?.active) eatingTarget.group.scale.setScalar(FOOD_SCALE);
    state.eatingTime = 0;
    eatingTarget = nearest;
  }
  ui.prompt.textContent = `EATING ${nearest.label}`;
  if (state.eatingTime === 0) triggerAction("Bite", 0.72);
  state.eatingTime += delta;
  const consumed = Math.min(delta, 1.25 - nearest.consumed);
  nearest.consumed += consumed;
  state.satiety = Math.min(100, state.satiety + consumed * (nearest.satietyValue / 1.25));
  nearest.group.scale.lerp(new THREE.Vector3(0.12, 0.12, 0.12), 1 - Math.exp(-4 * delta));
  if (state.eatingTime >= 1.25) {
    nearest.active = false;
    nearest.group.visible = false;
    state.eaten += 1;
    if (nearest.required) state.levelFoodEaten += 1;
    state.chonk = Math.min(100, state.chonk + nearest.chonkValue);
    state.xp += nearest.xp;
    state.eatingTime = 0;
    eatingTarget = null;
    if (nearest.boost) {
      state.catnipTime = CATNIP_DURATION;
      nearest.cooldown = CATNIP_DURATION + 4;
      const leapControls = touchControls?.enabled ? "Trot + Jump" : "Shift + Space";
      showToast(`Catnip zoomies! +32% speed / +18% leap. ${leapControls} for the long jump.`, 5);
    } else {
      showToast(`${nearest.label.toLowerCase()} secured · +${nearest.xp} XP`, 2.8);
    }
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
  const allFoodFound = foods.every((food) => !food.required || !food.active);
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
  requestCameraControl();
}

function requestCameraControl() {
  if (touchControls?.enabled || COARSE_POINTER) return;
  const unavailable = () => { if (!touchControls?.enabled) ui.prompt.textContent = "CLICK TO RESUME CAMERA"; };
  try {
    canvas.requestPointerLock?.()?.catch?.(unavailable);
  } catch {
    unavailable();
  }
}

function updateCamera(delta) {
  temp.cameraTarget.copy(character.root.position);
  temp.cameraTarget.y += 0.44;
  temp.cameraTarget.addScaledVector(character.velocity, 0.08);

  const distance = 3.35;
  const horizontal = Math.cos(state.pitch) * distance;
  temp.cameraDesired.set(
    temp.cameraTarget.x + Math.sin(state.yaw) * horizontal,
    temp.cameraTarget.y + 0.24 + Math.sin(state.pitch) * distance,
    temp.cameraTarget.z + Math.cos(state.yaw) * horizontal,
  );

  temp.rayDirection.copy(temp.cameraDesired).sub(temp.cameraTarget);
  const desiredDistance = temp.rayDirection.length();
  temp.rayDirection.normalize();
  const raycaster = updateCamera.raycaster || (updateCamera.raycaster = new THREE.Raycaster());
  raycaster.set(temp.cameraTarget, temp.rayDirection);
  raycaster.far = desiredDistance;
  const hits = raycaster.intersectObjects(cameraOccluders, false);
  const safeDistance = hits.length ? Math.min(desiredDistance, Math.max(0.35, hits[0].distance - 0.24)) : desiredDistance;
  cameraRig.desiredDistance = safeDistance;
  cameraRig.obstructed = hits.length > 0;
  const currentDistance = cameraRig.distance ?? safeDistance;
  // Pull in promptly at walls, but ease back out when a corner clears the ray.
  const response = safeDistance < currentDistance ? 18 : 3.5;
  cameraRig.distance = THREE.MathUtils.damp(currentDistance, safeDistance, response, delta);
  temp.cameraDesired.copy(temp.cameraTarget).addScaledVector(temp.rayDirection, cameraRig.distance);

  camera.position.lerp(temp.cameraDesired, 1 - Math.exp(-9.5 * delta));
  camera.lookAt(temp.cameraTarget);
}

function updateCatVisual(delta) {
  if (!character.model || !character.mixer) return;
  character.mixer.update(delta);

  const chonkWidth = 1 + THREE.MathUtils.smoothstep(state.chonk, 62, 100) * 0.07;
  character.model.scale.set(CAT_SCALE * chonkWidth, CAT_SCALE, CAT_SCALE * chonkWidth);

  const support = findSupport(
    character.root.position.x,
    character.root.position.z,
    -0.5,
    character.root.position.y + 0.08,
  );
  const supportY = support?.topY ?? 0;
  const airHeight = Math.max(0, character.root.position.y - supportY);
  const shadowSpread = 1 + Math.min(airHeight, 2.5) * 0.12;
  character.shadow.position.set(character.root.position.x, supportY + 0.012, character.root.position.z);
  character.shadow.scale.set(0.66 * shadowSpread * chonkWidth, 0.52 * shadowSpread * chonkWidth, 1);
  character.shadow.material.opacity = 0.28 * (1 - Math.min(airHeight / 3.5, 0.72));
}

function updateAtmosphere(delta, elapsed) {
  if (dust) {
    dust.rotation.y += delta * 0.012;
    dust.position.y = Math.sin(elapsed * 0.13) * 0.06;
  }
  for (const plant of animatedPlants) plant.mesh.rotation.z = plant.base + Math.sin(elapsed * 0.7 + plant.phase) * 0.014;
  for (const lamp of lamps) lamp.light.intensity = 18 + Math.sin(elapsed * 7 + lamp.phase) * 0.35 + Math.sin(elapsed * 17 + lamp.phase) * 0.16;
  for (const sign of worldSigns) {
    const distance = sign.position.distanceTo(character.root.position);
    sign.material.opacity = THREE.MathUtils.smoothstep(distance, 2.2, 3.8) * (1 - THREE.MathUtils.smoothstep(distance, 14, 20));
    sign.visible = sign.material.opacity > 0.01;
  }
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
  ui.boost.hidden = state.catnipTime <= 0;
  ui.boost.textContent = `CATNIP ZOOMIES ${Math.ceil(state.catnipTime)}s / +32% SPEED / +18% LEAP`;
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
  const remaining = foods.filter((food) => food.active && food.required);
  const left = remaining.length;
  const upstairs = remaining.some((food) => food.baseY > 2);
  ui.objective.textContent = left ? `Find supper · ${left} scents${upstairs ? " / check upstairs" : " remain"}` : "Reach the glowing pet door";
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
  touchControls?.setPlaying(state.started && !state.transitioning && !state.gameComplete);
  const look = mouseLook.consume(delta);
  const touchLook = touchControls?.consumeLook(delta) ?? { yaw: 0, pitch: 0 };
  state.yaw += look.yaw + touchLook.yaw;
  state.pitch = THREE.MathUtils.clamp(state.pitch + look.pitch + touchLook.pitch, 0.08, 0.62);
  let speed = 0;
  updateMovingPlatforms(elapsed);
  if (state.started) {
    if (!state.transitioning && !state.gameComplete) state.catnipTime = Math.max(0, state.catnipTime - delta);
    speed = moveCharacter(delta);
    updateFood(delta, speed);
    updateHazards(delta, elapsed);
    updateCheckpoints(elapsed);
    updateGoal(delta, elapsed);
  }
  updateCamera(delta);
  updateCatVisual(delta);
  updateAtmosphere(delta, elapsed);
  updateHud(speed);
  updateToast(delta);
  composer.render();
}

function setupInput() {
  touchControls = new TouchControls({
    canvas,
    root: document.querySelector("#touch-controls"),
    toggle: document.querySelector("#touch-toggle"),
    onAction: (action) => {
      if (action === "jump") requestJump();
      if (action === "sit") toggleSit();
      if (action === "claw") triggerAction("Claw", 0.85);
      if (action === "bite") triggerAction("Bite", 0.72);
    },
    onModeChange: (enabled) => {
      keys.clear();
      mouseLook.setLocked(false);
      if (enabled && document.pointerLockElement) document.exitPointerLock?.();
      document.querySelector("#input-hint").textContent = enabled
        ? "Left stick moves. Swipe right side to look. Tap Trot for longer jumps."
        : "WASD to move. Mouse to look. Space to jump.";
      resize();
    },
  });
  addEventListener("keydown", (event) => {
    keys.add(event.code);
    if (state.started && !event.repeat) {
      if (event.code === "Space") requestJump();
      if (event.code === "KeyQ") toggleSit();
      if (event.code === "KeyF") triggerAction("Claw", 0.85);
      if (event.code === "KeyE") triggerAction("Bite", 0.72);
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  });
  addEventListener("keyup", (event) => keys.delete(event.code));
  addEventListener("blur", () => {
    keys.clear();
    mouseLook.setLocked(false);
  });
  const syncMouseLook = () => mouseLook.setLocked(!touchControls.enabled && document.pointerLockElement === canvas && document.hasFocus() && !document.hidden);
  addEventListener("focus", syncMouseLook);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) keys.clear();
    syncMouseLook();
  });

  document.addEventListener("pointerlockchange", () => {
    state.pointerLocked = document.pointerLockElement === canvas;
    syncMouseLook();
    if (state.started) ui.prompt.textContent = state.pointerLocked || touchControls.enabled ? "" : "CLICK TO RESUME CAMERA";
  });
  document.addEventListener("mousemove", (event) => {
    if (!state.started || !state.pointerLocked || touchControls.enabled) return;
    mouseLook.addMovement(event.movementX, event.movementY);
  });
  canvas.addEventListener("click", () => {
    if (state.started && document.pointerLockElement !== canvas) requestCameraControl();
  });
  canvas.addEventListener("mousedown", (event) => {
    if (!state.started || document.pointerLockElement !== canvas || touchControls.enabled) return;
    if (event.button === 0) triggerAction("Claw", 0.85);
    if (event.button === 2) triggerAction("Bite", 0.72);
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, touchControls?.enabled || COARSE_POINTER ? 1.25 : 1.8));
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
}

async function init() {
  buildSky();
  buildLevel(0, false);
  addAtmosphere();
  setupInput();
  camera.position.set(0, 2.2, 12);
  camera.lookAt(0, 0.8, 7);
  await loadCat();
  state.ready = true;
  ui.enter.disabled = false;
  ui.loadStatus.textContent = "Turkish Van ready · Three rooms to explore";
  ui.enter.addEventListener("click", () => {
    state.started = true;
    state.runStartedAt = performance.now();
    ui.boot.classList.add("is-gone");
    ui.hud.classList.remove("is-hidden");
    requestCameraControl();
    showLevelCard(LEVELS[0], 0);
  }, { once: true });
  ui.restart.addEventListener("click", restartRun);
  renderer.setAnimationLoop(animate);
}

addEventListener("resize", resize);
window.__megaChonk = {
  state,
  character,
  touchSnapshot: () => touchControls.snapshot(),
  cameraSnapshot: () => ({
    position: camera.position.toArray(),
    target: temp.cameraTarget.toArray(),
    quaternion: camera.quaternion.toArray(),
    yaw: state.yaw,
    pitch: state.pitch,
    distance: cameraRig.distance,
    desiredDistance: cameraRig.desiredDistance,
    obstructed: cameraRig.obstructed,
    rejectedMouseSamples: mouseLook.rejectedSamples,
  }),
  start: () => ui.enter.click(),
  aimAt: (x, z) => {
    const dx = x - character.root.position.x;
    const dz = z - character.root.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.0001) state.yaw = Math.atan2(-dx, -dz);
    return state.yaw;
  },
  setCoat: (style) => style === "van",
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
    bounds: WORLD_BOUNDS,
    house: HOUSE,
    catScale: CAT_SCALE,
    bodyHeight: CAT_BODY_HEIGHT,
    radius: character.radius,
    generation: generatedCourse,
    level: state.level,
    transitioning: state.transitioning,
    gameComplete: state.gameComplete,
    grounded: state.grounded,
    bonks: state.bonks,
    jumps: state.jumps,
    satiety: state.satiety,
    chonk: state.chonk,
    catnipTime: state.catnipTime,
    position: character.root.position.toArray(),
    checkpoint: character.checkpoint.toArray(),
    foods: foods
      .map((food, index) => ({
        index,
        label: food.label,
        active: food.active,
        position: [food.group.position.x, food.baseY, food.group.position.z],
      }))
      .filter((food) => food.active && foods[food.index].required),
    snacks: foods.filter((food) => !food.required).map((food) => ({ label: food.label, active: food.active, boost: food.boost, position: [food.group.position.x, food.baseY, food.group.position.z] })),
    verticalRoutes,
    surfaces: surfaces.map(({ minX, maxX, minZ, maxZ, topY }) => ({ minX, maxX, minZ, maxZ, topY })),
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
    visualMode: character.visualMode,
    modelName: character.model?.name ?? null,
    animationClips: character.clipCount,
    skinnedMeshes: character.skinnedMeshCount,
    catScale: CAT_SCALE,
    house: HOUSE,
    generatedObstacles: generatedCourse?.obstacles.length ?? 0,
    level: state.level,
    xp: state.xp,
    grounded: state.grounded,
    sitting: state.sitting,
    forcedAction: state.forcedAction,
    jumpAllowed: jumpProfile().allowed,
    jumpImpulse: Number(jumpProfile().impulse.toFixed(3)),
    foodsRemaining: foods.filter((food) => food.active && food.required).length,
    catnipTime: Number(state.catnipTime.toFixed(2)),
    speedBoost: state.catnipTime > 0 ? CATNIP_SPEED : 1,
    upstairsHeight: Math.max(0, ...verticalRoutes.map((route) => route.height)),
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
