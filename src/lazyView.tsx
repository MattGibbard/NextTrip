import { Suspense, lazy } from "react";
import type { ComponentType } from "react";

/**
 * A page whose code downloads only when it's visited, so other pages don't carry it. `preload` fetches
 * it early: main.tsx does that for the page being opened before it starts, so a ready-made page picks
 * up from its HTML straight away rather than waiting (or flashing empty) while the code arrives.
 */
export function lazyView<P extends object>(load: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<ComponentType<P>> | undefined;
  const preload = () => (pending ??= load().then((view) => (loaded = view)));
  const Later = lazy(() => preload().then((view) => ({ default: view })));
  function View(props: P) {
    if (loaded) {
      const Loaded = loaded;
      return <Loaded {...props} />;
    }
    return (
      <Suspense fallback={null}>
        <Later {...props} />
      </Suspense>
    );
  }
  View.preload = preload;
  return View;
}
