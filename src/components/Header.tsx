import { AuditButton } from "./ui";

const NAV = [
  { href: "#proof", label: "Proof" },
  { href: "#pricing", label: "Pricing" },
  { href: "#audit", label: "Book Audit" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-mrg-border/60 bg-mrg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <a href="#" className="font-display text-xl text-mrg-text sm:text-2xl">
          Mandel Realty Group
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-mrg-muted transition-colors hover:text-mrg-text"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <AuditButton className="!px-4 !py-2 !text-xs sm:!text-sm" />
      </div>
    </header>
  );
}
