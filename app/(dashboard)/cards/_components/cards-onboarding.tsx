"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CreditCardIcon } from "@hugeicons/core-free-icons";
import { Check, Volume2, VolumeX } from "lucide-react";
import { MUTE_KEY, OnboardingSound } from "../_lib/onboarding-sound";
import { Dropdown } from "@/app/_components/dropdown";

import type { CardType, FundingSource } from "../_data";
import { money } from "../_lib/format";
import {
  cardArtPoints,
  cardPoints,
  clamp01,
  ease,
  loadCardArt,
  measureTargets,
  parseRgb,
  wrapAngle,
  type CardArt,
  type Rect,
} from "../_lib/particles";

const CARD_ART = "/cards/aurora-front.png"; // Figma: Gravv Branding › Aurora — Front

/**
 * First-run Cards onboarding (empty account), after Mercury Books' sign-up transition.
 * Gravv doesn't issue cards from the dashboard: you request card issuing once here, then
 * issue cards through the API.
 *   1. Welcome — the sidebar slides away, the page goes dark, stars drift behind a short pitch.
 *   2. Issue cards — stars swirl into a dotted Aurora card (dots take the art's colours) that
 *      floats large on the left; the request form comes up in the centre.
 *   3. Request access → reviewing → granted (the dotted card streams across to the other side).
 *   4. Go to Cards — the card breaks apart into the (still empty) Cards page, which fades in
 *      under the dots and waits for the first card from the API; the sidebar slides back.
 * Always dark, whatever the theme; nothing sits on a panel — text floats on the stars.
 */

type Step =
  | "welcome"
  | "forming"
  | "request"
  | "reviewing"
  | "granted"
  | "leaving"
  | "reveal";

type UseCase = "customers" | "team" | "vendors";
type TypeChoice = "Virtual" | "Physical" | "Both";

export type CardsRequest = {
  useCase: UseCase;
  types: CardType[];
  volume: string;
  funding: FundingSource;
};

const GATHER_FOR = 1500; // swirl into the card (+ up to 520ms stagger)
const HOLD_UPRIGHT = 500; // the formed card holds a beat before moving up
const LAY_FOR = 1300; // card glides up into its slot above the form…
const LAY_STAGGER = 140; // …top edge leading slightly
const BACKDROP = 1; // the card stays fully lit above the form
const STACK_GAP = 44; // card ↔ form
const SCAN_FOR = 1700; // review: one soft scan along the card
const RIPPLE_FOR = 1100; // granted: one ripple from the centre (ms per card half-width)
const BURST_FOR = 950; // card → page (+ up to 560ms stagger)
const BURST_AFTER = 500; // status line before the burst
const REVEAL_AFTER_BURST = 1350;
const SIDEBAR_AFTER_REVEAL = 450;
const SIDEBAR_FOR = 1200;
const REVIEW_FOR = 1900; // "Request granted" lands as the scan finishes
const FORM_W = 440;

const FACTS = [
  {
    title: "Built for your API",
    body: "Request card issuing once here, then create and manage cards from your own product through the API.",
  },
  {
    title: "Funded from your wallets",
    body: "Cards draw from USDC on Ethereum or Solana, or from your USD account.",
  },
  {
    title: "Limits that hold",
    body: "Cap spend per day, week or month, and freeze a card in one call.",
  },
];

const USE_CASES: { id: UseCase; label: string; title: string; hint: string }[] =
  [
    {
      id: "customers",
      label: "Customers",
      title: "Cards for your customers",
      hint: "Cards for your users, in your product",
    },
    {
      id: "team",
      label: "Team",
      title: "Cards for your team",
      hint: "Expenses, travel and software",
    },
    {
      id: "vendors",
      label: "Vendors",
      title: "Vendor payments",
      hint: "Suppliers, ads and subscriptions",
    },
  ];

const TYPE_CHOICES: { id: TypeChoice; hint: string }[] = [
  { id: "Virtual", hint: "Live the moment you issue" },
  { id: "Physical", hint: "Shipped in 5–7 days" },
  { id: "Both", hint: "Virtual now, physical on request" },
];

