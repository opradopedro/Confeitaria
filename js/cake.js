import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =========================================================================
   Amorino — bolo 3D montado conforme o scroll.
   Tudo é procedural (geometria + texturas desenhadas em <canvas>),
   então não há arquivos de imagem/modelo para carregar.
   ========================================================================= */

window.__amorinoCake = true;
const t0 = performance.now();
const canvas = document.getElementById('cake-canvas');
const stage = document.querySelector('.stage');
const build = document.querySelector('.build');
const loader = document.getElementById('loader');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  console.error(err);
  document.documentElement.classList.add('no-webgl');
  loader.classList.add('is-done');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const BG = new THREE.Color('#efdcc0');
scene.background = BG;
scene.fog = new THREE.Fog(BG, 16, 40);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

/* ----------------------------- helpers ---------------------------------- */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t, s = 1.4) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = MAX_ANISO;
  return t;
}

function ellipse(g, x, y, rx, ry, rot) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fill();
}

/* ----------------------------- textures ---------------------------------- */

// Miolo de bolo: poros escuros + migalhas claras, com bump map coerente.
function crumbTextures({ seed, base, dark, light, W = 1024, H = 512, pores = 26000 }) {
  const [c, g] = makeCanvas(W, H);
  const [b, gb] = makeCanvas(W, H);
  const R = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  gb.fillStyle = '#8a8a8a';
  gb.fillRect(0, 0, W, H);

  for (let i = 0; i < 700; i++) {
    const x = R() * W, y = R() * H, r = 12 + R() * 50;
    const col = R() < 0.5 ? dark : light;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rgba(col, 0.14));
    grd.addColorStop(1, rgba(col, 0));
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < pores; i++) {
    const x = R() * W, y = R() * H;
    const r = 0.5 + Math.pow(R(), 3) * 5;
    const rx = r * (0.6 + R() * 0.9), ry = r * (0.6 + R() * 0.9), rot = R() * Math.PI;
    g.fillStyle = rgba(dark, 0.35 + R() * 0.5);
    ellipse(g, x, y, rx, ry, rot);
    gb.fillStyle = `rgba(0,0,0,${0.35 + R() * 0.5})`;
    ellipse(gb, x, y, rx, ry, rot);
    if (R() < 0.55) {
      const hx = x + rx * 0.7, hy = y - ry * 0.7;
      g.fillStyle = rgba(light, 0.25 + R() * 0.35);
      ellipse(g, hx, hy, rx * 0.6, ry * 0.45, rot);
      gb.fillStyle = 'rgba(255,255,255,.55)';
      ellipse(gb, hx, hy, rx * 0.6, ry * 0.45, rot);
    }
  }
  return { map: toTexture(c), bump: toTexture(b, { srgb: false }) };
}

// Creme liso com pintinhas (pedacinhos de fruta, etc.) e marcas de espátula.
function creamTextures({ seed, base, tint, specks = [], streaks = 0.12 }) {
  const W = 1024, H = 256;
  const [c, g] = makeCanvas(W, H);
  const [b, gb] = makeCanvas(W, H);
  const R = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  gb.fillStyle = '#808080';
  gb.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) {
    const x = R() * W, y = R() * H, r = 10 + R() * 60;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rgba(tint, 0.18 * R()));
    grd.addColorStop(1, rgba(tint, 0));
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  gb.filter = 'blur(2px)';
  for (let i = 0; i < 160; i++) {
    const y = R() * H;
    gb.strokeStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${streaks * (0.4 + R())})`;
    gb.lineWidth = 1 + R() * 7;
    gb.beginPath();
    gb.moveTo(0, y);
    for (let x = 0; x <= W; x += 64) gb.lineTo(x, y + Math.sin(x * 0.01 + i) * 3);
    gb.stroke();
  }
  gb.filter = 'none';
  for (const s of specks) {
    for (let i = 0; i < s.count; i++) {
      const x = R() * W, y = R() * H, r = s.size * (0.4 + R());
      g.fillStyle = rgba(s.color, 0.5 + R() * 0.5);
      ellipse(g, x, y, r, r * (0.5 + R() * 0.6), R() * Math.PI);
      gb.fillStyle = 'rgba(255,255,255,.4)';
      ellipse(gb, x, y, r, r * 0.8, 0);
    }
  }
  return { map: toTexture(c), bump: toTexture(b, { srgb: false }) };
}

// Riscos horizontais da espátula no chantilly.
function spatulaBump() {
  const W = 512, H = 512;
  const [c, g] = makeCanvas(W, H);
  const R = rng(99);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, W, H);
  g.filter = 'blur(3px)';
  for (let i = 0; i < 90; i++) {
    const y = R() * H;
    g.strokeStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${0.06 + R() * 0.16})`;
    g.lineWidth = 2 + R() * 12;
    g.beginPath();
    g.moveTo(-10, y);
    for (let x = 0; x <= W + 20; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 1.5);
    g.stroke();
  }
  g.filter = 'none';
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(0,0,0,${R() * 0.12})`;
    ellipse(g, R() * W, R() * H, 0.6 + R() * 1.4, 0.6 + R() * 1.2, 0);
  }
  return toTexture(c, { srgb: false, repeat: [4, 1] });
}

function woodTextures() {
  const W = 2048, H = 1024;
  const [c, g] = makeCanvas(W, H);
  const [b, gb] = makeCanvas(W, H);
  const R = rng(5);
  const planks = 6;
  const ph = H / planks;
  for (let p = 0; p < planks; p++) {
    const tone = 0.85 + R() * 0.3;
    const base = new THREE.Color('#b0794b').multiplyScalar(tone);
    g.fillStyle = `#${base.getHexString()}`;
    g.fillRect(0, p * ph, W, ph);
    gb.fillStyle = '#909090';
    gb.fillRect(0, p * ph, W, ph);
    for (let i = 0; i < 70; i++) {
      const y0 = p * ph + R() * ph;
      const amp = 2 + R() * 8, freq = 0.002 + R() * 0.006, phase = R() * 10;
      g.strokeStyle = rgba(R() < 0.6 ? '#5e3a20' : '#d8a774', 0.08 + R() * 0.22);
      g.lineWidth = 0.6 + R() * 2.5;
      g.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1) * amp * 0.3;
        x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    // junta entre tábuas
    g.fillStyle = 'rgba(40,20,10,.55)';
    g.fillRect(0, p * ph, W, 3);
    gb.fillStyle = '#000';
    gb.fillRect(0, p * ph, W, 4);
  }
  return { map: toTexture(c, { repeat: [5, 2] }), bump: toTexture(b, { srgb: false, repeat: [5, 2] }) };
}

