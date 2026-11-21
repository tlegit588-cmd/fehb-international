/**
 * FEHB Organization - Contact Form API
 * Cloudflare Pages Function: POST /api/contact
 *
 * Place this file at: functions/api/contact.js in your Cloudflare Pages repo
 * Your HTML file (index.html) must be at the repo root, next to /functions/
 *
 * SETUP - Choose ONE option:
 *
 * ── OPTION 1: Resend (RECOMMENDED - most reliable) ──
 * 1. Go to https://resend.com -> Sign up free -> Domains -> Add fehborganization.org
 *    Add the DNS records Resend gives you in Cloudflare Dashboard > DNS
 * 2. In Resend: API Keys -> Create key -> copy it
 * 3. In Cloudflare Dashboard: Pages > fehb-organization > Settings > Environment variables
 *    Add:  RESEND_API_KEY = <your key>
 *          CONTACT_TO_EMAIL = info@fehborganization.org
 *          CONTACT_FROM_EMAIL = website@fehborganization.org  (must be on your verified domain)
 * 4. Redeploy. Test the form.
 * Free tier: 100 emails/day, 3,000/month - plenty for a contact form.
 *
 * ── OPTION 2: MailChannels (no API key) ──
 * Works only if fehborganization.org DNS is on Cloudflare (it is, if you host on Cloudflare).
 * 1. In Cloudflare Dashboard: Email > Email Routing > Enable, add SPF/DKIM records as shown
 *    in MailChannels setup: https://developers.cloudflare.com/pages/functions/email-sending/
 * 2. Leave RESEND_API_KEY empty - the code below will automatically use MailChannels.
 * 3. You must send FROM an address on your domain (e.g. website@fehborganization.org)
 *
 * ENV VARS (optional, defaults shown):
 *   RESEND_API_KEY       - if set, uses Resend. If empty, uses MailChannels.
 *   CONTACT_TO_EMAIL     - default: info@fehborganization.org
 *   CONTACT_FROM_EMAIL   - default: website@fehborganization.org
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    let data = {};
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await request.json();
    } else {
      const fd = await request.formData();
      data = Object.fromEntries(fd.entries());
    }

    // Honeypot - bots fill this, humans don't. Silently pretend success.
    if (data._gotcha || data.website || data['bot-field']) {
      return jsonResponse({ ok: true });
    }

    const name = String(data.name || '').trim().slice(0, 100);
    const email = String(data.email || '').trim().slice(0, 200);
    const subject = String(data.subject || '').trim().slice(0, 200);
    const message = String(data.message || '').trim().slice(0, 5000);
    const language = String(data.language || 'en').slice(0, 5);

    // Validation
    if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(
        { ok: false, error: 'Please provide a valid name, email and message.' },
        400
      );
    }

    const toEmail = env.CONTACT_TO_EMAIL || 'info@fehborganization.org';
    const fromEmail = env.CONTACT_FROM_EMAIL || 'website@fehborganization.org';
    const fromName = 'FEHB Website';
    const emailSubject = subject ? `[FEHB] ${subject}` : 'New message from FEHB website';

    const textBody =
      `New message from FEHB website\n` +
      `-------------------------\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Language: ${language}\n` +
      `Subject: ${subject || '(no subject)'}\n\n` +
      `${message}\n`;

    const htmlBody =
      `<h2>New message from FEHB website</h2>` +
      `<p><strong>Name:</strong> ${escapeHtml(name)}<br>` +
      `<strong>Email:</strong> ${escapeHtml(email)}<br>` +
      `<strong>Language:</strong> ${escapeHtml(language)}<br>` +
      `<strong>Subject:</strong> ${escapeHtml(subject || '(no subject)')}</p>` +
      `<p>${escapeHtml(message).replaceAll('\n', '<br>')}</p>` +
      `<p style="color:#888;font-size:12px">Reply directly to this email to answer ${escapeHtml(name)}.</p>`;

    // ── OPTION 1: Resend ──
    if (env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [toEmail],
          reply_to: email,
          subject: emailSubject,
          text: textBody,
          html: htmlBody,
        }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        console.error('Resend error:', res.status, err);
        return jsonResponse(
          { ok: false, error: 'Could not send email. Please email info@fehborganization.org directly.' },
          502
        );
      }
      return jsonResponse({ ok: true });
    }

    // ── OPTION 2: MailChannels (no key) ──
    // Requires your domain DNS on Cloudflare + MailChannels DKIM set up.
    // See: https://developers.cloudflare.com/pages/functions/email-sending/
    const mcRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail, name: 'FEHB Organization' }] }],
        from: { email: fromEmail, name: fromName },
        reply_to: { email, name },
        subject: emailSubject,
        content: [
          { type: 'text/plain', value: textBody },
          { type: 'text/html', value: htmlBody },
        ],
      }),
    });
    if (!mcRes.ok) {
      const err = await mcRes.text().catch(() => '');
      console.error('MailChannels error:', mcRes.status, err);
      return jsonResponse(
        {
          ok: false,
          error:
            'Email service not configured yet. Add RESEND_API_KEY in Cloudflare Pages > Settings > Environment variables, or set up MailChannels. See functions/api/contact.js',
        },
        502
      );
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('Contact API error:', err);
    return jsonResponse(
      { ok: false, error: 'Something went wrong. Please email info@fehborganization.org directly.' },
      500
    );
  }
}

// Allow preflight if needed (same-origin form doesn't need it, but harmless)
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    },
  });
}
