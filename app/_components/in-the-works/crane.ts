// A tower crane in a yard of crates, moving three mint boxes one at a time from a
// pile on the left to a pile on the right (and back), rendered in 3D into the Gravv
// dot-matrix style (square dots, six tones). The scene is built from voxels and
// ray-cast from a high camera at the top right, so faces, foreshortening and shadows
// are real. For each box the crane stops, runs the trolley out to reach it, lowers,
// hooks, hoists, runs the trolley back in, then slews — and the load sways on its
// cable as the crane starts and stops.

type V3 = [number, number, number];

// ——— Materials ———
const STEEL = 1;
const CRATE = 2;
const BAND = 3;
const CABLE = 4;
const WEIGHT = 5;
const GLASS = 6;
// The boxes being moved wear the brand colour.
const MINT = 7;
const MINT_BAND = 8;

/** Accent tones are returned offset by this, so the page can colour them with the brand ramp. */
export const ACCENT = 10;
/** Ground dots get their own token so they stay faint in both themes. */
export const GROUND = 20;

/** Brightest tone each material reaches on a fully lit face. */
const MAX_TONE: Record<number, number> = {
  [STEEL]: 5,
  [CRATE]: 4,
  [BAND]: 3,
  [CABLE]: 4,
  [WEIGHT]: 3,
  [GLASS]: 2,
  [MINT]: 5,
  [MINT_BAND]: 3,
};

// ——— A small voxel grid, used for the world and for shapes in their own frame ———

class Grid {
  data: Uint8Array;
  x0: number;
  y0: number;
  z0: number;
  nx: number;
  ny: number;
  nz: number;
  constructor(
    x0: number,
    y0: number,
    z0: number,
    nx: number,
    ny: number,
    nz: number,
  ) {
    this.x0 = x0;
    this.y0 = y0;
    this.z0 = z0;
    this.nx = nx;
    this.ny = ny;
    this.nz = nz;
    this.data = new Uint8Array(nx * ny * nz);
  }
  get(x: number, y: number, z: number) {
    const i = x - this.x0;
    const j = y - this.y0;
    const k = z - this.z0;
    return i >= 0 &&
      i < this.nx &&
      j >= 0 &&
      j < this.ny &&
      k >= 0 &&
      k < this.nz
      ? this.data[i + this.nx * (j + this.ny * k)]
      : 0;
  }
  set(x: number, y: number, z: number, m: number) {
    const i = Math.round(x) - this.x0;
    const j = Math.round(y) - this.y0;
    const k = Math.round(z) - this.z0;
    if (i >= 0 && i < this.nx && j >= 0 && j < this.ny && k >= 0 && k < this.nz)
      this.data[i + this.nx * (j + this.ny * k)] = m;
  }
  /** Solid block, inclusive bounds. */
  block(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    m: number,
  ) {
    for (let z = z0; z <= z1; z++)
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) this.set(x, y, z, m);
  }
  /** Straight run of voxels between two points (cables, braces). */
  line(a: V3, b: V3, m: number) {
    const n =
      Math.ceil(Math.max(...a.map((v, i) => Math.abs(b[i] - v)))) * 2 + 1;
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      this.set(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
        m,
      );
    }
  }
  /** A crate with darker banding along its edges and a cross band on top. */
  crate(
    x0: number,
    y0: number,
    z0: number,
    w: number,
    d: number,
    h: number,
    body = CRATE,
    band = BAND,
  ) {
    const x1 = x0 + w - 1;
    const y1 = y0 + d - 1;
    const z1 = z0 + h - 1;
    for (let z = z0; z <= z1; z++)
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const edges =
            +(x === x0 || x === x1) +
            +(y === y0 || y === y1) +
            +(z === z0 || z === z1);
          const cross =
            z === z1 &&
            (x === Math.floor((x0 + x1) / 2) ||
              y === Math.floor((y0 + y1) / 2));
          this.set(x, y, z, edges >= 2 || cross ? band : body);
        }
  }
}

// ——— World ———

