import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/ny")({
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/ny/ny-page").then((m) => ({ default: m.NyPage })))
    : closedScreen("New York detail"),
  head: () => ({
    meta: [
      { title: "Lane — New York" },
      { name: "description", content: "Medicare Rest of New York beside the New York Medicaid fee-for-service schedule." },
    ],
  }),
});
