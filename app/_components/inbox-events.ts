/** Open the inbox (notifications + promotions) from anywhere; the top bar owns the panel. */
export type InboxTab = "notifications" | "promotions";
export const INBOX_EVENT = "gravv:inbox";
export function openInbox(tab: InboxTab = "notifications") {
  window.dispatchEvent(new CustomEvent<InboxTab>(INBOX_EVENT, { detail: tab }));
}
