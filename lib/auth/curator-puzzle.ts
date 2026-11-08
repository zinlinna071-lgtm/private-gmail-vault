export const CURATOR_REQUIRED_MARKS = ["margin", "shelf", "note"] as const;
export const CURATOR_REQUIRED_ORDER = ["email", "backup", "note", "password"] as const;

export function isValidCuratorSolution(found: unknown, order: unknown): boolean {
  if (!Array.isArray(found) || !Array.isArray(order)) return false;
  const marksCorrect = found.length === CURATOR_REQUIRED_MARKS.length
    && CURATOR_REQUIRED_MARKS.every(mark => found.includes(mark))
    && found.every(mark => typeof mark === "string" && CURATOR_REQUIRED_MARKS.includes(mark as typeof CURATOR_REQUIRED_MARKS[number]));
  const orderCorrect = order.length === CURATOR_REQUIRED_ORDER.length
    && CURATOR_REQUIRED_ORDER.every((value, index) => order[index] === value);
  return marksCorrect && orderCorrect;
}