const VOLUMES = ["Under $50k", "$50k–$250k", "$250k–$1M", "Over $1M"];

export function CardsOnboarding({
  contentRef,
  sources,
  workspace,
  onGranted,
  onReveal,
  onDone,
}: {
  contentRef: RefObject<HTMLElement | null>;
  sources: (FundingSource & { balance: number })[];
  workspace: string;
  onGranted: (request: CardsRequest) => void;
  onReveal: () => void;
  onDone: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Commands from the UI into the animation loop.
  const cmd = useRef({
    gather: false,
    scan: false,
    grant: false,
    leave: false,
    skip: false,
  });
  const [step, setStep] = useState<Step>("welcome");
  const [status, setStatus] = useState<string | null>(null);
  const formRef = useRef<HTMLElement>(null);
  const [formTop, setFormTop] = useState<number | null>(null);
  // Sound, with a mute that sticks (for presenting).
  const soundRef = useRef<OnboardingSound | null>(null);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundRef.current?.setMuted(next);
    try {
      localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {}
  };

  // Request form
  const [useCase, setUseCase] = useState<UseCase>("customers");
  const [typeChoice, setTypeChoice] = useState<TypeChoice>("Virtual");
  const [volume, setVolume] = useState(VOLUMES[1]);
  const [sourceId, setSourceId] = useState(sources[0].id);
  const source = sources.find((s) => s.id === sourceId)!;
  const types: CardType[] =
    typeChoice === "Both" ? ["Virtual", "Physical"] : [typeChoice];
  const use = USE_CASES.find((u) => u.id === useCase)!;

  const submit = () => {
    setStep("reviewing");
    cmd.current.scan = true; // one soft scan along the card while the request is reviewed
    setStatus("Reviewing your request");
    setTimeout(() => {
      onGranted({
        useCase,
        types,
        volume,
        funding: {
          id: source.id,
          asset: source.asset,
          label: source.label,
          network: source.network,
        },
      });
      setStatus(null);
      setStep("granted");
      soundRef.current?.granted();
      cmd.current.grant = true;
    }, REVIEW_FOR);
  };

  useEffect(() => {
    const html = document.documentElement;
    const stage = stageRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Staging: the card forms upright in the centre, then glides up into its slot directly
    // above the centred form — card and form are one stacked composition on the centre line.
    const cw = Math.max(280, Math.min(460, W * 0.26, H * 0.5 * 1.587));
    const ch = cw / 1.587;
    const upright = {
      x: W / 2,
      y: H / 2,
      yaw: -0.18,
      pitch: -0.08,
      roll: -0.03,
      scale: 1,
    };
    // The slot's y depends on the form's height, so it's measured when the card moves up.
    const floor = {
      x: W / 2,
      y: H / 2,
      yaw: -0.1,
      pitch: -0.12,
      roll: -0.02,
      scale: Math.min(1, (H * 0.3 * 1.587) / cw),
    };
    const placeSlot = () => {
      const formH = formRef.current?.offsetHeight ?? 440;
      const cardH = ch * floor.scale;
      const block = cardH + STACK_GAP + formH;
      const top = Math.max(48, (H - block) / 2);
      floor.y = top + cardH / 2;
      setFormTop(top + cardH + STACK_GAP);
    };

    const ink = parseRgb(getComputedStyle(stage).color);
    const inkStyle = `rgb(${ink.r} ${ink.g} ${ink.b})`;

    const N = Math.round(Math.min(5600, Math.max(2200, (W * H) / 420)));
    const G = Math.round(N * 0.7); // stars that become the card; the rest keep drifting
    const sx = new Float32Array(N),
      sy = new Float32Array(N),
      vx = new Float32Array(N),
      vy = new Float32Array(N);
    const size = new Float32Array(N),
      alpha = new Float32Array(N),
      tw = new Float32Array(N),
      gd = new Float32Array(N);
    const cu = new Float32Array(N),
      cv = new Float32Array(N),
      pa = new Float32Array(N),
      ps = new Float32Array(N);
    const ld = new Float32Array(N); // lay-down stagger
    const tx = new Float32Array(N),
      ty = new Float32Array(N),
      td = new Float32Array(N),
      bulge = new Float32Array(N);
    const fx = new Float32Array(N),
      fy = new Float32Array(N),
      fs = new Float32Array(N),
      fa = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      sx[i] = Math.random() * W;
      sy[i] = Math.random() * H;
      vx[i] = 4 + Math.random() * 6;
      vy[i] = -2 - Math.random() * 4;
      size[i] = 0.6 + Math.random() * Math.random() * 1.1;
      alpha[i] = 0.25 + Math.random() * 0.65;
      tw[i] = Math.random() * Math.PI * 2;
      gd[i] = Math.random() * 520;
    }

    // Card dots, in card-local coordinates, coloured from the Aurora art once it loads.
    // `groups` are draw batches: [fillStyle, dot indices].
    let groups: [string, number[]][] = [
      [inkStyle, Array.from({ length: N }, (_, i) => i)],
    ];
    const placeCard = (art: CardArt | null) => {
      if (art) {
        const { pts, colours } = cardArtPoints(G, art, cw);
        const byBucket = colours.map(
          (c) => [c, [] as number[]] as [string, number[]],
        );
        pts.forEach((p, i) => {
          cu[i] = p.u;
          cv[i] = p.v;
          pa[i] = p.a;
          ps[i] = p.s;
          byBucket[p.bucket][1].push(i);
        });
        groups = [
          [inkStyle, Array.from({ length: N - G }, (_, i) => i + G)],
          ...byBucket,
        ];
      } else {
        cardPoints(G, 0, 0, 0, cw).forEach((p, i) => {
          cu[i] = p.x;
          cv[i] = p.y;
          pa[i] = p.a;
          ps[i] = 1;
        });
      }
      // The top edge leads slightly, so the card moves like a sheet rather than a block.
      for (let i = 0; i < G; i++) ld[i] = (0.5 + cv[i] / ch) * LAY_STAGGER;
    };
    placeCard(null);
    let cancelled = false;
    loadCardArt(CARD_ART).then((art) => !cancelled && art && placeCard(art));

    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / W) * 2 - 1;
      pointer.y = (e.clientY / H) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove);

    const sound = new OnboardingSound(muted);
    soundRef.current = sound;
    sound.resume();
    sound.startPad();
    const wake = () => sound.resume();
    window.addEventListener("pointerdown", wake);
    const panOf = (x: number) => Math.max(-1, Math.min(1, (x / W) * 2 - 1));

    const start = performance.now();
    let gatherAt = -1,
      layAt = -1,
      formAt = -1,
      scanAt = -1,
      grantAt = -1,
      leaveAt = -1,
      burstAt = -1;
    let revealAt = -1,
      sidebarAt = -1;
    let finished = false;
    html.dataset.intro = "out";

    // A pose = where the card is, its size and turn; trig is cached per pose per frame.
    type Spot = typeof upright;
    type Pose = {
      x: number;
      y: number;
      k: number;
      yc: number;
      ys: number;
      pc: number;
      ps: number;
      rc: number;
      rs: number;
    };
    const makePose = (): Pose => ({
      x: 0,
      y: 0,
      k: 1,
      yc: 1,
      ys: 0,
      pc: 1,
      ps: 0,
      rc: 1,
      rs: 0,
    });
    const poseU = makePose(),
      poseF = makePose();
    const setPose = (P: Pose, s: Spot, t: number, lean: number) => {
      const yaw = s.yaw + Math.sin(t / 1900) * 0.03 + pointer.sx * 0.07 * lean;
      const pitch =
        s.pitch + Math.sin(t / 1700) * 0.02 + pointer.sy * 0.05 * lean;
      const r = s.roll + Math.sin(t / 2600) * 0.008;
      P.x = s.x + Math.sin(t / 2300) * 3;
      P.y = s.y + Math.sin(t / 1500) * 4;
      P.k = s.scale;
      P.yc = Math.cos(yaw);
      P.ys = Math.sin(yaw);
      P.pc = Math.cos(pitch);
      P.ps = Math.sin(pitch);
      P.rc = Math.cos(r);
      P.rs = Math.sin(r);
    };
    // Card-local (u, v) → screen, with perspective; writes [x, y, scale] into `o`.
    const project = (
      P: Pose,
      u0: number,
      v0: number,
      o: [number, number, number],
    ) => {
      const u = u0 * P.k,
        v = v0 * P.k;
      const x1 = u * P.yc;
      const y1 = v * P.pc;
      const z = u * P.ys - v * P.ps;
      const s = 1500 / (1500 + z);
      o[0] = P.x + (x1 * P.rc - y1 * P.rs) * s;
      o[1] = P.y + (x1 * P.rs + y1 * P.rc) * s;
      o[2] = s * P.k;
      return o;
    };
    const oU: [number, number, number] = [0, 0, 1];
    const oF: [number, number, number] = [0, 0, 1];

    // Where card dot i sits at time t (before the burst), plus `glow` (extra brightness) and
    // `dim` (how far it has receded into the background).
    let glow = 0,
      dim = 1;
    const cardDot = (i: number, t: number) => {
      glow = 0;
      dim = 1;
      const pU = project(poseU, cu[i], cv[i], oU);
      if (layAt < 0) return pU;
      const p = ease(clamp01((t - layAt - ld[i]) / LAY_FOR));
      const pF = project(poseF, cu[i], cv[i], oF);
      pU[0] += (pF[0] - pU[0]) * p;
      pU[1] += (pF[1] - pU[1]) * p;
      pU[2] += (pF[2] - pU[2]) * p;
      dim = 1 - (1 - BACKDROP) * p;
      // Review: one soft scan travelling along the card, away from the viewer.
      if (scanAt >= 0) {
        const s = (t - scanAt) / SCAN_FOR;
        if (s < 1.2) {
          const band = Math.exp(-(((cu[i] / cw + 0.5 - s) / 0.07) ** 2)); // reads left → right
          glow += band * 0.9;
          pU[1] -= band * 3;
        }
      }
      // Granted: a single slow ripple from the centre, and the card warms up a little.
      if (grantAt >= 0) {
        const g = t - grantAt;
        const r = Math.hypot(cu[i] / cw, cv[i] / ch) * 2; // 0 centre → ~1.4 corners
        const wave = Math.exp(-(((r - g / RIPPLE_FOR) / 0.12) ** 2));
        glow += wave * 0.8;
        pU[1] -= wave * 4;
        dim +=
          0.18 * Math.sin(Math.PI * clamp01(g / 2200)) +
          0.06 * clamp01(g / 2200);
      }
      return pU;
    };
    const starAt = (i: number, t: number) => {
      const s = t / 1000;
      return [
        (((sx[i] + vx[i] * s) % W) + W) % W,
        (((sy[i] + vy[i] * s) % H) + H) % H,
      ] as const;
    };

    const startBurst = (t: number) => {
      burstAt = t;
      const root = contentRef.current;
      let rects: Rect[] = root ? measureTargets(root, "#00ffb4", W, H) : [];
      if (!rects.length)
        rects = [{ x: 0, y: 0, w: W, h: H, weight: 1, mint: false }];
      const sum = rects.reduce((s, r) => s + r.weight, 0);
      const pick = () => {
        let k = Math.random() * sum;
        for (const r of rects) if ((k -= r.weight) <= 0) return r;
        return rects[rects.length - 1];
      };
      for (let i = 0; i < N; i++) {
        if (i < G) {
          const [x, y, k] = cardDot(i, t);
          fx[i] = x;
          fy[i] = y;
          fs[i] = ps[i] * k;
          fa[i] = pa[i] * dim;
        } else {
          const [x, y] = starAt(i, t);
          fx[i] = x;
          fy[i] = y;
          fs[i] = size[i];
          fa[i] = alpha[i] * 0.5;
        }
      }
      // Pair dots and targets by angle around the card so the burst opens outwards.
      const ox = poseF.x,
        oy = poseF.y;
      const byAngle = (x: number, y: number) => Math.atan2(y - oy, x - ox);
      const targets = Array.from({ length: N }, () => {
        const r = pick();
        return { x: r.x + Math.random() * r.w, y: r.y + Math.random() * r.h };
      }).sort((a, b) => byAngle(a.x, a.y) - byAngle(b.x, b.y));
      Array.from({ length: N }, (_, i) => i)
        .sort((a, b) => byAngle(fx[a], fy[a]) - byAngle(fx[b], fy[b]))
        .forEach((i, j) => {
          tx[i] = targets[j].x;
          ty[i] = targets[j].y;
        });
      for (let i = 0; i < N; i++) {
        td[i] = (Math.max(0, ty[i]) / H) * 420 + Math.random() * 140;
        bulge[i] = 50 + Math.random() * 150;
      }
    };

    // A couple of shooting stars now and then: thin streaks with a fading tail.
    type Meteor = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      born: number;
      life: number;
      len: number;
    };
    const meteors: Meteor[] = [];
    let nextMeteor = 1400 + Math.random() * 1600;
    const drawMeteors = (t: number, fadeAll: number) => {
      if (t >= nextMeteor && meteors.length < 2 && burstAt < 0) {
        const fromLeft = Math.random() < 0.5;
        const ang = 0.32 + Math.random() * 0.28; // downward slope
        const speed = 1.1 + Math.random() * 0.6; // px per ms
        const m: Meteor = {
          x: fromLeft
            ? Math.random() * W * 0.6
            : W * 0.4 + Math.random() * W * 0.6,
          y: Math.random() * H * 0.4,
          vx: Math.cos(ang) * speed * (fromLeft ? 1 : -1),
          vy: Math.sin(ang) * speed,
          born: t,
          life: 650 + Math.random() * 450,
          len: 110 + Math.random() * 120,
        };
        meteors.push(m);
        sound.meteor(panOf(m.x));
        nextMeteor = t + 2200 + Math.random() * 3400;
      }
      for (let k = meteors.length - 1; k >= 0; k--) {
        const m = meteors[k];
        const age = t - m.born;
        if (age > m.life) {
          meteors.splice(k, 1);
          continue;
        }
        const hx = m.x + m.vx * age,
          hy = m.y + m.vy * age;
        const sp = Math.hypot(m.vx, m.vy);
        const ex = hx - (m.vx / sp) * m.len,
          ey = hy - (m.vy / sp) * m.len;
        const life = Math.sin(Math.PI * (age / m.life));
        const g = ctx.createLinearGradient(hx, hy, ex, ey);
        g.addColorStop(
          0,
          `rgba(${ink.r}, ${ink.g}, ${ink.b}, ${0.85 * life * fadeAll})`,
        );
        g.addColorStop(1, `rgba(${ink.r}, ${ink.g}, ${ink.b}, 0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    };

    let raf = 0;
    let last = start;
    const frame = (now: number) => {
      const t = now - start;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = cmd.current;
      pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 2.5));
      pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 2.5));

      if (c.skip && revealAt < 0) {
        sound.stopPad(0);
        revealAt = t;
        onReveal();
        setStep("reveal");
      }
      if (c.gather && gatherAt < 0) {
        gatherAt = t;
        sound.gather((GATHER_FOR + 520) / 1000);
      }
      // Card formed → hold a beat, then glide up into its slot; the form comes up beneath it.
      if (
        gatherAt >= 0 &&
        layAt < 0 &&
        t >= gatherAt + GATHER_FOR + 520 + HOLD_UPRIGHT
      ) {
        layAt = t;
        placeSlot();
        sound.settle();
      }
      if (layAt >= 0 && formAt < 0 && t >= layAt + LAY_FOR * 0.55) {
        formAt = t;
        setStep("request");
      }
      if (c.scan && scanAt < 0) {
        scanAt = t;
        sound.scan(SCAN_FOR / 1000, panOf(W / 2 - cw), panOf(W / 2 + cw));
      }
      if (c.grant && grantAt < 0) {
        grantAt = t;
        sound.reform(1.4);
      }
      if (c.leave && leaveAt < 0) {
        leaveAt = t;
        setStatus("Setting up Cards");
      }
      if (leaveAt >= 0 && burstAt < 0 && t >= leaveAt + BURST_AFTER) {
        startBurst(t);
        sound.burst();
        sound.stopPad(1.4);
      }
      if (burstAt >= 0 && revealAt < 0 && t >= burstAt + REVEAL_AFTER_BURST) {
        revealAt = t;
        setStatus(null);
        setStep("reveal");
        onReveal();
      }
      if (
        revealAt >= 0 &&
        sidebarAt < 0 &&
        t >= revealAt + SIDEBAR_AFTER_REVEAL
      ) {
        sidebarAt = t;
        html.dataset.intro = "in";
      }
      if (sidebarAt >= 0 && !finished && t >= sidebarAt + SIDEBAR_FOR) {
        finished = true;
        delete html.dataset.intro;
        onDone();
        return;
      }

      setPose(poseU, upright, t, 1);
      setPose(poseF, floor, t, 0.35);

      ctx.clearRect(0, 0, W, H);
      const fade = revealAt < 0 ? 1 : 1 - clamp01((t - revealAt - 100) / 650);
      if (fade > 0) {
        for (const [style, idx] of groups) {
          ctx.fillStyle = style;
          for (const i of idx) {
            let x: number,
              y: number,
              a: number,
              s = size[i];
            if (burstAt >= 0) {
              const e = ease(clamp01((t - burstAt - td[i]) / BURST_FOR));
              const nx = fx[i] - poseF.x,
                ny = fy[i] - poseF.y;
              const len = Math.hypot(nx, ny) || 1;
              const out = Math.sin(Math.PI * e) * bulge[i];
              x = fx[i] + (tx[i] - fx[i]) * e + (nx / len) * out;
              y = fy[i] + (ty[i] - fy[i]) * e + (ny / len) * out;
              a = fa[i] * (1 - e) + 0.85 * e;
              s = fs[i] + (1.1 - fs[i]) * e;
            } else if (gatherAt < 0 || i >= G) {
              [x, y] = starAt(i, t);
              const fadeOut =
                i >= G && gatherAt >= 0
                  ? 1 - 0.5 * clamp01((t - gatherAt) / 800)
                  : 1;
              a =
                alpha[i] *
                (0.78 + 0.22 * Math.sin(tw[i] + t / 420)) *
                clamp01(t / 600 + 0.2) *
                fadeOut;
            } else {
              const [x1, y1, k] = cardDot(i, t);
              const e = ease(clamp01((t - gatherAt - gd[i]) / GATHER_FOR));
              if (e < 1) {
                // Swirl in around the card centre, landing on the dot's place in the card.
                const [x0, y0] = starAt(i, gatherAt);
                const P = poseU;
                const r0 = Math.hypot(x0 - P.x, y0 - P.y),
                  a0 = Math.atan2(y0 - P.y, x0 - P.x);
                const r1 = Math.hypot(x1 - P.x, y1 - P.y),
                  a1 = Math.atan2(y1 - P.y, x1 - P.x);
                // Extra swirl peaks mid-flight and returns to zero, so every dot lands in place.
                const ang =
                  a0 + wrapAngle(a1 - a0) * e + Math.PI * 0.9 * 4 * e * (1 - e);
                const r = r0 + (r1 - r0) * e;
                x = P.x + Math.cos(ang) * r;
                y = P.y + Math.sin(ang) * r;
              } else {
                x = x1;
                y = y1;
              }
              const shimmer = 0.9 + 0.1 * Math.sin(tw[i] + t / 650);
              a = Math.min(
                1,
                (alpha[i] * (1 - e) + pa[i] * shimmer * e) * dim * (1 + glow),
              );
              s = size[i] * (1 - e) + ps[i] * k * e;
            }
            ctx.globalAlpha = a * fade;
            ctx.fillRect(x - s / 2, y - s / 2, s, s);
          }
        }
        ctx.globalAlpha = 1;
        drawMeteors(t, fade);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("pointerdown", wake);
      sound.close();
      soundRef.current = null;
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      delete html.dataset.intro;
    };
    // The loop reads UI commands through `cmd`; it must not restart when the form changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formOn =
    step === "request" || step === "reviewing" || step === "granted";

  return (
    <div
      ref={stageRef}
      // Always dark, whatever the theme: the page fades in (light or dark) only at the reveal.
      className={`theme-lock-dark fixed inset-0 z-[55] text-white transition-[background-color] duration-[900ms] ease-out ${
        step === "reveal"
          ? "pointer-events-none bg-transparent"
          : "bg-[var(--surface)]"
      }`}
      style={
        {
          "--surface": "#070707",
          "--brand": "#00ffb4",
          colorScheme: "dark",
        } as CSSProperties
      }
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        aria-hidden
      />

      {/* Lockup parks top-left as the sidebar leaves; the status line sits under it */}
      <div
        className={`intro-lockup absolute top-5 left-6 z-10 flex flex-col items-start gap-3 transition-opacity duration-300 ${
          step === "reveal" ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="flex items-center gap-2 rounded-md bg-white/8 px-2 py-1 text-[18px] font-medium tracking-[-0.02em] text-white">
          <HugeiconsIcon icon={CreditCardIcon} size={18} strokeWidth={1.75} />
          Cards
        </span>
        <span
          role="status"
          className={`flex h-7 items-center gap-2 rounded-full border border-white/10 bg-[var(--surface)] px-3 text-[12px] text-neutral-300 transition-opacity duration-300 ${
            status ? "opacity-100" : "opacity-0"
          }`}
        >
          <Spinner />
          {status && (
            <span key={status} className="intro-status">
              {status}
            </span>
          )}
        </span>
      </div>

      {/* Sound toggle, for presenting */}
      <button
        type="button"
        onClick={toggleMute}
        aria-pressed={muted}
        aria-label={muted ? "Turn sound on" : "Mute sound"}
        className={`absolute top-5 right-6 z-10 flex h-8 items-center gap-2 rounded-full border border-white/10 px-3 text-xs text-neutral-400 transition-[color,border-color,opacity] duration-300 hover:border-white/25 hover:text-white ${
          step === "reveal" ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {muted ? (
          <VolumeX size={14} strokeWidth={1.75} />
        ) : (
          <Volume2 size={14} strokeWidth={1.75} />
        )}
        {muted ? "Sound off" : "Sound on"}
      </button>

      {/* 1 · Welcome — the pitch, no cards yet */}
      <section
        aria-labelledby="cards-welcome"
        className={`absolute top-1/2 left-[max(64px,calc(45%-240px))] w-[min(480px,calc(100vw-128px))] -translate-y-1/2 transition-[opacity,translate] duration-500 ease-out ${
          step === "welcome"
            ? "intro-welcome opacity-100"
            : "pointer-events-none -translate-x-3 opacity-0"
        }`}
      >
        <h1
          id="cards-welcome"
          className="text-[40px] leading-[1.1] font-medium tracking-[-0.03em] text-white"
        >
          Welcome to Gravv Cards
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-neutral-400">
          Issue Visa cards that spend straight from your stablecoin wallets. No
          off-ramp, no waiting on a bank.
        </p>
        <dl className="mt-8">
          {FACTS.map((f) => (
            <div key={f.title} className="border-t border-white/8 py-3.5">
              <dt className="text-[13px] font-medium text-white">{f.title}</dt>
              <dd className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">
                {f.body}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              cmd.current.gather = true;
              setStep("forming");
            }}
            className="h-9 rounded-full bg-white px-5 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
          >
            Issue cards
          </button>
          <button
            type="button"
            onClick={() => (cmd.current.skip = true)}
            className="h-9 rounded-full px-4 text-[13px] text-neutral-500 transition-colors hover:text-white"
          >
            Skip for now
          </button>
        </div>
      </section>

      {/* 2 · Request card issuing — centred on the stars, no panel, directly under the card */}
      <section
        ref={formRef}
        aria-labelledby="cards-request"
        style={
          formTop === null ? { width: FORM_W } : { width: FORM_W, top: formTop }
        }
        className={`absolute left-1/2 -translate-x-1/2 ${formTop === null ? "top-1/2 -translate-y-1/2" : ""} transition-opacity duration-300 ease-out ${
          formOn ? "intro-form opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {step !== "granted" ? (
          <fieldset disabled={step === "reviewing"} className="min-w-0">
            <h2
              id="cards-request"
              className="text-[26px] font-medium tracking-[-0.025em] text-white"
            >
              Request card issuing
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">
              Tell us about your program. Once it&apos;s on, you issue cards
              through the API.
            </p>

            <dl className="mt-6">
              <Row label="Cards for" hint={use.hint}>
                <Segmented
                  label="Cards for"
                  value={useCase}
                  options={USE_CASES.map((u) => ({
                    value: u.id,
                    label: u.label,
                  }))}
                  onChange={setUseCase}
                />
              </Row>
              <Row
                label="Card type"
                hint={TYPE_CHOICES.find((c) => c.id === typeChoice)!.hint}
              >
                <Segmented
                  label="Card type"
                  value={typeChoice}
                  options={TYPE_CHOICES.map((c) => ({
                    value: c.id,
                    label: c.id,
                  }))}
                  onChange={setTypeChoice}
                />
              </Row>
              <Row label="Monthly spend" hint="Roughly, across all cards">
                <Dropdown
                  label="Expected monthly card spend"
                  variant="compact"
                  align="right"
                  value={volume}
                  options={VOLUMES.map((v) => ({ value: v, label: v }))}
                  onChange={setVolume}
                />
              </Row>
              <Row label="Fund cards from" hint="Default for new cards">
                <Dropdown
                  label="Funding wallet"
                  variant="compact"
                  align="right"
                  value={sourceId}
                  options={sources.map((s) => ({
                    value: s.id,
                    label: s.label,
                    hint: `${s.asset}${s.network ? ` · ${s.network}` : ""} · ${money(s.balance)}`,
                  }))}
                  onChange={setSourceId}
                />
              </Row>
            </dl>

            <div className="mt-6 flex items-center gap-3 border-t border-white/8 pt-6">
              <button
                type="button"
                onClick={submit}
                className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-medium whitespace-nowrap text-black transition-colors hover:bg-neutral-200 disabled:opacity-60"
              >
                {step === "reviewing" && <Spinner />}
                {step === "reviewing" ? "Reviewing…" : "Request access"}
              </button>
              <span className="text-xs text-neutral-600">
                Approved straight away in sandbox
              </span>
            </div>
          </fieldset>
        ) : (
          <div className="intro-status">
            <span className="flex size-8 items-center justify-center rounded-full bg-[var(--brand)] text-black">
              <Check size={16} strokeWidth={2.5} />
            </span>
            <h2
              id="cards-request"
              className="mt-4 text-[26px] font-medium tracking-[-0.025em] text-white"
            >
              Request granted
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
              Card issuing is on for {workspace} in sandbox. Create the first
              card through the API with your secret key and it shows up in Cards
              straight away.
            </p>
            <dl className="mt-6 text-[13px]">
              {[
                ["Program", `Gravv Visa · ${types.join(" + ")}`],
                ["For", use.title],
                [
                  "Funded from",
                  `${source.label} · ${source.asset}${source.network ? ` on ${source.network}` : ""}`,
                ],
                ["Monthly spend", volume],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-6 border-t border-white/8 py-2.5"
                >
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="text-right text-white">{v}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => {
                cmd.current.leave = true;
                setStep("leaving");
              }}
              className="mt-6 h-9 rounded-full bg-white px-5 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
            >
              Go to Cards
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/8 py-3">
      <div className="min-w-0">
        <dt className="text-[13px] text-white">{label}</dt>
        <dd className="mt-0.5 truncate text-xs text-neutral-500">{hint}</dd>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-full border border-white/10 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 rounded-full px-3 text-xs transition-colors ${
            value === o.value
              ? "bg-white text-black"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className="intro-spin shrink-0"
      aria-hidden
    >
      <circle
        cx="6"
        cy="6"
        r="4.75"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />
      <path
        d="M6 1.25a4.75 4.75 0 0 1 4.75 4.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
