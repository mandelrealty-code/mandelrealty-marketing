import { PHONE_DISPLAY, PHONE_HREF } from "../lib/constants";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#proof", label: "Proof" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#fit", label: "Who it fits" },
  { href: "/#plans", label: "Plans" },
] as const;

export function MarketingHeader({
  ctaHref = "/book-a-call",
  ctaLabel = "Book a call",
  ctaColor = "#222222",
  ctaInk = "#ffffff",
}: {
  ctaHref?: string;
  ctaLabel?: string;
  ctaColor?: string;
  ctaInk?: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#ebebeb] bg-white">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-5 gap-y-2.5 px-5 py-3">
        <a href="/" className="mr-auto flex items-center" aria-label="Mandel Realty Group home">
          <img src="/hub/mrg-logo.png" alt="Mandel Realty Group" className="block h-10 w-auto" />
        </a>
        <nav className="flex flex-wrap items-center gap-1 text-[14.5px] font-semibold">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-[#5e5e5e] hover:text-[#222222]"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <a
            href={PHONE_HREF}
            className="whitespace-nowrap rounded-full border border-[#dddddd] px-3.5 py-2 text-sm font-bold text-[#222222]"
          >
            {PHONE_DISPLAY}
          </a>
          <a
            href={ctaHref}
            className="whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold"
            style={{ background: ctaColor, color: ctaInk }}
          >
            {ctaLabel}
          </a>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter({ bookHref = "/book-a-call" }: { bookHref?: string }) {
  return (
    <footer className="border-t border-[#ebebeb] px-5 py-11">
      <div className="mx-auto grid max-w-[1120px] gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <a href="/" className="inline-block" aria-label="Mandel Realty Group home">
            <img src="/hub/mrg-logo.png" alt="Mandel Realty Group" className="block h-11 w-auto" />
          </a>
          <p className="mt-3.5 max-w-[36ch] text-sm font-medium leading-relaxed text-[#717171]">
            Virtual is not distant. Toronto-based, serving Toronto, Muskoka, Canada and the U.S.
          </p>
          <a href={PHONE_HREF} className="mt-2.5 inline-block text-[14.5px] font-bold text-[#222222]">
            {PHONE_DISPLAY}
          </a>
        </div>
        <FooterCol
          title="Explore"
          links={[
            { href: "/#how", label: "How it works" },
            { href: "/#proof", label: "Proof" },
            { href: "/#fit", label: "Who it fits" },
            { href: "/#faq", label: "FAQ" },
            { href: "/muskoka", label: "Muskoka" },
          ]}
        />
        <FooterCol
          title="Services"
          links={[
            { href: "/full-service", label: "Full Service Management" },
            { href: "/growth", label: "Growth Partnership" },
            { href: "/essentials", label: "Managed Essentials" },
            { href: "/furniture", label: "Furniture Investment" },
            { href: "/revenueaudit/", label: "Free revenue audit" },
          ]}
        />
        <FooterCol
          title="Get started"
          links={[
            { href: bookHref, label: "Book a free 15-minute call" },
            { href: "mailto:info@mandelrealtygroup.com", label: "info@mandelrealtygroup.com" },
            { href: "/privacy", label: "Privacy" },
          ]}
        />
      </div>
      <p className="mx-auto mt-8 max-w-[1120px] border-t border-[#ebebeb] pt-4 text-[13px] font-medium text-[#717171]">
        © {new Date().getFullYear()} Mandel Realty Group
      </p>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">{title}</p>
      <div className="mt-3.5 flex flex-col gap-2.5 text-[14.5px] font-semibold">
        {links.map((link) => (
          <a key={link.href + link.label} href={link.href} className="text-[#5e5e5e] hover:text-[#222222]">
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
