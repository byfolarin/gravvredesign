import NetworkAvalanche from "@web3icons/react/icons/networks/NetworkAvalanche";
import NetworkEthereum from "@web3icons/react/icons/networks/NetworkEthereum";
import NetworkPolygon from "@web3icons/react/icons/networks/NetworkPolygon";
import NetworkStellar from "@web3icons/react/icons/networks/NetworkStellar";
import type { Network } from "../_data";

const ICONS = {
  Polygon: NetworkPolygon,
  Ethereum: NetworkEthereum,
  Avalanche: NetworkAvalanche,
  Stellar: NetworkStellar,
} satisfies Record<Network, unknown>;

/**
 * Small circular network mark ("background" variant clipped to a circle), so every logo —
 * including Stellar's black mark — reads on both the dark and light themes.
 */
export function NetworkLogo({ network, size = 16, className = "" }: { network: Network; size?: number; className?: string }) {
  const Icon = ICONS[network];
  return (
    <Icon
      variant="background"
      size={size}
      aria-hidden
      className={`shrink-0 overflow-hidden rounded-full ring-1 ring-white/12 ${className}`}
    />
  );
}
