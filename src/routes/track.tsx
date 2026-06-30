import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/track")({
  component: () => <Navigate to="/orders" replace />,
});
