import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/claim")({
  beforeLoad: () => {
    throw redirect({ to: "/billing" });
  },
});
