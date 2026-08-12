import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/menu")({
  component: AdminMenuLayout,
});

function AdminMenuLayout() {
  return <Outlet />;
}
