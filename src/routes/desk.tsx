import { createFileRoute } from "@tanstack/react-router";
import { DeskPage } from "@/components/desk/desk-page";

export const Route = createFileRoute("/desk")({
  component: DeskPage,
  head: () => ({
    meta: [
      { title: "Lane — Try a sample note" },
      {
        name: "description",
        content:
          "Try a made-up, de-identified therapy note. See the code, the Medicare reference price, and the measured coder time. Not a payment.",
      },
    ],
  }),
});
