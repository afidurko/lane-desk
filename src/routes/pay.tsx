import { createFileRoute } from "@tanstack/react-router";
import { PayPage } from "@/components/pay/pay-page";

export const Route = createFileRoute("/pay")({
  component: PayPage,
  head: () => ({
    meta: [
      { title: "Lane — Pay" },
      { name: "description", content: "Lines with no third party. The file amount. Lane does not send a payment." },
    ],
  }),
});
