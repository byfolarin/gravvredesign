import { Suspense } from "react";
import { links } from "../_data";
import { LinkDetail } from "../_components/link-detail";

export async function generateStaticParams() {
  return links.map((l) => ({ id: l.id }));
}

// Links made or edited in this session live in the client store, so the page looks the id up there.
export default function LinkPage({ params }: PageProps<"/payment-links/[id]">) {
  return (
    <Suspense fallback={null}>
      {params.then(({ id }) => (
        <LinkDetail id={id} />
      ))}
    </Suspense>
  );
}
