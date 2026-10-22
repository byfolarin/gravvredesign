import NetworkAvalanche from "@web3icons/react/icons/networks/NetworkAvalanche";
import NetworkBase from "@web3icons/react/icons/networks/NetworkBase";
import NetworkEthereum from "@web3icons/react/icons/networks/NetworkEthereum";
import NetworkPolygon from "@web3icons/react/icons/networks/NetworkPolygon";
import NetworkSolana from "@web3icons/react/icons/networks/NetworkSolana";
import NetworkStellar from "@web3icons/react/icons/networks/NetworkStellar";
import NetworkTron from "@web3icons/react/icons/networks/NetworkTron";
import type { Chain } from "./open-account-data";

const ICONS = {
  Polygon: NetworkPolygon,
  Base: NetworkBase,
  Avalanche: NetworkAvalanche,
  Ethereum: NetworkEthereum,
  Stellar: NetworkStellar,
  Solana: NetworkSolana,
  Tron: NetworkTron,
} satisfies Record<Chain, unknown>;

/** Round network mark, same treatment as Wallets' NetworkLogo. */
export function ChainMark({
  chain,
  size = 20,
}: {
  chain: Chain;
  size?: number;
}) {
  const Icon = ICONS[chain];
  return (
    <Icon
      variant="background"
      size={size}
      aria-hidden
      className="shrink-0 overflow-hidden rounded-full ring-1 ring-white/12"
    />
  );
}
