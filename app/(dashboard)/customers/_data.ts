/** The people and businesses who pay you: through payment links, card collection or bank transfer. */

export type CustomerKind = "Individual" | "Business";
/** Identity check status. Customers must be verified before they can pay above the unverified limit. */
export type Verification = "Verified" | "Pending" | "Action needed";
export type PayMethod = "Card" | "Bank transfer" | "USDC";

export type CustomerPayment = {
  id: string;
  at: string;
  amount: number; // USD equivalent
  method: PayMethod;
  status: "Paid" | "Failed" | "Refunded";
  for: string;
};

export type OpenLink = { name: string; amount: number; expiresAt: string };

export type Customer = {
  id: string;
  name: string;
  email: string;
  kind: CustomerKind;
  country: string;
  verification: Verification;
  /** Why the check is stuck, in plain words. */
  verificationNote?: string;
  createdAt: string;
  /** Totals kept on the record so the list never sums payments. */
  lifetime: number;
  paid30d: number;
  lastPayment?: CustomerPayment;
  payments: CustomerPayment[];
  openLinks: OpenLink[];
};

export const AS_OF = Date.UTC(2026, 9, 20, 9, 0, 0);
export const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number, hour = 10) =>
  new Date(AS_OF - days * DAY + (hour - 9) * 3600_000).toISOString();
const ahead = (days: number) => new Date(AS_OF + days * DAY).toISOString();

const pay = (
  id: string,
  days: number,
  amount: number,
  method: PayMethod,
  forWhat: string,
  status: CustomerPayment["status"] = "Paid",
): CustomerPayment => ({
  id,
  at: ago(days, 11),
  amount,
  method,
  status,
  for: forWhat,
});

function featured(
  c: Omit<Customer, "lifetime" | "paid30d" | "lastPayment"> & {
    earlier?: number;
  },
): Customer {
  const paid = c.payments.filter((p) => p.status === "Paid");
  const sorted = [...c.payments].sort((a, b) => b.at.localeCompare(a.at));
  return {
    ...c,
    lifetime: (c.earlier ?? 0) + paid.reduce((s, p) => s + p.amount, 0),
    paid30d: paid
      .filter((p) => Date.parse(p.at) > AS_OF - 30 * DAY)
      .reduce((s, p) => s + p.amount, 0),
    lastPayment: sorted[0],
    payments: sorted,
  };
}

