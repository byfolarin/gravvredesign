import { Suspense } from "react";
import { FeeHistory } from "../_components/fee-history";
import { fees } from "../_data";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FeeHistory fees={fees} />
    </Suspense>
  );
}