const NX = 88;
const NY = 88;
const NZ = 52;
const world = new Grid(0, 0, 0, NX, NY, NZ);
/** Mast centre; the crane slews around this. */
const CX = 44;
const CY = 44;
const TOP = 32; // top of the mast
const JZ = TOP + 2; // jib deck height
const R_IN = 17; // trolley parked while slewing
const R_OUT = 24; // trolley reaching over a pile
const BOX = 7; // mint box footprint
const BOX_H = 5;
const STACK = 3; // boxes that travel between the piles
const SLING = 4; // hook to box top

// Mast: 4×4 lattice with corner chords and open bracing, so it reads at dot scale.
{
  const mx = CX - 2;
  const my = CY - 2;
  const w = 3;
  for (let z = 0; z <= TOP; z++) {
    for (const [cx, cy] of [
      [mx, my],
      [mx + w, my],
      [mx, my + w],
      [mx + w, my + w],
    ])
      world.set(cx, cy, z, STEEL);
    const bay = z % 6;
    if (bay === 0) {
      world.block(mx, my, z, mx + w, my, z, STEEL);
      world.block(mx, my + w, z, mx + w, my + w, z, STEEL);
      world.block(mx, my, z, mx, my + w, z, STEEL);
      world.block(mx + w, my, z, mx + w, my + w, z, STEEL);
    } else if (bay === 2 || bay === 4) {
      const k = bay === 2 ? 1 : 2;
      const o = Math.floor(z / 6) % 2 ? w - k : k;
      world.set(mx + o, my, z, STEEL);
      world.set(mx + w - o, my + w, z, STEEL);
      world.set(mx, my + w - o, z, STEEL);
      world.set(mx + w, my + o, z, STEEL);
    }
  }
  world.block(mx - 2, my - 2, 0, mx + w + 2, my + w + 2, 0, WEIGHT); // footing
}

// ——— Camera: high and to the top right, looking down ———

const norm = (v: V3): V3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const AZ = (-32 * Math.PI) / 180; // camera sits east-south-east…
const EL = (42 * Math.PI) / 180; // …and well above the site
const toCam = norm([
  Math.cos(EL) * Math.cos(AZ),
  Math.cos(EL) * Math.sin(AZ),
  Math.sin(EL),
]);
const dir: V3 = [-toCam[0], -toCam[1], -toCam[2]];
const right = norm(cross(dir, [0, 0, 1]));
const up = cross(right, dir);
// Sun from the upper left of the frame, so left-facing sides read lit and shadows fall right.
const sun = norm([
  -right[0] * 0.6 + toCam[0] * 0.25,
  -right[1] * 0.6 + toCam[1] * 0.25,
  0.85,
]);

// Pile angles around the mast: one to the screen-left, one to the screen-right, both
// swung a little away from the camera so the mast never hides them.
const deg = Math.PI / 180;
const away = Math.atan2(dir[1], dir[0]);
const PICK = away + 62 * deg; // screen-left
const DROP = away - 62 * deg; // screen-right
const polar = (theta: number, r: number): [number, number] => [
  CX + r * Math.cos(theta),
  CY + r * Math.sin(theta),
];

// ——— Shapes in their own frame, rotated into the world ———

/** A single crate centred on the origin. */
function crateShape(z0: number, w = BOX, h = BOX_H, body = CRATE, band = BAND) {
  const c0 = -Math.floor(w / 2);
  const g = new Grid(c0, c0, 0, w, w, NZ);
  g.crate(c0, c0, z0, w, w, h, body, band);
  return g;
}

/**
 * Write a shape into the world, rotated by `theta` about (ox, oy). Each world voxel
 * looks up the shape (inverse mapping), so rotated parts stay solid with no holes.
 */
function stamp(
  target: Grid,
  shape: Grid,
  ox: number,
  oy: number,
  theta: number,
) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const r = Math.hypot(
    Math.max(Math.abs(shape.x0), Math.abs(shape.x0 + shape.nx)),
    Math.max(Math.abs(shape.y0), Math.abs(shape.y0 + shape.ny)),
  );
  const xa = Math.max(0, Math.floor(ox - r));
  const xb = Math.min(NX - 1, Math.ceil(ox + r));
  const ya = Math.max(0, Math.floor(oy - r));
  const yb = Math.min(NY - 1, Math.ceil(oy + r));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - ox;
      const dy = y + 0.5 - oy;
      const lx = Math.floor(dx * c + dy * s);
      const ly = Math.floor(-dx * s + dy * c);
      if (
        lx < shape.x0 ||
        lx >= shape.x0 + shape.nx ||
        ly < shape.y0 ||
        ly >= shape.y0 + shape.ny
      )
        continue;
      for (let z = shape.z0; z < shape.z0 + shape.nz; z++) {
        const m = shape.get(lx, ly, z);
        if (m) target.set(x, y, z, m);
      }
    }
}