// Parede listrada rosa/manteiga — a identidade visual da Amorino.
function stripeTexture() {
  const W = 1024, H = 1024;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#f7f4d0';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#efc6da';
  const stripes = 8;
  const sw = W / stripes;
  for (let s = 0; s < stripes; s++) {
    const x0 = s * sw;
    g.beginPath();
    for (let y = 0; y <= H; y += 16) g.lineTo(x0 + Math.sin(y * 0.012 + s) * 5, y);
    for (let y = H; y >= 0; y -= 16) g.lineTo(x0 + sw * 0.5 + Math.sin(y * 0.014 + s * 2) * 5, y);
    g.closePath();
    g.fill();
  }
  const R = rng(3);
  for (let i = 0; i < 20000; i++) {
    g.fillStyle = `rgba(80,50,30,${R() * 0.04})`;
    g.fillRect(R() * W, R() * H, 1.5, 1.5);
  }
  return toTexture(c, { repeat: [5, 1] });
}

function strawberryTexture() {
  const W = 512, H = 256;
  const [c, g] = makeCanvas(W, H);
  const [b, gb] = makeCanvas(W, H);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#e2312e');
  grd.addColorStop(0.5, '#c4141b');
  grd.addColorStop(0.92, '#a10d15');
  grd.addColorStop(1, '#d9e08a');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  gb.fillStyle = '#909090';
  gb.fillRect(0, 0, W, H);
  const R = rng(11);
  const rows = 12, cols = 22;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const x = (k + (r % 2) * 0.5) * (W / cols) + (R() - 0.5) * 4;
      const y = (r + 0.5) * (H / rows) * 0.92 + (R() - 0.5) * 4;
      g.fillStyle = 'rgba(110,10,15,.55)';
      ellipse(g, x, y, 5, 6, 0);
      gb.fillStyle = '#202020';
      ellipse(gb, x, y, 5, 6, 0);
      g.fillStyle = '#e8c45a';
      ellipse(g, x, y + 1, 1.6, 2.4, 0);
      gb.fillStyle = '#e0e0e0';
      ellipse(gb, x, y + 1, 1.6, 2.4, 0);
    }
  }
  return { map: toTexture(c), bump: toTexture(b, { srgb: false }) };
}

