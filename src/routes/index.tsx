import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/page";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Lane — Code the note. Price the claim." },
      {
        name: "description",
        content:
          "A de-identified encounter goes in. A code and an allowed amount come out, timed against the manual coding and fee-schedule desk. The chart stays.",
      },
    ],
  }),
});