// A couple of crates waiting off to the side, so the site reads as a yard.
{
  const t = PICK + 0.55;
  const r = 30;
  stamp(world, crateShape(0), ...polar(t, r), t);
  stamp(world, crateShape(0), ...polar(t + 0.3, r), t + 0.3);
  // …and one on the right, for balance
  const t2 = DROP - 0.5;
  stamp(world, crateShape(0), ...polar(t2, r), t2);
}
// Pallet-like bases under the two piles
for (const theta of [PICK, DROP]) {
  const [x, y] = polar(theta, R_OUT);
  const g = new Grid(-5, -5, 0, 10, 10, 1);
  g.block(-5, -5, 0, 4, 4, 0, WEIGHT);
  stamp(world, g, x, y, theta);
}

/** Everything that never moves, so each frame can start from it. */
const still = world.data.slice();

// ——— Timeline ———

const LEG_SECONDS = 8; // unhurried, so each move reads
const LEGS = STACK * 2; // all three left → right, then back
export const LOOP_SECONDS = LEG_SECONDS * LEGS;

const HOOK_HIGH = 28;
/** Hook height with a box resting at stack level `l` (0 = on the pallet). */
const hookAt = (l: number) => 1 + l * BOX_H + BOX_H + SLING + 1;

const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const span = (u: number, a: number, b: number) => ease((u - a) / (b - a));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

type Pose = {
  theta: number; // slew angle
  r: number; // trolley distance along the jib
  hookZ: number;
  hooked: boolean;
  /** Boxes resting on each pile (not counting one on the hook). */
  left: number;
  rightCount: number;
};

/**
 * Leg k: carry the top box from one pile to the other. Each leg first swings empty to
 * the source if needed, then: trolley out, lower, hook, hoist, trolley in, slew,
 * trolley out, lower, release, hoist clear and trolley in.
 */
