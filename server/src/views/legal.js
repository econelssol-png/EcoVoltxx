/**
 * Contact and policy pages (served at /contact, /terms, /privacy, /refunds).
 *
 * Payment providers such as Razorpay review these before they accept
 * payments from the site. Business details live in BUSINESS below, so a
 * change of address or phone is a one-line edit.
 *
 * Styling follows the landing page (views/landing.js).
 */

const BUSINESS = {
  legalName: 'EcoNelssol Energy Pvt. Ltd.',
  product: 'EcoVoltX',
  email: 'ecoNelssolenergy@gmail.com',
  phone: '+91 78001 56868',
  phoneHref: '+917800156868',
  address: 'Hyderabad, Telangana, India',
  website: 'https://econelssol.com',
};

const LAST_UPDATED = '28 November 2026';
const DEPOSIT = '₹50';

const BOLT = '<svg class="mark" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>';

const B = BUSINESS;
const emailLink = `<a href="mailto:${B.email}">${B.email}</a>`;
const phoneLink = `<a href="tel:${B.phoneHref}">${B.phone}</a>`;
const contactLine = `Email ${emailLink} or call ${phoneLink}.`;

const PAGES = {
  contact: {
    title: 'Contact us',
    description: `How to reach ${B.legalName}, the company that runs ${B.product}.`,
    body: `
      <p class="lead"><strong>${B.legalName}</strong> runs ${B.product}. Write or call us about charging, bills, payments, refunds or your account.</p>
      <dl class="facts">
        <div><dt>Company</dt><dd>${B.legalName}</dd></div>
        <div><dt>Email</dt><dd>${emailLink}</dd></div>
        <div><dt>Phone</dt><dd>${phoneLink}</dd></div>
        <div><dt>Address</dt><dd>${B.address}</dd></div>
        <div><dt>Website</dt><dd><a href="${B.website}">${B.website.replace('https://', '')}</a></dd></div>
      </dl>
      <h2>Help with a charge or payment</h2>
      <p>Tell us your society, your flat number and the session, booking or payment reference shown in the app. It lets us find the record straight away.</p>
      <p>For a problem with a charger in your society, you can also contact your society admin, who manages the chargers there.</p>`,
  },

  terms: {
    title: 'Terms and conditions',
    description: `The terms for using ${B.product} EV charging.`,
    body: `
      <p class="lead">These terms apply to everyone who uses ${B.product}: residents, visitors and society admins. ${B.product} is run by ${B.legalName} (“we”, “us”). By using the app or paying through it, you agree to these terms.</p>

      <h2>1. The service</h2>
      <p>${B.product} runs the shared EV chargers in residential societies. Residents start and stop charging from the app and pay for the energy they use. Visitors can charge at public chargers without an account. Society admins manage chargers, residents, rates and billing for their society.</p>

      <h2>2. Accounts</h2>
      <ul>
        <li>Residents join their society with the code the society shares. The society admin approves each request before the resident can charge.</li>
        <li>Give your real name, flat number and contact details, and keep your password to yourself. You are responsible for charging started from your account.</li>
        <li>A society admin can disable an account, for example when a resident moves out.</li>
      </ul>

      <h2>3. Prices</h2>
      <ul>
        <li><strong>Charging</strong> is billed per kWh of energy delivered, at the rate your society sets. The app shows the rate before you start, for example ₹8 per kWh. The cost is the energy measured by the charger multiplied by that rate.</li>
        <li><strong>Slot bookings</strong> are optional. Reserving a slot with a deposit costs ${DEPOSIT}; see the <a href="/refunds">refund and cancellation policy</a>.</li>
        <li><strong>Society plans</strong> are billed to the society each month: Starter Community ₹1,999 (up to 3 chargers), Pro Society ₹4,999 (up to 10 chargers) and Enterprise Grid ₹9,999 (up to 50 chargers).</li>
        <li>All prices are in Indian rupees.</li>
      </ul>

      <h2>4. Paying</h2>
      <ul>
        <li>Residents pay in the app, for each charging session after it ends or on the society’s monthly invoice. Payments are processed by Razorpay using UPI, cards or net banking. We do not see or store your card or UPI details.</li>
        <li>A payment counts only once our server has confirmed it with Razorpay.</li>
        <li>Visitors get a receipt with the amount due when they stop, and pay it as the society directs.</li>
      </ul>

      <h2>5. Using the chargers</h2>
      <ul>
        <li>Use a vehicle and cable that suit the charger, follow your society’s parking rules, and move your vehicle when charging ends.</li>
        <li>Charging depends on the charger, the power supply and your vehicle. We do not promise that a particular charger will be free or working at a given time.</li>
        <li>Report a damaged or faulty charger to your society admin or to us, and don’t use it.</li>
      </ul>

      <h2>6. How the service is delivered</h2>
      <p>The service is delivered at the charger and in the app. Nothing is shipped. Energy is delivered while your session runs, and receipts are available in the app straight after payment.</p>

      <h2>7. Changes and law</h2>
      <p>We may update these terms; the date below shows the latest version. These terms are governed by the laws of India, and the courts in Hyderabad, Telangana have jurisdiction.</p>

      <h2>8. Contact</h2>
      <p>${contactLine}</p>`,
  },

  privacy: {
    title: 'Privacy policy',
    description: `What personal data ${B.product} collects and how it is used.`,
    body: `
      <p class="lead">This policy explains what ${B.legalName} collects when you use ${B.product}, why, and who can see it.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> name, email, phone number, your society and flat number.</li>
        <li><strong>Visitor details:</strong> mobile number and vehicle number, entered when charging as a visitor.</li>
        <li><strong>Charging records:</strong> which charger you used, when, how much energy and what it cost.</li>
        <li><strong>Bookings and payments:</strong> slot bookings, payment amounts, status and references. Card and UPI details are handled by Razorpay; we never receive them.</li>
        <li><strong>Technical data:</strong> IP address and basic request logs, used to keep the service secure.</li>
      </ul>

      <h2>Why we use it</h2>
      <p>To run your account, start and stop charging, work out and collect what you owe, send receipts and notices, answer support requests, prevent misuse, and keep records the law requires.</p>

      <h2>Who can see it</h2>
      <ul>
        <li><strong>Your society admin</strong> sees residents’ names, flat numbers, charging sessions, bookings and payments for that society, so they can manage the chargers and billing.</li>
        <li><strong>Razorpay</strong> processes payments.</li>
        <li><strong>Our hosting provider</strong> stores the data on our behalf.</li>
      </ul>
      <p>We do not sell personal data or use it for advertising. We share it with others only when the law requires.</p>

      <h2>Keeping it safe</h2>
      <p>The site is served over an encrypted connection, passwords are stored only as secure hashes, and access is limited to the people who need it.</p>

      <h2>How long we keep it</h2>
      <p>While your account is active, and afterwards for as long as billing, tax and legal records must be kept.</p>

      <h2>Cookies and storage</h2>
      <p>The app keeps your sign-in in your browser’s storage so you stay signed in. We don’t use advertising trackers. The site loads its fonts from Google Fonts.</p>

      <h2>Your choices</h2>
      <p>You can ask to see, correct or delete your personal data. ${contactLine} Some records, such as payments, may have to be kept for legal reasons.</p>`,
  },

  refunds: {
    title: 'Refund and cancellation policy',
    description: `How refunds and cancellations work on ${B.product}.`,
    body: `
      <p class="lead">${B.legalName} runs ${B.product}. This policy covers charging payments, slot booking deposits and society plans.</p>

      <h2>Charging sessions</h2>
      <ul>
        <li>You pay only for the energy delivered during your session, at your society’s rate.</li>
        <li>A session can be stopped at any time from the app; you are charged up to that point.</li>
        <li>If you think a bill is wrong, for example because of a faulty charger reading, contact us with the session reference. If we find an error, we correct the bill or refund the difference.</li>
      </ul>

      <h2>Slot booking deposits (${DEPOSIT})</h2>
      <ul>
        <li><strong>Cancelled before the slot starts:</strong> the deposit is refunded in full.</li>
        <li><strong>Not used, or cancelled after the slot has started:</strong> the deposit is not refunded.</li>
        <li>You can cancel a booking on the Bookings page in the app.</li>
      </ul>

      <h2>Failed or duplicate payments</h2>
      <p>If money left your account but the app shows the payment as failed, or you were charged twice for the same item, the extra amount is refunded. Payments that fail at the bank are usually reversed automatically. If not, contact us with the payment reference.</p>

      <h2>Society plans</h2>
      <p>A society can cancel its plan at any time. The plan stays active until the end of the month already paid for, and is not billed again.</p>

      <h2>How refunds are paid</h2>
      <p>Refunds go back to the original payment method (the same UPI account, card or bank account) through Razorpay. Once issued, a refund usually reaches you within 5–7 working days, depending on your bank.</p>

      <h2>Contact</h2>
      <p>${contactLine}</p>`,
  },
};

