// Plain, functional HTML templates for Resend emails — no heavy styling.

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildLeadEmailHtml(
  lead: { name: string; email: string; message: string; aiSummary?: string },
  market: string
): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a; margin-bottom: 4px;">New lead — ${market.toUpperCase()} market</h2>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 16px 0;" />

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 100px; vertical-align: top;">Name</td>
          <td style="padding: 8px 0; color: #1a1a1a;">${escapeHtml(lead.name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; vertical-align: top;">Email</td>
          <td style="padding: 8px 0;">
            <a href="mailto:${escapeHtml(lead.email)}" style="color: #4f46e5;">${escapeHtml(lead.email)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; vertical-align: top;">Message</td>
          <td style="padding: 8px 0; color: #1a1a1a; white-space: pre-wrap;">${escapeHtml(lead.message)}</td>
        </tr>
        ${
          lead.aiSummary
            ? `
        <tr>
          <td style="padding: 8px 0; color: #666; vertical-align: top;">AI summary</td>
          <td style="padding: 8px 0; color: #1a1a1a; white-space: pre-wrap;">${escapeHtml(lead.aiSummary)}</td>
        </tr>`
            : ''
        }
      </table>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 16px 0;" />
      <p style="color: #999; font-size: 13px; margin: 0;">
        LandingPageBuild · ${market.toUpperCase()} market · Reply to this email to respond directly to the lead.
      </p>
    </div>
  `
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  client_admin: 'Client Admin',
  viewer: 'Viewer',
}

// Not an "accept invitation" email — this codebase has no invite-token
// flow (POST /api/admin/users creates the account with a password
// directly, set by the super_admin who created it). Notifies the new
// user their account exists and points them at the admin panel; it
// deliberately never includes the password itself.
export function buildWelcomeEmailHtml(opts: { role: string; adminPanelUrl: string }): string {
  const roleLabel = ROLE_LABELS[opts.role] ?? opts.role

  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a;">You have been added to LandingPageBuild</h2>
      <p style="color: #444;">
        You have been given <strong>${escapeHtml(roleLabel)}</strong> access to the LandingPageBuild admin panel.
      </p>
      <p style="margin: 24px 0;">
        <a href="${opts.adminPanelUrl}"
           style="background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px;
                  text-decoration: none; font-weight: 600; display: inline-block;">
          Sign in
        </a>
      </p>
      <p style="color: #666; font-size: 13px;">
        Ask whoever set up your account for your sign-in password — this email doesn't include it. If you
        weren't expecting this, you can ignore it.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 16px 0;" />
      <p style="color: #999; font-size: 12px; margin: 0;">LandingPageBuild</p>
    </div>
  `
}
