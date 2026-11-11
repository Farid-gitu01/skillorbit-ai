export type ClassValue = string | number | boolean | undefined | null;

/**
 * Combines conditional class names into a single string.
 */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(' ');
}
