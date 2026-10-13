import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/page";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Lane — Four teams" },
      {
        name: "description",
        content: "Intake, Price, New York, and Review. A bill is checked for Olean. Nothing is sent.",
      },
    ],
  }),
});
