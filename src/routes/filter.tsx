import { createFileRoute } from "@tanstack/react-router";
import { internalOnly } from "@/components/gate";
import { FilterPage } from "@/components/filter/filter-page";

export const Route = createFileRoute("/filter")({
  component: internalOnly(FilterPage, "Filter codes"),
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
