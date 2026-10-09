/** True when the person asked their system for less motion. */
export const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** An animation length in ms, or 0 when motion is reduced. */
export const ms = (n: number): number => (reducedMotion() ? 0 : n);
