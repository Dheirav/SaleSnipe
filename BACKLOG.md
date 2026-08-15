# Backlog

Ordered by impact. The scraping items come first: until a broken scraper is
distinguishable from an empty result, nothing downstream can be trusted.

---

## 1. A failed scrape is indistinguishable from a legitimate zero-result search

`AmazonScraper.js` walks a list of candidate selectors and, when none match,
falls through to:

```js
console.log('No product elements found with any selector');
```

That is a log line, not an error. The function returns an empty list, and every
layer above it — controller, watchlist, cron job — treats "the site changed its
markup" exactly like "there are genuinely no results for this query". Prices
silently stop updating and nothing reports it.

**Fix.** Make "no elements matched any selector" throw a distinct error, separate
from "a product container matched and contained zero products". Surface the
difference in the cron job's logs and in the API response.

---

## 2. Headless Puppeteer against Amazon

`BaseScraper.js` drives `puppeteer.launch()`. Amazon runs some of the most
aggressive headless detection in retail — `navigator.webdriver`, missing Chrome
runtime properties, canvas and TLS fingerprints. The result is a CAPTCHA page or
a stripped response, not the product grid.

The single hard-coded desktop Chrome User-Agent on line 812 does not help. It
*contradicts* the headless fingerprint, and that mismatch is itself a detection
signal.

**Options, in order of durability:**

1. Use official APIs where they exist — eBay has a public one, and Amazon's
   Product Advertising API is the sanctioned route. Slower to set up, and it
   stops breaking.
2. `puppeteer-extra` with `puppeteer-extra-plugin-stealth` for the sites with no
   API.
3. If scraping stays, rotate a realistic User-Agent set that matches the
   browser actually being driven.

---

## 3. Selector rot is caught in production, not in CI

91 source files, one test. Scrapers break when a site ships a redesign, which is
unannounced and frequent.

**Fix.** Save one real HTML response per site as a fixture and write a parse test
per scraper against it. These tests do not hit the network, so they can run in
CI on every push. They will not catch a site changing today, but they will stop a
refactor from breaking the parser, and they document the expected markup.

---

## 4. The root manifest does not know what it is

`package.json` at the root declares 32 dependencies mixing backend and frontend:

- **Backend:** `express`, `mongoose`, `puppeteer`, `cheerio`, `nodemailer`,
  `jsonwebtoken`, `bcryptjs`, `node-cron`
- **Frontend, but declared at the root anyway:** `@radix-ui/react-dropdown-menu`,
  `@radix-ui/react-select`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`,
  `@radix-ui/react-toggle`, `react-hook-form`, `@hookform/resolvers`,
  `lucide-react`, `recharts`, `tailwind-merge`, `clsx`,
  `class-variance-authority`, `zod`

`src/frontend/package.json` declares 11 of its own. `axios` appears in both at
different versions — `^1.6.2` at the root, `^1.6.7` in the frontend.

**Fix.** Split the manifests so each declares only what it runs, or adopt npm
workspaces and hoist deliberately. Pin `axios` to one version.

---

## 5. `@tensorflow/tfjs-node` is a fragile install

It is a native-binding dependency and frequently fails to build on a clean
machine, which takes the whole backend install down with it. Check whether
`pricePredictionService.js` genuinely needs it; `natural` and `sentiment` are
already present for the text work. If the price model is a simple regression,
drop the dependency.

---

## 6. No CI

No `.github/workflows`. Once item 3 exists there is something worth running:
lint, the scraper parse tests, and a backend boot check.
