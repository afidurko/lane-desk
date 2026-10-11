import { createFileRoute } from "@tanstack/react-router";
import { OpsPage } from "@/components/ops/ops-page";

export const Route = createFileRoute("/ops")({
  component: OpsPage,
  head: () => ({
    meta: [
      { title: "Lane — Files" },
      { name: "description", content: "Which Rest of New York fee files are loaded, and when the next file is due." },
    ],
  }),
});
