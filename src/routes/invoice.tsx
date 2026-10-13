import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/invoice")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
