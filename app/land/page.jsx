// The sales landing (7 Nov 2026), for restaurant owners who don't use Cash
// Curry yet. Public, no sign-in, no app menu (ClientLayoutWrapper, middleware).
// It uses nothing from the app but the logo and fonts, so it can move to its
// own site and domain later. The pictures are HTML, with made-up figures.
import Link from "next/link";
import { CONTACT, DEMO_TEXT, FEATURES, STEPS, TRUST } from "./content";
import s from "./land.module.css";

export const metadata = {
  title: "Cash Curry · The back office for restaurants",
  description:
    "Daily sales and cash, approvals, payroll from real hours, purchases and a staff app, for restaurants with one branch or many.",
};

const demoHref = CONTACT.whatsapp
  ? `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(DEMO_TEXT)}`
  : CONTACT.email
    ? `mailto:${CONTACT.email}?subject=${encodeURIComponent("Cash Curry demo")}&body=${encodeURIComponent(DEMO_TEXT)}`
    : "#contact";
const hasContact = !!(CONTACT.whatsapp || CONTACT.email);
const external =demoHref.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {};

const rm = (n) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Mark({ size = 32 }) {
  return <img src="/logo/mark.svg" width={size} height={size} alt="" />;
}

function DemoButton({ children = "Book a demo", light = false }) {
  return (
    <a href={demoHref} {...external} className={light ? s.btnLight : s.btn}>
      {children}
    </a>
  );
}

/* ---------- pictures (made-up Demo Curry House figures) ---------- */

const CHANNELS = [
  { label: "Card", amount: 3804.6, tone: s.c1 },
  { label: "Cash", amount: 2930.0, tone: s.c2 },
  { label: "QR & e-wallet", amount: 1028.0, tone: s.c3 },
  { label: "Delivery apps", amount: 650.0, tone: s.c4 },
];
const SALES = CHANNELS.reduce((t, c) => t + c.amount, 0);

function DayEnd() {
  return (
    <div className={s.dayend} aria-label="Example day-end">
      <div className={s.cardHead}>
        <div>
          <p className={s.eyebrow}>Day-end · Demo Curry House</p>
          <p className={s.cardTitle}>Friday, 7 Nov</p>
        </div>
        <span className={s.chipOk}>Approved</span>
      </div>
      <p className={s.big}>
        <span className={s.cur}>RM</span>
        {rm(SALES)}
      </p>
      <p className={s.small}>Sales today</p>
      <div className={s.stack} role="img" aria-label="Sales by channel">
        {CHANNELS.map((c) => (
          <span key={c.label} className={c.tone} style={{ width: `${(c.amount / SALES) * 100}%` }} />
        ))}
      </div>
      <ul className={s.legend}>
        {CHANNELS.map((c) => (
          <li key={c.label}>
            <span className={`${s.dot} ${c.tone}`} />
            <span>{c.label}</span>
            <span className={s.num}>{rm(c.amount)}</span>
          </li>
        ))}
      </ul>
      <div className={s.cash}>
        <div>
          <p className={s.small}>Expected in drawer</p>
          <p className={s.num}>{rm(2930)}</p>
        </div>
        <div>
          <p className={s.small}>Counted</p>
          <p className={s.num}>{rm(2925.5)}</p>
        </div>
        <div>
          <p className={s.small}>Difference</p>
          <p className={`${s.num} ${s.short}`}>−4.50</p>
        </div>
      </div>
    </div>
  );
}

function Toast() {
  return (
    <div className={s.toast} aria-hidden="true">
      <span className={s.toastIcon}>✓</span>
      <div>
        <p className={s.toastTitle}>Leave request · Aina</p>
        <p className={s.small}>12–13 Nov · sent to her supervisor</p>
      </div>
    </div>
  );
}

function Payslip() {
  const rows = [
    ["Basic", "1,800.00"],
    ["Overtime · 18 h × 5.77", "103.86"],
    ["Advance, 2 Nov", "−200.00"],
    ["Loan · instalment 3 of 6", "−150.00"],
  ];
  return (
    <div className={s.paper} aria-label="Example payslip">
      <div className={s.cardHead}>
        <div>
          <p className={s.eyebrow}>Payslip · October 2026</p>
          <p className={s.cardTitle}>Rahim Ali · Cook</p>
        </div>
        <span className={s.chip}>PDF</span>
      </div>
      <div className={s.hours}>
        <div><p className={s.num}>208</p><p className={s.small}>hours worked</p></div>
        <div><p className={s.num}>26</p><p className={s.small}>days</p></div>
        <div><p className={s.num}>1</p><p className={s.small}>late</p></div>
      </div>
      <dl className={s.lines}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className={s.num}>{v}</dd>
          </div>
        ))}
        <div className={s.total}>
          <dt>Net pay</dt>
          <dd className={s.num}>RM 1,553.86</dd>
        </div>
      </dl>
    </div>
  );
}

