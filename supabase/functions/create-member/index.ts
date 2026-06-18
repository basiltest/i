// create-member: an admin creates a member account directly and emails the sign-in details.
//
// The SPA holds only the anon key, so creating a confirmed user with a known password
// requires the service-role key, which must never reach the browser — hence this function.
//
// Authorization is enforced two ways: the caller's JWT is checked against profiles.role
// === 'admin' before anything happens (a non-admin gets 403), and only then does a
// service-role client create the auth user. The generated password is returned to the
// admin once (shown in the UI) and emailed to the member via Resend.
//
// Deploy:  supabase functions deploy create-member
// Secrets: supabase secrets set RESEND_API_KEY=... PUBLIC_SITE_URL=https://your-app \
//                               MEMBER_FROM_EMAIL="IFN <accounts@your-domain>"
// (SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
//  MEMBER_FROM_EMAIL falls back to INVITE_FROM_EMAIL if unset.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail, escapeHtml } from '../_shared/resend.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROLE_LABEL: Record<string, string> = { mentor: 'Mentor', admin: 'Admin', student: 'Student' }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// Strong random password: 16 chars drawn from a class-diverse alphabet, guaranteed to
// include at least one lower, upper, digit and symbol. Uses crypto for unbiased selection.
function generatePassword() {
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digit = '23456789'
  const symbol = '!@#$%^&*-_=+?'
  const all = lower + upper + digit + symbol
  const pick = (set: string) => set[randomInt(set.length)]
  const chars = [pick(lower), pick(upper), pick(digit), pick(symbol)]
  while (chars.length < 16) chars.push(pick(all))
  // Fisher–Yates shuffle so the guaranteed chars aren't always in the first 4 slots.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function randomInt(max: number) {
  // Rejection sampling to avoid modulo bias.
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  let n: number
  do { crypto.getRandomValues(buf); n = buf[0] } while (n >= limit)
  return n % max
}

// Brand tokens lifted verbatim from the app's design system (web/src/index.css /
// tailwind.config.js): navy is the primary, the red bar is the ICFAI logo motif, paper is
// the body surface. Kept as constants so the email and the app never drift apart.
const BRAND = {
  navy: '#2C2A82',
  red: '#E31E24',
  paper: '#F7F5F2',
  card: '#FFFFFF',
  line: '#E4E0D6',
  ink: '#1C1D33',
  muted: '#5B5D75',
  faint: '#71748C',
  soft: '#EAEAF7',
}
// System-first stack; capable clients (Apple Mail, iOS) upgrade to the brand faces via the
// <style> @import below, everyone else falls back gracefully. No web font is required to read it.
const BODY_FONT = `'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`
const DISPLAY_FONT = `'Bricolage Grotesque',${BODY_FONT}`
const MONO_FONT = `'SFMono-Regular',ui-monospace,Menlo,Consolas,'Liberation Mono',monospace`