// Etiqueta listrada com o logo da Amorino (img/logo-amorino.webp).
function labelTexture() {
  const [c, g] = makeCanvas(512, 512);
  for (let x = 0; x < 512; x += 32) {
    g.fillStyle = (x / 32) % 2 ? '#fbfbf0' : '#f1cadf';
    g.fillRect(x, 0, 32, 512);
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const logo = new Image();
  logo.onload = () => {
    const w = 400, h = (logo.height / logo.width) * w;
    g.drawImage(logo, (512 - w) / 2, (512 - h) / 2, w, h);
    t.needsUpdate = true;
  };
  logo.src = 'img/logo-amorino.webp';
  return t;
}

/* ----------------------------- materials --------------------------------- */

const spongeTex = crumbTextures({ seed: 21, base: '#5e3522', dark: '#2a140b', light: '#8f5c3d', W: 1024, H: 512, pores: 16000 });
const spongeTopTex = crumbTextures({ seed: 42, base: '#5a3320', dark: '#241109', light: '#8d5a3b', W: 512, H: 512, pores: 7000 });
// proporção certa dos poros: a lateral tem ~6,3 de volta por 0,34 de altura
for (const t of [spongeTex.map, spongeTex.bump]) t.repeat.set(9, 1);
for (const t of [spongeTopTex.map, spongeTopTex.bump]) t.repeat.set(2, 2);
const pinkTex = creamTextures({ seed: 3, base: '#eaa4b0', tint: '#c9566d', specks: [{ color: '#b2263f', size: 4, count: 260 }, { color: '#fff1ef', size: 2, count: 300 }] });
const whiteTex = creamTextures({ seed: 8, base: '#f5ecd9', tint: '#d9c39b', specks: [{ color: '#fffaf0', size: 2, count: 400 }] });
const chantBump = spatulaBump();
console.log(`textures ${Math.round(performance.now() - t0)}ms`);
const wood = woodTextures();
const berry = strawberryTexture();

const M = {
  spongeSide: new THREE.MeshStandardMaterial({ map: spongeTex.map, bumpMap: spongeTex.bump, bumpScale: 3, roughness: 0.92 }),
  spongeCap: new THREE.MeshStandardMaterial({ map: spongeTopTex.map, bumpMap: spongeTopTex.bump, bumpScale: 3, roughness: 0.92 }),
  pink: new THREE.MeshPhysicalMaterial({ map: pinkTex.map, bumpMap: pinkTex.bump, bumpScale: 1.2, roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.45, sheen: 0.4, sheenColor: new THREE.Color('#ffd6de') }),
  white: new THREE.MeshPhysicalMaterial({ map: whiteTex.map, bumpMap: whiteTex.bump, bumpScale: 1.2, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color('#fffaf0') }),
  chantilly: new THREE.MeshPhysicalMaterial({ color: '#fbf6ee', bumpMap: chantBump, bumpScale: 1.4, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide }),
  chantPink: new THREE.MeshPhysicalMaterial({ color: '#f1bcc6', roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color('#ffe4ea'), side: THREE.DoubleSide }),
  chantPiped: new THREE.MeshPhysicalMaterial({ color: '#fcf7ef', roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide }),
  ganache: new THREE.MeshPhysicalMaterial({ color: '#2f170c', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  strawberry: new THREE.MeshPhysicalMaterial({ map: berry.map, bumpMap: berry.bump, bumpScale: 2, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#4d7a2a', roughness: 0.6, side: THREE.DoubleSide }),
  blueberry: new THREE.MeshPhysicalMaterial({ color: '#2a2d55', roughness: 0.55, sheen: 1, sheenColor: new THREE.Color('#8c93c9'), sheenRoughness: 0.4 }),
  sprinkle: new THREE.MeshStandardMaterial({ color: '#3a1d10', roughness: 0.5 }),
  pearl: new THREE.MeshStandardMaterial({ color: '#e7c27a', metalness: 1, roughness: 0.25 }),
  board: new THREE.MeshStandardMaterial({ color: '#d9b26a', metalness: 0.9, roughness: 0.32 }),
  ceramic: new THREE.MeshPhysicalMaterial({ color: '#fbf8f3', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
  ceramicPink: new THREE.MeshPhysicalMaterial({ color: '#efc4cb', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
  steel: new THREE.MeshStandardMaterial({ color: '#e8e8e8', metalness: 0.85, roughness: 0.3 }),
  alu: new THREE.MeshStandardMaterial({ color: '#cfcfcf', metalness: 1, roughness: 0.38 }),
  handle: new THREE.MeshStandardMaterial({ color: '#7a4a2a', roughness: 0.55 }),
  wood: new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 1.5, roughness: 0.6 }),
  wall: new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.95 }),
  ribbon: new THREE.MeshPhysicalMaterial({ color: '#c3161c', roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#ff6a6a'), sheenRoughness: 0.3, side: THREE.DoubleSide }),
  napkin: new THREE.MeshStandardMaterial({ color: '#f2d3d8', roughness: 0.9 }),
  label: new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.6 }),
};

/* ----------------------------- dimensions -------------------------------- */

const R = 1.0;          // raio do bolo
const LH = 0.34;        // altura de cada camada de massa
const FH = 0.11;        // altura de cada recheio
const BASE = 0.03;      // espessura da base dourada
const Y = {
  l1: BASE,
  f1: BASE + LH,
  l2: BASE + LH + FH,
  f2: BASE + 2 * LH + FH,
  l3: BASE + 2 * LH + 2 * FH,
  top: BASE + 3 * LH + 2 * FH,
};
const CR = 1.045;             // raio do chantilly
const TOP = Y.top + 0.03;     // topo do chantilly
const TABLE_Y = -0.9;

/* ----------------------------- geometry ---------------------------------- */

function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function spongeGeometry(seed) {
  const geo = new THREE.CylinderGeometry(R, R, LH, 160, 8);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-4) continue;
    const a = Math.atan2(v.z, v.x);
    const n = 1
      + 0.006 * Math.sin(a * 5 + seed)
      + 0.004 * Math.sin(a * 11 + seed * 2.3)
      + 0.003 * Math.sin(a * 23 + seed * 0.7)
      // leve "barriga" e borda superior arredondada como bolo de verdade
      + (r > R * 0.98 ? 0.006 * Math.cos((v.y / LH) * Math.PI) : 0);
    pos.setXYZ(i, v.x * n, v.y, v.z * n);
  }
  geo.translate(0, LH / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

function fillingGeometry(h) {
  const pts = [new THREE.Vector2(0, 0)];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(R - 0.035 + 0.05 * Math.sin(Math.PI * t), t * h));
  }
  pts.push(new THREE.Vector2(R * 0.6, h + 0.004));
  pts.push(new THREE.Vector2(0, h + 0.006));
  return new THREE.LatheGeometry(pts, 160);
}

// Roseta de chantilly feita com bico pitanga: tubo em espiral com seção em estrela.
function rosetteGeometry() {
  const curvePts = [];
  const turns = 1.5;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const r = 0.085 * (1 - 0.7 * t);
    const a = t * turns * Math.PI * 2;
    curvePts.push(new THREE.Vector3(Math.cos(a) * r, 0.035 + 0.085 * t, Math.sin(a) * r));
  }
  curvePts.push(new THREE.Vector3(0.006, 0.15, 0.004));
  curvePts.push(new THREE.Vector3(0, 0.185, 0));
  const curve = new THREE.CatmullRomCurve3(curvePts);
  const steps = 180, ring = 64;
  const frames = curve.computeFrenetFrames(steps, false);
  const positions = [];
  const indices = [];
  const P = new THREE.Vector3();
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    curve.getPointAt(t, P);
    const N = frames.normals[s], B = frames.binormals[s];
    let scale = 1;
    if (t < 0.05) scale = 0.55 + 0.45 * (t / 0.05);
    if (t > 0.72) scale = Math.max(0.0, Math.pow(1 - (t - 0.72) / 0.28, 0.9));
    const rad = 0.05 * scale;
    const twist = t * 7;
    for (let j = 0; j <= ring; j++) {
      const th = (j / ring) * Math.PI * 2;
      const star = 1 + 0.24 * Math.pow(Math.abs(Math.cos(4 * (th + twist))), 0.6) - 0.12;
      const rr = rad * star;
      positions.push(
        P.x + (N.x * Math.cos(th) + B.x * Math.sin(th)) * rr,
        P.y + (N.y * Math.cos(th) + B.y * Math.sin(th)) * rr,
        P.z + (N.z * Math.cos(th) + B.z * Math.sin(th)) * rr,
      );
    }
  }
  for (let s = 0; s < steps; s++) {
    for (let j = 0; j < ring; j++) {
      const a = s * (ring + 1) + j, b = a + ring + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function strawberryGeometry() {
  const pts = [];
  const prof = [
    [0.0, 0.0], [0.012, 0.004], [0.03, 0.02], [0.05, 0.045], [0.068, 0.075],
    [0.08, 0.105], [0.084, 0.13], [0.078, 0.15], [0.06, 0.163], [0.03, 0.17], [0.0, 0.172],
  ];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 48);
  // pequenas irregularidades
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const n = 1 + 0.04 * Math.sin(a * 3 + v.y * 30);
    pos.setXYZ(i, v.x * n, v.y, v.z * n);
  }
  geo.computeVertexNormals();
  return geo;
}

function leafGeometry() {
  const shape = new THREE.Shape();
  const n = 7;
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.075 : 0.022;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  const geo = new THREE.ShapeGeometry(shape, 4);
  geo.rotateX(-Math.PI / 2);
  // folhas levemente curvadas pra baixo
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, -Math.pow(Math.hypot(x, z) / 0.075, 2) * 0.025);
  }
  geo.computeVertexNormals();
  return geo;
}

