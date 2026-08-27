/** Joins conditional class names without adding a dependency (clsx/cva etc.), per the
 * "no new styling framework" constraint. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
