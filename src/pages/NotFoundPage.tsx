import { useEffect } from "react";
import { MarketingFooter, MarketingHeader } from "../components/MarketingChrome";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Page not found | Mandel Realty Group";
    const robots = document.querySelector('meta[name="robots"]');
    const previous = robots?.getAttribute("content") ?? "";
    robots?.setAttribute("content", "noindex, nofollow");
    return () => {
      if (previous) robots?.setAttribute("content", previous);
    };
  }, []);

  return (
    <div
      className="flex min-h-dvh flex-col bg-white text-[#222222]"
      style={{ fontFamily: '"Plus Jakarta Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-20">
        <p className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#8a6f2e]">404</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em]">That page isn’t here.</h1>
        <p className="mt-4 text-[17px] font-medium leading-relaxed text-[#5e5e5e]">
          The address doesn’t match a page on this site. Head home, or book a call if you were looking
          for management.
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          <a
            href="/"
            className="rounded-full bg-[#222222] px-5 py-3 text-[15px] font-bold text-white"
          >
            Back to home
          </a>
          <a
            href="/book-a-call"
            className="rounded-full border border-[#dddddd] px-5 py-3 text-[15px] font-bold text-[#222222]"
          >
            Book a call
          </a>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
