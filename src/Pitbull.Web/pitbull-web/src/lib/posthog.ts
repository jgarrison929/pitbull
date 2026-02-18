import posthog from 'posthog-js'

export function initPostHog() {
  if (typeof window !== 'undefined' && !posthog.__loaded) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return posthog

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      capture_exceptions: true,
      enable_recording_console_log: true,
      mask_all_text: false,
      mask_all_element_attributes: false,
    })
  }
  return posthog
}

export { posthog }
