import { createFileRoute } from "@tanstack/react-router";
import { DeskPage } from "@/components/desk/desk-page";

export const Route = createFileRoute("/desk")({
  component: DeskPage,
  head: () => ({
    meta: [
      { title: "Lane — Desk" },
      {
        name: "description",
        content:
          "Paste a de-identified adult-day note. Lane times it, prices the therapy codes it recognizes, and keeps the row in this browser.",
      },
    ],
  }),
});
