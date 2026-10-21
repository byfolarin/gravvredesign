import { Snowflake } from "lucide-react";
import type { Card } from "../_data";

/** List thumbnail: a flat, matte chip. Frozen cards get a diagonal hatch + snowflake. */
export function CardThumb({ frozen = false }: { frozen?: boolean }) {
  return (
    <span
      className="theme-lock-dark relative flex h-5 w-8 shrink-0 items-end justify-end overflow-hidden rounded-[3px] border border-white/12 bg-[#111] p-[3px]"
      aria-hidden
    >
      {frozen ? (
        <>
          <span className="hatch absolute inset-0" />
          <Snowflake
            size={10}
            strokeWidth={2.25}
            className="absolute inset-0 m-auto text-white"
          />
        </>
      ) : (
        <span className="h-[3px] w-2 rounded-[1px] bg-brand" />
      )}
    </span>
  );
}

/** Card face for the drawer: matte, typographic, quiet. */
export function FlatCard({
  card,
  frozen,
}: {
  card: Pick<Card, "holder" | "last4" | "type" | "expiry">;
  frozen: boolean;
}) {
  const exp = new Date(card.expiry);
  const mm = String(exp.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(exp.getUTCFullYear()).slice(2);

  return (
    <div className="theme-lock-dark relative aspect-[1.586] w-full">
      <div
        className={`relative flex h-full flex-col justify-between overflow-hidden rounded-xl border border-white/12 bg-[linear-gradient(180deg,#1a1a1d_0%,#0e0e10_100%)] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_18px_40px_-18px_rgb(0_0_0/0.55)]`}
      >
        <div className="relative flex items-start justify-between">
          <span className="text-[15px] font-bold tracking-[-0.03em] text-white">
            Gravv.
          </span>
          <span className="text-[11px] text-neutral-500">{card.type}</span>
        </div>
        <div className="relative flex items-end justify-between">
          <div>
            <div className="text-[13px] tracking-[0.14em] text-white tabular-nums">
              •••• {card.last4}
            </div>
            <div className="mt-1 text-[11px] text-neutral-500">
              {card.holder} · {mm}/{yy}
            </div>
          </div>
          <span className="text-[15px] font-black tracking-tight text-white italic">
            VISA
          </span>
        </div>
      </div>
      {frozen && (
        // Monochrome frozen state: hatch over the card plus a small chip — no colour.
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl">
          <span className="hatch absolute inset-0 opacity-70" aria-hidden />
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-black shadow-lg">
            <Snowflake size={12} strokeWidth={2.25} />
            Frozen
          </span>
        </div>
      )}
    </div>
  );
}
