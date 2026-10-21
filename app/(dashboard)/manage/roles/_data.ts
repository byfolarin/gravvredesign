/** What one permission lets someone do, in the words a finance lead would use. */
export type Ability = {
  id: string;
  label: string;
  hint?: string;
  /** Read-only: seeing, not changing. "View only" access is every view ability and nothing else. */
  view?: boolean;
  /** Abilities that move money carry a cap, set per role. */
  limit?: { unit: string };
};
export type Area = { id: string; label: string; abilities: Ability[] };
export type Group = { id: string; label: string; areas: Area[] };

export const GROUPS: Group[] = [
  {
    id: "money",
    label: "Money",
    areas: [
      {
        id: "wallets",
        label: "Wallets",
        abilities: [
          { id: "wallets.view", label: "See wallets and balances", view: true },
          { id: "wallets.create", label: "Create wallets" },
          { id: "wallets.freeze", label: "Freeze and unfreeze wallets" },
        ],
      },
      {
        id: "accounts",
        label: "Accounts",
        abilities: [
          {
            id: "accounts.view",
            label: "See accounts and balances",
            view: true,
          },
          {
            id: "accounts.details",
            label: "See full bank details",
            hint: "Account and routing numbers",
            view: true,
          },
          { id: "accounts.open", label: "Open new accounts" },
          { id: "accounts.freeze", label: "Freeze and close accounts" },
        ],
      },
      {
        id: "transactions",
        label: "Transactions",
        abilities: [
          { id: "transactions.view", label: "See transactions", view: true },
          {
            id: "transactions.export",
            label: "Download statements and exports",
            view: true,
          },
          { id: "transactions.categorise", label: "Categorise and add notes" },
        ],
      },
      {
        id: "send",
        label: "Send money",
        abilities: [
          {
            id: "send.saved",
            label: "Send to saved recipients",
            limit: { unit: "per payment" },
          },
          {
            id: "send.new",
            label: "Add new recipients",
            hint: "New bank accounts and wallet addresses",
          },
          { id: "send.bulk", label: "Send bulk payouts" },
        ],
      },
      {
        id: "trade",
        label: "Trade desk",
        abilities: [
          { id: "trade.view", label: "See quotes and rates", view: true },
          {
            id: "trade.execute",
            label: "Convert between currencies",
            limit: { unit: "per trade" },
          },
        ],
      },
    ],
  },
  {
    id: "collect",
    label: "Getting paid",
    areas: [
      {
        id: "links",
        label: "Payment links",
        abilities: [
          { id: "links.view", label: "See payment links", view: true },
          { id: "links.create", label: "Create and share links" },
          { id: "links.checkout", label: "Change checkout branding" },
        ],
      },
      {
        id: "customers",
        label: "Customers",
        abilities: [
          { id: "customers.view", label: "See customers", view: true },
          { id: "customers.edit", label: "Add and edit customers" },
          {
            id: "customers.kyc",
            label: "See identity documents",
            hint: "Passports, IDs and proof of address",
            view: true,
          },
        ],
      },
      {
        id: "collection",
        label: "Card collection",
        abilities: [
          { id: "collection.view", label: "See card payments", view: true },
          {
            id: "collection.refund",
            label: "Issue refunds",
            limit: { unit: "per refund" },
          },
          { id: "collection.disputes", label: "Respond to disputes" },
        ],
      },
    ],
  },
  {
    id: "cards",
    label: "Cards",
    areas: [
      {
        id: "cards",
        label: "Cards",
        abilities: [
          { id: "cards.view", label: "See all cards", view: true },
          { id: "cards.issue", label: "Issue cards" },
          { id: "cards.limits", label: "Change card limits" },
          { id: "cards.freeze", label: "Freeze and cancel cards" },
        ],
      },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    areas: [
      {
        id: "team",
        label: "Team",
        abilities: [
          { id: "team.view", label: "See team members", view: true },
          { id: "team.invite", label: "Invite and remove people" },
          {
            id: "team.roles",
            label: "Change roles",
            hint: "Includes editing roles on this page",
          },
        ],
      },
      {
        id: "approvals",
        label: "Approvals",
        abilities: [
          { id: "approvals.approve", label: "Approve payments" },
          { id: "approvals.rules", label: "Set approval rules" },
        ],
      },
      {
        id: "billing",
        label: "Billing",
        abilities: [
          { id: "billing.view", label: "See invoices and plan", view: true },
          { id: "billing.manage", label: "Change plan and payment method" },
        ],
      },
      {
        id: "api",
        label: "API keys & webhooks",
        abilities: [
          {
            id: "api.view",
            label: "See API keys and request logs",
            view: true,
          },
          { id: "api.manage", label: "Create and revoke keys" },
          { id: "api.webhooks", label: "Manage webhooks" },
        ],
      },
    ],
  },
];

export const ALL_ABILITIES = GROUPS.flatMap((g) =>
  g.areas.flatMap((a) => a.abilities),
);
const VIEW = ALL_ABILITIES.filter((a) => a.view).map((a) => a.id);
/** Read-only roles still shouldn't see the most sensitive records by default. */
const SENSITIVE = ["accounts.details", "customers.kyc"];

export type Role = {
  id: string;
  name: string;
  /** A few words for the roles list; the description says the rest. */
  tagline: string;
  description: string;
  /** Gravv's defaults are fixed; duplicate one to customise it. */
  system: boolean;
  owner?: boolean;
  grants: string[];
  /** Cap per limited ability, in USD; null means no cap. */
  limits: Record<string, number | null>;
};

const every = ALL_ABILITIES.map((a) => a.id);
const noCaps = {
  "send.saved": null,
  "trade.execute": null,
  "collection.refund": null,
};

export const ROLES: Role[] = [
  {
    id: "owner",
    name: "Owner",
    tagline: "Everything, including billing",
    description:
      "Full access, including billing and transferring ownership. A workspace has one owner.",
    system: true,
    owner: true,
    grants: every,
    limits: noCaps,
  },
  {
    id: "admin",
    name: "Admin",
    tagline: "Everything except billing",
    description:
      "Full access to money, customers, team and developer settings.",
    system: true,
    grants: every.filter((id) => id !== "billing.manage"),
    limits: noCaps,
  },
  {
    id: "finance",
    name: "Finance",
    tagline: "Money and approvals",
    description:
      "Moves money and approves payments. Can't change the team or developer settings.",
    system: true,
    grants: [
      ...every.filter((id) =>
        /^(wallets|accounts|transactions|send|trade|approvals)\./.test(id),
      ),
      "billing.view",
      "collection.view",
      "collection.refund",
      "cards.view",
      "cards.limits",
      "team.view",
      "customers.view",
      "links.view",
    ],
    limits: {
      "send.saved": 50_000,
      "trade.execute": 100_000,
      "collection.refund": 10_000,
    },
  },
  {
    id: "operations",
    name: "Operations",
    tagline: "Collections and payouts to $5k",
    description:
      "Runs day-to-day collections and payouts to saved recipients, up to $5,000 each.",
    system: true,
    grants: [
      "links.view",
      "links.create",
      "customers.view",
      "customers.edit",
      "collection.view",
      "collection.disputes",
      "transactions.view",
      "transactions.categorise",
      "wallets.view",
      "accounts.view",
      "send.saved",
      "cards.view",
      "cards.freeze",
      "team.view",
    ],
    limits: {
      "send.saved": 5_000,
      "trade.execute": null,
      "collection.refund": null,
    },
  },
  {
    id: "developer",
    name: "Developer",
    tagline: "API keys and webhooks",
    description:
      "Manages API keys and webhooks. Read-only elsewhere and can't move money.",
    system: true,
    grants: [
      "api.view",
      "api.manage",
      "api.webhooks",
      "transactions.view",
      "wallets.view",
      "accounts.view",
      "links.view",
      "customers.view",
      "team.view",
    ],
    limits: noCaps,
  },
  {
    id: "viewer",
    name: "Viewer",
    tagline: "Read-only",
    description:
      "Sees balances and activity. Can't move money, change anything or see identity documents.",
    system: true,
    grants: VIEW.filter((id) => !SENSITIVE.includes(id)),
    limits: noCaps,
  },
  {
    id: "support",
    name: "Customer support",
    tagline: "Customers and disputes",
    description: "Answers customer questions and handles card disputes.",
    system: false,
    grants: [
      "customers.view",
      "customers.edit",
      "links.view",
      "transactions.view",
      "collection.view",
      "collection.disputes",
    ],
    limits: noCaps,
  },
];

export type Member = {
  name: string;
  email: string;
  role: string;
  lastActive: string;
  /** Two-step login at sign-in. */
  twoFactor: boolean;
  joined: string;
};

const m = (
  name: string,
  role: string,
  lastActive: string,
  twoFactor = true,
  joined = "Mar 2025",
): Member => ({
  name,
  email: `${name.split(" ")[0].toLowerCase()}@kredete.com`,
  role,
  lastActive,
  twoFactor,
  joined,
});

/** Who's signed in — the prototype's point of view for Team and Approvals. */
export const ME = "Oluwatobi Bello";

export const MEMBERS: Member[] = [
  m("Folarin Folarin", "owner", "Now", true, "Jan 2024"),
  m("Oluwatobi Bello", "admin", "Now", true, "Feb 2024"),
  m("Amara Nwosu", "admin", "1h ago", true, "Jun 2024"),
  m("Tolu Adeyemi", "finance", "3 min ago", true, "Apr 2024"),
  m("Grace Mensah", "finance", "Yesterday", false, "Sep 2024"),
  m("Ikenna Obi", "finance", "2h ago", true, "Nov 2024"),
  m("Chioma Eze", "finance", "Today", true, "Jan 2025"),
  m("Musa Bello", "operations", "20 min ago", true, "Jul 2024"),
  m("Priya Nair", "operations", "Today", false, "Feb 2025"),
  m("Daniel Okafor", "operations", "3 days ago", true, "May 2025"),
  m("Kwame Asante", "developer", "1h ago", true, "Aug 2024"),
  m("Sarah Chen", "developer", "Today", true, "Mar 2025"),
  m("Lena Fischer", "viewer", "Last week", false, "Jun 2025"),
  m("Femi Okonkwo", "support", "5 min ago", true, "Apr 2025"),
  m("Hannah Kim", "support", "Today", true, "Aug 2025"),
];

export type Invite = {
  email: string;
  role: string;
  invitedBy: string;
  sent: string;
  expires: string;
};
export const INVITES: Invite[] = [
  {
    email: "jordan@kredete.com",
    role: "operations",
    invitedBy: "Oluwatobi Bello",
    sent: "2 days ago",
    expires: "in 5 days",
  },
  {
    email: "sofia.alvarez@kredete.com",
    role: "viewer",
    invitedBy: "Amara Nwosu",
    sent: "6 days ago",
    expires: "tomorrow",
  },
];

/** A role's reach in numbers, for one-line summaries outside the Roles page. */
export function reachOf(role: Role) {
  const g = new Set(role.grants);
  const areas = GROUPS.flatMap((x) => x.areas);
  let manages = 0;
  let views = 0;
  for (const a of areas) {
    const on = a.abilities.filter((b) => g.has(b.id));
    if (!on.length) continue;
    if (on.every((b) => b.view)) views++;
    else manages++;
  }
  return {
    manages,
    views,
    total: areas.length,
    sendCap: g.has("send.saved") ? role.limits["send.saved"] : undefined,
  };
}
