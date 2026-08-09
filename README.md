# Handoff: WDIO Gear, Demo E-commerce Test Site

*Built with Claude Design and Claude Code.*

## Overview
A mocked webshop (WDIO Gear) built to serve as a realistic target for exploring WebdriverIO's automation and performance capabilities. It covers the common flows and widget types found in real customer sites: navigation, search-with-autocomplete, filtering/sorting, infinite scroll, product detail, cart, checkout, login/register, tabs, accordions, modals, tooltips, drag-and-drop, carousels, an iframe, toasts, and scroll-triggered animations.

## About the Files
These are **working HTML files**, not static design mockups. Each page is self-contained: markup, inline styles, and a JS logic class, run by the small runtime in `support.js` (loaded via `<script src="./support.js">` in each page's `<head>`). No build step. `index.html` is the one page not named `*.dc.html` (see "Running locally" for why). Every other page keeps the `.dc.html` suffix.

## Running locally
```
npm install
npm start        # serves the folder at http://localhost:4173
```
This runs `serve` (pinned in `package.json`) with the `serve.json` config already in this folder. That config matters. The runtime (`support.js`) identifies which page to boot by checking that the URL ends in `.dc.html`, so a plain static server with "clean URLs" (auto-redirecting `Products.dc.html` to `Products`) will silently break every page transition except the one you loaded first. `serve.json` scopes that clean-URL behavior to just `/`, so root still resolves to `index.html`, and leaves every `.dc.html` URL untouched. If you serve this folder with something other than `npm start`, make sure it does the same: don't strip `.html` from `*.dc.html` requests.

## Fidelity
High-fidelity and functional. All interactivity (state, form validation, filtering, cart math, tab/modal state, etc.) is real, client-side JS, not a visual-only mock.

## Backend
Fully mocked, client-side only. No network calls, no real backend, no payment processor:
- Product catalog is generated in `products-data.js` (64 products across 8 categories) and exposed as `window.__wdioProducts`.
- Cart state is centralized in `cart-store.js` (`window.__wdioCart`) and persisted to `localStorage`. Every page reads/writes through it, so the header cart badge, line items, and promo code stay in sync across navigation and reloads.
- Auth state is centralized in `auth-store.js` (`window.__wdioAuth`), persisted to `localStorage` the same way. Signing in/registering on Account.dc.html survives a reload.
- "Sign in", "Create account", and "Place order" are simulated with client-side validation only. Placing an order clears the cart.

## Pages
- **index.html**: hero, category grid, featured carousel, scroll-reveal sections, newsletter form.
- **Products.dc.html**: category checkboxes, price range slider, sort select, live search-with-suggestions, infinite scroll (IntersectionObserver + simulated network delay), tooltips, toast on add-to-cart.
- **Product.dc.html**: product detail, color/size selection, quantity, related products.
- **Cart.dc.html**: line items, drag-to-reorder, quantity controls.
- **Checkout.dc.html**: multi-field form, no real payment step (stubbed).
- **Account.dc.html**: login/register tabs, profile/orders/addresses tabs, address edit modal, an `<iframe srcdoc>` map preview.

## Interactions & Behavior worth noting for test-writing
- Search suggestions debounce is not implemented. Filtering is synchronous on `oninput`.
- Infinite scroll on Products has an artificial ~700ms delay (`setTimeout`) to simulate a network round trip, useful for testing wait/retry strategies.
- Toasts on Products auto-dismiss after ~2.2s.
- Tooltips are hover-triggered (`onmouseenter`/`onmouseleave`), not focus-triggered, so keyboard-only automation won't reach them as-is.
- Home's scroll-reveal sections use `IntersectionObserver`, not CSS-only animation.

## Locators for automation
Every interactive element (nav links, filters, product cards, cart rows, checkout fields, auth forms, etc.) carries a stable `data-testid` for reliable automation targeting. Icon-only controls (cart icon, wishlist heart, quantity steppers, carousel arrows) also carry `aria-label`, and checkout/account form inputs use real `<label for>`/`id` pairs, so WDIO's `$('[data-testid=...]')`, accessibility-name, and label-based selectors all work. Naming follows `<area>-<element>[-<id-or-index>]`, e.g. `add-to-cart-14`, `cart-item-remove-2`, `checkout-email`.

## Images
`assets/products/` and `assets/categories/` hold procedurally generated placeholder art (flat, icon-based illustrations with per-product color variety and photographic grain). Not real product photography, but real image files with realistic payload weights, so image-loading, lazy-load, and payload-weight scenarios have something to test against:
- Product images ship in 3 sizes/formats per product (64 products x 3 = 192 files): `p<id>-thumb.webp` (~240px, ~2KB, used for cart rows and detail-page thumbnails), `p<id>-card.jpg` (~800px, ~40KB, used in grids), `p<id>-detail.png` (~1200px, ~500-900KB, used on the product detail hero, deliberately heavy to exercise slow-load/spinner scenarios).
- Category tiles (`assets/categories/<slug>.jpg`, ~1200px JPEG) cover 7 of the 8 categories. Stickers & Decor keeps the WDIO robot mascot as its tile art (a deliberate brand choice, not a placeholder gap).
- Regenerate or restyle via `scripts/generate-images.py` (usage/requirements in its header docstring, needs Pillow). It reads a `products-data.json` dump of `products-data.js`, so restyling after a catalog change means re-dumping first.