function pose(time: number): Pose {
  const T = ((time % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  const k = Math.floor(T / LEG_SECONDS);
  const u = (T - k * LEG_SECONDS) / LEG_SECONDS;
  const forward = k < STACK; // left → right
  const i = forward ? k : k - STACK; // boxes already moved this direction
  const src = forward ? PICK : DROP;
  const dst = forward ? DROP : PICK;
  // Where the crane ended the previous leg.
  const prev = k === 0 || k === STACK ? src : dst;
  const srcCount = STACK - i; // boxes on the source pile before this pick
  const dstCount = i;
  const srcLevel = srcCount - 1;
  const dstLevel = dstCount;

  const ret = span(u, 0, 0.16); // empty swing back to the source
  const out1 = span(u, 0.16, 0.24);
  const low1 = span(u, 0.24, 0.34);
  const up1 = span(u, 0.38, 0.48);
  const in1 = span(u, 0.48, 0.55);
  const slew = span(u, 0.55, 0.74);
  const out2 = span(u, 0.74, 0.8);
  const low2 = span(u, 0.8, 0.89);
  const up2 = span(u, 0.92, 1);

  let theta = mix(prev, src, ret);
  if (u >= 0.55) theta = mix(src, dst, slew);
  let r = R_IN;
  if (u >= 0.16 && u < 0.48) r = mix(R_IN, R_OUT, out1);
  else if (u >= 0.48 && u < 0.74) r = mix(R_OUT, R_IN, in1);
  else if (u >= 0.74 && u < 0.92) r = mix(R_IN, R_OUT, out2);
  else if (u >= 0.92) r = mix(R_OUT, R_IN, up2);

  let hookZ = HOOK_HIGH;
  if (u >= 0.24 && u < 0.38) hookZ = mix(HOOK_HIGH, hookAt(srcLevel), low1);
  else if (u >= 0.38 && u < 0.74) hookZ = mix(hookAt(srcLevel), HOOK_HIGH, up1);
  else if (u >= 0.8 && u < 0.92) hookZ = mix(HOOK_HIGH, hookAt(dstLevel), low2);
  else if (u >= 0.92) hookZ = mix(hookAt(dstLevel), HOOK_HIGH, up2);

  const hooked = u >= 0.36 && u < 0.9;
  const onSrc = hooked || u >= 0.9 ? srcCount - 1 : srcCount;
  const onDst = u >= 0.9 ? dstCount + 1 : dstCount;
  return {
    theta,
    r,
    hookZ,
    hooked,
    left: forward ? onSrc : onDst,
    rightCount: forward ? onDst : onSrc,
  };
}

// ——— The load swings on its cable: a damped pendulum driven by the trolley's motion ———

const SIM_HZ = 120;
const SIM_STEPS = Math.round(LOOP_SECONDS * SIM_HZ);
const swayX = new Float32Array(SIM_STEPS);
const swayY = new Float32Array(SIM_STEPS);
{
  const OMEGA = (2 * Math.PI) / 1.7; // ~1.7 s swing period
  const DAMP = 1.9; // settles during the pauses to hook and release
  const DRIVE = 0.24; // keeps the sway readable but not wild, in voxels
  const dt = 1 / SIM_HZ;
  const at = (s: number) => {
    const p = pose(s * dt);
    return polar(p.theta, p.r);
  };
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  // Run the loop twice so the second pass starts from a settled, periodic state.
  for (let pass = 0; pass < 2; pass++)
    for (let s = 0; s < SIM_STEPS; s++) {
      const [x0, y0] = at(s - 1);
      const [x1, y1] = at(s);
      const [x2, y2] = at(s + 1);
      const ax = (x2 - 2 * x1 + x0) / (dt * dt);
      const ay = (y2 - 2 * y1 + y0) / (dt * dt);
      vx += (-OMEGA * OMEGA * x - DAMP * vx - DRIVE * ax) * dt;
      vy += (-OMEGA * OMEGA * y - DAMP * vy - DRIVE * ay) * dt;
      x += vx * dt;
      y += vy * dt;
      if (pass === 1) {
        swayX[s] = x;
        swayY[s] = y;
      }
    }
}

// ——— The upper crane, built in its own frame: +x along the jib, y across it ———

function upperCrane(p: Pose, swayLocal: [number, number]) {
  const g = new Grid(-22, -9, 0, 70, 19, NZ);
  // Slewing ring and the operator cab on the side
  g.block(-3, -3, TOP + 1, 2, 2, TOP + 1, STEEL);
  g.block(-1, 3, TOP - 2, 2, 5, TOP + 1, STEEL);
  g.block(2, 3, TOP - 1, 2, 4, TOP, GLASS);
  // Jib: triangular truss
  for (let x = 2; x <= 32; x++) {
    g.set(x, -2, JZ, STEEL);
    g.set(x, 1, JZ, STEEL);
    g.set(x, -1, JZ + 2, STEEL);
    g.set(x, 0, JZ + 2, STEEL);
    if (x % 3 === 0) {
      g.block(x, -2, JZ, x, 1, JZ, STEEL);
      g.set(x, -2, JZ + 1, STEEL);
      g.set(x, 1, JZ + 1, STEEL);
    } else if (x % 3 === 1) {
      g.set(x, -1, JZ + 1, STEEL);
      g.set(x, 0, JZ + 1, STEEL);
    }
  }
  // Counter-jib deck, rails and counterweight
  for (let x = -18; x <= -3; x++) {
    g.block(x, -2, JZ, x, 1, JZ, STEEL);
    if (x % 2 === 0) {
      g.set(x, -2, JZ + 1, STEEL);
      g.set(x, 1, JZ + 1, STEEL);
    }
  }
  g.block(-18, -3, JZ - 4, -13, 2, JZ - 1, WEIGHT);
  // Tower head and pendant lines
  g.block(-1, -1, JZ + 1, 0, 0, JZ + 7, STEEL);
  g.line([-0.5, -0.5, JZ + 7], [28, -0.5, JZ + 2], CABLE);
  g.line([-0.5, -0.5, JZ + 7], [-18, -0.5, JZ + 1], CABLE);
  // Trolley, then the hook hanging off it — displaced by the sway, so the cable leans.
  const tx = Math.round(p.r);
  g.block(tx - 1, -2, JZ - 1, tx + 1, 1, JZ - 1, STEEL);
  const hx = p.r + swayLocal[0];
  const hy = swayLocal[1];
  const hz = Math.round(p.hookZ);
  g.line([tx, -1, JZ - 2], [hx, hy - 0.5, hz + 1], CABLE);
  g.line([tx, 0, JZ - 2], [hx, hy + 0.5, hz + 1], CABLE);
  g.block(
    Math.round(hx) - 1,
    Math.round(hy - 0.5),
    hz - 1,
    Math.round(hx) + 1,
    Math.round(hy + 0.5),
    hz,
    STEEL,
  );
  if (p.hooked) {
    const lz = hz - 1 - SLING - BOX_H;
    const c0 = -Math.floor(BOX / 2);
    const bx = Math.round(hx) + c0;
    const by = Math.round(hy) + c0;
    g.crate(bx, by, lz, BOX, BOX, BOX_H, MINT, MINT_BAND);
    for (const [sx, sy] of [
      [bx, by],
      [bx + BOX - 1, by],
      [bx, by + BOX - 1],
      [bx + BOX - 1, by + BOX - 1],
    ])
      g.line([hx, hy, hz - 1], [sx, sy, lz + BOX_H], CABLE);
  }
  return g;
}

/** A pile of `count` mint boxes on a pallet. */
function pileShape(count: number) {
  const c0 = -Math.floor(BOX / 2);
  const g = new Grid(c0, c0, 0, BOX, BOX, NZ);
  for (let l = 0; l < count; l++)
    g.crate(c0, c0, 1 + l * BOX_H, BOX, BOX, BOX_H, MINT, MINT_BAND);
  return g;
}

// ——— Rendering ———

// Amanatides–Woo voxel walk through the world. Returns the first solid voxel and its face normal.
function cast(
  o: V3,
  d: V3,
  maxT = 700,
): { t: number; m: number; n: V3 } | null {
  let t0 = 0;
  let t1 = maxT;
  const hi = [NX, NY, NZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < 0 || o[i] >= hi[i]) return null;
      continue;
    }
    let a = (0 - o[i]) / d[i];
    let b = (hi[i] - o[i]) / d[i];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
  }
  if (t0 > t1) return null;
  const p: V3 = [
    o[0] + d[0] * (t0 + 1e-6),
    o[1] + d[1] * (t0 + 1e-6),
    o[2] + d[2] * (t0 + 1e-6),
  ];
  const c = p.map((v, i) => Math.min(hi[i] - 1, Math.max(0, Math.floor(v))));
  const step = d.map((v) => (v > 0 ? 1 : -1));
  const tMax = c.map((v, i) =>
    Math.abs(d[i]) < 1e-9
      ? Infinity
      : t0 + ((d[i] > 0 ? v + 1 : v) - p[i]) / d[i],
  );
  const tDelta = d.map((v) =>
    Math.abs(v) < 1e-9 ? Infinity : Math.abs(1 / v),
  );
  let axis = -1;
  let t = t0;
  while (t <= t1) {
    const m = world.data[c[0] + NX * (c[1] + NY * c[2])];
    if (m) {
      const n: V3 = [0, 0, 0];
      if (axis >= 0) n[axis] = -step[axis];
      else n[2] = 1;
      return { t, m, n };
    }
    axis =
      tMax[0] < tMax[1]
        ? tMax[0] < tMax[2]
          ? 0
          : 2
        : tMax[1] < tMax[2]
          ? 1
          : 2;
    t = tMax[axis];
    c[axis] += step[axis];
    tMax[axis] += tDelta[axis];
    if (c[axis] < 0 || c[axis] >= hi[axis]) return null;
  }
  return null;
}

