import { createFileRoute } from "@tanstack/react-router";
import { ProofPage } from "@/components/pages/proof-page";

export const Route = createFileRoute("/proof")({
  component: ProofPage,
  head: () => ({
    meta: [
      { title: "Lane — Proof" },
      {
        name: "description",
        content:
          "What has been checked: prices against the CMS files for every year, and the coder timing, labeled as ours and provisional.",
      },
    ],
  }),
});
