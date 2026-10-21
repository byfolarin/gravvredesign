import {
  BankIcon,
  ChartLineData01Icon,
  CheckmarkSquare01Icon,
  Clock01Icon,
  ContactBookIcon,
  CreditCardIcon,
  DashboardSquare02Icon,
  InboxDownloadIcon,
  Link01Icon,
  MenuCircleIcon,
  Settings03Icon,
  Shield01Icon,
  SquareLockCheck01Icon,
  TransactionHistoryIcon,
  UserGroupIcon,
  UserMultipleIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import type { NavIconSource } from "../icons/nav-icon";

// Every nav icon is a Hugeicons stroke icon, so the set reads consistently.
export type NavLink = {
  label: string;
  href: string;
  icon: NavIconSource;
};

export type NavSection = {
  // Unlabelled sections render as a plain list; labelled ones get a
  // collapsible header ("Card Collection ▾").
  label?: string;
  items: NavLink[];
};

export const navSections: NavSection[] = [
  {
    items: [
      { label: "Overview", href: "/", icon: DashboardSquare02Icon },
      { label: "Account", href: "/account", icon: BankIcon },
      { label: "Customers", href: "/customers", icon: UserMultipleIcon },
      { label: "Cards", href: "/cards", icon: CreditCardIcon },
      { label: "Trade Desk", href: "/trade-desk", icon: ChartLineData01Icon },
      {
        label: "Transactions",
        href: "/transactions",
        icon: TransactionHistoryIcon,
      },
      { label: "Wallets", href: "/wallets", icon: Wallet01Icon },
      { label: "Recipients", href: "/recipients", icon: ContactBookIcon },
      { label: "Payment Links", href: "/payment-links", icon: Link01Icon },
    ],
  },
  {
    label: "Card Collection",
    items: [
      {
        label: "Collections",
        href: "/card-collection/collections",
        icon: InboxDownloadIcon,
      },
      {
        label: "Disputes",
        href: "/card-collection/disputes",
        icon: Shield01Icon,
      },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        label: "Approvals",
        href: "/manage/approvals",
        icon: CheckmarkSquare01Icon,
      },
      { label: "Team", href: "/manage/team", icon: UserGroupIcon },
      {
        label: "Roles & Permissions",
        href: "/manage/roles",
        icon: SquareLockCheck01Icon,
      },
      { label: "Configure", href: "/manage/configure", icon: Settings03Icon },
    ],
  },
  {
    label: "Billing",
    items: [
      { label: "Billing Overview", href: "/billing", icon: MenuCircleIcon },
      { label: "Billing History", href: "/billing/history", icon: Clock01Icon },
    ],
  },
];

export function findNavLink(pathname: string) {
  for (const section of navSections) {
    const link = section.items.find((item) => item.href === pathname);
    if (link) return link;
  }
}
