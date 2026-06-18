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

function credentialsEmail(siteUrl: string, role: string, email: string, password: string) {
  const loginUrl = `${siteUrl.replace(/\/$/, '')}/login`
  const roleLabel = ROLE_LABEL[role] || role
  const subject = `Your ICFAI Founders Network account is ready`
  // Inline styles only — email clients ignore <style>/external CSS.
  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
    <h1 style="font-size:20px;font-weight:700;margin:0 0 8px">ICFAI Founders Network</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px;color:#444">
      An account has been created for you as a <strong>${escapeHtml(roleLabel)}</strong>. Use the details below to sign in, then complete your profile.
    </p>
    <table style="border-collapse:collapse;margin:0 0 20px">
      <tr><td style="padding:4px 16px 4px 0;font-size:13px;color:#888">Email</td><td style="font-size:14px;font-weight:600">${escapeHtml(email)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;font-size:13px;color:#888">Password</td><td style="font-size:14px;font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escapeHtml(password)}</td></tr>
    </table>
    <a href="${loginUrl}"
       style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px">
      Sign in
    </a>
    <p style="font-size:13px;line-height:1.5;margin:22px 0 0;color:#888">
      Or paste this link into your browser:<br>
      <a href="${loginUrl}" style="color:#555;word-break:break-all">${loginUrl}</a>
    </p>
    <p style="font-size:12px;line-height:1.5;margin:20px 0 0;color:#aaa">
      For your security, change this password from Settings after you sign in. If you weren't expecting this email, ignore it.
    </p>
  </div>`
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
