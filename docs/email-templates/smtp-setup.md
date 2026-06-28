# Custom SMTP for BrainQueue auth emails (Resend)

Supabase's built-in email is test-only and rate-limited; to brand the sender and send
reliably you configure **custom SMTP**. You do NOT need to buy extra mailboxes — you
verify the *domain* once and can send from any address on it (e.g. `noreply@
brainqueue.kuraitstudio.ai`) with no inbox required.

## A. Create Resend + verify your domain
1. Sign up at https://resend.com (free).
2. **Domains → Add Domain.** Use a subdomain for reputation isolation, e.g.
   `brainqueue.kuraitstudio.ai` (apex `kuraitstudio.ai` also works).
3. Resend shows DNS records (SPF `TXT`, DKIM `CNAME`/`TXT`, optional DMARC). Add them
   in your DNS host. **Your DNS is on Cloudflare** (you use Cloudflare Turnstile), so:
   - Cloudflare → DNS → Records → add each record exactly as shown.
   - Set the DKIM `CNAME` records to **DNS only** (grey cloud), not proxied.
4. Click **Verify** in Resend (propagation: minutes up to ~1 hour).

## B. Get SMTP credentials
Resend → **SMTP** (or API Keys → create a key):
- Host: `smtp.resend.com`
- Port: `465` (SSL) or `587` (STARTTLS)
- Username: `resend`
- Password: your Resend API key (`re_...`) — treat as a secret.

## C. Configure Supabase custom SMTP
Supabase → **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
- Sender email: `noreply@brainqueue.kuraitstudio.ai` (must be on the verified domain)
- Sender name: `BrainQueue`
- Host: `smtp.resend.com` · Port: `465` · User: `resend` · Pass: `re_...`
- (Optional) Reply-To: `contact@kuraitstudio.ai`
- Save.

## D. Brand the template + test
1. Authentication → **Email Templates → Magic Link** → paste `magic-link.html` from this
   folder; set subject to **"Your BrainQueue sign-in link."**
2. From your login page, request a magic link. It should now arrive from
   **BrainQueue `<noreply@brainqueue.kuraitstudio.ai>`** with your branding — no Supabase.
3. Deliverability check: confirm it lands in inbox (not spam); add a DMARC record if you
   don't have one (`v=DMARC1; p=none; rua=mailto:contact@kuraitstudio.ai` to start).

## Notes
- The Resend API key is server-side only (lives in Supabase SMTP settings). Never commit it.
- Free tier (3k/mo, 100/day) is ample for magic links; upgrade when volume grows.
- One verified domain → unlimited from-addresses on it. No extra mailboxes to buy.
