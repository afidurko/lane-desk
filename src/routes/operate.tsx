import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen, publicNotFound } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/operate")({
  beforeLoad: publicNotFound,
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/operate/operate-page").then((m) => ({ default: m.OperatePage })))
    : closedScreen("Rules"),
  head: () => ({
    meta: [
      { title: "Lane — Rules" },
      {
        name: "description",
        content: "The boundary that runs before any skill. No claim submission, no portal, no stored HPI.",
      },
    ],
  }),
});
