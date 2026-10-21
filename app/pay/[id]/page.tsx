import { Suspense } from "react";
import { notFound } from "next/navigation";
import { links } from "@/app/(dashboard)/payment-links/_data";
import { Checkout } from "../_components/checkout";

/** The hosted checkout for a payment link — what the payer sees (pay.gravv.xyz/…). */
export async function generateStaticParams() {
  return links.map((l) => ({ id: l.id }));
}

export default function PayPage({ params }: PageProps<"/pay/[id]">) {
  return (
    <Suspense fallback={null}>
      {params.then(({ id }) => {
        const l = links.find((x) => x.id === id);
        if (!l) notFound();
        return <Checkout link={l} />;
      })}
    </Suspense>
  );
}
