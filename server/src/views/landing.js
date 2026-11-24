/**
 * EcoVoltX landing page (served at /).
 *
 * Design pass based on unslop by Damir Sokolovsky (@heydamir),
 * https://github.com/heydamir/unslop, CC BY 4.0.
 */

const icon = (paths, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  arrow: icon('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', 16),
  phone: icon('<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>'),
  building: icon('<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>'),
  plug: icon('<path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"/><path d="m2 22 3-3"/><path d="M7.5 13.5 10 11"/><path d="M10.5 16.5 13 14"/><path d="m18 3-4 4h6l-4 4"/>'),
};

const BOLT = '<svg class="mark" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>';

const PLANS = [
  { name: 'Starter Community', chargers: 3, price: '₹1,999' },
  { name: 'Pro Society', chargers: 10, price: '₹4,999' },
  { name: 'Enterprise Grid', chargers: 50, price: '₹9,999' },
];

const DEMO_ACCOUNTS = [
  { role: 'Super admin', email: 'superadmin@societycharge.com' },
  { role: 'Green Valley admin', email: 'admin_gvr@test.com' },
  { role: 'Sunrise Towers admin', email: 'admin_srt@test.com' },
  { role: 'Resident, Green Valley A-101', email: 'rahul@test.com' },
];

function renderLanding({ demoMode }) {
  const demoSection = demoMode ? `
    <section class="section demo" aria-labelledby="demo-title">
      <div class="split">
        <div>
          <h2 id="demo-title">Demo accounts</h2>
          <p class="lead-sm">This server runs in demo mode with sample societies. Every demo account uses the password <code>password123</code></p>
        </div>
        <ul class="rows">
          ${DEMO_ACCOUNTS.map((a) => `
          <li class="row"><span>${a.role}</span><code>${a.email}</code></li>`).join('')}
        </ul>
      </div>
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EcoVoltX · EV charging for housing societies</title>
  <meta name="description" content="Shared EV chargers for residential societies: residents charge in their own parking and pay one monthly invoice, admins run chargers, tariffs and billing.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-deep: #10100f;
      --bg: #151514;
      --card: #1b1b19;
      --raised: #252523;
      --text: #ecebe8;
      --text-2: #a3a29d;
      --muted: #878680;
      --line: rgba(236, 235, 232, 0.08);
      --line-strong: rgba(236, 235, 232, 0.16);
      --accent: #00a651;
      --accent-hover: #10b862;
      --on-accent: #04140b;
      --brand-blue: #0066cc;
      --sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
      --mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--sans);
      font-size: 15px;
      line-height: 22px;
      -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; text-decoration: none; }
    code { font-family: var(--mono); font-size: 13px; }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }

    .wrap { max-width: 1200px; margin: 0 auto; padding: 0 32px; }

    /* Navigation */
    .nav { height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
    .brand { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 600; line-height: 1; }
    .brand .mark { color: var(--accent); }
    .brand .by { font-size: 13px; font-weight: 400; color: var(--muted); margin-left: 4px; }
    .brand .by b { font-weight: 600; }
    .brand .eco { color: var(--accent); }
    .brand .nelssol { color: var(--brand-blue); }
    .nav-links { display: flex; align-items: center; gap: 24px; font-size: 14px; color: var(--text-2); }
    .nav-links a { transition: color 150ms var(--ease); }
    .nav-links a:hover { color: var(--text); }

    /* Buttons */
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      height: 48px; padding: 0 20px; border-radius: 10px;
      font: 500 15px/1 var(--sans);
      transition: background-color 150ms var(--ease), border-color 150ms var(--ease), transform 120ms var(--ease);
    }
    .btn:active { transform: scale(0.98); }
    .btn-primary { background: var(--accent); color: var(--on-accent); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16); }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-secondary { background: var(--raised); color: var(--text); border: 1px solid var(--line-strong); }
    .btn-secondary:hover { background: #2d2d2a; }
    .btn-sm { height: 36px; padding: 0 16px; font-size: 14px; border-radius: 8px; }

    /* Hero */
    .hero {
      min-height: calc(100vh - 64px);
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: center;
      gap: 64px;
      padding: 48px 0 64px;
    }
    h1 {
      font-size: 64px; line-height: 1.04; font-weight: 500; letter-spacing: -0.03em;
      max-width: 13ch;
    }
    .subhead { margin-top: 24px; max-width: 36rem; font-size: 19px; line-height: 29px; color: var(--text-2); }
    .actions { margin-top: 40px; display: flex; flex-wrap: wrap; gap: 12px; }

    /* Phone preview: the one bright element */
    .preview { display: flex; justify-content: center; }
    .phone {
      width: 312px; padding: 10px; border-radius: 44px;
      background: #0b0b0a; border: 1px solid var(--line-strong);
      box-shadow: 0 32px 64px rgba(0, 0, 0, 0.45);
    }
    .screen { border-radius: 34px; background: var(--bg); padding: 20px 20px 24px; overflow: hidden; }
    .statusbar { display: flex; justify-content: space-between; font: 500 12px/16px var(--mono); color: var(--muted); }
    .session-head { margin-top: 24px; display: flex; align-items: center; justify-content: space-between; }
    .session-head .title { font-size: 15px; font-weight: 500; }
    .state { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
    .light { width: 8px; height: 8px; border-radius: 50%; background: #e0a33a; }
    .light.ok { background: var(--accent); }
    .bay {
      display: inline-flex; align-items: center; height: 24px; padding: 0 8px;
      border: 1px solid rgba(236, 235, 232, 0.36); border-radius: 4px;
      font: 500 12px/1 var(--mono); letter-spacing: 0.04em; color: var(--text);
    }
    .where { margin-top: 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2); }

    .meter {
      margin-top: 20px; border-radius: 16px; padding: 20px 16px 16px;
      background: linear-gradient(180deg, #0f1611 0%, #0c120e 100%);
      border: 1px solid rgba(143, 227, 176, 0.14);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }
    .meter-label { display: flex; justify-content: space-between; gap: 12px; white-space: nowrap; font: 400 12px/16px var(--mono); color: rgba(143, 227, 176, 0.6); }
    .readout { position: relative; margin-top: 12px; font: 500 52px/1 var(--mono); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
    .readout .ghost { color: rgba(143, 227, 176, 0.07); }
    .readout .lit { position: absolute; inset: 0 auto auto 0; color: #8fe3b0; }
    .readout .unit { font-size: 15px; letter-spacing: 0; color: rgba(143, 227, 176, 0.6); margin-left: 8px; }

    .facts { margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
    .fact span { display: block; font-size: 12px; line-height: 16px; color: var(--muted); }
    .fact b { display: block; margin-top: 4px; font: 500 15px/20px var(--mono); font-variant-numeric: tabular-nums; }
    .stop {
      margin-top: 20px; width: 100%; height: 44px; border-radius: 10px;
      background: var(--raised); border: 1px solid var(--line-strong); color: var(--text);
      font: 500 14px/1 var(--sans);
    }
    .billed { margin-top: 12px; text-align: center; font-size: 12px; line-height: 16px; color: var(--muted); }

    /* Sections */
    .section { padding: 96px 0; border-top: 1px solid var(--line); }
    h2 { font-size: 28px; line-height: 1.15; font-weight: 500; letter-spacing: -0.01em; }
    .lead-sm { margin-top: 12px; color: var(--text-2); max-width: 28rem; }

    .roles { margin-top: 48px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .role { padding: 0 32px; border-left: 1px solid var(--line); }
    .role:first-child { padding-left: 0; border-left: 0; }
    .role .ico { color: var(--muted); }
    .role h3 { margin-top: 16px; font-size: 17px; font-weight: 500; }
    .role p { margin-top: 8px; color: var(--text-2); }
    .role a {
      margin-top: 20px; display: inline-flex; align-items: center; gap: 8px;
      font-size: 14px; font-weight: 500; color: var(--text);
      transition: color 150ms var(--ease);
    }
    .role a:hover { color: var(--accent); }

    .split { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 64px; align-items: start; }
    .rows { list-style: none; border-top: 1px solid var(--line); }
    .row {
      display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center;
      min-height: 56px; padding: 12px 0; border-bottom: 1px solid var(--line);
    }
    .row .meta { color: var(--muted); font-size: 14px; }
    .row .price { font: 500 15px/20px var(--mono); font-variant-numeric: tabular-nums; text-align: right; }
    .row .price small { font: 400 13px var(--sans); color: var(--muted); margin-left: 4px; }
    .plan-name { display: flex; flex-direction: column; gap: 2px; }
    .demo .row code { color: var(--text-2); }

    footer { border-top: 1px solid var(--line); }
    .foot { height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 13px; color: var(--muted); }
    .foot .live { display: inline-flex; align-items: center; gap: 8px; color: var(--text-2); }
    .foot a { font-family: var(--mono); font-size: 12px; transition: color 150ms var(--ease); }
    .foot a:hover { color: var(--text); }

    /* One entrance on load */
    @media (prefers-reduced-motion: no-preference) {
      .rise { opacity: 0; transform: translateY(8px); animation: rise 420ms var(--ease) forwards; }
      .rise:nth-child(2) { animation-delay: 50ms; }
      .rise:nth-child(3) { animation-delay: 100ms; }
      .preview.rise { animation-delay: 150ms; }
      @keyframes rise { to { opacity: 1; transform: none; } }
    }

    @media (max-width: 960px) {
      .wrap { padding: 0 20px; }
      .nav-links a.hide-sm { display: none; }
      .hero { grid-template-columns: 1fr; min-height: 0; gap: 48px; padding: 48px 0 64px; }
      h1 { font-size: 40px; max-width: 16ch; }
      .subhead { font-size: 17px; line-height: 26px; }
      .section { padding: 64px 0; }
      .roles { grid-template-columns: 1fr; gap: 32px; }
      .role { padding: 0; border-left: 0; }
      .split { grid-template-columns: 1fr; gap: 24px; }
    }
    @media (max-width: 420px) {
      .phone { width: 100%; max-width: 312px; }
      .readout { font-size: 44px; }
      .foot { flex-direction: column; justify-content: center; height: auto; padding: 20px 0; }
    }
  </style>
</head>
<body>
  <header class="wrap nav">
    <a class="brand" href="/" aria-label="EcoVoltX by EcoNelssol, home">
      ${BOLT}<span>EcoVoltX</span>
      <span class="by">by <b><span class="eco">Eco</span><span class="nelssol">Nelssol</span></b></span>
    </a>
    <nav class="nav-links" aria-label="Main">
      <a class="hide-sm" href="/app/">Resident app</a>
      <a class="hide-sm" href="/app/public">Public charging</a>
      <a class="btn btn-secondary btn-sm" href="/admin/">Admin portal</a>
    </nav>
  </header>

  <main>
    <section class="wrap hero">
      <div>
        <h1 class="rise">Charge in your society’s parking, pay once a month</h1>
        <p class="subhead rise">EcoVoltX runs the shared EV chargers in residential societies. Residents see which bay is free, start and stop from their phone, and get one invoice a month. Society admins handle chargers, approvals, tariffs and billing.</p>
        <div class="actions rise">
          <a class="btn btn-primary" href="/app/">Open resident app</a>
          <a class="btn btn-secondary" href="/app/public">Charge as a visitor</a>
        </div>
      </div>

      <div class="preview rise" aria-label="Preview of a live charging session in the resident app">
        <div class="phone">
          <div class="screen">
            <div class="statusbar"><span>19:24</span><span>Green Valley Residency</span></div>
            <div class="session-head">
              <span class="title">Charging session</span>
              <span class="state"><span class="light"></span>Charging</span>
            </div>
            <div class="where"><span class="bay">C-01</span>Parking Lot A, ground floor</div>

            <div class="meter" role="img" aria-label="Energy delivered so far">
              <div class="meter-label"><span>Delivered</span><span>Type 2</span></div>
              <div class="readout">
                <span class="ghost">88.888</span>
                <span class="lit"><span id="kwh">12.484</span><span class="unit">kWh</span></span>
              </div>
            </div>

            <div class="facts">
              <div class="fact"><span>Cost so far</span><b id="cost">₹99.87</b></div>
              <div class="fact"><span>Rate</span><b>₹8.00/kWh</b></div>
              <div class="fact"><span>Started</span><b>17:43</b></div>
              <div class="fact"><span>Power</span><b>7.4 kW</b></div>
            </div>
            <button class="stop" type="button" tabindex="-1">Stop charging</button>
            <p class="billed">Added to your November invoice</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="roles-title">
      <div class="wrap">
        <h2 id="roles-title">Who uses it</h2>
        <div class="roles">
          <div class="role">
            <span class="ico">${ICONS.phone}</span>
            <h3>Residents</h3>
            <p>Join your society with its code, see which chargers are free, start and stop with a live kWh meter, book a slot and pay one monthly invoice.</p>
            <a href="/app/">Open resident app ${ICONS.arrow}</a>
          </div>
          <div class="role">
            <span class="ico">${ICONS.building}</span>
            <h3>Society admins</h3>
            <p>Approve residents, watch and reset chargers, log maintenance, set time-of-day tariffs and idle fees, and manage the society’s plan and invoices.</p>
            <a href="/admin/">Admin portal ${ICONS.arrow}</a>
          </div>
          <div class="role">
            <span class="ico">${ICONS.plug}</span>
            <h3>Visitors</h3>
            <p>Charge at any hour without an account. Pick a free charger, enter a phone number and vehicle plate, and pay by UPI with a receipt.</p>
            <a href="/app/public">Find a public charger ${ICONS.arrow}</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="plans-title">
      <div class="wrap split">
        <div>
          <h2 id="plans-title">Society plans</h2>
          <p class="lead-sm">Billed to the society every month. Residents pay only for the energy they use, at the society’s tariff.</p>
        </div>
        <ul class="rows">
          ${PLANS.map((p) => `
          <li class="row">
            <span class="plan-name"><span>${p.name}</span><span class="meta">Up to ${p.chargers} chargers</span></span>
            <span class="price">${p.price}<small>/ month</small></span>
          </li>`).join('')}
        </ul>
      </div>
    </section>
    ${demoSection ? `<div class="wrap">${demoSection}</div>` : ''}
  </main>

  <footer>
    <div class="wrap foot">
      <span class="live"><span class="light ok"></span>Platform online</span>
      <span>EcoVoltX by EcoNelssol · <a href="/api/health">/api/health</a></span>
    </div>
  </footer>

  <script>
    // Live meter in the preview: 7.4 kW adds about 0.002 kWh per second
    (function () {
      var kwhEl = document.getElementById('kwh');
      var costEl = document.getElementById('cost');
      if (!kwhEl || !costEl) return;
      var kwh = 12.484;
      var fmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      setInterval(function () {
        kwh += 7.4 / 3600;
        kwhEl.textContent = kwh.toFixed(3);
        costEl.textContent = '₹' + fmt.format(kwh * 8);
      }, 1000);
    })();
  </script>
</body>
</html>`;
}

module.exports = { renderLanding };
