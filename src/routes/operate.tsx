import { createFileRoute } from "@tanstack/react-router";
import { internalOnly } from "@/components/gate";
import { OperatePage } from "@/components/operate/operate-page";

export const Route = createFileRoute("/operate")({
  component: internalOnly(OperatePage, "Rules"),
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
