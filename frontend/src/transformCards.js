// Per-card bookkeeping for multi-part transform results. Applying one
// part shifts the document, so later cards move by the length delta.
// Pure helpers; the editor stays in App.jsx.

// Drop one card, keeping the rest in order.
export function removeTransformCard(cards, card) {
  return (Array.isArray(cards) ? cards : []).filter((item) => item !== card);
}

// Drop the applied card and shift cards after its span by the length
// delta. Earlier cards are untouched. Chunks never overlap, so a card
// is either fully before the edit or fully shifted.
export function shiftTransformCards(cards, applied, delta) {
  const list = Array.isArray(cards) ? cards : [];
  if (!applied) {
    return [...list];
  }
  const shift = Number(delta) || 0;
  const next = [];
  for (const card of list) {
    if (card === applied) {
      continue;
    }
    if (
      Number.isInteger(card?.from) &&
      Number.isInteger(card?.to) &&
      Number.isInteger(applied?.from) &&
      Number.isInteger(applied?.to) &&
      card.from >= applied.to
    ) {
      next.push({ ...card, from: card.from + shift, to: card.to + shift });
    } else {
      next.push(card);
    }
  }
  return next;
}
