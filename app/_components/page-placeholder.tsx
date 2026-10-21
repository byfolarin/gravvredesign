import { CraneCanvas } from "./in-the-works/crane-canvas";
import { InWorksText } from "./in-the-works/in-works-text";

/** Pages that aren't built yet: a greyscale pixel crane swinging a mint crate between piles, over a heading and subheading, centred on the page. */
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[560px] items-center justify-center overflow-hidden px-8">
      <div className="relative flex flex-col items-center">
        {/* Soft glow behind the crane */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-32 -inset-y-20"
          style={{
            background:
              "radial-gradient(closest-side, var(--px-glow), transparent)",
          }}
        />
        <CraneCanvas />
        <InWorksText title={title} />
      </div>
    </div>
  );
}
