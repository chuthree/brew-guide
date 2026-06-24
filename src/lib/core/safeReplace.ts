export type EmptyReplaceCheck = {
  nextCount: number;
  existingCount: number;
  allowEmptyReplace?: boolean;
};

export function shouldSkipEmptyReplace({
  nextCount,
  existingCount,
  allowEmptyReplace = false,
}: EmptyReplaceCheck): boolean {
  return !allowEmptyReplace && nextCount === 0 && existingCount > 0;
}