/** The customers you deal with most, matching the "Recently charged" list in Create link. */
export const FEATURED: Customer[] = [
  featured({
    id: "cus_8f2a01",
    name: "James Bond",
    email: "jamesbond@email.com",
    kind: "Individual",
    country: "United Kingdom",
    verification: "Verified",
    createdAt: ago(210),
    earlier: 1680,
    payments: [
      pay("pay_1", 1, 240, "Card", "Annual membership"),
      pay("pay_2", 64, 150, "Card", "Lagos Fintech Week · Early bird"),
    ],
    openLinks: [],
  }),
  featured({
    id: "cus_31d9ae",
    name: "Jacinta Olukoya",
    email: "jacinta@olukoya.co",
    kind: "Individual",
    country: "Nigeria",
    verification: "Pending",
    verificationNote: "ID uploaded, waiting on a selfie match",
    createdAt: ago(3),
    payments: [],
    openLinks: [
      { name: "Consulting · October", amount: 1200, expiresAt: ahead(28) },
    ],
  }),
  featured({
    id: "cus_c47b10",
    name: "Jasper Smith",
    email: "jasper@creativityhub.com",
    kind: "Individual",
    country: "United States",
    verification: "Verified",
    createdAt: ago(140),
    earlier: 940,
    payments: [
      pay("pay_3", 4, 65, "Card", "Merch drop · Hoodie"),
      pay("pay_4", 33, 45, "USDC", "Workshop · Stablecoin payouts 101"),
    ],
    openLinks: [],
  }),
  featured({
    id: "cus_92ee5f",
    name: "John Doe",
    email: "johndoe@kredete.com",
    kind: "Individual",
    country: "Nigeria",
    verification: "Verified",
    createdAt: ago(320),
    earlier: 3_480,
    payments: [
      pay("pay_5", 8, 240, "Bank transfer", "Annual membership"),
      pay("pay_6", 12, 240, "Card", "Annual membership", "Failed"),
      pay("pay_6b", 64, 150, "Card", "Lagos Fintech Week · Early bird"),
      pay("pay_6c", 140, 65, "Card", "Merch drop · Hoodie"),
      pay("pay_6d", 230, 45, "USDC", "Workshop · Stablecoin payouts 101"),
    ],
    openLinks: [],
  }),
  featured({
    id: "cus_0ab7d3",
    name: "Lumen Labs Inc",
    email: "ap@lumenlabs.io",
    kind: "Business",
    country: "United States",
    verification: "Verified",
    createdAt: ago(400),
    earlier: 0,
    // Monthly invoices; June was skipped while the contract was renegotiated.
    payments: [18, 49, 79, 110, 172, 202, 233, 263, 293, 324].map((d, k) =>
      pay(
        `pay_7_${k}`,
        d,
        k < 4 ? 18_400 : 14_200,
        "USDC",
        `Invoice INV-2026-${112 - k * 8}`,
      ),
    ),
    openLinks: [
      { name: "Invoice INV-2026-118", amount: 18_400, expiresAt: ahead(9) },
    ],
  }),
  featured({
    id: "cus_5c19f0",
    name: "Northwind Logistics",
    email: "finance@northwind.lu",
    kind: "Business",
    country: "Luxembourg",
    verification: "Action needed",
    verificationNote: "Proof of address is older than 3 months",
    createdAt: ago(60),
    earlier: 0,
    payments: [pay("pay_9", 20, 6_250, "Bank transfer", "Freight deposit")],
    openLinks: [
      {
        name: "Deposit · Office fit-out",
        amount: 2_500_000 / 1550,
        expiresAt: ahead(3),
      },
    ],
  }),
  featured({
    id: "cus_77a2c4",
    name: "Atlas Relief Foundation",
    email: "giving@atlasrelief.org",
    kind: "Business",
    country: "Morocco",
    verification: "Verified",
    createdAt: ago(190),
    earlier: 0,
    payments: [
      [2, 6_800, "USDC"],
      [26, 3_100, "Bank transfer"],
      [44, 2_400, "USDC"],
      [71, 5_200, "USDC"],
      [97, 1_900, "Bank transfer"],
      [128, 2_750, "USDC"],
      [151, 4_100, "USDC"],
      [189, 1_600, "Bank transfer"],
    ].map(([d, a, m], k) =>
      pay(
        `pay_10_${k}`,
        d as number,
        a as number,
        m as PayMethod,
        "Donate to Atlas Relief",
      ),
    ),
    openLinks: [],
  }),
  featured({
    id: "cus_e01b88",
    name: "Ngozi Eze",
    email: "ngozi.eze@gmail.com",
    kind: "Individual",
    country: "Nigeria",
    verification: "Action needed",
    verificationNote: "Name on ID doesn't match the account name",
    createdAt: ago(9),
    payments: [
      pay("pay_12", 6, 450, "Card", "Private class · 3 sessions", "Failed"),
    ],
    openLinks: [
      { name: "Private class · 3 sessions", amount: 450, expiresAt: ahead(21) },
    ],
  }),
  featured({
    id: "cus_4f6d21",
    name: "Meridian Trade Co",
    email: "ops@meridiantrade.ae",
    kind: "Business",
    country: "United Arab Emirates",
    verification: "Verified",
    createdAt: ago(260),
    earlier: 0,
    payments: [
      pay("pay_13", 11, 12_000, "USDC", "Q4 retainer"),
      pay("pay_14", 15, 1_850, "Card", "Hardware order", "Refunded"),
      pay("pay_15", 102, 16_000, "USDC", "Q3 retainer"),
      pay("pay_16", 193, 16_000, "USDC", "Q2 retainer"),
      pay("pay_17", 284, 16_000, "USDC", "Q1 retainer"),
    ],
    openLinks: [
      { name: "Q4 retainer · balance", amount: 4_000, expiresAt: ahead(14) },
    ],
  }),
  featured({
    id: "cus_b3c0e7",
    name: "Kwame Mensah",
    email: "kwame@mensah.studio",
    kind: "Individual",
    country: "Ghana",
    verification: "Pending",
    verificationNote: "Waiting on the customer to finish the check",
    createdAt: ago(1),
    payments: [],
    openLinks: [],
  }),
];

/* ———— The rest of the book: 100,000 customers, generated the same way every time ———— */

export const TOTAL = 100_000;

const FIRST = [
  "Ada",
  "Tolu",
  "Grace",
  "Ikenna",
  "Sarah",
  "Kwame",
  "Amara",
  "Daniel",
  "Zainab",
  "Chidi",
  "Fatima",
  "Michael",
  "Funke",
  "Emeka",
  "Aisha",
  "David",
  "Yemi",
  "Hannah",
  "Seun",
  "Lola",
  "Bayo",
  "Esther",
  "Kofi",
  "Nadia",
  "Tunde",
  "Mariam",
  "Obinna",
  "Rita",
  "Samuel",
  "Ifeoma",
];
const LAST = [
  "Okafor",
  "Adeyemi",
  "Mensah",
  "Bello",
  "Nwosu",
  "Okeke",
  "Hassan",
  "Abiola",
  "Eze",
  "Ibrahim",
  "Owusu",
  "Balogun",
  "Danjuma",
  "Afolabi",
  "Chukwu",
  "Kamara",
  "Diallo",
  "Osei",
  "Mohammed",
  "Ogunleye",
];
const COMPANY = [
  "Studio",
  "Labs",
  "Trading",
  "Foods",
  "Logistics",
  "Health",
  "Capital",
  "Media",
  "Works",
  "Ventures",
];
const COUNTRIES = [
  "Nigeria",
  "Nigeria",
  "Nigeria",
  "Ghana",
  "Kenya",
  "United States",
  "United Kingdom",
  "South Africa",
  "Morocco",
  "United Arab Emirates",
];
const METHODS: PayMethod[] = ["Card", "Card", "Bank transfer", "USDC"];
const FOR = [
  "Annual membership",
  "Merch drop · Hoodie",
  "Lagos Fintech Week · Early bird",
  "Workshop · Stablecoin payouts 101",
  "Donate to Atlas Relief",
  "Consulting session",
];

