import { lazy, Suspense, type ComponentType, type ReactElement } from "react";
import { InternalOnly } from "@/components/ui";

/**
 * Internal screens. A route uses them like this:
 *
 *   component: IS_INTERNAL ? lazyScreen(() => import("...").then((m) => ({ default: m.Screen }))) : closedScreen("Name")
 *
 * IS_INTERNAL is fixed at build time, so a public build drops the import and the screen's code never ships.
 */
export function lazyScreen(load: () => Promise<{ default: ComponentType }>): () => ReactElement {
  const Screen = lazy(load);
  return function Internal() {
    return (
      <Suspense fallback={<p className="px-5 py-10 text-sm text-muted">Loading.</p>}>
        <Screen />
      </Suspense>
    );
  };
}

export function closedScreen(name: string): () => ReactElement {
  return function Closed() {
    return <InternalOnly name={name} />;
  };
}
