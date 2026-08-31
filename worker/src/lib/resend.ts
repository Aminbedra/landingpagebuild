// Thin wrapper around the Resend REST API — no SDK, the HTTP API is simple
// enough to call directly via fetch. Sending domain/from address are fixed
// (verified in Resend), not per-call configurable.

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_ADDRESS = 'leads@hello.intrnationalmarketing.com'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
}

// Returns null on any failure rather than throwing — a Resend outage must
// never break the caller's own response (lead capture, user creation).
// Errors are logged (visible via `wrangler tail`) but not retried; a lead
// whose notification failed just keeps email_sent = 0, which is there for
// a future retry sweep, not handled here.
export async function sendEmail(apiKey: string, options: SendEmailOptions): Promise<{ id: string } | null> {
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: options.to,
        subject: options.subject,
        html: options.html,
        reply_to: options.replyTo,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`Resend error ${res.status}:`, body)
      return null
    }

    return (await res.json()) as { id: string }
  } catch (e) {
    console.error('Resend fetch failed:', e)
    return null
  }
}
