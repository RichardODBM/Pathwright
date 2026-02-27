(() => {
  // =========================
  // CONFIG (edit these)
  // =========================

  // Put the PUBLIC URL to the CSV stored in Pathwright Resource Library:
  // Example: https://artosacademy.pathwright.com/library/.../download?filename=pathwright_demo_prices.csv
  const CSV_URL = window.PW_OFFERS_CSV_URL || "";

  // Checkout URLs (replace with real ones)
  const PURCHASE_URL_BY_RESOURCE_ID = window.PW_PURCHASE_URLS || {
    "748694": "https://example.com/checkout?s=course&rid=748694",
    "559174": "https://example.com/checkout?s=course&rid=559174",
    "743531": "https://example.com/checkout?s=course&rid=743531"
  };
  const SUBSCRIPTION_URL = window.PW_SUBSCRIPTION_URL || "https://example.com/checkout?s=subscription";

  // Optional: disable geo lookup
  const ENABLE_GEO = (window.PW_ENABLE_GEO !== false);

  // =========================
  // Helpers
  // =========================

  function getResourceId() {
    const raw = (window.PW_RESOURCE_ID || "@resource.id").trim();
    if (raw && raw !== "@resource.id" && /^\d+$/.test(raw)) return raw;

    const m = (location.pathname || "").match(/\/(\d{5,})\b/);
    return m ? m[1] : "";
  }

  function getResourceName() {
    const raw = (window.PW_RESOURCE_NAME || "@resource.name").trim();
    if (raw && raw !== "@resource.name") return raw;
    return "this course";
  }

  async function detectCountryBucket() {
    const fallback = { bucket: "Global", cc: null };
    if (!ENABLE_GEO) return fallback;

    try {
      const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      if (!res.ok) return fallback;
      const data = await res.json();
      const cc = String(data.country || data.country_code || "").toUpperCase() || null;

      if (cc === "ZA") return { bucket: "South Africa", cc };
      if (cc === "US") return { bucket: "USA", cc };
      return { bucket: "Global", cc };
    } catch {
      return fallback;
    }
  }

  function parseCsv(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    const headers = lines.shift().split(",").map(h => h.trim());
    return lines.map(line => {
      const cols = line.split(",").map(c => c.trim());
      const obj = {};
      headers.forEach((h, i) => (obj[h] = (cols[i] ?? "")));
      return obj;
    });
  }

  function formatPrice(currency, price, billingPeriod) {
    const num = Number(price);
    const money =
      currency === "ZAR" ? `R${num.toFixed(0)}` :
      currency === "USD" ? `$${num.toFixed(0)}` :
      `${num.toFixed(0)} ${currency}`;

    return billingPeriod ? `${money}/${billingPeriod}` : money;
  }

  function pickRow(rows, offerType, resourceId, countryBucket) {
    if (offerType === "subscription") {
      return rows.find(r => r.offer_type === "subscription" && r.resource_id === "ALL" && r.country === countryBucket)
        || rows.find(r => r.offer_type === "subscription" && r.resource_id === "ALL" && r.country === "Global");
    }
    return rows.find(r => r.offer_type === "purchase" && r.resource_id === resourceId && r.country === countryBucket)
      || rows.find(r => r.offer_type === "purchase" && r.resource_id === resourceId && r.country === "Global");
  }

  function ensureContainer() {
    let el = document.getElementById("pw-offer-widget");
    if (el) return el;

    // If the LMS snippet doesn't include HTML, inject a minimal widget container
    el = document.createElement("div");
    el.id = "pw-offer-widget";
    el.style.maxWidth = "720px";
    el.innerHTML = `
      <div id="pw-offer-text" style="margin-bottom:12px; line-height:1.4;"></div>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <a id="pw-subscribe-btn" href="#" style="display:inline-block; padding:12px 16px; border-radius:10px; text-decoration:none; border:1px solid rgba(0,0,0,.2);"></a>
        <a id="pw-purchase-btn" href="#" style="display:inline-block; padding:12px 16px; border-radius:10px; text-decoration:none; border:1px solid rgba(0,0,0,.2);"></a>
      </div>
      <div id="pw-offer-footnote" style="margin-top:10px; font-size:0.95em; opacity:0.85;"></div>
    `;
    document.body.appendChild(el);
    return el;
  }

  async function fetchCsvText() {
    if (!CSV_URL) throw new Error("Missing CSV_URL. Set window.PW_OFFERS_CSV_URL before loading the script.");
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    return await res.text();
  }

  async function render() {
    const container = ensureContainer();

    const resourceId = getResourceId();
    const resourceName = getResourceName();

    const [geo, csvText] = await Promise.all([detectCountryBucket(), fetchCsvText()]);
    const rows = parseCsv(csvText);

    const countryBucket = geo.bucket;

    const purchaseRow = resourceId ? pickRow(rows, "purchase", resourceId, countryBucket) : null;
    const subscribeRow = pickRow(rows, "subscription", "ALL", countryBucket);

    const textEl = container.querySelector("#pw-offer-text");
    const subBtn = container.querySelector("#pw-subscribe-btn");
    const buyBtn = container.querySelector("#pw-purchase-btn");
    const footEl = container.querySelector("#pw-offer-footnote");

    const subscribePriceText = subscribeRow
      ? formatPrice(subscribeRow.currency, subscribeRow.price, subscribeRow.billing_period)
      : "";
    const purchasePriceText = purchaseRow
      ? formatPrice(purchaseRow.currency, purchaseRow.price, purchaseRow.billing_period)
      : "";

    textEl.textContent =
      `Access to "${resourceName}" can be purchased as a single course, or unlocked through a full-access subscription.`;

    // Subscribe button
    subBtn.textContent = `${subscribeRow?.button_label || `Subscribe ${countryBucket}`} – ${subscribePriceText}`;
    subBtn.href = SUBSCRIPTION_URL;

    // Purchase button
    if (purchaseRow && resourceId) {
      const href = PURCHASE_URL_BY_RESOURCE_ID[resourceId] || "#";
      buyBtn.textContent = `${purchaseRow.button_label} – ${purchasePriceText}`;
      buyBtn.href = href;

      if (href === "#") {
        buyBtn.setAttribute("aria-disabled", "true");
        buyBtn.style.opacity = "0.6";
        buyBtn.style.pointerEvents = "none";
      }
    } else {
      buyBtn.textContent = `Purchase ${countryBucket}`;
      buyBtn.href = "#";
      buyBtn.setAttribute("aria-disabled", "true");
      buyBtn.style.opacity = "0.6";
      buyBtn.style.pointerEvents = "none";
    }

    const sourceNote = geo.cc ? `Detected region: ${geo.cc}` : "Region detection unavailable";
    footEl.textContent = `${sourceNote}. Pricing defaults to Global when a country is not matched.`;
  }

  render().catch(err => {
    // Fail gracefully
    console.warn("[pw-offers-widget]", err);
  });
})();