/** Small, fast, seeded hash: the same index always yields the same customer on server and client. */
function rand(i: number, salt: number) {
  let t = (i * 2654435761 + salt * 40503) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(xs: T[], r: number) => xs[Math.floor(r * xs.length)];

const idAt = (i: number) =>
  `cus_${(0x100000 + i * 7919).toString(16).slice(-6)}`;

/** Any customer by ID: the featured few, else a scan of the generated book (a lookup by key in production). */
export function findCustomer(id: string): Customer | null {
  const f = FEATURED.find((c) => c.id === id);
  if (f) return f;
  for (let i = 0; i < TOTAL - FEATURED.length; i++)
    if (idAt(i) === id) return customerAt(i);
  return null;
}

/** Lightweight row for search and counts; the full record is built only for rows on screen. */
export type Lite = {
  i: number;
  id: string;
  name: string;
  email: string;
  kind: CustomerKind;
  verification: Verification;
  paying: boolean; // paid in the last 30 days
  owes: boolean; // has an open link
  hay: string;
};

export function liteAt(i: number): Lite {
  const business = rand(i, 1) < 0.18;
  const f = pick(FIRST, rand(i, 2));
  const l = pick(LAST, rand(i, 3));
  const name = business ? `${l} ${pick(COMPANY, rand(i, 4))}` : `${f} ${l}`;
  const email = business
    ? `accounts@${l.toLowerCase()}${pick(COMPANY, rand(i, 4)).toLowerCase()}.com`
    : `${f.toLowerCase()}.${l.toLowerCase()}${i % 97}@gmail.com`;
  const v = rand(i, 5);
  const verification: Verification =
    v < 0.97 ? "Verified" : v < 0.993 ? "Pending" : "Action needed";
  const id = idAt(i);
  // Recent activity thins out further down the book (index ≈ how long since they last paid).
  const paying =
    verification === "Verified" && rand(i, 6) < Math.max(0.012, 0.5 - i / 3000);
  const owes = rand(i, 7) < 0.004;
  return {
    i,
    id,
    name,
    email,
    kind: business ? "Business" : "Individual",
    verification,
    paying,
    owes,
    hay: `${name} ${email} ${id}`.toLowerCase(),
  };
}

/** The full record for one generated customer. */
export function customerAt(i: number): Customer {
  const lite = liteAt(i);
  const days = lite.paying
    ? 1 + Math.floor(rand(i, 8) * 28)
    : 31 + Math.floor(i / 300 + rand(i, 9) * 60);
  const amount =
    Math.round(
      (lite.kind === "Business"
        ? 300 + rand(i, 10) * 4200
        : 15 + rand(i, 10) * 285) * 100,
    ) / 100;
  const n = 1 + Math.floor(rand(i, 11) * 3);
  const payments: CustomerPayment[] =
    lite.verification === "Verified" || rand(i, 12) < 0.5
      ? Array.from({ length: n }, (_, k) =>
          pay(
            `pay_${i}_${k}`,
            days + k * 30,
            amount,
            pick(METHODS, rand(i, 13 + k)),
            pick(FOR, rand(i, 20 + k)),
            rand(i, 30 + k) < 0.04 ? "Failed" : "Paid",
          ),
        )
      : [];
  const notes = [
    "Selfie didn't match the ID photo",
    "ID document has expired",
    "Waiting on the customer to finish the check",
  ];
  return featured({
    id: lite.id,
    name: lite.name,
    email: lite.email,
    kind: lite.kind,
    country: pick(COUNTRIES, rand(i, 14)),
    verification: lite.verification,
    verificationNote:
      lite.verification === "Verified"
        ? undefined
        : lite.verification === "Pending"
          ? notes[2]
          : pick(notes.slice(0, 2), rand(i, 15)),
    createdAt: ago(days + 30 + Math.floor(rand(i, 16) * 400)),
    earlier: Math.round(amount * Math.floor(rand(i, 17) * 8) * 100) / 100,
    payments,
    openLinks: lite.owes
      ? [
          {
            name: pick(FOR, rand(i, 18)),
            amount,
            expiresAt: ahead(2 + Math.floor(rand(i, 19) * 28)),
          },
        ]
      : [],
  });
}
