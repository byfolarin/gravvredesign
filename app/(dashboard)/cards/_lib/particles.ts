/** Particle helpers for the Cards onboarding (stars → card → page). */

export const ease = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
  weight: number;
  mint: boolean;
};

export function parseRgb(color: string) {
  const m = color.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255, 1];
  return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 };
}

/** Where the dots land: text boxes, coloured fills (meters, thumbs, avatars) and hairlines. */
export function measureTargets(
  root: HTMLElement,
  brand: string,
  W: number,
  H: number,
): Rect[] {
  const out: Rect[] = [];
  const inView = (r: DOMRect) =>
    r.width > 0 &&
    r.height > 0 &&
    r.bottom > 0 &&
    r.top < H &&
    r.right > 0 &&
    r.left < W;
  const brandRgb = parseRgb(brand);
  const isBrand = (c: string) => {
    const v = parseRgb(c);
    return (
      v.a > 0.5 &&
      Math.abs(v.r - brandRgb.r) +
        Math.abs(v.g - brandRgb.g) +
        Math.abs(v.b - brandRgb.b) <
        30
    );
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    const parent = n.parentElement;
    if (!parent || parent.closest(".sr-only")) continue;
    // Rolling digits stack 0–9 in a clipped column; only the visible window counts.
    const clip = parent
      .closest<HTMLElement>('[style*="clip-path"]')
      ?.getBoundingClientRect();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (!inView(r)) continue;
      if (clip && (r.bottom <= clip.top + 1 || r.top >= clip.bottom - 1))
        continue;
      // Glyph band only, not the full line box.
      const h = r.height * 0.62;
      out.push({
        x: r.left,
        y: r.top + (r.height - h) / 2,
        w: r.width,
        h,
        weight: r.width * h,
        mint: false,
      });
    }
  }

  for (const el of root.querySelectorAll<HTMLElement>("*")) {
    const r = el.getBoundingClientRect();
    if (!inView(r)) continue;
    const cs = getComputedStyle(el);
    const bg = parseRgb(cs.backgroundColor);
    if (
      el.tagName === "IMG" ||
      (bg.a > 0.05 && el.childElementCount === 0 && r.width * r.height < 40000)
    ) {
      const mint = isBrand(cs.backgroundColor);
      out.push({
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        weight: r.width * r.height * (mint ? 1.6 : 0.5),
        mint,
      });
    }
    if (
      parseFloat(cs.borderBottomWidth) > 0 &&
      parseRgb(cs.borderBottomColor).a > 0.03 &&
      r.width > 120
    ) {
      out.push({
        x: r.left,
        y: r.bottom - 1,
        w: r.width,
        h: 1,
        weight: r.width * 2.2,
        mint: false,
      });
    }
  }
  return out;
}

/** Points of a card face laid out like FlatCard: outline, faint fill, wordmark, number, holder, network. */
export function cardPoints(
  count: number,
  mintCount: number,
  cx: number,
  cy: number,
  cw: number,
) {
  const ch = cw / 1.586;
  const x0 = cx - cw / 2;
  const y0 = cy - ch / 2;
  const rad = cw * 0.05;
  const pts: { x: number; y: number; a: number }[] = [];
  const inRect = (x: number, y: number, w: number, h: number, a: number) =>
    pts.push({ x: x + Math.random() * w, y: y + Math.random() * h, a });

  // Wordmark "Gravv." — the brand-coloured dots (they later land on the brand meters).
  for (let i = 0; i < mintCount; i++)
    inRect(x0 + cw * 0.075, y0 + ch * 0.1, cw * 0.17, ch * 0.065, 0.95);

  const rest = count - mintCount;
  const perim = 2 * (cw + ch - 4 * rad) + 2 * Math.PI * rad;
  for (let i = 0; i < rest; i++) {
    const k = i / rest;
    if (k < 0.42) {
      // Outline: walk the rounded-rect perimeter.
      let d = Math.random() * perim;
      const sides = [cw - 2 * rad, ch - 2 * rad, cw - 2 * rad, ch - 2 * rad];
      const corners = [
        [x0 + cw - rad, y0 + rad, -Math.PI / 2],
        [x0 + cw - rad, y0 + ch - rad, 0],
        [x0 + rad, y0 + ch - rad, Math.PI / 2],
        [x0 + rad, y0 + rad, Math.PI],
      ];
      const starts = [
        [x0 + rad, y0, 1, 0],
        [x0 + cw, y0 + rad, 0, 1],
        [x0 + cw - rad, y0 + ch, -1, 0],
        [x0, y0 + ch - rad, 0, -1],
      ];
      let placed = false;
      for (let s = 0; s < 4 && !placed; s++) {
        if (d < sides[s]) {
          pts.push({
            x: starts[s][0] + starts[s][2] * d,
            y: starts[s][1] + starts[s][3] * d,
            a: 0.9,
          });
          placed = true;
        } else d -= sides[s];
        const arc = (Math.PI / 2) * rad;
        if (!placed && d < arc) {
          const [ax, ay, a0] = corners[s];
          const ang = a0 + d / rad;
          pts.push({
            x: ax + Math.cos(ang) * rad,
            y: ay + Math.sin(ang) * rad,
            a: 0.9,
          });
          placed = true;
        } else if (!placed) d -= arc;
      }
      if (!placed) pts.push({ x: x0, y: y0, a: 0.9 });
    } else if (k < 0.72) {
      inRect(x0 + 2, y0 + 2, cw - 4, ch - 4, 0.28); // faint face
    } else if (k < 0.86) {
      // •••• 4821 — four dots then four digits
      const gy = y0 + ch * 0.68;
      const slot = Math.floor(Math.random() * 9);
      const sx =
        x0 + cw * 0.075 + slot * cw * 0.034 + (slot > 3 ? cw * 0.03 : 0);
      inRect(sx, gy, cw * 0.022, ch * 0.05, 0.95);
    } else if (k < 0.93) {
      inRect(x0 + cw * 0.075, y0 + ch * 0.8, cw * 0.3, ch * 0.035, 0.55); // holder · expiry
    } else {
      inRect(x0 + cw * 0.76, y0 + ch * 0.76, cw * 0.165, ch * 0.075, 0.95); // VISA
    }
  }
  return pts;
}

