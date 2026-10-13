import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen, publicNotFound } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/ny")({
  beforeLoad: publicNotFound,
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/ny/ny-page").then((m) => ({ default: m.NyPage })))
    : closedScreen("New York detail"),
  head: () => ({
    meta: [
      { title: "Lane — New York" },
      { name: "description", content: IS_INTERNAL ? "Medicare Rest of New York beside the New York Medicaid fee-for-service schedule." : "Internal screen." },
    ],
  }),
});
