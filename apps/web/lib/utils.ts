export type ClassValue = string | number | boolean | undefined | null | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter((x): x is string | number => typeof x === 'string' || typeof x === 'number')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
