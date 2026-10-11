import { createFileRoute } from "@tanstack/react-router";
import { OperatePage } from "@/components/operate/operate-page";

export const Route = createFileRoute("/operate")({
  component: OperatePage,
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
