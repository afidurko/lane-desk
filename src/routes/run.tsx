import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/run")({
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/landing/run-page").then((m) => ({ default: m.RunPage })))
    : closedScreen("Sample file"),
  head: () => ({
    meta: [
      { title: "Lane — Sample file" },
      {
        name: "description",
        content:
          "A fictional adult-day therapeutic exercise note, with the script side filled and the human desk left blank. Not a measured run. Not a bill.",
      },
    ],
  }),
});
