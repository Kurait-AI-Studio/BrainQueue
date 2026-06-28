# BrainQueue — Distribution as a System (for a solo technical founder)

> The point of this doc is to understand distribution as a **system with loops**, not a
> list of tactics. Tactics ("post on Reddit") are interchangeable; the system is what makes
> reach **repeatable and compounding**. A great product with no distribution system loses to
> a worse one that has one. This is the founder's most likely blind spot, so treat it as a
> first-class engineering problem: inputs, outputs, feedback, and a metric per stage.

## 1. The mental model: distribution = a machine that turns attention into retained users, repeatably

Five parts. If any is broken, the machine leaks.

```
  AUDIENCE → MESSAGE → CHANNEL(S) → FUNNEL → LOOP
   (who)     (why)     (where)      (convert) (compounds)
```

- **Audience** — the *specific* people, and *where they already gather*.
- **Message** — the one sentence that makes them feel seen. You cannot out-distribute a muddy message.
- **Channels** — owned / earned / paid (below). The path the message travels.
- **Funnel** — awareness → trial → activation (first "aha") → retention → referral. Instrument every stage.
- **Loop** — the part that feeds itself, so reach grows without linearly more effort. This is the whole game.

## 2. Audience: pick ONE beachhead, narrow

Not "busy people." **Adults with ADHD who feel buried by task chaos** — ideally a sub-slice (e.g. ADHD women, or ADHD knowledge workers). Founder–market fit is real here (you + your wife). Where they gather:
- Reddit: r/ADHD, r/adhdwomen, r/productivity, r/getdisciplined
- ADHD TikTok / YouTube / Instagram creators (huge, engaged)
- Discord/Facebook ADHD + productivity communities
- X/Twitter ADHD + build-in-public communities
- Overlap with Tiimo / Saner / Llama Life users

Narrow beats broad: a message that's perfect for 10,000 ADHD women beats a generic one for "everyone."

## 3. Channels: owned / earned / paid

| Type | You… | Examples | For you |
|---|---|---|---|
| **Owned** | control it | landing page, email list, the app, your build-in-public account | **Build these first** — they compound and cost nothing per use |
| **Earned** | are given it | word of mouth, community posts, creator mentions, press, SEO | **Your main lever** — trust-based, fits a niche product |
| **Paid** | rent it | ads | **Last** — only once you know your funnel converts, or you'll burn cash teaching a broken funnel |

**The conversion that matters: turn earned/paid reach into OWNED.** Every visitor → capture an email (waitlist, "notify me"). Owned audience is the asset you keep.

## 4. The loops (the compounding part — pick ONE to start)

A *campaign* runs once. A *loop* feeds its own input. You want loops.

1. **Word-of-mouth loop** (strongest for a niche): product genuinely helps an ADHD person → they tell ADHD friends → who tell theirs. Requires (a) real love for a narrow group, (b) a natural "tell a friend" moment. *Input:* delighted user. *Output:* a new user who can also delight. **This is the loop to bet on — niche + emotional relief = high referral.**
2. **Content / build-in-public loop**: you share the journey + helpful ADHD-productivity content → attracts audience → some convert → some content gets shared / ranks in search (SEO compounds for years). *Input:* your time. *Output:* durable owned audience + inbound. **Highest-leverage for a solo technical founder, and it doubles as audience-building before launch.**
3. **Community loop**: be genuinely useful in ADHD communities (answer questions, share the build) → trust → pull. Not spam; contribution. Slower, but real.

Rule: **find one loop, saturate it, then add a second.** Most founders dabble in ten channels and compound in none.

## 5. The funnel, instrumented (use your telemetry)

| Stage | Question | Metric | Where it lives |
|---|---|---|---|
| Awareness | Do they hear about it? | reach, landing visits | analytics |
| Trial | Do they sign up? | signups / visit | auth |
| **Activation** | Do they hit the first "aha"? | completed a brain dump + a focus set | `task_events` |
| **Retention** | Do they come back? | day-1 / 3 / 7 / 30 return | `task_events` |
| Referral | Do they bring others? | invites / shares | (add later) |

**Fix the leakiest stage first.** For a pre-launch product the usual killer is **retention**, not awareness — so prove that *before* pouring effort into reach. You already capture the events; build a weekly funnel readout.

## 6. The founder is the first channel

For a solo technical founder, **building in public is the highest-ROI, lowest-cost system**: share the craft, the ADHD angle (you + your wife as users), the honest journey. It compounds trust, builds an owned audience *before* launch, and creates content that fuels the content loop. Authenticity is your edge over funded competitors. Start now, not at launch.

## 7. The two n=10 cohorts (your demo idea — this is validation, not distribution)

Run two small cohorts and treat them differently:
- **Cohort A — your circle** (you, wife, friends): catches obvious friction. **Biased** (they're invested), so don't trust their enthusiasm as a market signal.
- **Cohort B — cold ADHD strangers** (recruited from the communities above): the *real* signal. Watch them use it for the first 5 minutes silently; note where they get confused.

Measure with one blunt instrument — the **Sean Ellis PMF test**: *"How would you feel if you could no longer use BrainQueue?"* If **>40% say "very disappointed,"** you have product–market fit signal and *then* distribution scales. Below that, fix the product before scaling reach (or you amplify a leaky funnel).

## 8. Sequencing for a bootstrapped solo founder

- **Phase 0 — now (pre-launch):** start building in public; run the two n=10 cohorts; nail the message; prove retention + the PMF question. Capture emails on the landing.
- **Phase 1 — launch moment:** coordinate one spike — Product Hunt + a few target communities + your build-in-public audience + the waitlist email. One good day beats a vague month.
- **Phase 2 — post-launch:** find the ONE channel/loop that actually worked, systematize it, ignore the rest. Add paid only once the funnel provably converts.

## 9. The one principle to remember

**Distribution is an experiment system, not a one-shot.** Pick a loop, instrument it, run weekly experiments, double down on what compounds, cut what doesn't — the same rigor you bring to code. Your detail-orientation is an asset here *if* you point it at "do strangers come back?" instead of only at the product.
