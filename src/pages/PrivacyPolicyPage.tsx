import { useEffect, type ReactNode } from "react";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { EMAIL, EMAIL_HREF, PHONE, PHONE_HREF } from "../lib/constants";

const LAST_UPDATED = "September 1, 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl text-mrg-text sm:text-2xl">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-mrg-muted">{children}</div>
    </section>
  );
}

export function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = "Privacy Policy | Mandel Realty Group";
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://www.mandelrealtygroup.com/privacy");
  }, []);

  return (
    <div className="min-h-dvh bg-mrg-bg text-mrg-text">
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mrg-gold">
          Legal
        </p>
        <h1 className="mt-3 font-display text-3xl text-mrg-text sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-mrg-muted">Last updated: {LAST_UPDATED}</p>

        <div className="mt-10 space-y-10">
          <Section title="Overview">
            <p>
              Mandel Realty Group (&ldquo;MRG,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
              &ldquo;our&rdquo;) respects your privacy. This policy explains what personal
              information we collect, how we use it, and the choices you have when you visit{" "}
              <a href="https://www.mandelrealtygroup.com" className="text-mrg-gold hover:text-mrg-gold-light">
                mandelrealtygroup.com
              </a>
              , submit a form on our website, respond to our ads, or communicate with us about
              Airbnb and short-term rental management services.
            </p>
          </Section>

          <Section title="Information we collect">
            <p>Depending on how you interact with us, we may collect:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-mrg-text">Contact details</strong> — name, email address,
                and phone number.
              </li>
              <li>
                <strong className="text-mrg-text">Property and listing information</strong> —
                property address, Airbnb listing link or title, earnings estimates, and answers
                you provide about your listing status or goals.
              </li>
              <li>
                <strong className="text-mrg-text">Booking preferences</strong> — preferred call
                times and scheduling details when you book a consultation.
              </li>
              <li>
                <strong className="text-mrg-text">Communications</strong> — messages you send us by
                email, phone, text, or WhatsApp, and our replies.
              </li>
              <li>
                <strong className="text-mrg-text">Client and host records</strong> — if you become
                a client, we also keep business records needed to manage your property, including
                payout and operational information.
              </li>
              <li>
                <strong className="text-mrg-text">Usage and device data</strong> — pages viewed,
                referral source, browser type, IP address, and similar technical data collected
                through cookies, pixels, and analytics tools.
              </li>
            </ul>
          </Section>

          <Section title="How we collect information">
            <ul className="list-disc space-y-2 pl-5">
              <li>Forms on our website, including our booking and earnings estimate flows.</li>
              <li>Lead forms on Meta (Facebook and Instagram) and other advertising platforms.</li>
              <li>Phone calls, text messages, email, and WhatsApp conversations with our team.</li>
              <li>Cookies, pixels, and similar technologies when you browse our site or interact with our ads.</li>
            </ul>
          </Section>

          <Section title="How we use your information">
            <p>We use personal information to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Respond to inquiries and schedule consultations about our management services.</li>
              <li>Prepare earnings estimates and evaluate whether your property is a fit for MRG.</li>
              <li>Deliver property management services if you become a client.</li>
              <li>Send follow-up calls, texts, or emails you have asked for or consented to receive.</li>
              <li>Measure and improve our website, ads, and marketing performance.</li>
              <li>Protect against fraud, abuse, and security incidents.</li>
              <li>Comply with legal obligations and enforce our agreements.</li>
            </ul>
            <p>
              We do not sell your personal information to third parties for their own marketing
              purposes.
            </p>
          </Section>

          <Section title="Advertising, analytics, and cookies">
            <p>
              We use advertising and analytics tools that may collect or receive information
              about your activity on our website and ads, including:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-mrg-text">Meta (Facebook) Pixel</strong> — to measure ad
                performance and understand visits and lead conversions from Meta ads.
              </li>
              <li>
                <strong className="text-mrg-text">Google Ads / Google tag</strong> — to measure
                conversions and campaign performance.
              </li>
            </ul>
            <p>
              These tools may use cookies, pixels, or similar technologies. You can control some
              tracking through your browser settings and, where available, platform ad preference
              tools offered by Meta and Google.
            </p>
          </Section>

          <Section title="How we share information">
            <p>We may share personal information with service providers that help us operate, such as:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Hosting, database, and CRM providers used to store lead and client records.</li>
              <li>Email delivery providers used to send transactional and operational messages.</li>
              <li>SMS and phone providers used to contact you by text or call.</li>
              <li>Automation tools that route lead form submissions into our systems.</li>
              <li>Advertising platforms when you submit information through a lead ad.</li>
            </ul>
            <p>
              These providers may only use the information to perform services for us, subject to
              their own privacy terms. We may also disclose information if required by law, to
              protect our rights, or in connection with a business transaction such as a merger or
              sale.
            </p>
          </Section>

          <Section title="Retention">
            <p>
              We keep personal information only as long as needed for the purposes described in
              this policy, including while we are in contact with you, providing services, or
              meeting legal, tax, and accounting requirements.
            </p>
          </Section>

          <Section title="Your choices and rights">
            <p>You can:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Opt out of marketing messages by replying STOP to a text or using the unsubscribe link in an email.</li>
              <li>Ask us to update or correct your contact information.</li>
              <li>Request access to or deletion of your personal information, subject to legal limits.</li>
              <li>Withdraw consent where we rely on consent, without affecting prior lawful processing.</li>
            </ul>
            <p>
              If you are in Canada, you may have additional rights under applicable privacy laws,
              including PIPEDA. If you are in certain U.S. states, you may have additional rights
              under state privacy laws. Contact us to make a request.
            </p>
          </Section>

          <Section title="Security">
            <p>
              We use reasonable administrative, technical, and organizational safeguards to protect
              personal information. No method of transmission or storage is completely secure, and
              we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="Children">
            <p>
              Our services are intended for adults. We do not knowingly collect personal
              information from children under 13. If you believe a child has provided us
              information, contact us and we will delete it.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy from time to time. The &ldquo;Last updated&rdquo; date at
              the top will change when we do. Continued use of our website or services after an
              update means you accept the revised policy.
            </p>
          </Section>

          <Section title="Contact us">
            <p>
              Questions about this policy or your personal information? Reach us at:
            </p>
            <ul className="list-none space-y-2 pl-0">
              <li>
                <strong className="text-mrg-text">Mandel Realty Group</strong>
              </li>
              <li>
                Email:{" "}
                <a href={EMAIL_HREF} className="text-mrg-gold hover:text-mrg-gold-light">
                  {EMAIL}
                </a>
              </li>
              <li>
                Phone:{" "}
                <a href={PHONE_HREF} className="text-mrg-gold hover:text-mrg-gold-light">
                  {PHONE}
                </a>
              </li>
              <li>
                Website:{" "}
                <a
                  href="https://www.mandelrealtygroup.com"
                  className="text-mrg-gold hover:text-mrg-gold-light"
                >
                  www.mandelrealtygroup.com
                </a>
              </li>
            </ul>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
