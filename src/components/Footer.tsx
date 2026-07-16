import { EMAIL, EMAIL_HREF, PHONE, PHONE_HREF } from "../lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-mrg-border/40 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="font-display text-lg text-mrg-text">Mandel Realty Group</p>
          <p className="mt-1 text-sm text-mrg-muted">Toronto STR Management</p>
          <p className="mt-2 text-sm text-mrg-muted">Toronto, ON</p>
        </div>
        <div className="text-sm text-mrg-muted">
          <a href={PHONE_HREF} className="block text-mrg-gold hover:text-mrg-gold-light">
            {PHONE}
          </a>
          <a href={EMAIL_HREF} className="mt-1 block hover:text-mrg-text">
            {EMAIL}
          </a>
        </div>
        <nav className="flex gap-6 text-sm text-mrg-muted">
          <a href="/#proof" className="hover:text-mrg-text">
            Proof
          </a>
          <a href="/#pricing" className="hover:text-mrg-text">
            Pricing
          </a>
          <a href="/#audit" className="hover:text-mrg-text">
            Book Audit
          </a>
        </nav>
      </div>
    </footer>
  );
}
