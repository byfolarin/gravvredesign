import type { CSSProperties } from "react";

/** Motion for the placeholder copy; scoped here so it ships with the component. */
const css = `
@keyframes itw-word {
  from { opacity: 0; transform: translateY(8px); filter: blur(6px); }
  to { opacity: 1; transform: none; filter: none; }
}
@keyframes itw-fade {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
@keyframes itw-shimmer {
  0%, 72% { background-position: 120% 0; }
  100% { background-position: -20% 0; }
}
.itw-word {
  display: inline-block;
  white-space: pre;
  opacity: 0;
  animation: itw-word 620ms cubic-bezier(0.22, 1, 0.36, 1) var(--itw-delay) forwards;
}
/* "in the works" rises in like the other words, then a mint glint passes over it
   every few seconds, echoing the crate. */
.itw-tail {
  display: inline-block;
  opacity: 0;
  background-image: linear-gradient(100deg, currentColor 0 32%, var(--brand) 50%, currentColor 68% 100%);
  background-size: 250% 100%;
  background-position: 120% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation:
    itw-word 620ms cubic-bezier(0.22, 1, 0.36, 1) var(--itw-delay) forwards,
    itw-shimmer 5.5s ease-in-out calc(var(--itw-delay) + 1.2s) infinite;
}
.itw-sub {
  opacity: 0;
  animation: itw-fade 700ms cubic-bezier(0.22, 1, 0.36, 1) var(--itw-delay) forwards;
}
@media (prefers-reduced-motion: reduce) {
  .itw-word, .itw-tail, .itw-sub { opacity: 1; animation: none; }
  .itw-tail { background: none; -webkit-text-fill-color: currentColor; }
}
`;

const STAGGER = 70; // ms between words
const delay = (ms: number) => ({ "--itw-delay": `${ms}ms` }) as CSSProperties;

/** "{title} is still in the works": words rise in one by one, then the subtext follows. */
export function InWorksText({ title }: { title: string }) {
  const lead = `${title} is still`.split(" ");
  return (
    <div className="relative mt-4 text-center">
      <style>{css}</style>
      <h2
        className="text-[18px] font-medium tracking-[-0.01em] text-white"
        aria-label={`${title} is still in the works`}
      >
        <span aria-hidden>
          {lead.map((w, i) => (
            <span key={i} className="itw-word" style={delay(i * STAGGER)}>
              {`${w} `}
            </span>
          ))}
          <span className="itw-tail" style={delay(lead.length * STAGGER)}>
            in the works
          </span>
        </span>
      </h2>
      <p
        className="itw-sub mt-1.5 text-[14px] text-neutral-500"
        style={delay((lead.length + 1) * STAGGER + 160)}
      >
        We&apos;re building this page. It&apos;ll be ready soon.
      </p>
    </div>
  );
}
