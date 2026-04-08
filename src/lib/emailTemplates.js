/**
 * Vaultline Onboarding Drip Email Templates
 * 5 emails over 14 days. Each returns { subject, html }.
 * Called by the notify edge function's cron scheduler.
 */

const BRAND = {
  logo: `<span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;">Vault<span style="background:linear-gradient(90deg,#22D3EE,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">line</span></span>`,
  footer: `<div style="text-align:center;padding:24px 0 0;border-top:1px solid #1E293B;margin-top:24px;"><p style="font-size:10px;color:#64748B;margin:0;">Vaultline Treasury Platform — vaultline.app</p><p style="font-size:10px;color:#64748B;margin:4px 0 0;"><a href="{{unsubscribe_url}}" style="color:#64748B;">Unsubscribe</a></p></div>`,
}

function wrap(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="margin:0;padding:0;background:#0B1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:24px;">${BRAND.logo}</div>
  <div style="background:#131B2E;border:1px solid rgba(148,163,184,0.08);border-radius:16px;padding:28px 24px;color:#F1F5F9;">
    ${body}
  </div>
  ${BRAND.footer}
</div></body></html>`
}

function cta(text, url) {
  return `<a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:linear-gradient(90deg,#22D3EE,#0891B2);color:#0B1120;font-weight:700;font-size:14px;text-decoration:none;border-radius:12px;">${text}</a>`
}

// ── Day 0: Welcome ──
export function drip0(userName) {
  return {
    subject: 'Welcome to Vaultline — connect your first bank in 60 seconds',
    html: wrap('Welcome', `
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;">Welcome to Vaultline${userName ? `, ${userName}` : ''}</h2>
      <p style="color:#94A3B8;font-size:14px;line-height:1.7;margin:0 0 16px;">Your treasury command center is ready. Here's the one thing that makes everything else work: connecting your bank.</p>
      <div style="background:#0B1120;border:1px solid rgba(34,211,238,0.1);border-radius:12px;padding:16px;margin:12px 0;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#22D3EE;">Step 1: Connect a bank</p>
        <p style="margin:0;font-size:12px;color:#94A3B8;">Click "Bank Connections" in the sidebar → "Add Bank" → search your bank → log in via Plaid. Takes 60 seconds. Supports Chase, Wells Fargo, BofA, SVB, and 12,000+ others.</p>
      </div>
      <p style="color:#94A3B8;font-size:13px;margin:12px 0 0;">Once connected, your dashboard lights up: real-time balances, transaction history, and AI forecasting all start working automatically.</p>
      ${cta('Connect your first bank →', 'https://vaultline.app/banks')}
    `)
  }
}

// ── Day 2: Import transactions ──
export function drip2(userName) {
  return {
    subject: 'Import your transaction history for better forecasts',
    html: wrap('Import data', `
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;">Better data = better forecasts</h2>
      <p style="color:#94A3B8;font-size:14px;line-height:1.7;margin:0 0 16px;">Vaultline's AI models improve with more historical data. If you have transaction exports from your bank or accounting software, importing them takes 2 minutes.</p>
      <div style="background:#0B1120;border:1px solid rgba(34,211,238,0.1);border-radius:12px;padding:16px;margin:12px 0;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#22D3EE;">Two ways to import:</p>
        <p style="margin:4px 0;font-size:12px;color:#94A3B8;">1. CSV upload — drag and drop any bank export. We auto-map columns.</p>
        <p style="margin:4px 0;font-size:12px;color:#94A3B8;">2. QuickBooks — click Connect on the Integrations page. OAuth takes 30 seconds.</p>
      </div>
      ${cta('Import data →', 'https://vaultline.app/import')}
    `)
  }
}

// ── Day 5: Generate first forecast ──
export function drip5(userName) {
  return {
    subject: 'Your first AI cash forecast is ready to generate',
    html: wrap('Forecasting', `
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;">See where your cash is headed</h2>
      <p style="color:#94A3B8;font-size:14px;line-height:1.7;margin:0 0 16px;">You have enough transaction history now for Vaultline to forecast your cash flow. Three AI models compete — the most accurate one becomes your default.</p>
      <div style="display:flex;gap:8px;margin:12px 0;">
        <div style="flex:1;background:#0B1120;border:1px solid rgba(34,211,238,0.1);border-radius:12px;padding:12px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#64748B;text-transform:uppercase;">Linear</p>
          <p style="margin:4px 0 0;font-size:13px;color:#22D3EE;font-weight:600;">Trend-based</p>
        </div>
        <div style="flex:1;background:#0B1120;border:1px solid rgba(34,211,238,0.1);border-radius:12px;padding:12px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#64748B;text-transform:uppercase;">EMA</p>
          <p style="margin:4px 0 0;font-size:13px;color:#22D3EE;font-weight:600;">Momentum</p>
        </div>
        <div style="flex:1;background:#0B1120;border:1px solid rgba(34,211,238,0.1);border-radius:12px;padding:12px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#64748B;text-transform:uppercase;">Monte Carlo</p>
          <p style="margin:4px 0 0;font-size:13px;color:#22D3EE;font-weight:600;">Probabilistic</p>
        </div>
      </div>
      <p style="color:#94A3B8;font-size:13px;margin:12px 0 0;">Click "Generate" on the Forecasting page. Your runway, burn rate, and confidence intervals update automatically.</p>
      ${cta('Generate forecast →', 'https://vaultline.app/forecast')}
    `)
  }
}

// ── Day 10: Set up alerts ──
export function drip10(userName) {
  return {
    subject: 'Set a cash floor alert — catch shortfalls before they happen',
    html: wrap('Alerts', `
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;">Never be surprised by a low balance</h2>
      <p style="color:#94A3B8;font-size:14px;line-height:1.7;margin:0 0 16px;">The single most valuable alert in treasury: a cash floor. Set it once, and Vaultline watches every account 24/7. If any balance drops below your threshold, you know immediately.</p>
      <div style="background:#0B1120;border:1px solid rgba(251,191,36,0.15);border-radius:12px;padding:16px;margin:12px 0;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#FBBF24;">Recommended first alert:</p>
        <p style="margin:0;font-size:12px;color:#94A3B8;">Cash floor at $500K on your primary checking account. Fires via in-app notification + email. Takes 30 seconds to set up.</p>
      </div>
      <p style="color:#94A3B8;font-size:13px;margin:12px 0 0;">You can also set alerts for: large transactions, anomaly detection, payment deadlines, and concentration risk.</p>
      ${cta('Set up alerts →', 'https://vaultline.app/alerts')}
    `)
  }
}

// ── Day 14: Trial ending ──
export function drip14(userName, stats = {}) {
  const { totalCash = 0, txCount = 0, forecastGenerated = false, alertsSet = 0 } = stats
  return {
    subject: 'Your trial ends tomorrow — here\'s what you\'ve accomplished',
    html: wrap('Trial recap', `
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;">14 days of treasury intelligence</h2>
      <p style="color:#94A3B8;font-size:14px;line-height:1.7;margin:0 0 16px;">Your free trial ends tomorrow. Here's what Vaultline has been doing for you:</p>
      <div style="background:#0B1120;border:1px solid rgba(34,211,238,0.1);border-radius:12px;padding:16px;margin:12px 0;">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(148,163,184,0.06);">
          <span style="font-size:12px;color:#94A3B8;">Cash monitored</span>
          <span style="font-size:13px;font-weight:600;color:#22D3EE;font-family:monospace;">${totalCash > 0 ? '$' + (totalCash / 1e6).toFixed(2) + 'M' : 'N/A'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(148,163,184,0.06);">
          <span style="font-size:12px;color:#94A3B8;">Transactions categorized</span>
          <span style="font-size:13px;font-weight:600;color:#22D3EE;font-family:monospace;">${txCount}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(148,163,184,0.06);">
          <span style="font-size:12px;color:#94A3B8;">AI forecast</span>
          <span style="font-size:13px;font-weight:600;color:${forecastGenerated ? '#34D399' : '#FBBF24'};">${forecastGenerated ? 'Active' : 'Not yet'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;">
          <span style="font-size:12px;color:#94A3B8;">Alert rules</span>
          <span style="font-size:13px;font-weight:600;color:#22D3EE;font-family:monospace;">${alertsSet}</span>
        </div>
      </div>
      <p style="color:#F1F5F9;font-size:14px;font-weight:600;margin:16px 0 4px;">Keep your treasury running.</p>
      <p style="color:#94A3B8;font-size:13px;margin:0 0 4px;">Starter plan: $499/mo. All the features you've been using, plus priority support.</p>
      ${cta('Upgrade now →', 'https://vaultline.app/billing')}
    `)
  }
}
