# Company Radar

Monitor early expansion signals from foreign companies in Shanghai and send alerts when new opportunities appear.

The monitor looks for signals such as:

- new office openings in Shanghai
- China commercial or application centers
- innovation centers or labs
- local team expansion
- official "entering China" or "expanding in China" announcements

## Sources

Current automated sources:

- Foodaily
- PR Newswire Asia
- Premium Beauty News
- FoodBev Media

LinkedIn is intentionally treated as a manual companion source because it is valuable but unstable for unattended scraping.

## Run locally

```bash
npm run monitor:leads
```

The script stores seen items in `.job-cache/seen-expansion-leads.json`.

## GitHub Actions schedule

The workflow runs at `09:00` Beijing time every other day.

## GitHub Secrets

Set these in `Settings -> Secrets and variables -> Actions`:

- `FEISHU_BOT_WEBHOOK_URL`
- `FEISHU_BOT_SECRET` (only if signature verification is enabled on the Feishu bot)

Optional channels:

- `ALERT_WEBHOOK_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SERVER_CHAN_SEND_KEY`
- `RESEND_API_KEY`
- `ALERT_EMAIL_TO`
- `ALERT_EMAIL_FROM`

Optional tuning:

- `LEAD_MIN_SCORE`
- `LEAD_PAGE_LIMIT`
- `LEAD_CONCURRENCY`
- `LEAD_TIMEOUT_MS`
- `LEAD_TOTAL_CANDIDATE_LIMIT`
- `LEAD_SEED_URLS`

## Notes

- The first run seeds the cache and normally does not alert on historical items.
- GitHub Actions is the recommended scheduler when the computer is off.
