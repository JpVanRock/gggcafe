// Shared by the practice quiz and the level tests (Softball IQ).

export const LETTERS = ["A", "B", "C", "D", "E"];

export type Feedback = { chosen: number; correct: boolean; correctIndex: number; explanation: string | null };

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
