import { BillingOverview } from "./_components/billing-overview";
import { CURRENT_PLAN, fees } from "./_data";

export default function Page() {
  return <BillingOverview fees={fees} plan={CURRENT_PLAN} />;
}
