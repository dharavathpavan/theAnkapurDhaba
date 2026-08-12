import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/restaurant/waiter")({
  beforeLoad: () => {
    throw redirect({ to: "/waiter" });
  },
});