/* ----------------------------- scene: table ------------------------------ */

const world = new THREE.Group();
scene.add(world);

const table = shadowed(new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 18), M.wood), false, true);
table.position.set(0, TABLE_Y - 0.1, 3);
world.add(table);

const wall = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(60, 26), M.wall), false, true);
wall.position.set(0, 9, -6);
world.add(wall);

// Boleira de cerâmica
{
  const p = [
    [0.0, -0.9], [0.72, -0.9], [0.76, -0.885], [0.74, -0.86], [0.5, -0.8], [0.26, -0.7],
    [0.16, -0.58], [0.13, -0.35], [0.14, -0.18], [0.24, -0.1], [1.5, -0.07], [1.56, -0.05],
    [1.57, -0.025], [1.52, 0.0], [0.0, 0.0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const stand = shadowed(new THREE.Mesh(new THREE.LatheGeometry(p, 128), M.ceramic));
  world.add(stand);
}

// Base dourada do bolo
const board = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, BASE, 128), M.board));
board.position.y = BASE / 2;
world.add(board);

// Pratos, garfos, xícara e uma marmitinha — aparecem quando a câmera se afasta
function plate(x, z, rot) {
  const g = new THREE.Group();
  const p = [
    [0, 0], [0.5, 0], [0.54, 0.012], [0.62, 0.05], [0.78, 0.075], [0.8, 0.085], [0.77, 0.088],
    [0.6, 0.064], [0.52, 0.028], [0.0, 0.026],
  ].map(([a, b]) => new THREE.Vector2(a, b));
  g.add(shadowed(new THREE.Mesh(new THREE.LatheGeometry(p, 96), M.ceramic)));
  const napkin = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.9), M.napkin));
  napkin.position.set(0.2, -0.004, 0.15);
  napkin.rotation.y = 0.5;
  g.add(napkin);
  const fork = new THREE.Group();
  const handle = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.012, 0.055), M.steel));
  fork.add(handle);
  for (let i = 0; i < 4; i++) {
    const tine = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.012), M.steel));
    tine.position.set(-0.45, 0, -0.03 + i * 0.02);
    fork.add(tine);
  }
  fork.position.set(0.95, 0.012, 0.0);
  fork.rotation.y = Math.PI / 2;
  g.add(fork);
  g.position.set(x, TABLE_Y, z);
  g.rotation.y = rot;
  world.add(g);
}
plate(-2.9, 2.0, 0.3);
plate(3.0, 2.2, -0.4);

{
  const cup = new THREE.Group();
  const saucer = [[0, 0], [0.38, 0], [0.42, 0.02], [0.48, 0.045], [0.46, 0.05], [0.3, 0.03], [0, 0.03]]
    .map(([a, b]) => new THREE.Vector2(a, b));
  cup.add(shadowed(new THREE.Mesh(new THREE.LatheGeometry(saucer, 64), M.ceramicPink)));
  const body = [[0, 0.03], [0.14, 0.03], [0.2, 0.08], [0.24, 0.2], [0.26, 0.32], [0.245, 0.32], [0.225, 0.2], [0.18, 0.09], [0, 0.07]]
    .map(([a, b]) => new THREE.Vector2(a, b));
  cup.add(shadowed(new THREE.Mesh(new THREE.LatheGeometry(body, 64), M.ceramicPink)));
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.235, 48), new THREE.MeshPhysicalMaterial({ color: '#3b1f10', roughness: 0.1, clearcoat: 1 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.27;
  cup.add(coffee);
  const handle = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 12, 32, Math.PI * 1.3), M.ceramicPink));
  handle.position.set(0.27, 0.2, 0);
  handle.rotation.z = -Math.PI * 0.65;
  cup.add(handle);
  cup.position.set(3.5, TABLE_Y, -0.9);
  world.add(cup);
}

