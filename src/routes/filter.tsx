import { createFileRoute } from "@tanstack/react-router";
import { FilterPage } from "@/components/filter/filter-page";

export const Route = createFileRoute("/filter")({
  component: FilterPage,
  head: () => ({
    meta: [
      { title: "Lane — Filter" },
      { name: "description", content: "Filter loaded Medicare codes, including procedures and transportation, and keep the ones you want." },
    ],
  }),
});
