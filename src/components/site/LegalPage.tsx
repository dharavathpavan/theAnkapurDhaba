import { Link } from "@tanstack/react-router";

export const LEGAL_BUSINESS = {
  brand: "The Ankapure Dhaba",
  legalName: "The Ankapure Dhaba",
  phone: "+91 90000 00000",
  email: "support@theankapuredhaba.com",
  address: "Ankapur Village, Nizamabad District, Telangana 503217",
  hours: "10:00 AM to 11:00 PM",
  updated: "July 13, 2026",
};

export type LegalSection = {
  title: string;
  body: string[];
};

export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="bg-[#F8F9FB] px-4 py-6 pb-40 md:px-6 md:py-10">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-sm">
        <header className="bg-zinc-950 px-5 py-8 text-white md:px-10">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/the-ankapure-dhaba-logo.png" alt="The Ankapure Dhaba logo" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/15" />
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.24em] text-red-300">{LEGAL_BUSINESS.brand}</span>
              <span className="block text-sm font-semibold text-white/70">Legal information</span>
            </span>
          </Link>
          <h1 className="mt-7 text-3xl font-black tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72 md:text-base">{intro}</p>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-white/45">Last updated: {LEGAL_BUSINESS.updated}</p>
        </header>

        <div className="grid gap-6 px-5 py-7 md:px-10">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-zinc-100 bg-zinc-50 p-5">
              <h2 className="text-xl font-black text-zinc-950">{section.title}</h2>
              <div className="mt-3 grid gap-3 text-sm leading-6 text-zinc-700">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-3xl border border-red-100 bg-red-50 p-5">
            <h2 className="text-xl font-black text-zinc-950">Business Contact</h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-zinc-700">
              <p><strong>Business:</strong> {LEGAL_BUSINESS.legalName}</p>
              <p><strong>Address:</strong> {LEGAL_BUSINESS.address}</p>
              <p><strong>Phone:</strong> <a className="font-bold text-red-600" href={`tel:${LEGAL_BUSINESS.phone}`}>{LEGAL_BUSINESS.phone}</a></p>
              <p><strong>Email:</strong> <a className="font-bold text-red-600" href={`mailto:${LEGAL_BUSINESS.email}`}>{LEGAL_BUSINESS.email}</a></p>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