{
  // Marmitinha de alumínio com laço vermelho
  const box = new THREE.Group();
  const tray = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 0.8), M.alu));
  tray.position.y = 0.1;
  box.add(tray);
  const lip = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.025, 0.92), M.alu));
  lip.position.y = 0.2;
  box.add(lip);
  const brownieTex = crumbTextures({ seed: 77, base: '#4a2615', dark: '#1d0d06', light: '#7a4a2c', W: 512, H: 512, pores: 7000 });
  const brownie = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.02, 0.74), new THREE.MeshStandardMaterial({ map: brownieTex.map, bumpMap: brownieTex.bump, bumpScale: 4, roughness: 0.85 }));
  brownie.position.y = 0.205;
  box.add(brownie);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.01, 0.9), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, roughness: 0.05, thickness: 0.02, transparent: true, opacity: 0.4 }));
  lid.position.y = 0.22;
  box.add(lid);
  const r1 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.215, 0.06), M.ribbon));
  r1.position.y = 0.11;
  box.add(r1);
  const r2 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.215, 0.94), M.ribbon));
  r2.position.set(0.1, 0.11, 0);
  box.add(r2);
  for (const s of [-1, 1]) {
    const loop = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 10, 32), M.ribbon));
    loop.scale.set(1, 0.45, 1);
    loop.rotation.x = -Math.PI / 2;
    loop.rotation.z = s * 0.4;
    loop.position.set(0.1 + s * 0.11, 0.24, 0);
    box.add(loop);
  }
  const label = new THREE.Mesh(new THREE.CircleGeometry(0.14, 48), M.label);
  label.rotation.x = -Math.PI / 2;
  label.position.set(-0.28, 0.229, -0.14);
  box.add(label);
  box.position.set(-3.4, TABLE_Y, -1.0);
  box.rotation.y = 0.35;
  world.add(box);
}

/* ----------------------------- scene: cake -------------------------------- */

const cake = new THREE.Group();
world.add(cake);

function spongeLayer(y, seed) {
  const m = shadowed(new THREE.Mesh(spongeGeometry(seed), [M.spongeSide, M.spongeCap, M.spongeCap]));
  m.rotation.y = seed;
  m.userData.y = y;
  m.visible = false;
  cake.add(m);
  return m;
}
function fillingLayer(y, mat) {
  const m = shadowed(new THREE.Mesh(fillingGeometry(FH), mat));
  m.userData.y = y;
  m.visible = false;
  cake.add(m);
  return m;
}

const L1 = spongeLayer(Y.l1, 0.3);
const F1 = fillingLayer(Y.f1, M.pink);
const L2 = spongeLayer(Y.l2, 2.1);
const F2 = fillingLayer(Y.f2, M.white);
const L3 = spongeLayer(Y.l3, 4.4);

// Chantilly: lateral (cresce em volta conforme a espátula passa) + topo
const chantSide = shadowed(new THREE.Mesh(new THREE.BufferGeometry(), M.chantilly));
chantSide.visible = false;
cake.add(chantSide);
let chantSideAngle = -1;
function setChantSide(angle) {
  if (Math.abs(angle - chantSideAngle) < 0.002) return;
  chantSideAngle = angle;
  chantSide.geometry.dispose();
  const h = TOP - BASE;
  const g = new THREE.CylinderGeometry(CR, CR, h, 160, 1, true, 0, Math.max(angle, 0.001));
  g.translate(0, BASE + h / 2, 0);
  chantSide.geometry = g;
  chantSide.visible = angle > 0.002;
}

const chantTop = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(CR, CR, 0.05, 160), M.chantilly));
chantTop.position.y = TOP - 0.025;
chantTop.visible = false;
cake.add(chantTop);

// Espátula
const spatula = new THREE.Group();
{
  const blade = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.6, 0.32), M.steel));
  blade.position.y = 0;
  spatula.add(blade);
  const handle = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.6, 24), M.handle));
  handle.position.set(0.03, 1.1, 0);
  spatula.add(handle);
  const neck = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 12), M.steel));
  neck.position.set(0.02, 0.85, 0);
  spatula.add(neck);
}
spatula.visible = false;
cake.add(spatula);

// Borda inferior de mini-rosetas
const rosetteGeo = rosetteGeometry();
const border = [];
{
  const n = 34;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = shadowed(new THREE.Mesh(rosetteGeo, M.chantPiped));
    m.position.set(Math.cos(a) * 1.1, BASE - 0.02, Math.sin(a) * 1.1);
    m.rotation.y = -a + i;
    m.userData.s = 0.62;
    m.visible = false;
    cake.add(m);
    border.push(m);
  }
}

