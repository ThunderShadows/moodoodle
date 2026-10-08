/** Runs async jobs one at a time, in order; a failing job never stops the ones after it. */
export function createQueue() {
  const jobs: (() => Promise<unknown>)[] = [];
  let running: Promise<void> | undefined;

  async function drain() {
    while (jobs.length) {
      const job = jobs.shift()!;
      try {
        await job();
      } catch {
        // One image failing to embed shouldn't block the rest.
      }
    }
    running = undefined;
  }

  return {
    push(job: () => Promise<unknown>) {
      jobs.push(job);
      running ??= drain();
    },
    size: () => jobs.length + (running ? 1 : 0),
    idle: () => running ?? Promise.resolve(),
  };
}
