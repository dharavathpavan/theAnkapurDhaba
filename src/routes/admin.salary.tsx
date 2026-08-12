import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getAdminSalary, saveAdminSalary, type StaffSalary } from "@/services/api";
import { BadgeIndianRupee, FileDown, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/admin/salary")({
  component: SalaryPage,
});

function SalaryPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [editing, setEditing] = useState<StaffSalary | null>(null);
  const [form, setForm] = useState(() => emptySalary(period));
  const { data, isLoading } = useQuery({ queryKey: ["admin-salary", period], queryFn: () => getAdminSalary({ period }) });
  const save = useMutation({
    mutationFn: () => saveAdminSalary({ ...form, period, id: editing?.id }),
    onSuccess: () => {
      toast.success("Salary saved");
      setEditing(null);
      setForm(emptySalary(period));
      qc.invalidateQueries({ queryKey: ["admin-salary"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save salary"),
  });

  return (
    <main className="space-y-5 p-4 md:p-6 lg:p-8">
      <section className="rounded-[28px] bg-[#120d0e] p-5 text-white shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-red-200">Payroll</p>
        <h1 className="mt-2 text-3xl font-black">Staff Salary</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">Manage employee salary, advance, bonus, deductions, paid status and salary slips.</p>
      </section>

      <div className="flex flex-col gap-3 rounded-[24px] border border-border bg-surface p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Salary Month</span>
          <input type="month" className="mt-2 h-12 rounded-2xl border border-border bg-background px-3 font-bold" value={period} onChange={(e) => { setPeriod(e.target.value); setForm(emptySalary(e.target.value)); }} />
        </label>
        <button className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border px-4 font-black text-muted-foreground"><FileDown className="h-4 w-4" /> Download Salary Report</button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Gross Salary" value={money(data?.summary.totalSalary)} />
        <Metric label="Advance" value={money(data?.summary.advances)} />
        <Metric label="Bonus" value={money(data?.summary.bonuses)} />
        <Metric label="Deduction" value={money(data?.summary.deductions)} />
        <Metric label="Final Payable" value={money(data?.summary.finalPayable)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-black"><Plus className="h-5 w-5 text-red-600" /> {editing ? "Edit Salary" : "Add Salary"}</h2>
          <div className="mt-4 space-y-3">
            <Field label="Employee Name" value={form.employeeName} onChange={(employeeName) => setForm({ ...form, employeeName })} />
            <Field label="Phone" value={form.employeePhone || ""} onChange={(employeePhone) => setForm({ ...form, employeePhone })} />
            <Field label="Role" value={form.role} onChange={(role) => setForm({ ...form, role })} />
            <Field label="Salary" type="number" value={String(form.salary || "")} onChange={(salary) => setForm({ ...form, salary: Number(salary) })} />
            <Field label="Advance" type="number" value={String(form.advance || "")} onChange={(advance) => setForm({ ...form, advance: Number(advance) })} />
            <Field label="Bonus" type="number" value={String(form.bonus || "")} onChange={(bonus) => setForm({ ...form, bonus: Number(bonus) })} />
            <Field label="Deduction" type="number" value={String(form.deduction || "")} onChange={(deduction) => setForm({ ...form, deduction: Number(deduction) })} />
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Status</span>
              <select className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-3 font-bold" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <div className="rounded-2xl bg-background p-4">
              <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">Final Salary</div>
              <div className="text-2xl font-black">{money((form.salary || 0) - (form.advance || 0) + (form.bonus || 0) - (form.deduction || 0))}</div>
            </div>
            <button disabled={save.isPending} onClick={() => save.mutate()} className="min-h-12 w-full rounded-2xl bg-red-600 font-black text-white disabled:opacity-60">{save.isPending ? "Saving..." : "Save Salary"}</button>
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-4 text-xl font-black">Employee List</h2>
          {isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-background" /> : !data?.salaries.length ? <Empty text="No salary records for this month." /> : (
            <div className="space-y-3">
              {data.salaries.map((row) => (
                <button key={row.id} onClick={() => { setEditing(row); setForm(row); }} className="grid w-full gap-3 rounded-2xl bg-background p-4 text-left md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black">{row.employeeName}</span>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{row.role}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${row.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.status}</span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{row.employeePhone || "No phone"} · {row.period}</div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-xl font-black">{money(row.finalSalary)}</div>
                    <div className="text-xs font-bold text-muted-foreground">Base {money(row.salary)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[22px] border border-border bg-surface p-4 shadow-sm"><BadgeIndianRupee className="h-5 w-5 text-red-600" /><div className="mt-3 text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-black">{value}</div></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</span><input type={type} className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-3 font-bold" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-background p-8 text-center text-sm font-bold text-muted-foreground"><Users className="mx-auto mb-2 h-6 w-6" />{text}</p>;
}

function emptySalary(period: string) {
  return { employeeName: "", employeePhone: "", role: "Staff", salary: 0, advance: 0, bonus: 0, deduction: 0, status: "pending", period, paidAt: null, note: "" };
}

function money(value?: number) {
  return `Rs ${Math.round(value || 0).toLocaleString("en-IN")}`;
}