// Ganache (cobertura de chocolate com escorridos)
const ganacheCap = (() => {
  const p = [
    [1.05, TOP - 0.08], [1.062, TOP - 0.07], [1.07, TOP - 0.045], [1.068, TOP - 0.015],
    [1.05, TOP + 0.01], [1.0, TOP + 0.028], [0.9, TOP + 0.034], [0.5, TOP + 0.036], [0, TOP + 0.036],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const m = shadowed(new THREE.Mesh(new THREE.LatheGeometry(p, 160), M.ganache));
  m.visible = false;
  cake.add(m);
  return m;
})();

const drips = [];
{
  const Rn = rng(17);
  const n = 30;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (Rn() - 0.5) * 0.12;
    const len = Rn() < 0.25 ? 0.06 + Rn() * 0.08 : 0.16 + Rn() * 0.42;
    const rad = 0.032 + Rn() * 0.018;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * (CR + 0.004), TOP - 0.05, Math.sin(a) * (CR + 0.004));
    pivot.rotation.y = -a;
    const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.95, 1, 16, 1, true), M.ganache));
    body.scale.x = 0.6;
    const bulb = shadowed(new THREE.Mesh(new THREE.SphereGeometry(rad * 1.18, 20, 14), M.ganache));
    bulb.scale.x = 0.62;
    pivot.add(body, bulb);
    pivot.userData = { len, body, bulb, delay: Rn() * 0.4 };
    pivot.visible = false;
    cake.add(pivot);
    drips.push(pivot);
  }
}

// Rosetas no topo (alternando branco e rosa)
const rosettes = [];
{
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = shadowed(new THREE.Mesh(rosetteGeo, i % 2 ? M.chantPink : M.chantPiped));
    m.position.set(Math.cos(a) * 0.8, TOP + 0.03, Math.sin(a) * 0.8);
    m.rotation.y = i * 1.7;
    m.userData.s = 1.15;
    m.visible = false;
    cake.add(m);
    rosettes.push(m);
  }
}

// Morangos e mirtilos no centro
const fruits = [];
{
  const sGeo = strawberryGeometry();
  const lGeo = leafGeometry();
  const makeBerry = () => {
    const g = new THREE.Group();
    const body = shadowed(new THREE.Mesh(sGeo, M.strawberry));
    const leaves = shadowed(new THREE.Mesh(lGeo, M.leaf));
    leaves.position.y = 0.17;
    const stem = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.05, 6), M.leaf));
    stem.position.y = 0.19;
    stem.rotation.z = 0.3;
    // centraliza o pivô no meio do morango
    body.position.y = -0.085;
    leaves.position.y = 0.085;
    stem.position.y = 0.105;
    g.add(body, leaves, stem);
    return g;
  };
  const up = new THREE.Vector3(0, 1, 0);
  const placements = [
    { pos: [0, 0.13, 0], dir: [0.05, 1, 0.08], scale: 1.25 },
    { pos: [0.26, 0.085, 0.05], dir: [0.9, 0.25, 0.2], scale: 1.1 },
    { pos: [-0.12, 0.085, 0.24], dir: [-0.4, 0.3, 0.9], scale: 1.1 },
    { pos: [-0.2, 0.085, -0.18], dir: [-0.7, 0.3, -0.6], scale: 1.1 },
    { pos: [0.1, 0.085, -0.27], dir: [0.3, 0.25, -0.95], scale: 1.05 },
  ];
  for (const p of placements) {
    const g = makeBerry();
    // a ponta do morango (y negativo) aponta para fora
    g.quaternion.setFromUnitVectors(up, new THREE.Vector3(...p.dir).normalize().negate());
    g.position.set(p.pos[0], TOP + 0.035 + p.pos[1], p.pos[2]);
    g.userData.s = p.scale;
    g.visible = false;
    cake.add(g);
    fruits.push(g);
  }
  const bGeo = new THREE.SphereGeometry(0.045, 24, 18);
  const Rb = rng(4);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const r = 0.42 + Rb() * 0.08;
    const m = shadowed(new THREE.Mesh(bGeo, M.blueberry));
    m.scale.set(1, 0.85, 1);
    m.position.set(Math.cos(a) * r, TOP + 0.075, Math.sin(a) * r);
    m.userData.s = 1;
    m.visible = false;
    cake.add(m);
    fruits.push(m);
  }
}

// Granulado de chocolate + pérolas douradas (instanciados)
const SPRINKLES = 260;
const PEARLS = 70;
const sprinkleMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.008, 0.032, 3, 6), M.sprinkle, SPRINKLES);
const pearlMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 12, 8), M.pearl, PEARLS);
sprinkleMesh.castShadow = pearlMesh.castShadow = true;
sprinkleMesh.visible = pearlMesh.visible = false;
cake.add(sprinkleMesh, pearlMesh);
const sprinkleData = [];
{
  const Rs = rng(31);
  const add = (count, list) => {
    for (let i = 0; i < count; i++) {
      // na faixa entre as frutas e as rosetas
      const a = Rs() * Math.PI * 2;
      const r = 0.48 + Math.sqrt(Rs()) * 0.22 + (Rs() < 0.2 ? 0.3 : 0);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + (Rs() - 0.5) * 0.4, Rs() * Math.PI, 0));
      list.push({ x: Math.cos(a) * Math.min(r, 0.98), z: Math.sin(a) * Math.min(r, 0.98), y: TOP + 0.045, q, delay: Rs() });
    }
  };
  add(SPRINKLES, sprinkleData);
  add(PEARLS, sprinkleData);
}

/* ----------------------------- lights ------------------------------------ */

const hemi = new THREE.HemisphereLight('#fff4e3', '#8a6a50', 0.55);
scene.add(hemi);

