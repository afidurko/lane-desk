import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen, publicNotFound } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/filter")({
  beforeLoad: publicNotFound,
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
