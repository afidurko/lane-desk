import { createFileRoute } from "@tanstack/react-router";
import { NyPage } from "@/components/ny/ny-page";

export const Route = createFileRoute("/ny")({
  component: NyPage,
  head: () => ({
    meta: [
      { title: "Lane — New York" },
      { name: "description", content: "Medicare Rest of New York beside the New York Medicaid fee-for-service schedule." },
    ],
  }),
});
