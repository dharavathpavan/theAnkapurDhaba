import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
  uploadCatalogFile,
  type AdminRangePreset,
  type Expense,
  type ExpensePayload,
} from "@/services/api";
import { IndianRupee, Plus, ReceiptText, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/admin/expenses")({
  component: ExpensesPage,
});

const paymentMethods = ["cash", "upi", "card", "phonepe", "gpay", "paytm", "bank"];

function ExpensesPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<AdminRangePreset>("today");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpensePayload>(() => emptyExpense());
  const { data, isLoading } = useQuery({
    queryKey: ["admin-expenses", range],
    queryFn: () => listExpenses({ range }),
  });
  const save = useMutation({
    mutationFn: () => editing ? updateExpense(editing.id, form) : createExpense(form),
    onSuccess: () => {
      toast.success(editing ? "Expense updated" : "Expense added");
      setEditing(null);
      setForm(emptyExpense());
      qc.invalidateQueries({ queryKey: ["admin-expenses"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save expense"),
  });
  const remove = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["admin-expenses"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  const categories = data?.categories ?? [];
  const totals = data?.summary;
  const expenses = data?.expenses ?? [];
  const yearTotal = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);

  async function uploadReceipt(file?: File) {
    if (!file) return;
    try {
      const uploaded = await uploadCatalogFile(file);
      setForm((prev) => ({ ...prev, receiptUrl: uploaded.url }));
      toast.success("Receipt uploaded");
    } catch {
      toast.error("Receipt upload failed");
    }
  }

  return (
    <main className="space-y-5 p-4 md:p-6 lg:p-8">
      <Header title="Expenses" subtitle="Track daily purchases, bills, salary spend and restaurant operating costs." />
      <RangeTabs value={range} onChange={setRange} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Selected Range" value={money(totals?.total)} />
        <Metric label="Today" value={money(totals?.today)} />
        <Metric label="Records" value={expenses.length.toString()} />
        <Metric label="Visible Total" value={money(yearTotal)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Plus className="h-5 w-5 text-red-600" /> {editing ? "Edit Expense" : "Add Expense"}
          </h2>
          <div className="mt-4 space-y-3">
            <Field label="Date" type="date" value={form.date} onChange={(date) => setForm({ ...form, date })} />
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Category</span>
              <select className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-3 font-bold" value={form.categoryName} onChange={(e) => setForm({ ...form, categoryName: e.target.value, categoryId: categories.find((c) => c.name === e.target.value)?.id })}>
                <option value="">Select category</option>
                {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
            </label>
            <Field label="Amount" type="number" value={String(form.amount || "")} onChange={(amount) => setForm({ ...form, amount: Number(amount) })} />
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Payment Method</span>
              <select className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-3 font-bold" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                {paymentMethods.map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</span>
              <textarea className="mt-2 min-h-24 w-full rounded-2xl border border-border bg-background p-3 font-semibold" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background text-sm font-black text-muted-foreground">
              <Upload className="h-4 w-4" /> Upload Receipt
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => uploadReceipt(e.target.files?.[0])} />
            </label>
            <button disabled={save.isPending} onClick={() => save.mutate()} className="min-h-12 w-full rounded-2xl bg-red-600 px-4 font-black text-white disabled:opacity-60">
              {save.isPending ? "Saving..." : editing ? "Update Expense" : "Add Expense"}
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-4 text-xl font-black">Expense Records</h2>
          {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-background" /> : expenses.length === 0 ? (
            <Empty text="No expenses in this range." />
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div key={expense.id} className="grid gap-3 rounded-2xl bg-background p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black">{expense.categoryName}</span>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{expense.paymentMethod}</span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{expense.description || "No description"}</div>
                    <div className="mt-1 text-xs font-bold text-muted-foreground">{new Date(expense.date).toLocaleDateString("en-IN")}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <div className="text-xl font-black">{money(expense.amount)}</div>
                    <button className="rounded-xl px-3 py-2 text-sm font-black text-red-600" onClick={() => { setEditing(expense); setForm({ date: expense.date.slice(0, 10), categoryId: expense.categoryId, categoryName: expense.categoryName, amount: expense.amount, paymentMethod: expense.paymentMethod, description: expense.description, receiptUrl: expense.receiptUrl }); }}>Edit</button>
                    <button className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600" onClick={() => remove.mutate(expense.id)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-4 text-xl font-black">Category Breakdown</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(totals?.byCategory ?? []).map((item) => <Metric key={item.label} label={item.label} value={money(item.amount)} icon={ReceiptText} />)}
        </div>
      </section>
    </main>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return <section className="rounded-[28px] bg-[#120d0e] p-5 text-white shadow-xl"><p className="text-xs font-black uppercase tracking-[0.24em] text-red-200">Owner Control</p><h1 className="mt-2 text-3xl font-black">{title}</h1><p className="mt-2 max-w-2xl text-sm text-white/65">{subtitle}</p></section>;
}

function Metric({ label, value, icon: Icon = IndianRupee }: { label: string; value: string; icon?: React.ElementType }) {
  return <div className="rounded-[22px] border border-border bg-surface p-4 shadow-sm"><Icon className="h-5 w-5 text-red-600" /><div className="mt-3 text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-black">{value}</div></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</span><input type={type} className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-3 font-bold" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function RangeTabs({ value, onChange }: { value: AdminRangePreset; onChange: (value: AdminRangePreset) => void }) {
  const options: AdminRangePreset[] = ["today", "yesterday", "week", "month", "year"];
  return <div className="flex gap-2 overflow-x-auto pb-1">{options.map((option) => <button key={option} onClick={() => onChange(option)} className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-black capitalize ${value === option ? "bg-red-600 text-white" : "bg-surface text-muted-foreground"}`}>{option}</button>)}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-background p-8 text-center text-sm font-bold text-muted-foreground">{text}</p>;
}

function emptyExpense(): ExpensePayload {
  return { date: new Date().toISOString().slice(0, 10), categoryName: "", amount: 0, paymentMethod: "cash", description: "" };
}

function money(value?: number) {
  return `Rs ${Math.round(value || 0).toLocaleString("en-IN")}`;
}
