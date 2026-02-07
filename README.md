# DCF Value — Intrinsic Value Calculator

A web app to look up US stocks and estimate **intrinsic value** using the **Discounted Cash Flow (DCF)** method. Dark, dashboard-style UI inspired by Bloomberg/TradingView.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS, Lucide React
- **Data:** Alpha Vantage (with free API key) or Yahoo Finance fallback

## Features

- **Ticker search:** Enter a US symbol (e.g. AAPL, TSLA) to load quote and financials.
- **Quote & stats:** Current price, market cap, P/E (TTM and forward), shares outstanding.
- **DCF calculator:** Uses latest free cash flow (FCF), projects 5–10 years, terminal value, WACC and terminal growth.
- **Adjustable inputs:** Sliders for growth rate, discount rate (WACC), terminal growth, and projection years; results update in real time.
- **Valuation view:** Gauge/progress showing overvalued vs undervalued vs fair vs intrinsic value per share.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a ticker, and use the sliders to refine the DCF.

## Environment

For **reliable quote and FCF data**, set an Alpha Vantage API key (free):

1. Get a key at [Alpha Vantage — API Key](https://www.alphavantage.co/support/#api-key).
2. Copy `.env.local.example` to `.env.local`.
3. Add: `ALPHA_VANTAGE_API_KEY=your_key_here`
4. Restart the dev server.

Without the key, the app falls back to Yahoo Finance; in many environments Yahoo returns no data and you will see **"Quote not found"**.

## Data & Limits

- **With ALPHA_VANTAGE_API_KEY:** Quote (GLOBAL_QUOTE), company overview, and annual cash flow (for FCF) come from Alpha Vantage. Free tier has rate limits (e.g. 25 requests/day).
- **Without key:** Yahoo Finance v7 quote + v10 quoteSummary are tried; they often require cookies and may fail.
- Missing or invalid data (e.g. no FCF, no shares) is handled with clear messages.

## DCF Logic (brief)

1. Use the **latest annual FCF** as the base.
2. Project FCF for the next **N years** (default 5) at the chosen **growth rate**.
3. Discount each year’s FCF to present value using the **discount rate (WACC)**.
4. Compute **terminal value** with perpetual growth and discount it to present value.
5. **Enterprise value** = sum of PV of projected FCF + PV of terminal value.
6. **Intrinsic value per share** = enterprise value / shares outstanding.
7. Compare to current price to show over/undervaluation.

## License

MIT