function credentialsEmail(siteUrl: string, role: string, email: string, password: string) {
  const base = siteUrl.replace(/\/$/, '')
  const loginUrl = `${base}/login`
  // The mark is a hosted PNG (email clients strip inline SVG). Shipped from the app's
  // public/ at this stable path; a web deploy publishes it alongside the feature.
  const logoUrl = `${base}/email/icfai-founders.png`
  const roleLabel = ROLE_LABEL[role] || role
  const subject = `Your ICFAI Founders Network account is ready`
  const e = escapeHtml

  // HTML email is its own medium: table layout for Outlook, inline styles only (embedded CSS
  // is stripped by Gmail/Outlook), a VML button so the CTA is solid in Outlook, a hidden
  // preheader for the inbox preview line, and color-scheme:light so clients don't auto-invert
  // the navy/paper palette. The brand mark is rebuilt typographically (no image) so it renders
  // even when a client blocks images by default — which most do for a first email.
  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=Instrument+Sans:wght@400;500;600;700&display=swap');
    body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table{border-collapse:collapse!important}
    a{text-decoration:none}
    @media only screen and (max-width:600px){
      .container{width:100%!important}
      .px{padding-left:24px!important;padding-right:24px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.paper};color:${BRAND.ink};font-family:${BODY_FONT};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.paper};">
    Your account is ready — sign in and finish setting up your profile.&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.paper};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" width="480" cellpadding="0" cellspacing="0" border="0" style="width:480px;max-width:480px;">

          <!-- Card -->
          <tr>
            <td style="background-color:${BRAND.card};border:1px solid ${BRAND.line};border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(28,29,51,0.08);">

              <!-- Full-bleed red signature rule (the ICFAI bar) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="height:3px;line-height:3px;font-size:0;background-color:${BRAND.red};">&nbsp;</td></tr>
              </table>

              <!-- Letter -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="px" style="padding:44px 44px 40px;">

                    <!-- Letterhead: the ICFAI Founders Network mark (hosted PNG; clients strip SVG) -->
                    <img src="${logoUrl}" width="150" height="57" alt="ICFAI Founders Network" style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;width:150px;height:57px;">

                    <h1 style="margin:30px 0 14px;font-family:${DISPLAY_FONT};font-size:29px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;color:${BRAND.ink};">Your account is ready</h1>
                    <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:${BRAND.muted};">
                      An administrator created your <strong style="color:${BRAND.ink};font-weight:600;">${e(roleLabel)}</strong> account on the ICFAI Founders Network. Sign in with the details below, then take a minute to finish your profile.
                    </p>

                    <!-- Credentials -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:12px;">
                      <tr>
                        <td style="padding:20px 22px 16px;">
                          <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:${BRAND.faint};text-transform:uppercase;">Email address</div>
                          <div style="margin-top:6px;font-size:16px;font-weight:600;color:${BRAND.ink};word-break:break-all;">${e(email)}</div>
                        </td>
                      </tr>
                      <tr><td style="padding:0 22px;"><div style="height:1px;line-height:1px;font-size:0;background-color:${BRAND.line};">&nbsp;</div></td></tr>
                      <tr>
                        <td style="padding:16px 22px 20px;">
                          <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:${BRAND.faint};text-transform:uppercase;">Temporary password</div>
                          <div style="margin-top:9px;">
                            <span style="display:inline-block;background-color:${BRAND.card};border:1px solid ${BRAND.line};border-radius:8px;padding:11px 15px;font-family:${MONO_FONT};font-size:17px;font-weight:700;letter-spacing:0.06em;color:${BRAND.ink};word-break:break-all;">${e(password)}</span>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA: full-width navy button -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
                      <tr>
                        <td align="center" bgcolor="${BRAND.navy}" style="background-color:${BRAND.navy};border-radius:10px;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${loginUrl}" style="height:50px;v-text-anchor:middle;width:392px;" arcsize="20%" strokecolor="${BRAND.navy}" fillcolor="${BRAND.navy}">
                            <w:anchorlock/>
                            <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Sign in to your account</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${loginUrl}" style="display:block;color:#ffffff;font-size:15px;font-weight:600;line-height:1;padding:16px 24px;text-align:center;">Sign in to your account</a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>

                    <p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:${BRAND.faint};text-align:center;">
                      Button not working? Paste this link into your browser:<br>
                      <a href="${loginUrl}" style="color:${BRAND.navy};font-weight:500;word-break:break-all;">${loginUrl}</a>
                    </p>

                    <div style="margin:30px 0 0;padding-top:22px;border-top:1px solid ${BRAND.line};">
                      <p style="margin:0;font-size:13px;line-height:1.55;color:${BRAND.muted};">
                        For your security, change this password from <strong style="color:${BRAND.ink};font-weight:600;">Settings</strong> once you're signed in.
                      </p>
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="px" style="padding:22px 40px 0;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.faint};">
                ICFAI Founders Network
              </p>
              <p style="margin:6px 0 0;font-size:12px;line-height:1.5;color:${BRAND.faint};">
                An administrator created this account for you. If you weren't expecting it, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  return { subject, html }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const SITE_URL = Deno.env.get('PUBLIC_SITE_URL')
  const FROM = Deno.env.get('MEMBER_FROM_EMAIL') || Deno.env.get('INVITE_FROM_EMAIL')

  if (!RESEND_API_KEY || !SITE_URL || !FROM) {
    return json({ error: 'Email is not configured (RESEND_API_KEY / PUBLIC_SITE_URL / MEMBER_FROM_EMAIL).' }, 500)
  }

  let email: unknown, role: unknown
  try {
    const body = await req.json()
    email = body.email
    role = body.role
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ error: 'A valid email is required.' }, 400)
  }
  if (typeof role !== 'string' || !['mentor', 'admin', 'student'].includes(role)) {
    return json({ error: 'role must be mentor, admin, or student' }, 400)
  }
  const addr = email.trim().toLowerCase()

  // 1. Authorize the caller: must be an existing admin. Uses the caller's JWT against RLS
  //    (a user can read their own profile row), so this is the same check the client UI uses.
  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'Not authenticated' }, 401)
  const { data: me, error: meErr } = await caller
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()
  if (meErr || me?.role !== 'admin') return json({ error: 'Not authorized' }, 403)

  // 2. Create the account with the service role. email_confirm so they can sign in at once.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const password = generatePassword()
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: addr,
    password,
    email_confirm: true,
  })
  if (createErr || !created?.user) {
    const msg = createErr?.message || 'Could not create the account.'
    const status = /already.*registered|already exists|duplicate/i.test(msg) ? 409 : 400
    return json({ error: /already/i.test(msg) ? 'That email already has an account.' : msg }, status)
  }

  // 3. Set the role on the profile row created by the new-user trigger.
  const { error: roleErr } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', created.user.id)
  if (roleErr) {
    // The account exists but the role didn't stick. Surface it so the admin can fix it
    // from the Members tab rather than silently leaving a misroled account.
    console.error('role update failed:', roleErr)
    return json({ error: `Account created, but the role could not be set: ${roleErr.message}. Set it from the Members tab.`, password }, 500)
  }

  // 4. Email the credentials. A send failure does not undo the account — report it so the
  //    admin can share the password (returned below) manually.
  const { subject, html } = credentialsEmail(SITE_URL, role, addr, password)
  let emailed = false
  try {
    await sendEmail({ apiKey: RESEND_API_KEY, from: FROM, to: addr, subject, html })
    emailed = true
  } catch (e) {
    console.error('Resend send failed:', e)
  }

  return json({ ok: true, email: addr, role, password, emailed })
})
