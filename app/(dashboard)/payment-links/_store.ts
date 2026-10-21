import { useSyncExternalStore } from "react";
import { links as seeded, type PaymentLink } from "./_data";

/**
 * The links for this browser session, shared by the list and the link page so a link you
 * create or edit opens on its own page. Seeded on load; nothing persists (prototype).
 */
let state: PaymentLink[] = seeded;
const subs = new Set<() => void>();

export const linkStore = {
  get: () => state,
  set(next: (all: PaymentLink[]) => PaymentLink[]) {
    state = next(state);
    subs.forEach((f) => f());
  },
  update(id: string, patch: Partial<PaymentLink>) {
    linkStore.set((all) =>
      all.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};

export const useLinks = () =>
  useSyncExternalStore(linkStore.subscribe, linkStore.get, () => seeded);