const key = new THREE.DirectionalLight('#fff1dc', 2.6);
key.position.set(4.5, 9, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -7;
key.shadow.camera.right = 7;
key.shadow.camera.top = 7;
key.shadow.camera.bottom = -7;
key.shadow.camera.near = 1;
key.shadow.camera.far = 30;
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.02;
key.shadow.radius = 6;
scene.add(key);

const rim = new THREE.DirectionalLight('#ffd9e0', 1.1);
rim.position.set(-6, 5, -5);
scene.add(rim);

const fill = new THREE.PointLight('#ffe7c9', 6, 14, 1.6);
fill.position.set(-3, 2.5, 4);
scene.add(fill);

/* ----------------------------- timeline ---------------------------------- */

// Janelas do scroll (0..1) — batem com os cartões em index.html
const T = {
  l1: [0.06, 0.13],
  f1: [0.16, 0.24],
  l2: [0.26, 0.33],
  f2: [0.36, 0.44],
  l3: [0.46, 0.53],
  chTop: [0.56, 0.59],
  chSide: [0.59, 0.67],
  border: [0.665, 0.695],
  ganache: [0.70, 0.735],
  drips: [0.72, 0.77],
  rosettes: [0.765, 0.81],
  fruits: [0.81, 0.84],
  sprinkles: [0.835, 0.865],
  zoom: [0.865, 0.97],
};

function dropLayer(mesh, t) {
  mesh.visible = t > 0;
  if (!mesh.visible) return;
  const e = easeOutCubic(t);
  mesh.position.y = mesh.userData.y + (1 - e) * 3.2;
  // pequena "assentada" ao tocar
  const land = seg(t, 0.82, 1);
  const squash = Math.sin(land * Math.PI) * 0.06;
  mesh.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
}

function spreadFilling(mesh, t) {
  mesh.visible = t > 0;
  if (!mesh.visible) return;
  const fall = easeOutCubic(seg(t, 0, 0.45));
  const spread = easeInOutCubic(seg(t, 0.35, 1));
  mesh.position.y = mesh.userData.y + (1 - fall) * 2.6;
  const s = lerp(0.35, 1, spread);
  mesh.scale.set(s, lerp(3.2, 1, spread), s);
}

function popIn(obj, t) {
  obj.visible = t > 0;
  if (!obj.visible) return;
  const s = (obj.userData.s || 1) * Math.max(0.001, easeOutBack(t, 1.6));
  obj.scale.set(s, s, s);
}

const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3(1, 1, 1);

function applyProgress(p) {
  dropLayer(L1, seg(p, ...T.l1));
  spreadFilling(F1, seg(p, ...T.f1));
  dropLayer(L2, seg(p, ...T.l2));
  spreadFilling(F2, seg(p, ...T.f2));
  dropLayer(L3, seg(p, ...T.l3));

  // chantilly topo: espalha do centro para a borda
  const ct = seg(p, ...T.chTop);
  chantTop.visible = ct > 0;
  const cs = easeOutCubic(ct);
  chantTop.scale.set(Math.max(cs, 0.001), 1, Math.max(cs, 0.001));

  // chantilly lateral + espátula dando a volta
  const st = seg(p, ...T.chSide);
  const ang = easeInOutCubic(st) * Math.PI * 2;
  setChantSide(ang);
  const spatIn = seg(p, T.chSide[0] - 0.015, T.chSide[0] + 0.01);
  const spatOut = seg(p, T.chSide[1] - 0.005, T.chSide[1] + 0.02);
  spatula.visible = spatIn > 0 && spatOut < 1;
  if (spatula.visible) {
    const off = (1 - easeOutCubic(spatIn)) * 1.5 + easeInOutCubic(spatOut) * 1.5;
    const th = ang;
    const rr = CR + 0.012 + off;
    spatula.position.set(Math.sin(th) * rr, BASE + 0.82 + off * 0.3, Math.cos(th) * rr);
    spatula.rotation.set(0, th - Math.PI / 2, 0);
    spatula.rotateZ(-0.12);
  }

  border.forEach((b, i) => popIn(b, seg(p, T.border[0] + (i / border.length) * 0.02, T.border[0] + (i / border.length) * 0.02 + 0.01)));

  // ganache
  const gt = seg(p, ...T.ganache);
  ganacheCap.visible = gt > 0;
  const gs = lerp(0.25, 1, easeOutCubic(gt));
  ganacheCap.scale.set(gs, 1, gs);
  ganacheCap.position.y = (1 - easeOutCubic(seg(gt, 0, 0.4))) * 0.5;

  const dt = seg(p, ...T.drips);
  for (const d of drips) {
    const { len, body, bulb, delay } = d.userData;
    const k = easeOutCubic(seg(dt, delay, delay + 0.6));
    d.visible = k > 0;
    const L = Math.max(len * k, 0.001);
    body.scale.y = L;
    body.position.y = -L / 2;
    bulb.position.y = -L;
    bulb.scale.y = 0.4 + 0.6 * k;
    bulb.scale.z = 0.4 + 0.6 * k;
  }

  rosettes.forEach((r, i) => {
    const a = T.rosettes[0] + (i / rosettes.length) * 0.032;
    popIn(r, seg(p, a, a + 0.012));
  });

  fruits.forEach((f, i) => {
    const a = T.fruits[0] + (i / fruits.length) * 0.022;
    const t = seg(p, a, a + 0.01);
    f.visible = t > 0;
    if (!f.visible) return;
    const s = f.userData.s;
    f.scale.set(s, s, s);
    f.userData.baseY ??= f.position.y;
    f.position.y = f.userData.baseY + (1 - easeOutCubic(t)) * 1.6;
  });

  // granulado caindo
  const sp = seg(p, ...T.sprinkles);
  sprinkleMesh.visible = pearlMesh.visible = sp > 0;
  if (sp > 0) {
    for (let i = 0; i < sprinkleData.length; i++) {
      const d = sprinkleData[i];
      const k = easeOutCubic(seg(sp, d.delay * 0.6, d.delay * 0.6 + 0.4));
      tmpP.set(d.x, d.y + (1 - k) * 2.2, d.z);
      tmpS.setScalar(k > 0 ? 1 : 0);
      tmpM.compose(tmpP, d.q, tmpS);
      if (i < SPRINKLES) sprinkleMesh.setMatrixAt(i, tmpM);
      else pearlMesh.setMatrixAt(i - SPRINKLES, tmpM);
    }
    sprinkleMesh.instanceMatrix.needsUpdate = true;
    pearlMesh.instanceMatrix.needsUpdate = true;
  }
}

/* ----------------------------- camera ------------------------------------ */

const vfov = THREE.MathUtils.degToRad(camera.fov);
function fitDistance(w, h, aspect) {
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  return Math.max(w / (2 * Math.tan(hfov / 2)), h / (2 * Math.tan(vfov / 2)));
}

const target = new THREE.Vector3();
function updateCamera(p, time) {
  const aspect = camera.aspect;
  const portrait = aspect < 0.9;
  // altura do bolo construído até agora — mantém o bolo no centro
  const built = BASE
    + LH * (seg(p, ...T.l1) + seg(p, ...T.l2) + seg(p, ...T.l3))
    + FH * (seg(p, ...T.f1) + seg(p, ...T.f2))
    + 0.2 * seg(p, ...T.rosettes);
  const z = easeInOutCubic(seg(p, ...T.zoom));

  const closeD = fitDistance(portrait ? 3.2 : 3.9, 3.3, aspect);
  const farD = fitDistance(portrait ? 4.3 : 8.4, 5.2, aspect);
  const dist = lerp(closeD, farD, z);
  const elev = THREE.MathUtils.degToRad(lerp(17, 22, z));
  const az = lerp(0, -0.3, z) + Math.sin(time * 0.15) * 0.03;

  const ty = lerp(Math.max(0.4, built * 0.55 + 0.05), 0.25, z);
  target.set(0, ty, 0);
  camera.position.set(
    target.x + Math.sin(az) * Math.cos(elev) * dist,
    target.y + Math.sin(elev) * dist,
    target.z + Math.cos(az) * Math.cos(elev) * dist,
  );
  camera.lookAt(target);

  // no celular o cartão fica embaixo: sobe um pouco o bolo na tela
  const h = renderer.domElement.clientHeight;
  const w = renderer.domElement.clientWidth;
  const shift = ((portrait ? 0.1 : 0) + z * 0.08) * h;
  if (shift) camera.setViewOffset(w, h, 0, shift, w, h);
  else camera.clearViewOffset();

  // o bolo gira devagar enquanto é montado
  cake.rotation.y = p * Math.PI * 1.6 + time * 0.05;
}

/* ----------------------------- UI sync ----------------------------------- */

const steps = [...document.querySelectorAll('.step')];
const rail = document.querySelector('.rail');
const railItems = [...document.querySelectorAll('.rail li')];

function updateUI(p) {
  for (const s of steps) {
    const on = p >= parseFloat(s.dataset.start) && p < parseFloat(s.dataset.end);
    s.classList.toggle('is-active', on);
  }
  let current = -1;
  railItems.forEach((li, i) => {
    if (p >= parseFloat(li.dataset.at)) current = i;
  });
  railItems.forEach((li, i) => {
    li.classList.toggle('is-done', i < current);
    li.classList.toggle('is-current', i === current);
  });
  rail.classList.toggle('is-hidden', p < 0.04 || p > 0.87);
}

/* ----------------------------- loop -------------------------------------- */

function scrollProgress() {
  const rect = build.getBoundingClientRect();
  const total = build.offsetHeight - window.innerHeight;
  return clamp01(-rect.top / Math.max(total, 1));
}

let target_p = scrollProgress();
let smooth_p = target_p;
let lastUI = -1;
let visible = true;

new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);
window.addEventListener('scroll', () => { target_p = scrollProgress(); }, { passive: true });

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  if (!visible) return;
  const time = clock.getElapsedTime();
  smooth_p += (target_p - smooth_p) * 0.09;
  if (Math.abs(target_p - smooth_p) < 0.00005) smooth_p = target_p;
  applyProgress(smooth_p);
  updateCamera(smooth_p, time);
  if (Math.abs(lastUI - target_p) > 0.0005) {
    updateUI(target_p);
    lastUI = target_p;
  }
  renderer.render(scene, camera);
}

// Garante a fonte do rótulo antes de compilar e então revela a cena.
// Gancho para testes automatizados: renderiza um quadro num progresso fixo.
const DEBUG = new URLSearchParams(location.search).has('still');
window.__renderAt = (p) => {
  applyProgress(p);
  updateCamera(p, 0);
  updateUI(p);
  renderer.render(scene, camera);
};

(document.fonts?.ready ?? Promise.resolve()).finally(() => {
  if (DEBUG) {
    loader.classList.add('is-done');
    return;
  }
  applyProgress(smooth_p);
  updateCamera(smooth_p, 0);
  renderer.compile(scene, camera);
  updateUI(target_p);
  frame();
  setTimeout(() => loader.classList.add('is-done'), 150);
  console.log(`cake ready in ${Math.round(performance.now() - t0)}ms`);
});
