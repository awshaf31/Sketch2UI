/** Joins conditional class names without adding a dependency (clsx/cva etc. per
 * design-direction.md's "no new styling framework"). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