function Phone() {
  const tasks = [
    ["Open the kitchen checklist", true],
    ["Chiller 2 temperature", true],
    ["Count the cash float", false],
    ["Receive the vegetable order", false],
  ];
  return (
    <div className={s.phone} aria-label="Example of the staff app">
      <div className={s.notch} />
      <p className={s.eyebrow}>Good morning</p>
      <p className={s.cardTitle}>Aina · Front of house</p>
      <div className={s.shift}>
        <span>On shift since 9:58</span>
        <span className={s.chipOk}>Clocked in</span>
      </div>
      <p className={s.label}>Today</p>
      <ul className={s.tasks}>
        {tasks.map(([t, done]) => (
          <li key={t} className={done ? s.done : undefined}>
            <span className={s.box}>{done ? "✓" : ""}</span>
            {t}
          </li>
        ))}
      </ul>
      <div className={s.req}>
        <p className={s.small}>Advance request</p>
        <p className={s.reqLine}>
          <span className={s.num}>RM 200.00</span>
          <span className={s.chipWait}>Waiting</span>
        </p>
      </div>
    </div>
  );
}

function CashBook() {
  const rows = [
    ["Opening cash", "1,200.00"],
    ["Cash sales", "+2,930.00"],
    ["Pay-outs · 2 bills", "−312.40"],
    ["Cash to bank", "−2,500.00"],
  ];
  return (
    <div className={s.paper} aria-label="Example cash book">
      <div className={s.cardHead}>
        <div>
          <p className={s.eyebrow}>Daily cash · Demo Curry House</p>
          <p className={s.cardTitle}>Friday, 7 Nov</p>
        </div>
        <span className={s.chip}>Branch 1 of 3</span>
      </div>
      <dl className={s.lines}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className={s.num}>{v}</dd>
          </div>
        ))}
        <div className={s.total}>
          <dt>Cash in hand</dt>
          <dd className={s.num}>RM 1,317.60</dd>
        </div>
      </dl>
      <p className={s.label} style={{ marginTop: 18 }}>Waiting for approval</p>
      <div className={s.req}>
        <p className={s.reqLine}>
          <span>
            Gas cylinders <span className={s.small}>· by the cashier</span>
          </span>
          <span className={s.num}>96.00</span>
        </p>
        <p className={s.reqLine}>
          <span className={s.small}>Receipt attached · to the manager</span>
          <span className={s.chipWait}>Waiting</span>
        </p>
      </div>
    </div>
  );
}

function PurchaseOrder() {
  const items = [
    ["Chicken thigh", "20 kg", "11.80", "12.10"],
    ["Red onion", "10 kg", "4.20", "4.20"],
    ["Basmati rice", "1 bag · 25 kg", "118.00", "118.00"],
  ];
  return (
    <div className={s.paper} aria-label="Example purchase order">
      <div className={s.cardHead}>
        <div>
          <p className={s.eyebrow}>PO-0142 · Kota Fresh Supply</p>
          <p className={s.cardTitle}>Received Thursday, 6 Nov</p>
        </div>
        <span className={s.chipOk}>Received</span>
      </div>
      <div className={s.poTable}>
        <div className={s.poHead}>
          <span>Item</span>
          <span>Ordered at</span>
          <span>Paid</span>
        </div>
        {items.map(([name, qty, was, now]) => (
          <div key={name} className={s.poRow}>
            <span>
              {name}
              <span className={s.small}> · {qty}</span>
            </span>
            <span className={s.num}>{was}</span>
            <span className={`${s.num} ${was !== now ? s.changed : ""}`}>{now}</span>
          </div>
        ))}
      </div>
      <div className={s.warn}>
        <span aria-hidden="true">⏰</span> Chiller 2 warranty ends in 21 days
      </div>
    </div>
  );
}

