#!/usr/bin/env node
const { fetchExpansionLeads } = require("../lib/expansion-leads");
const { findNewLeads, readLeadState, updateLeadStateWithLeads, writeLeadState } = require("../lib/lead-state");
const { notifyNewLeads } = require("../lib/notify");

async function main() {
  const minScore = Number(process.env.LEAD_MIN_SCORE || 62);
  const data = await fetchExpansionLeads({
    minScore,
    pageLimit: Number(process.env.LEAD_PAGE_LIMIT || 16),
    timeoutMs: Number(process.env.LEAD_TIMEOUT_MS || 9000),
    concurrency: Number(process.env.LEAD_CONCURRENCY || 4),
    totalCandidateLimit: Number(process.env.LEAD_TOTAL_CANDIDATE_LIMIT || 32),
  });

  const state = await readLeadState();
  const isFirstRun = !state.lastRunAt && Object.keys(state.seen || {}).length === 0;
  const newLeads = findNewLeads(data.leads, state, { minScore });
  const shouldAlert = newLeads.length > 0 && (!isFirstRun || process.env.ALERT_ON_FIRST_RUN === "true");
  const notification = shouldAlert ? await notifyNewLeads(newLeads, data.meta) : { sent: [], errors: [] };

  await writeLeadState(updateLeadStateWithLeads(state, data.leads));

  const summary = {
    ok: true,
    scannedAt: data.meta.scannedAt,
    sources: data.meta.sourceCount,
    candidates: data.meta.candidateCount,
    leadsFound: data.leads.length,
    newLeads: newLeads.length,
    alertSent: shouldAlert,
    firstRunSeeded: isFirstRun && !shouldAlert,
    channels: notification.sent,
    notificationErrors: notification.errors,
    errors: data.meta.errors,
    topLeads: data.leads.slice(0, 10).map((lead) => ({
      score: lead.relevance.score,
      company: lead.company,
      title: lead.title,
      publishedAt: lead.publishedAt,
      url: lead.url,
      reasons: lead.relevance.reasons,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (notification.errors.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
