import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCart } from "@/stores/cart";

export const Route = createFileRoute("/t/$tableId")({
  head: ({ params }) => ({
    meta: [{ title: `Table ${params.tableId} · Ankapur Dhaba` }, { name: "robots", content: "noindex" }],
  }),
  component: TableLanding,
});

function TableLanding() {
  const { tableId } = Route.useParams();
  const navigate = useNavigate();
  const setTable = useCart((s) => s.setTable);

  useEffect(() => {
    setTable(tableId);
    const t = setTimeout(() => navigate({ to: "/menu" }), 900);
    return () => clearTimeout(t);
  }, [tableId, setTable, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div>
        <div className="font-display text-xs tracking-[0.4em] text-muted-foreground">ANKAPUR DHABA</div>
        <div className="mt-3 font-display text-6xl tracking-wide text-primary">TABLE {tableId}</div>
        <p className="mt-4 text-sm text-muted-foreground">Opening the menu for your table…</p>
      </div>
    </div>
  );
}
