import type { Order } from "@/services/api";

export function KotBill({ order, kind = "kot" }: { order: Order; kind?: "kot" | "bill" }) {
  const o = order;
  const dt = new Date(o.updatedAt || o.createdAt);
  const isBill = kind === "bill";
  return (
    <div className="paper-bill mx-auto w-[320px] px-5 pt-6 pb-8 text-[13px] leading-snug">
      <div className="feed">
        <div className="text-center">
          <div className="text-[22px] font-bold tracking-[0.3em]">ANKAPUR</div>
          <div className="text-[14px] tracking-[0.4em] -mt-1">DHABA</div>
          <div className="mt-1 text-[10px] tracking-widest">— SINCE 1985 —</div>
          <div className="mt-2 text-[11px]">
            {isBill ? "CUSTOMER BILL" : "KITCHEN ORDER TICKET"}
          </div>
          <div className="mt-1 text-[16px] font-bold tracking-widest">
            {o.tableNumber ? `DINE-IN · TABLE ${o.tableNumber}` : o.type === "pickup" ? "PICKUP ORDER" : "DELIVERY ORDER"}
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-black/60" />

        <div className="flex justify-between text-[12px]">
          <span>#{o.id}</span>
          <span>
            {dt.toLocaleDateString()}{" "}
            {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span>{o.type.toUpperCase()}</span>
          <span>{o.tableNumber ? `TABLE ${o.tableNumber}` : o.paymentMethod.toUpperCase()}</span>
        </div>
        <div className="text-[12px]">
          STATUS: {o.status.replace(/_/g, " ").toUpperCase()}
        </div>

        <div className="my-3 border-t border-dashed border-black/60" />

        <div className="text-[12px]">
          <div className="font-bold">{o.customer.name}</div>
          <div>{o.customer.phone}</div>
          {o.customer.address && <div className="mt-1">{o.customer.address}</div>}
          {o.customer.landmark && <div className="italic">↳ {o.customer.landmark}</div>}
        </div>

        <div className="my-3 border-t border-dashed border-black/60" />

        <div className="flex justify-between text-[11px] font-bold uppercase">
          <span>Item</span>
          <span className="flex gap-3">
            <span className="w-6 text-right">Qty</span>
            {isBill && <span className="w-12 text-right">Amt</span>}
          </span>
        </div>
        <div className="my-1 border-t border-black/60" />
        <ul className="space-y-1">
          {o.items.map((it) => (
            <li key={it.id} className="flex justify-between">
              <span>
                <span className="inline-block w-3">{it.isVeg ? "●" : "▲"}</span>
                {it.name}
              </span>
              <span className="flex gap-3">
                <span className="w-6 text-right">{it.qty}</span>
                {isBill && <span className="w-12 text-right">₹{it.price * it.qty}</span>}
              </span>
            </li>
          ))}
        </ul>

        {isBill && (
          <>
            <div className="my-2 border-t border-dashed border-black/60" />
            <Row label="Subtotal" value={`₹${o.subtotal}`} />
            <Row label="GST 5%" value={`₹${o.tax}`} />
            {o.deliveryFee > 0 && <Row label="Delivery" value={`₹${o.deliveryFee}`} />}
            <div className="my-2 border-t border-black/60" />
            <div className="flex justify-between text-[15px] font-bold">
              <span>TOTAL</span>
              <span>₹{o.total}</span>
            </div>
            <div className="mt-1 text-right text-[11px]">
              {o.paymentMethod.toUpperCase()} · {o.paymentStatus.toUpperCase()}
            </div>
          </>
        )}

        {o.customer.notes && (
          <>
            <div className="my-3 border-t border-dashed border-black/60" />
            <div className="text-[12px]">
              <div className="font-bold">NOTE:</div>
              <div>{o.customer.notes}</div>
            </div>
          </>
        )}

        <div className="my-3 border-t border-dashed border-black/60" />
        <div className="text-center text-[11px]">
          {isBill ? "DHANYAVAAD · VISIT AGAIN" : "*** PREPARE WITH LOVE ***"}
        </div>
        <div className="mt-1 text-center text-[10px]">ankapurdhaba.in</div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
