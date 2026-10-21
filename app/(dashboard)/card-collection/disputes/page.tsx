import { DisputesWorkspace } from "./_components/disputes-workspace";
import { disputes } from "./_data";

export default function Page() {
  return <DisputesWorkspace initial={disputes} />;
}