const FOOTER_LINKS = [
  ['/contact', 'Contact'],
  ['/terms', 'Terms'],
  ['/privacy', 'Privacy'],
  ['/refunds', 'Refunds'],
];

function footerLinks(current) {
  return FOOTER_LINKS.map(([href, label]) =>
    `<a href="${href}"${href === `/${current}` ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('');
}

function renderLegalPage(slug) {
  const page = PAGES[slug];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title} · ${B.product}</title>
  <meta name="description" content="${page.description}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #151514;
      --raised: #252523;
      --text: #ecebe8;
      --text-2: #a3a29d;
      --muted: #878680;
      --line: rgba(236, 235, 232, 0.08);
      --line-strong: rgba(236, 235, 232, 0.16);
      --accent: #00a651;
      --brand-blue: #0066cc;
      --sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
      --mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body { background: var(--bg); color: var(--text); font: 15px/24px var(--sans); -webkit-font-smoothing: antialiased; }
    a { color: inherit; }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }

    .wrap { max-width: 1200px; margin: 0 auto; padding: 0 32px; }
    .nav { height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
    .brand { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 600; line-height: 1; text-decoration: none; }
    .brand .mark { color: var(--accent); }
    .brand .by { font-size: 13px; font-weight: 400; color: var(--muted); margin-left: 4px; }
    .brand .by b { font-weight: 600; }
    .brand .eco { color: var(--accent); }
    .brand .nelssol { color: var(--brand-blue); }
    .btn {
      display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border-radius: 8px;
      background: var(--raised); border: 1px solid var(--line-strong); font: 500 14px/1 var(--sans); text-decoration: none;
      transition: background-color 150ms var(--ease);
    }
    .btn:hover { background: #2d2d2a; }

    article { max-width: 680px; padding: 56px 0 96px; }
    h1 { font-size: 40px; line-height: 1.1; font-weight: 500; letter-spacing: -0.02em; }
    .updated { margin-top: 12px; font: 400 13px/20px var(--mono); color: var(--muted); }
    .lead { margin-top: 24px; font-size: 17px; line-height: 27px; color: var(--text-2); }
    h2 { margin-top: 40px; font-size: 19px; line-height: 1.3; font-weight: 500; }
    article p, article li { color: var(--text-2); }
    article p { margin-top: 12px; }
    article ul { margin-top: 12px; padding-left: 20px; display: grid; gap: 8px; }
    article strong { color: var(--text); font-weight: 500; }
    article a { color: var(--text); text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 3px; transition: text-decoration-color 150ms var(--ease); }
    article a:hover { text-decoration-color: var(--accent); }

    .facts { margin-top: 32px; border-top: 1px solid var(--line); }
    .facts div { display: grid; grid-template-columns: 140px 1fr; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); }
    .facts dt { color: var(--muted); font-size: 14px; }
    .facts dd { color: var(--text); overflow-wrap: anywhere; }

    footer { border-top: 1px solid var(--line); }
    .foot { min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 16px 0; font-size: 13px; color: var(--muted); }
    .foot nav { display: flex; gap: 20px; flex-wrap: wrap; }
    .foot nav a { text-decoration: none; transition: color 150ms var(--ease); }
    .foot nav a:hover, .foot nav a[aria-current="page"] { color: var(--text); }

    @media (max-width: 640px) {
      .wrap { padding: 0 16px; }
      .brand .by { display: none; }
      article { padding: 40px 0 64px; }
      h1 { font-size: 30px; }
      .facts div { grid-template-columns: 1fr; gap: 2px; }
    }
  </style>
</head>
<body>
  <header class="wrap nav">
    <a class="brand" href="/" aria-label="EcoVoltX by EcoNelssol, home">
      ${BOLT}<span>EcoVoltX</span>
      <span class="by">by <b><span class="eco">Eco</span><span class="nelssol">Nelssol</span></b></span>
    </a>
    <a class="btn" href="/app/">Resident app</a>
  </header>

  <main class="wrap">
    <article>
      <h1>${page.title}</h1>
      <p class="updated">Last updated ${LAST_UPDATED}</p>
      ${page.body}
    </article>
  </main>

  <footer>
    <div class="wrap foot">
      <span>© ${new Date().getFullYear()} ${B.legalName}</span>
      <nav aria-label="Policies">${footerLinks(slug)}</nav>
    </div>
  </footer>
</body>
</html>`;
}

module.exports = { BUSINESS, LEGAL_SLUGS: Object.keys(PAGES), renderLegalPage, footerLinks };
