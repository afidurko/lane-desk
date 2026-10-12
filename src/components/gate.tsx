import type { ComponentType, ReactElement } from "react";
import { InternalOnly } from "@/components/ui";
import { IS_INTERNAL } from "@/lib/config/mode";

/** Wrap a screen so a public build shows a plain "not part of this demo" page instead. */
export function internalOnly(Screen: ComponentType, name: string): () => ReactElement {
  return function Gated() {
    return IS_INTERNAL ? <Screen /> : <InternalOnly name={name} />;
  };
}
