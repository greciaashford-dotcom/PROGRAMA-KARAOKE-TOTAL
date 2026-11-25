export type ClassValue = string | number | boolean | undefined | null | ClassValue[];

/**
 * Utilidad ligera para concatenar clases condicionales (compatible con estructura shadcn/ui).
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) classes.push(inner);
    }
  }
  return classes.join(' ');
}