const shadowed = (p: V3, n: V3) =>
  cast(
    [
      p[0] + n[0] * 0.02 + sun[0] * 0.05,
      p[1] + n[1] * 0.02 + sun[1] * 0.05,
      p[2] + n[2] * 0.02 + sun[2] * 0.05,
    ],
    sun,
  ) !== null;

const hash = (x: number, y: number) => {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

// Frame the yard and everything the crane sweeps: a cylinder around the mast.
let uMin = Infinity;
let uMax = -Infinity;
let vMin = Infinity;
let vMax = -Infinity;
for (let k = 0; k < 72; k++) {
  const a = (k / 72) * Math.PI * 2;
  for (const [r, z] of [
    [37, 0],
    [37, 12],
    [33, JZ + 8],
  ]) {
    const p: V3 = [CX + r * Math.cos(a), CY + r * Math.sin(a), z];
    const u = dot(p, right);
    const v = dot(p, up);
    uMin = Math.min(uMin, u);
    uMax = Math.max(uMax, u);
    vMin = Math.min(vMin, v);
    vMax = Math.max(vMax, v);
  }
}
// The jib never points at the camera, so the top of the cylinder's front half stays empty.
vMax -= 4;
uMin -= 2;
uMax += 2;

/** Dots across the frame. */
export const COLS = 108;
const S = (uMax - uMin) / COLS; // world units per dot
export const ROWS = Math.ceil((vMax - vMin) / S);

const GROUND_R = 40;

/**
 * Dots for time t in [0, 1) of the loop.
 * Values: −1 empty, 0…5 grey (darkest → highlight), ACCENT + 0…5 brand mint, GROUND.
 */
export function renderFrame(t: number): Int8Array {
  const u = ((t % 1) + 1) % 1;
  const time = u * LOOP_SECONDS;
  const p = pose(time);
  const step = Math.floor(u * SIM_STEPS) % SIM_STEPS;
  // World sway → the crane's own frame
  const c = Math.cos(p.theta);
  const s = Math.sin(p.theta);
  const sway: [number, number] = [
    swayX[step] * c + swayY[step] * s,
    -swayX[step] * s + swayY[step] * c,
  ];

  world.data.set(still);
  const [lx, ly] = polar(PICK, R_OUT);
  const [rx, ry] = polar(DROP, R_OUT);
  stamp(world, pileShape(p.left), lx, ly, PICK);
  stamp(world, pileShape(p.rightCount), rx, ry, DROP);
  stamp(world, upperCrane(p, sway), CX, CY, p.theta);

  const out = new Int8Array(COLS * ROWS).fill(-1);
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const su = uMin + (i + 0.5) * S;
      const sv = vMax - (j + 0.5) * S;
      const o: V3 = [
        right[0] * su + up[0] * sv - dir[0] * 300,
        right[1] * su + up[1] * sv - dir[1] * 300,
        right[2] * su + up[2] * sv - dir[2] * 300,
      ];
      const hit = cast(o, dir);
      let tone = -1;
      if (hit) {
        const q: V3 = [
          o[0] + dir[0] * hit.t,
          o[1] + dir[1] * hit.t,
          o[2] + dir[2] * hit.t,
        ];
        // Tops catch the sky; sides split into a lit and a shade face.
        const light =
          hit.n[2] > 0 ? 1 : 0.28 + 0.6 * Math.max(0, dot(hit.n, sun));
        const lit = shadowed(q, hit.n) ? light * 0.55 : light;
        tone = Math.max(0, Math.round(lit * MAX_TONE[hit.m]));
        if (hit.m === MINT || hit.m === MINT_BAND) tone += ACCENT;
        // Weathered texture, like the brand illustrations (cables stay continuous).
        if (hit.m !== CABLE && hash(i, j) < 0.04) tone = -1;
      } else if (dir[2] < 0) {
        // Ground plane: sparse dots that fade out, broken by real shadows.
        const tg = -o[2] / dir[2];
        const q: V3 = [o[0] + dir[0] * tg, o[1] + dir[1] * tg, 0];
        const r = Math.hypot(q[0] - CX, q[1] - CY) / GROUND_R;
        if (r < 1) {
          const inShadow =
            cast([q[0] + sun[0] * 0.05, q[1] + sun[1] * 0.05, 0.05], sun) !==
            null;
          const density = inShadow ? 0 : 0.32 * (1 - r) ** 1.5;
          if (hash(i + 31, j + 17) < density) tone = GROUND;
        }
      }
      out[j * COLS + i] = tone;
    }
  }
  return out;
}
