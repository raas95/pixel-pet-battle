export const LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;

export type Letter = (typeof LETTERS)[number];

export const TOTAL_ROUNDS = 10;
export const MAX_LIVES = 3;
export const POINTS_PER_CORRECT = 10;

export type GameDifficulty = "santai" | "tantangan" | "kilat";

export type DifficultySettings = {
  label: string;
  badge: string;
  timeLimitMs: number | null;
  description: string;
};

export const DIFFICULTY_CONFIG: Record<GameDifficulty, DifficultySettings> = {
  santai: {
    label: "Santai",
    badge: "☕ Santai",
    timeLimitMs: null,
    description: "Tanpa batas waktu, rileks dan santai untuk melatih refleks.",
  },
  tantangan: {
    label: "Tantangan",
    badge: "⏱️ Tantangan (4d)",
    timeLimitMs: 4000,
    description: "Batas waktu 4 detik per ronde. Tuntut refleks tangkas!",
  },
  kilat: {
    label: "Kilat",
    badge: "⚡ Kilat (2.5d)",
    timeLimitMs: 2500,
    description: "Batas waktu 2.5 detik per ronde. Uji kecepatan reaksi maksimal!",
  },
};

export type LetterRound = {
  target: Letter;
  options: Letter[];
  audioPath: string;
};

export function getLetterAudioPath(letter: string): string {
  return `/audio/letters/${letter.toLowerCase()}.mp3`;
}

export function shuffleArray<T>(
  items: readonly T[],
  rng: () => number = Math.random
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateRound(
  previousTarget?: string,
  rng: () => number = Math.random
): LetterRound {
  const targetPool = previousTarget
    ? LETTERS.filter((letter) => letter !== previousTarget)
    : LETTERS;
  const target = targetPool[Math.floor(rng() * targetPool.length)];

  const decoyPool = shuffleArray(
    LETTERS.filter((letter) => letter !== target),
    rng
  );
  const decoys = decoyPool.slice(0, 3);
  const options = shuffleArray([target, ...decoys], rng);

  return {
    target,
    options,
    audioPath: getLetterAudioPath(target),
  };
}

export function isValidLetterOption(letter: string, options: readonly string[]): boolean {
  return options.includes(letter.toUpperCase());
}

