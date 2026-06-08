const crypto = require("crypto");

function leadLine(lead) {
  return `${lead.relevance.score}% ${lead.company} | ${lead.title}\n${lead.url}`;
}

function buildLeadAlertText(leads, meta = {}) {
  const header = `发现 ${leads.length} 条新的外企扩张/新办公室线索`;
  const scanned = meta.scannedAt ? `扫描时间：${meta.scannedAt}` : "";
  const body = leads
    .slice(0, 10)
    .map(
      (lead, index) =>
        `${index + 1}. ${leadLine(lead)}\n发布时间：${lead.publishedAt || "未知"}｜来源：${lead.source}\n命中点：${
          lead.relevance.reasons.join("、") || "扩张信号相关"
        }\n摘要：${lead.summary || "暂无摘要"}\n建议：关注官网招聘页、LinkedIn/公众号和上海团队动态`,
    )
    .join("\n\n");
  return [header, scanned, body].filter(Boolean).join("\n\n");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFeishuHeaders(payload) {
  const headers = { "content-type": "application/json" };
  if (!process.env.FEISHU_BOT_SECRET) return { headers, body: payload };

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = crypto
    .createHmac("sha256", `${timestamp}\n${process.env.FEISHU_BOT_SECRET}`)
    .update("")
    .digest("base64");

  return {
    headers,
    body: {
      timestamp,
      sign,
      ...payload,
    },
  };
}

async function sendLeadWebhook(leads, meta) {
  if (!process.env.ALERT_WEBHOOK_URL) return null;
  const response = await fetch(process.env.ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: buildLeadAlertText(leads, meta),
      leads,
      meta,
      type: "expansion-leads",
    }),
  });
  if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
  return "webhook";
}

async function sendFeishuLeads(leads, meta) {
  if (!process.env.FEISHU_BOT_WEBHOOK_URL) return null;
  const payload = {
    msg_type: "text",
    content: {
      text: buildLeadAlertText(leads, meta),
    },
  };
  const { headers, body } = buildFeishuHeaders(payload);
  const response = await fetch(process.env.FEISHU_BOT_WEBHOOK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Feishu bot failed: ${response.status}`);
  return "feishu-bot";
}

async function sendLeadTelegram(leads, meta) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return null;
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: buildLeadAlertText(leads, meta).slice(0, 3900),
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) throw new Error(`Telegram failed: ${response.status}`);
  return "telegram";
}

async function sendLeadServerChan(leads, meta) {
  if (!process.env.SERVER_CHAN_SEND_KEY) return null;
  const url = `https://sctapi.ftqq.com/${process.env.SERVER_CHAN_SEND_KEY}.send`;
  const params = new URLSearchParams();
  params.set("title", `外企扩张线索：${leads.length} 条`);
  params.set("desp", buildLeadAlertText(leads, meta));
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!response.ok) throw new Error(`ServerChan failed: ${response.status}`);
  return "server-chan";
}

async function sendLeadResendEmail(leads, meta) {
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_EMAIL_TO) return null;
  const from = process.env.ALERT_EMAIL_FROM || "Company Radar <onboarding@resend.dev>";
  const htmlItems = leads
    .slice(0, 16)
    .map(
      (lead) => `
        <li style="margin-bottom:16px">
          <strong>${escapeHtml(lead.company)}</strong><br/>
          <a href="${escapeHtml(lead.url)}">${escapeHtml(lead.title)}</a><br/>
          <span>${escapeHtml(lead.source)} · ${escapeHtml(lead.publishedAt || "未知日期")} · 线索分 ${lead.relevance.score}%</span><br/>
          <span>${escapeHtml(lead.relevance.reasons.join("、") || "扩张信号相关")}</span><br/>
          <span>${escapeHtml(lead.summary || "")}</span>
        </li>`,
    )
    .join("");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [process.env.ALERT_EMAIL_TO],
      subject: `外企扩张线索：${leads.length} 条`,
      text: buildLeadAlertText(leads, meta),
      html: `<h2>外企扩张/新办公室线索</h2><p>${escapeHtml(meta.scannedAt || "")}</p><ol>${htmlItems}</ol>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend failed: ${response.status}`);
  return "resend";
}

async function notifyNewLeads(leads, meta = {}) {
  if (!leads.length) {
    return { sent: [], errors: [] };
  }
  const senders = [sendLeadWebhook, sendFeishuLeads, sendLeadTelegram, sendLeadServerChan, sendLeadResendEmail];
  const settled = await Promise.allSettled(senders.map((sender) => sender(leads, meta)));
  const sent = [];
  const errors = [];
  for (const item of settled) {
    if (item.status === "fulfilled" && item.value) sent.push(item.value);
    if (item.status === "rejected") errors.push(item.reason.message || String(item.reason));
  }
  return { sent, errors };
}

module.exports = {
  buildLeadAlertText,
  notifyNewLeads,
};