const PICTURE = { finance: CashBook, payroll: Payslip, "staff-app": Phone, purchases: PurchaseOrder };

/* ---------- page ---------- */

export default function LandingPage() {
  return (
    <div className={s.page}>
      <header className={s.nav}>
        <div className={s.wrap}>
          <a href="#top" className={s.brand}>
            <Mark size={30} />
            <span>Cash Curry</span>
          </a>
          <nav className={s.links} aria-label="Sections">
            {FEATURES.map((f) => (
              <a key={f.id} href={`#${f.id}`}>{f.kicker.split(" & ")[0]}</a>
            ))}
          </nav>
          <div className={s.navCta}>
            <Link href="/login" className={s.signin}>Sign in</Link>
            <DemoButton />
          </div>
        </div>
      </header>

      <main id="top">
        <section className={s.hero}>
          <div className={`${s.wrap} ${s.heroGrid}`}>
            <div className={s.heroText}>
              <p className={s.pill}>The back office for restaurants</p>
              <h1>
                Every ringgit, every shift, <em>every branch.</em>
              </h1>
              <p className={s.lead}>
                Daily sales and cash, approvals, payroll from real hours, purchases and an app for
                your staff. One place, for one restaurant or twenty.
              </p>
              <div className={s.ctaRow}>
                <DemoButton light>Book a demo</DemoButton>
                <a href="#finance" className={s.ghost}>See what it does ↓</a>
              </div>
              <p className={s.note}>Made with a working restaurant group and used there every day.</p>
            </div>
            <div className={s.heroArt}>
              <DayEnd />
              <Toast />
            </div>
          </div>
        </section>

        <section className={s.strip} aria-label="In short">
          <div className={`${s.wrap} ${s.stripGrid}`}>
            <p><strong>One set of numbers.</strong> The day-end, the cash book and the reports all agree.</p>
            <p><strong>Approved by someone senior.</strong> Nobody signs off their own pay-out.</p>
            <p><strong>On any phone.</strong> Web for the office, an app for the team, a kiosk by the door.</p>
          </div>
        </section>

        {FEATURES.map((f, i) => {
          const Picture = PICTURE[f.id];
          return (
            <section key={f.id} id={f.id} className={`${s.feature} ${i % 2 ? s.alt : ""}`}>
              <div className={`${s.wrap} ${s.featureGrid} ${i % 2 ? s.flip : ""}`}>
                <div className={s.featureText}>
                  <p className={s.kicker}>
                    <span className={s.kn}>0{i + 1}</span>
                    {f.kicker}
                  </p>
                  <h2>{f.title}</h2>
                  <p className={s.body}>{f.body}</p>
                  <ul className={s.points}>
                    {f.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div className={s.featureArt}>
                  <Picture />
                </div>
              </div>
            </section>
          );
        })}

        <section className={s.steps}>
          <div className={s.wrap}>
            <h2 className={s.center}>Up and running in a week</h2>
            <ol className={s.stepGrid}>
              {STEPS.map((st) => (
                <li key={st.n}>
                  <span className={s.stepN}>{st.n}</span>
                  <h3>{st.title}</h3>
                  <p>{st.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={s.trust}>
          <div className={s.wrap}>
            <h2 className={s.center}>Built for how a restaurant really runs</h2>
            <div className={s.trustGrid}>
              {TRUST.map((t) => (
                <div key={t.title}>
                  <h3>{t.title}</h3>
                  <p>{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className={s.final}>
          <div className={`${s.wrap} ${s.finalInner}`}>
            <h2>See it with your own restaurant&apos;s numbers.</h2>
            <p className={s.lead}>
              We&apos;ll walk you through a demo restaurant, then set up yours with you.
            </p>
            <div className={s.ctaRow}>
              {hasContact && (
                <DemoButton light>{CONTACT.whatsapp ? "Message us on WhatsApp" : "Email us for a demo"}</DemoButton>
              )}
              <Link href="/login" className={s.ghost}>Already a customer? Sign in</Link>
            </div>
            {CONTACT.email && (
              <p className={s.note}>
                Or write to <span className={s.select}>{CONTACT.email}</span>
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footInner}`}>
          <span className={s.brand}>
            <Mark size={22} />
            <span>Cash Curry</span>
          </span>
          <span>© 2026 Cash Curry</span>
        </div>
      </footer>
    </div>
  );
}
