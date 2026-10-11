import { createFileRoute } from "@tanstack/react-router";
import { CodePage } from "@/components/lookup/code-page";

export const Route = createFileRoute("/code")({
  component: CodePage,
  head: () => ({
    meta: [
      { title: "Lane — One code" },
      { name: "description", content: "One code, what the file calls it, and the Rest of New York amount for each year from 2020 through 2026." },
    ],
  }),
});
