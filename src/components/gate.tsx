import { lazy, Suspense, type ComponentType, type ReactElement } from "react";
import { InternalOnly } from "@/components/ui";
import { notFound } from "@tanstack/react-router";
import { IS_INTERNAL } from "@/lib/config/mode";

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

/**
 * For internal-only routes: in a public build the route throws notFound() before loading, so the server answers
 * with a real HTTP 404 and the site's 404 page. In an internal build it is undefined (no guard).
 */
export const publicNotFound: (() => never) | undefined = IS_INTERNAL
  ? undefined
  : () => {
      throw notFound();
    };

export function closedScreen(name: string): () => ReactElement {
  return function Closed() {
    return <InternalOnly name={name} />;
  };
}
