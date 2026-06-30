import { Link } from "@tanstack/react-router";
import { Instagram, Phone, MapPin, Clock } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-6">
        <div>
          <div className="font-display text-3xl tracking-widest text-primary">ANKAPUR DHABA</div>
          <p className="mt-3 text-sm text-muted-foreground">
            Slow-cooked Telangana classics, fired in a clay tandoor since 1998.
          </p>
        </div>
        <div>
          <h4 className="font-display text-sm tracking-[0.3em] text-accent">Visit</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary" /> NH-44, Ankapur, Telangana</li>
            <li className="flex gap-2"><Phone className="h-4 w-4 mt-0.5 text-primary" /> +91 98765 43210</li>
            <li className="flex gap-2"><Clock className="h-4 w-4 mt-0.5 text-primary" /> 11:00 AM — 11:30 PM</li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm tracking-[0.3em] text-accent">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/menu" className="hover:text-primary">Full menu</Link></li>
            <li><Link to="/orders" className="hover:text-primary">Your orders</Link></li>
            <li><Link to="/admin" className="hover:text-primary">Staff login</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm tracking-[0.3em] text-accent">Follow</h4>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <Instagram className="h-4 w-4" /> @ankapurdhaba
          </a>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs tracking-widest text-muted-foreground">
        © {new Date().getFullYear()} ANKAPUR DHABA · ALL RIGHTS RESERVED
      </div>
    </footer>
  );
}
