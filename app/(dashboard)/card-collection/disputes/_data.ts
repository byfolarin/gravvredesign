import { AS_OF, collections, type Collection } from "../collections/_data";

/**
 * Chargebacks: a customer asks their bank to take a card payment back. The amount (plus the
 * network's fee) is held from you until it's decided. You answer with evidence before the
 * deadline, or accept it. Mirrors Gravv's real Disputes columns: opened, updated, payment,
 * customer, total, status, protection, 3-D Secure, code, due. Placeholder data.
 */

export type DisputeStatus =
  "Needs response" | "Under review" | "Won" | "Lost" | "Accepted" | "Expired";

export type Reason = {
  /** Network reason code, e.g. Visa 10.4. "Manual" = raised by Gravv's risk team. */
  code: string;
  network: "Visa" | "Mastercard" | "Gravv";
  title: string;
  /** What the customer is saying, in plain words. */
  claim: string;
  /** What tends to win this kind of dispute. */
  evidence: string[];
};

export const REASONS: Record<string, Reason> = {
  fraud: {
    code: "10.4",
    network: "Visa",
    title: "Fraud — card not present",
    claim: "The cardholder says they didn't make this payment.",
    evidence: [
      "Proof the cardholder made it: a passed 3-D Secure check is the strongest",
      "The customer's past payments with the same card that weren't disputed",
      "Their email, IP or device matching earlier orders",
    ],
  },
  notReceived: {
    code: "13.1",
    network: "Visa",
    title: "Not received",
    claim: "The customer says they paid but never got what they bought.",
    evidence: [
      "Proof of delivery or access: tracking, sign-in logs, a download record",
      "Messages where the customer confirms they received it",
      "Your delivery terms as the customer saw them at checkout",
    ],
  },
  notAsDescribed: {
    code: "13.3",
    network: "Visa",
    title: "Not as described",
    claim:
      "The customer says what they got was different from what was promised.",
    evidence: [
      "The description they saw when paying (screenshot of the page or link)",
      "Your refund or return policy, and whether they used it",
      "Any messages about the problem and how you answered",
    ],
  },
  duplicate: {
    code: "4834",
    network: "Mastercard",
    title: "Charged twice",
    claim:
      "The customer says they were charged more than once for one purchase.",
    evidence: [
      "Proof each payment was for something different",
      "Or a refund you already made for the duplicate",
    ],
  },
  manual: {
    code: "Manual",
    network: "Gravv",
    title: "Raised by Gravv risk",
    claim: "Gravv's risk team opened this after the bank flagged the payment.",
    evidence: [
      "What was bought and who bought it",
      "Any messages with the customer",
    ],
  },
};

export type Dispute = {
  id: string;
  payment: Collection;
  reason: keyof typeof REASONS;
  status: DisputeStatus;
  openedAt: string;
  updatedAt: string;
  /** Respond by. */
  dueAt: string;
  amount: number;
  /** Network fee, kept by the network if you lose. */
  fee: number;
  /** Your reply, once sent. */
  response?: { note: string; files: string[]; at: string };
  outcomeNote?: string;
};

const DAY = 24 * 60 * 60 * 1000;
const iso = (t: number) => new Date(t).toISOString();
const charged = collections.filter(
  (c) =>
    c.status === "Settlement completed" || c.status === "Partially refunded",
);

const plan: {
  reason: Dispute["reason"];
  status: DisputeStatus;
  opened: number;
  due: number;
  note?: string;
}[] = [
  { reason: "fraud", status: "Needs response", opened: 4, due: 2 },
  { reason: "notReceived", status: "Needs response", opened: 9, due: 6 },
  { reason: "notAsDescribed", status: "Needs response", opened: 2, due: 19 },
  { reason: "duplicate", status: "Under review", opened: 21, due: -7 },
  {
    reason: "fraud",
    status: "Won",
    opened: 70,
    due: -50,
    note: "Visa sided with you — the 3-D Secure check showed the cardholder approved it.",
  },
  {
    reason: "notReceived",
    status: "Lost",
    opened: 64,
    due: -44,
    note: "The bank didn't accept the delivery proof — the tracking ended at a different address.",
  },
  {
    reason: "manual",
    status: "Expired",
    opened: 125,
    due: -111,
    note: "No response was sent before the deadline, so the customer kept the money.",
  },
  {
    reason: "notAsDescribed",
    status: "Accepted",
    opened: 40,
    due: -26,
    note: "You accepted it. The customer kept the money.",
  },
];

export const disputes: Dispute[] = plan.map((p, i) => {
  const payment = charged[(i * 3 + 1) % charged.length];
  const opened = AS_OF - p.opened * DAY;
  const decided = p.status !== "Needs response" && p.status !== "Under review";
  return {
    id: `dp_${(0x3a11c + i * 4099).toString(16)}${payment.id.slice(0, 4)}`,
    payment,
    reason: p.reason,
    status: p.status,
    openedAt: iso(opened),
    updatedAt: iso(decided ? AS_OF + p.due * DAY + 3 * DAY : opened + DAY),
    dueAt: iso(AS_OF + p.due * DAY),
    amount: payment.subtotal,
    fee: 15,
    response:
      p.status === "Under review" || p.status === "Won" || p.status === "Lost"
        ? {
            note: "The customer signed in and used the service after paying. Logs and their messages attached.",
            files: ["access-log.pdf", "customer-messages.pdf"],
            at: iso(opened + 3 * DAY),
          }
        : undefined,
    outcomeNote: p.note,
  };
});

export const isOpen = (d: Dispute) =>
  d.status === "Needs response" || d.status === "Under review";
export const daysUntil = (iso: string) =>
  Math.ceil((Date.parse(iso) - AS_OF) / DAY);
