import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/book")({
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/book/book-page").then((m) => ({ default: m.BookPage })))
    : closedScreen("Code book"),
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
