import { createFileRoute } from "@tanstack/react-router";
import { CodePage } from "@/components/lookup/code-page";

export const Route = createFileRoute("/code")({
  component: CodePage,
  head: () => ({
    meta: [
      { title: "Lane — Look up a code" },
      { name: "description", content: "One code, what the CMS file calls it, and its Medicare reference price. Not a payment." },
    ],
  }),
});
