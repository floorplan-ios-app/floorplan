export type IntMM = number; // integer millimetres (validated at runtime)

export function assertIntMM(n: number, label = "value"): asserts n is IntMM {
  if (!Number.isInteger(n)) throw new Error(`${label} must be integer millimetres`);
}
