import { createFileRoute } from "@tanstack/react-router";
import { internalOnly } from "@/components/gate";
import { RunPage } from "@/components/landing/run-page";

export const Route = createFileRoute("/run")({
  component: internalOnly(RunPage, "Sample file"),
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
