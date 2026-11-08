import { describe, expect, it } from "vitest";
import { LETTERS, generateRound, isValidLetterOption } from "@/lib/letters";

describe("lib/letters", () => {
  it("always generates 4 unique options containing target exactly once", () => {
    const targetIndices = new Set<number>();

    for (let i = 0; i < 300; i++) {
      const round = generateRound();
      expect(round.options).toHaveLength(4);
      expect(new Set(round.options).size).toBe(4);
      expect(LETTERS).toContain(round.target);

      const targetCount = round.options.filter((opt) => opt === round.target).length;
      expect(targetCount).toBe(1);
      expect(round.audioPath).toBe(`/audio/letters/${round.target.toLowerCase()}.mp3`);
      targetIndices.add(round.options.indexOf(round.target));
    }

    // Target position should vary across all 4 slots
    expect(targetIndices.size).toBe(4);
  });

  it("avoids repeating the immediate previous target when provided", () => {
    for (let i = 0; i < 100; i++) {
      const round = generateRound("A");
      expect(round.target).not.toBe("A");
    }
  });

  it("validates whether an input letter is one of the 4 round options", () => {
    expect(isValidLetterOption("a", ["A", "B", "C", "D"])).toBe(true);
    expect(isValidLetterOption("Z", ["A", "B", "C", "D"])).toBe(false);
  });
});

