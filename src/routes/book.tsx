import { createFileRoute } from "@tanstack/react-router";
import { BookPage } from "@/components/book/book-page";

export const Route = createFileRoute("/book")({
  component: BookPage,
  head: () => ({
    meta: [
      { title: "Lane — Codes" },
      {
        name: "description",
        content:
          "Look up adult-day therapy codes on the loaded 2026 Medicare national non-facility schedule. Other schedules are named and not priced.",
      },
    ],
  }),
});
