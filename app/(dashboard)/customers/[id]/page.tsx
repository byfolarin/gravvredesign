import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FEATURED, findCustomer } from "../_data";
import { CustomerDetail } from "../_components/customer-detail";

// The customers people open most are prerendered; any other ID renders on first request.
export async function generateStaticParams() {
  return FEATURED.map((c) => ({ id: c.id }));
}

export default function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  return (
    <Suspense fallback={null}>
      {params.then(({ id }) => {
        const c = findCustomer(id);
        if (!c) notFound();
        return <CustomerDetail c={c} />;
      })}
    </Suspense>
  );
}