export type CardArt = { data: Uint8ClampedArray; w: number; h: number };

/** Reads the card face (public/cards/aurora-front.png) small, so dots can take its colours. */
export function loadCardArt(src: string): Promise<CardArt | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = 160;
      const h = Math.round(w / (img.width / img.height));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return resolve(null);
      g.drawImage(img, 0, 0, w, h);
      resolve({ data: g.getImageData(0, 0, w, h).data, w, h });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * A dotted rendition of the card art, in card-local coordinates (centre 0,0; width cw).
 * Dots sit on a lightly jittered grid — echoing the art's own dot pattern — with colour and
 * size taken from the art (brighter = bigger), plus a ring of dots tracing the rounded edge
 * so the card keeps its shape where the art is dark. Colours are snapped to a small palette
 * so the canvas can draw them in a handful of fillStyle batches.
 */
export function cardArtPoints(count: number, art: CardArt, cw: number) {
  const ch = cw / 1.587;
  const rad = cw * 0.0222;
  const pts: { u: number; v: number; a: number; s: number; bucket: number }[] =
    [];
  const palette = new Map<string, number>();
  const colours: string[] = [];
  const colourAt = (fu: number, fv: number) => {
    const px = Math.min(art.w - 1, Math.max(0, Math.floor(fu * art.w)));
    const py = Math.min(art.h - 1, Math.max(0, Math.floor(fv * art.h)));
    const k = (py * art.w + px) * 4;
    const r = art.data[k],
      g = art.data[k + 1],
      b = art.data[k + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    // Lift the darkest greens so the card still reads on a black stage.
    const q = (n: number) =>
      Math.min(255, Math.round((n * 1.3 + 22) / 20) * 20);
    const key = `${q(r)},${q(g)},${q(b)}`;
    let bucket = palette.get(key);
    if (bucket === undefined) {
      bucket = colours.length;
      palette.set(key, bucket);
      colours.push(`rgb(${key.replaceAll(",", " ")})`);
    }
    return { lum, bucket };
  };

  // Edge ring (~7%)
  const ring = Math.round(count * 0.07);
  const perim = 2 * (cw + ch);
  for (let i = 0; i < ring; i++) {
    let d = (i / ring) * perim;
    let u: number, v: number;
    if (d < cw) [u, v] = [d - cw / 2, -ch / 2];
    else if ((d -= cw) < ch) [u, v] = [cw / 2, d - ch / 2];
    else if ((d -= ch) < cw) [u, v] = [cw / 2 - d, ch / 2];
    else [u, v] = [-cw / 2, ch / 2 - (d - cw)];
    // Pull corner points onto the rounded corner.
    const cu = Math.max(Math.abs(u) - (cw / 2 - rad), 0),
      cv = Math.max(Math.abs(v) - (ch / 2 - rad), 0);
    if (cu > 0 && cv > 0) {
      const len = Math.hypot(cu, cv);
      u = Math.sign(u) * (cw / 2 - rad + (cu / len) * rad);
      v = Math.sign(v) * (ch / 2 - rad + (cv / len) * rad);
    }
    const { lum, bucket } = colourAt(u / cw + 0.5, v / ch + 0.5);
    pts.push({
      u,
      v,
      a: 0.55 + 0.35 * lum,
      s: Math.max(1, Math.sqrt((cw * ch) / count) * 0.16),
      bucket,
    });
  }

  // Face grid
  const faceCount = count - ring;
  const step = Math.sqrt((cw * ch) / faceCount);
  const cols = Math.floor(cw / step),
    rows = Math.floor(ch / step);
  const cells: [number, number][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) cells.push([c, r]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  for (let i = 0; pts.length < count; i++) {
    const [c, r] = cells[i % cells.length];
    const u = -cw / 2 + (c + 0.5 + (Math.random() - 0.5) * 0.3) * (cw / cols);
    const v = -ch / 2 + (r + 0.5 + (Math.random() - 0.5) * 0.3) * (ch / rows);
    const { lum, bucket } = colourAt(u / cw + 0.5, v / ch + 0.5);
    // Dot size follows the grid step, so the card reads the same at any scale.
    pts.push({
      u,
      v,
      a: 0.3 + 0.7 * lum,
      s: Math.max(1, step * (0.14 + 0.32 * lum)),
      bucket,
    });
  }
  return { pts, colours };
}
