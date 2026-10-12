import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/filter")({
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/filter/filter-page").then((m) => ({ default: m.FilterPage })))
    : closedScreen("Filter codes"),
  head: () => ({
    meta: [
      { title: "Lane — Filter" },
      {
        name: "description",
        content: "Filter loaded Medicare codes, including procedures and transportation, and keep the ones you want.",
      },
    ],
  }),
});
