import { CollectionsWorkspace } from "./_components/collections-workspace";
import { collections } from "./_data";

export default function Page() {
  return <CollectionsWorkspace initial={collections} />;
}
