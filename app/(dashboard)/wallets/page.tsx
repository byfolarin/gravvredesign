import { WalletsWorkspace } from "./_components/wallets-workspace";
import { wallets } from "./_data";

export default function WalletsPage() {
  return <WalletsWorkspace initialWallets={wallets} />;
}
