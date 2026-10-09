/** Shared helpers for flashcard decks. */

export type FlashcardPair = [question: string, answer: string];

export type FlashcardDeck = {
  id: string;
  title: string;
  subject: string;
  description: string;
  cards: FlashcardPair[] | (string | number)[][];
};

export function normalizeFlashcards(
  cards: FlashcardDeck["cards"],
): FlashcardPair[] {
  return cards.map((c) => {
    if (Array.isArray(c) && c.length >= 2) {
      return [String(c[0]), String(c[1])];
    }
    return [String(c), ""];
  });
}

export function cardCountLabel(count: number): string {
  return `${count} ${count === 1 ? "card" : "cards"}`;
}
