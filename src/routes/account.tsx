import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/account")({
  component: () => <Navigate to="/profile" />,
});
