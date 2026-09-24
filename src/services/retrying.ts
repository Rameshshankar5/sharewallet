import type { Unsubscribe } from 'firebase/firestore';

/**
 * Keep a Firestore listener alive through a refusal.
 *
 * A listener that errors is dead for good; Firestore never retries it. That
 * matters here because the rules can briefly refuse something that is about
 * to be allowed — a profile or connection written on this phone a moment ago
 * is visible locally before the server has it. Without a retry the screen
 * waits for ever on a listener that has already given up.
 */
export function retrying(start: (onError: () => void) => Unsubscribe, maxTries = 6): Unsubscribe {
  let unsub: Unsubscribe | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let tries = 0;

  const run = () => {
    unsub = start(() => {
      unsub?.();
      unsub = null;
      if (stopped || tries >= maxTries) return;
      tries += 1;
      // 1s, 2s, 4s… — quick for the common race, gentle if it is real.
      timer = setTimeout(run, 500 * 2 ** tries);
    });
  };
  run();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    unsub?.();
  };
}
