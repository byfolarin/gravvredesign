import { RecipientsWorkspace } from "./_components/recipients-workspace";
import { recipients } from "./_data";
import { fundingSources } from "../cards/_data";

export default function RecipientsPage() {
  return <RecipientsWorkspace initialRecipients={recipients} sources={fundingSources} />;
}
