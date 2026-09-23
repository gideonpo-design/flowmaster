# FlowMaster — Business Management PWA

A complete, offline-first Progressive Web App for FlowMaster Irrigation Services. It runs entirely in the browser — no backend, no server, no account — stores everything on the device, works without a signal, and installs to the iPhone Home Screen and the macOS Dock like a native app.

Built to feel like Jobber or Housecall Pro, tailored for an irrigation business.

---

## Run it

Service workers (offline mode) need to be served over `http://`, not opened as a `file://` path:

```bash
cd flowmaster
python3 serve.py
```

That serves it at `http://localhost:8000/index.html` and opens your browser.

To use it on your phone, host the `flowmaster/` folder on any free static host (GitHub Pages, Netlify, Cloudflare Pages, Vercel) and open the URL on the iPhone.

## Install to a device

- **iPhone (Safari):** open the hosted URL -> Share -> **Add to Home Screen**. Launches full-screen, works offline.
- **Mac (Chrome/Edge):** open the URL -> install icon in the address bar, or the in-app **Install** banner.

---

## Modules

- **Dashboard** — live KPIs (revenue, unpaid, today's jobs, profit), quick actions, today's schedule, recent invoices.
- **Customers (CRM)** — searchable contacts, tags, repeat flag, irrigation system details (zones/controller/backflow/valves), lifetime-value summary, and a merged service history of every invoice, estimate, and job. Customers can be created inline from anywhere.
- **Invoices** — builder with Price Book line items and live tax/totals, status tracking (unpaid/pending/paid + auto-derived **overdue**), payment recording with running balance, status filters, and one-tap **PDF export**.
- **Estimates** — same fast builder; mark sent/accepted/declined and **convert an accepted estimate into an invoice in one tap**.
- **Calendar & Scheduling** — Month, Week, Agenda, and Today views; color-coded jobs by status; **drag-to-reschedule** in the month grid; recurring jobs; **Today's Route** with click-to-call and Apple/Google Maps links; convert a job into an invoice.
- **Seasonal Recall** — scans past startups and winterizations and surfaces customers due for their next seasonal service, with one-tap scheduling.
- **Price Book** — 150+ irrigation services across startups, winterizations, repairs, controllers, valves, backflow, heads, drip, new installs, commercial, pumps, lighting, emergency, labor, and materials. Fully editable; add your own.
- **Financials** — revenue, expenses, net profit, outstanding, average invoice; a revenue-vs-expenses chart; CSV export. Period filters (this year / last 12 months / all time).
- **Receipts** — capture receipts with a phone photo, categorize by vendor and expense type, and track totals.
- **Reports** — top customers, revenue by service category, estimate win rate, repeat-customer rate, and monthly revenue.
- **Email Center** — auto-drafted, editable templates for sending invoices, estimates, payment reminders, overdue notices, payment receipts, follow-ups, and seasonal reminders. Opens in your mail app or copies to clipboard; keeps a history.
- **Settings** — editable business profile (name, address, phone, slogan), tax rate, invoice/estimate numbering and terms, technicians, light/dark/system theme, and **backup export / restore / erase**.

Everything is driven by your business profile in **Settings** — change the business name to **SprinklerMaster Irrigation Services** and every screen and every PDF follows it. Nothing is hard-coded.

---

## Architecture

```
flowmaster/
|- index.html              App shell, PWA meta, script load order
|- manifest.json           Installable PWA metadata
|- service-worker.js       Offline precache + runtime caching
|- serve.py                Local launcher (http, for offline testing)
|- css/styles.css          Design system (tokens, components, light/dark, responsive)
|- js/
|  |- data/pricebook.js    The 150+ service catalog (seeds the database)
|  |- components.js         UI kit: el() builder, icons, toasts, modals, formatters
|  |- db.js                 IndexedDB data layer — full schema, CRUD, numbering, backup
|  |- router.js             Hash router
|  |- shared.js             Cross-module helpers (customer picker, line items, totals, photos)
|  |- pdf.js                Branded invoice/estimate PDF generation
|  |- vendor/               jsPDF + autotable (vendored locally for offline PDF)
|  |- views/                One file per module (dashboard, customers, invoices, ...)
|  |- app.js                Bootstrap: shell, nav, theme, offline, install, service worker
|- icons/                  PWA icons
```

The data layer (`db.js`) declares the **entire** IndexedDB schema up front, so all modules read and write a shared store with no migrations. PDFs are generated locally with a vendored copy of jsPDF, so export works with no internet connection.

It's pure vanilla HTML/CSS/JS — no build step, no framework, no dependencies to install. Open the folder and it runs.

---

## A couple of notes

- **The brief says "FlowMaster"**, so that's the seeded default — fully editable in Settings to "SprinklerMaster Irrigation Services."
- **Invoice PDF layout:** the brief mentioned example invoices for layout inspiration, but none were attached. The current layout is a clean, professional default — share your examples and it can be matched.
- **Backups matter:** data lives only on the device. Export a backup from Settings before switching phones or clearing browser data.
