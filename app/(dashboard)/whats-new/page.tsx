import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { UpdateArt } from "@/app/_components/updates";
import { ReplayWhatsNew } from "@/app/_components/whats-new-modal";
import { UPDATES, updateDate } from "@/app/_components/updates-data";

/** Everything Gravv shipped, newest first, each with the screen it changed. */
export default function WhatsNewPage() {
  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max-narrow) px-8 pt-12 pb-24">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              What&apos;s new
            </h1>
            <p className="mt-1 text-[14px] text-neutral-500">
              What changed in Gravv, and where to find it.
            </p>
          </div>
          <ReplayWhatsNew />
        </div>
        <ol className="mt-10 space-y-14">
          {UPDATES.map((u) => (
            <li
              key={u.id}
              className="grid gap-8 border-t border-white/8 pt-8 lg:grid-cols-[200px_minmax(0,1fr)]"
            >
              <div className="text-[13px] text-neutral-500">
                <div className="text-neutral-300">{updateDate(u)}</div>
                <div className="mt-0.5">{u.area}</div>
              </div>
              <div>
                <h2 className="text-[20px] font-medium tracking-[-0.02em] text-white">
                  {u.title}
                </h2>
                <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-neutral-400">
                  {u.body}
                </p>
                <UpdateArt
                  u={u}
                  className="mt-5 aspect-[16/7] rounded-2xl border border-white/8"
                />
                <Link
                  href={u.href}
                  className="mt-4 inline-flex items-center gap-1 text-[13px] text-white hover:underline"
                >
                  {u.cta}
                  <ArrowRight size={13} strokeWidth={1.75} />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
