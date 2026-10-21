import { TransactionsTable } from "./_components/transactions-table";
import { transactions } from "./_data";

export default function TransactionsPage() {
  return <TransactionsTable initial={transactions} />;
}
