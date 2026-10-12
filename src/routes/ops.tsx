import { createFileRoute } from "@tanstack/react-router";
import { internalOnly } from "@/components/gate";
import { OpsPage } from "@/components/ops/ops-page";

export const Route = createFileRoute("/ops")({
  component: internalOnly(OpsPage, "File status"),
  head: () => ({
    meta: [
      { title: "Lane — Files" },
      { name: "description", content: "Which Rest of New York fee files are loaded, and when the next file is due." },
    ],
  }),
});
