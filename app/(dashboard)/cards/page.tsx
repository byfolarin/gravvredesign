import { CardsWorkspace } from "./_components/cards-workspace";
import { cards, fundingSources, monthlySpend } from "./_data";

export default function CardsPage() {
  return (
    <CardsWorkspace
      initialCards={cards}
      sources={fundingSources}
      spend={monthlySpend}
    />
  );
}
