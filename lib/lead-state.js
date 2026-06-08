const fs = require("fs/promises");
const path = require("path");

const DEFAULT_STATE_FILE = path.join(process.cwd(), ".job-cache", "seen-expansion-leads.json");

function emptyLeadState() {
  return {
    seen: {},
    lastRunAt: null,
  };
}

function normalizeLeadState(value) {
  if (!value) return emptyLeadState();
  if (typeof value === "string") {
    try {
      return normalizeLeadState(JSON.parse(value));
    } catch {
      return emptyLeadState();
    }
  }
  return {
    seen: value.seen && typeof value.seen === "object" ? value.seen : {},
    lastRunAt: value.lastRunAt || null,
  };
}

async function readLeadState(file = process.env.LEAD_STATE_FILE || DEFAULT_STATE_FILE) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return normalizeLeadState(JSON.parse(raw));
  } catch {
    return emptyLeadState();
  }
}

async function writeLeadState(state, file = process.env.LEAD_STATE_FILE || DEFAULT_STATE_FILE) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(normalizeLeadState(state), null, 2)}\n`, "utf8");
  return true;
}

function findNewLeads(leads, state, options = {}) {
  const minScore = Number(options.minScore || process.env.LEAD_MIN_SCORE || 62);
  const seen = normalizeLeadState(state).seen;
  return leads.filter((lead) => lead.relevance.score >= minScore && !seen[lead.id]);
}

function updateLeadStateWithLeads(state, leads) {
  const next = normalizeLeadState(state);
  const now = new Date().toISOString();
  for (const lead of leads) {
    next.seen[lead.id] = next.seen[lead.id] || now;
  }
  next.lastRunAt = now;
  return next;
}

module.exports = {
  findNewLeads,
  readLeadState,
  updateLeadStateWithLeads,
  writeLeadState,
};
