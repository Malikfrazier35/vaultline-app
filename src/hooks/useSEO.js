import { useEffect } from 'react'

/**
 * Sets page-level SEO tags for SPA pages.
 * Google's crawler executes JS, so document.title and meta tags set at render time are indexed.
 * 
 * @param {object} opts
 * @param {string} opts.title - Page title (appends " — Vaultline" automatically)
 * @param {string} opts.description - Meta description (160 chars max for SERP display)
 * @param {string} [opts.canonical] - Canonical URL path (e.g. '/roi')
 */
export function useSEO({ title, description, canonical }) {
  useEffect(() => {
    // Title
    const fullTitle = title ? `${title} — Vaultline` : 'Vaultline — Cloud Treasury Management for Mid-Market Finance Teams'
    document.title = fullTitle

    // Description
    const descTag = document.querySelector('meta[name="description"]')
    const ogDescTag = document.querySelector('meta[property="og:description"]')
    const twDescTag = document.querySelector('meta[name="twitter:description"]')
    if (description) {
      if (descTag) descTag.setAttribute('content', description)
      if (ogDescTag) ogDescTag.setAttribute('content', description)
      if (twDescTag) twDescTag.setAttribute('content', description)
    }

    // OG title
    const ogTitle = document.querySelector('meta[property="og:title"]')
    const twTitle = document.querySelector('meta[name="twitter:title"]')
    if (ogTitle) ogTitle.setAttribute('content', fullTitle)
    if (twTitle) twTitle.setAttribute('content', fullTitle)

    // Canonical
    const canonicalTag = document.querySelector('link[rel="canonical"]')
    if (canonical && canonicalTag) {
      canonicalTag.setAttribute('href', `https://www.vaultline.app${canonical}`)
    }

    // OG URL
    const ogUrl = document.querySelector('meta[property="og:url"]')
    if (canonical && ogUrl) {
      ogUrl.setAttribute('content', `https://www.vaultline.app${canonical}`)
    }

    // Cleanup — restore defaults on unmount
    return () => {
      document.title = 'Vaultline — Cloud Treasury Management for Mid-Market Finance Teams'
      if (descTag) descTag.setAttribute('content', 'Real-time cash visibility, AI-powered forecasting, and multi-entity treasury management for companies with $10M-$500M in revenue.')
      if (canonicalTag) canonicalTag.setAttribute('href', 'https://www.vaultline.app')
    }
  }, [title, description, canonical])
}
