import { describe, expect, it } from "vitest";
import {
  removeTransformCard,
  shiftTransformCards,
} from "../transformCards.js";

function card(part, from, to) {
  return { tool: "Rewrite", text: `part ${part}`, from, to, part, total: 3 };
}

describe("removeTransformCard", () => {
  it("removes only the dismissed card", () => {
    const cards = [card(1, 0, 10), card(2, 11, 20), card(3, 21, 30)];
    expect(removeTransformCard(cards, cards[1])).toEqual([cards[0], cards[2]]);
  });

  it("empties the list for the last card", () => {
    const cards = [card(1, 0, 10)];
    expect(removeTransformCard(cards, cards[0])).toEqual([]);
  });
});

describe("shiftTransformCards", () => {
  it("shifts later cards by the applied delta and drops the applied one", () => {
    const cards = [card(1, 0, 10), card(2, 11, 20), card(3, 21, 30)];
    expect(shiftTransformCards(cards, cards[0], 5)).toEqual([
      { tool: "Rewrite", text: "part 2", from: 16, to: 25, part: 2, total: 3 },
      { tool: "Rewrite", text: "part 3", from: 26, to: 35, part: 3, total: 3 },
    ]);
  });

  it("leaves earlier cards alone when a later part applies first", () => {
    const cards = [card(1, 0, 10), card(2, 11, 20), card(3, 21, 30)];
    const next = shiftTransformCards(cards, cards[2], -4);
    expect(next[0]).toEqual(cards[0]);
    expect(next[1]).toEqual(cards[1]);
    expect(next).toHaveLength(2);
  });

  it("chains across sequential applies", () => {
    const cards = [card(1, 0, 10), card(2, 11, 20), card(3, 21, 30)];
    const afterFirst = shiftTransformCards(cards, cards[0], 5);
    const afterSecond = shiftTransformCards(afterFirst, afterFirst[0], -2);
    expect(afterFirst[0].from).toBe(16);
    expect(afterSecond[0]).toEqual({
      tool: "Rewrite",
      text: "part 3",
      from: 24,
      to: 33,
      part: 3,
      total: 3,
    });
  });
});
