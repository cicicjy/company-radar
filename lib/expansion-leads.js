const crypto = require("crypto");

const DEFAULT_TIMEOUT_MS = Number(process.env.LEAD_TIMEOUT_MS || 9000);
const DEFAULT_CONCURRENCY = Number(process.env.LEAD_CONCURRENCY || 4);
const DEFAULT_PAGE_LIMIT = Number(process.env.LEAD_PAGE_LIMIT || 28);
const DEFAULT_MIN_SCORE = Number(process.env.LEAD_MIN_SCORE || 62);

const expansionLeadSources = [
  {
    id: "foodaily-articles",
    name: "Foodaily",
    url: "https://foodaily.com/articles",
    articleUrlPattern: /\/articles\/\d+/i,
  },
  {
    id: "prnasia-releases",
    name: "PR Newswire Asia",
    url: "https://www.prnasia.com/releases/",
    articleUrlPattern: /\/story\/\d+-\d+\.shtml$/i,
    timeoutMs: 15000,
  },
  {
    id: "premiumbeauty-companies",
    name: "Premium Beauty News",
    url: "https://www.premiumbeautynews.com/en/companies-industry/",
    articleUrlPattern: /\/en\/[^?#]+,\d+(?:,en)?$/i,
  },
  {
    id: "foodbev-home",
    name: "FoodBev Media",
    url: "https://www.foodbev.com/",
    articleUrlPattern: /\/post301\/[^?#]+$/i,
    timeoutMs: 15000,
  },
];

const signalGroups = [
  {
    label: "上海落地",
    weight: 24,
    keywords: ["上海正式落成", "上海应用实验室", "上海办公室", "上海销售", "在上海", "上海", "Shanghai"],
  },
  {
    label: "新办公室/中心",
    weight: 28,
    keywords: [
      "中国办公室",
      "新办公室",
      "办公室正式揭幕",
      "正式揭幕",
      "销售与应用中心",
      "应用中心",
      "应用实验室",
      "研发中心",
      "创新中心",
      "客户体验中心",
      "培训中心",
      "地区总部",
      "区域总部",
      "亚太总部",
      "商业中心",
      "制造中心",
      "设立",
      "开设",
      "落成",
      "揭幕",
      "启用",
      "开业",
      "inaugurated",
      "opened",
      "opening",
      "launches",
      "launching",
      "opens",
      "hub",
      "headquarters",
      "regional headquarters",
      "innovation centre",
      "innovation center",
      "commercial centre",
      "commercial center",
      "industrial facility",
      "manufacturing facility",
      "pilot plant",
    ],
  },
  {
    label: "中国市场扩张",
    weight: 18,
    keywords: [
      "中国市场",
      "深耕中国",
      "本土化运营",
      "本土化专业团队",
      "长期战略布局",
      "进入中国",
      "在华",
      "开拓中国市场",
      "赋能中国市场",
      "中国客户",
      "中国食品饮料行业",
      "China market",
      "Chinese market",
      "local team",
      "local presence",
      "market entry",
      "market expansion",
      "growth in China",
      "expand in China",
    ],
  },
  {
    label: "外企/跨国信号",
    weight: 16,
    keywords: [
      "全球",
      "亚太",
      "欧洲",
      "美国",
      "德国",
      "荷兰",
      "法国",
      "英国",
      "瑞士",
      "丹麦",
      "意大利",
      "瑞典",
      "芬兰",
      "挪威",
      "比利时",
      "西班牙",
      "奥地利",
      "日本",
      "韩国",
      "跨国",
      "international",
      "global",
      "APAC",
      "EMEA",
      "Nordic",
    ],
  },
  {
    label: "目标行业",
    weight: 14,
    keywords: [
      "食品",
      "饮料",
      "食品饮料",
      "植物基",
      "着色",
      "配料",
      "原料",
      "香精",
      "香料",
      "营养",
      "清洁标签",
      "美妆",
      "个护",
      "零售",
      "消费品",
      "快消",
      "ingredients",
      "beauty",
      "beverage",
      "food",
      "flavour",
      "fragrance",
    ],
  },
];

function hashLead(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function unique(items, getKey) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function parseCsv(value = "") {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanText(value = "") {
  return String(value)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value = "") {
  return cleanText(
    decodeHtml(value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function toAbsoluteUrl(href, baseUrl) {
  try {
    return normalizeUrl(new URL(decodeHtml(href), baseUrl).toString());
  } catch {
    return "";
  }
}

async function fetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (compatible; CompanyRadar/1.0; +https://github.com/cicicjy/company-radar)",
      },
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url || url,
      contentType: response.headers.get("content-type") || "",
      text,
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractArticleLinks(html, source, limit = DEFAULT_PAGE_LIMIT) {
  const links = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const url = toAbsoluteUrl(match[1], source.url);
    if (!url || (source.articleUrlPattern && !source.articleUrlPattern.test(url))) continue;
    links.push({
      sourceId: source.id,
      sourceName: source.name,
      url,
      title: stripHtml(match[2]),
    });
  }
  return unique(links, (item) => item.url).slice(0, limit);
}

function extractFirst(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return stripHtml(match[1]);
  }
  return "";
}

function extractTitle(html, fallbackTitle = "") {
  const title =
    extractFirst(html, [
      /class=["'][^"']*\barticle-title\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]) || fallbackTitle;
  return cleanText(title).replace(
    /\s*(?:\||-|–)\s*(?:Foodaily每日食品|Foodaily|Premium Beauty News|Food Dive|FoodBev(?: Media)?(?: \| News and analysis.*)?|PR Newswire Asia|美通社).*/i,
    "",
  );
}

function extractPublishedAtFromHtml(html = "") {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /"uploadDate"\s*:\s*"([^"]+)"/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match || !match[1]) continue;
    const value = cleanText(match[1]);
    const normalized = value.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
    if (!normalized) continue;
    const [, year, month, day] = normalized;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return "";
}

function extractPublishedAt(text = "", html = "") {
  const fromHtml = extractPublishedAtFromHtml(html);
  if (fromHtml) return fromHtml;
  const match = cleanText(text).match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function trimArticleText(text, title) {
  let value = cleanText(text);
  const titleIndex = title ? value.indexOf(title) : -1;
  if (titleIndex >= 0) value = value.slice(titleIndex + title.length).trim();
  value = value
    .replace(/^.*?搜索一下\s*/i, "")
    .split(/点赞\s*\d+|好文章，需要你的鼓励|评论\s*登录|推荐专栏|扫码关注|打开微信“扫一扫”|Read more and set cookies/i)[0]
    .trim();
  return value || cleanText(text).slice(0, 2800);
}

function inferCompany(title = "", articleText = "") {
  const titleCompany = cleanText(title).match(/^([A-Za-z][A-Za-z0-9&.+\- ]{1,36})(?=中国|上海|在华|集团|近日|宣布|正式|携|，|:|：)/);
  if (titleCompany && titleCompany[1]) return cleanText(titleCompany[1]);

  const englishTitleCompany = cleanText(title).match(
    /^([A-Z][A-Za-z0-9&.+\- ]{1,40})\s+(?:opens|opened|launches|launched|expands|expanded|inaugurates|inaugurated|establishes|established|unveils|unveiled|invests|invested|debuts|debuted)\b/i,
  );
  if (englishTitleCompany && englishTitleCompany[1]) return cleanText(englishTitleCompany[1]);

  const bylineCompany = cleanText(articleText).match(/^([A-Za-z][A-Za-z0-9&.+\-]{1,24}|[\u4e00-\u9fa5A-Za-z0-9&.+\-]{2,30})\s+20\d{2}[./-]\d{1,2}[./-]\d{1,2}\b/);
  if (bylineCompany && bylineCompany[1]) return cleanText(bylineCompany[1]);

  const announcedCompany = cleanText(articleText).match(/([A-Za-z][A-Za-z0-9&.+\- ]{1,36}|[\u4e00-\u9fa5A-Za-z0-9&.+\-]{2,30})近日宣布/);
  if (announcedCompany && announcedCompany[1]) return cleanText(announcedCompany[1]);

  const englishBodyCompany = cleanText(articleText).match(
    /([A-Z][A-Za-z0-9&.+\- ]{1,40})\s+(?:announced|opened|launched|expanded|inaugurated|established|unveiled|invested)\b/i,
  );
  if (englishBodyCompany && englishBodyCompany[1]) return cleanText(englishBodyCompany[1]);

  return "";
}

function matchedKeywords(text, keywords) {
  const haystack = cleanText(text).toLowerCase();
  return unique(
    keywords.filter((keyword) => haystack.includes(String(keyword).toLowerCase())),
    (keyword) => String(keyword).toLowerCase(),
  );
}

function hasEnglishCompanySignal(company = "", title = "") {
  return /^[A-Za-z][A-Za-z0-9&.+\- ]{1,36}$/.test(cleanText(company)) || /\b[A-Z][A-Z0-9&.+\-]{1,12}\b/.test(title);
}

function scoreLead({ title, articleText, company }) {
  const text = `${title} ${articleText}`;
  const reasons = [];
  let score = 18;
  const groupHits = {};

  for (const group of signalGroups) {
    const hits = matchedKeywords(text, group.keywords);
    groupHits[group.label] = hits;
    if (!hits.length) continue;
    score += Math.min(group.weight, 8 + hits.length * 4);
    reasons.push(`${group.label}：${hits.slice(0, 4).join("、")}`);
  }

  const hasShanghai = (groupHits["上海落地"] || []).length > 0;
  const hasChina = /中国|在华|Chinese market|China market/i.test(text);
  const hasCompany = Boolean(cleanText(company));
  const hasStrongExpansionSignal =
    (groupHits["新办公室/中心"] || []).length > 0 ||
    /新办公|中国办公室|办公室正式揭幕|销售与应用中心|应用实验室|研发中心|创新中心|客户体验中心|落成|揭幕|启用/.test(text);
  const hasChinaExpansionSignal =
    (groupHits["中国市场扩张"] || []).length > 0 && /中国市场|深耕中国|本土化|进入中国|在华|中国客户/.test(text);
  const hasExpansion = hasStrongExpansionSignal || hasChinaExpansionSignal;
  const hasForeign = hasCompany && ((groupHits["外企/跨国信号"] || []).length > 0 || hasEnglishCompanySignal(company, title));

  if (hasEnglishCompanySignal(company, title)) {
    score += 8;
    if (!reasons.some((reason) => reason.startsWith("外企/跨国信号"))) {
      reasons.push("外企/跨国信号：英文公司名");
    }
  }
  if (hasShanghai && hasExpansion) score += 10;
  if (!hasShanghai && hasChina) score -= 8;
  if (!hasExpansion) score -= 35;
  if (!hasCompany) score -= 24;
  if (!hasForeign) score -= 18;

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    confidence: score >= 82 ? "high" : score >= 68 ? "medium" : "watch",
    reasons: unique(reasons, (item) => item),
    hasExpansion,
    hasForeign,
    hasLocation: hasShanghai || hasChina,
  };
}

function pickSummary(articleText = "", title = "") {
  const signalWords = signalGroups.flatMap((group) => group.keywords);
  const sentences = cleanText(articleText)
    .replace(/\s+/g, " ")
    .match(/[^。！？.!?；;]{12,180}[。！？.!?；;]?/g);
  const ranked = (sentences || [])
    .map((sentence, index) => ({
      sentence: cleanText(sentence),
      index,
      score: matchedKeywords(sentence, signalWords).length,
    }))
    .filter((item) => item.sentence && !/图片来源|扫码|评论|收藏|分享/i.test(item.sentence))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.sentence);
  const picked = unique(ranked, (item) => item).slice(0, 2);
  return picked.join(" ") || cleanText(title);
}

function buildLeadFromArticle(article, html) {
  const title = extractTitle(html, article.title);
  const rawText = stripHtml(html);
  const articleText = trimArticleText(rawText, title);
  const company = inferCompany(title, articleText);
  const relevance = scoreLead({ title, articleText, company });
  return {
    id: hashLead(article.url),
    company: company || "待确认公司",
    title,
    source: article.sourceName,
    sourceId: article.sourceId,
    url: article.url,
    publishedAt: extractPublishedAt(articleText || rawText, html),
    summary: pickSummary(articleText, title),
    relevance,
    capturedAt: new Date().toISOString(),
  };
}

async function runPool(items, worker, concurrency = DEFAULT_CONCURRENCY) {
  const results = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function collectCandidates(source, options = {}) {
  const fetched = await fetchText(source.url, source.timeoutMs || options.timeoutMs || DEFAULT_TIMEOUT_MS);
  if (!fetched.ok) throw new Error(`${source.name} ${fetched.status}`);
  return extractArticleLinks(fetched.text, source, options.pageLimit || DEFAULT_PAGE_LIMIT);
}

function sourceForUrl(url) {
  return (
    expansionLeadSources.find((source) => {
      try {
        return new URL(url).hostname.endsWith(new URL(source.url).hostname);
      } catch {
        return false;
      }
    }) || {
      id: "manual-seed",
      name: "手动线索",
      url,
      articleUrlPattern: /.*/,
    }
  );
}

function filterLead(lead, minScore = DEFAULT_MIN_SCORE) {
  return (
    lead.title &&
    lead.company !== "待确认公司" &&
    lead.relevance.score >= minScore &&
    lead.relevance.hasExpansion &&
    lead.relevance.hasLocation &&
    lead.relevance.hasForeign
  );
}

async function fetchExpansionLeads(options = {}) {
  const startedAt = Date.now();
  const sourceLimit = Number(options.sourceLimit || process.env.LEAD_SOURCE_LIMIT || expansionLeadSources.length);
  const pageLimit = Number(options.pageLimit || process.env.LEAD_PAGE_LIMIT || DEFAULT_PAGE_LIMIT);
  const totalCandidateLimit = Number(
    options.totalCandidateLimit || process.env.LEAD_TOTAL_CANDIDATE_LIMIT || pageLimit * Math.max(1, sourceLimit),
  );
  const minScore = Number(options.minScore || process.env.LEAD_MIN_SCORE || DEFAULT_MIN_SCORE);
  const sources = expansionLeadSources.slice(0, sourceLimit);
  const errors = [];

  const candidateGroups = await Promise.all(
    sources.map(async (source) => {
      try {
        return await collectCandidates(source, { ...options, pageLimit });
      } catch (error) {
        errors.push(`${source.name}: ${error.message || String(error)}`);
        return [];
      }
    }),
  );

  const seedUrls = parseCsv(options.seedUrls || process.env.LEAD_SEED_URLS);
  const seedCandidates = seedUrls.map((url) => {
    const source = sourceForUrl(url);
    return {
      sourceId: source.id,
      sourceName: source.name,
      url: normalizeUrl(url),
      title: "",
    };
  });

  const candidates = unique([...seedCandidates, ...candidateGroups.flat()], (item) => item.url).slice(0, totalCandidateLimit);

  const articles = await runPool(
    candidates,
    async (candidate) => {
      try {
        const source = expansionLeadSources.find((item) => item.id === candidate.sourceId);
        const fetched = await fetchText(candidate.url, source && source.timeoutMs ? source.timeoutMs : options.timeoutMs || DEFAULT_TIMEOUT_MS);
        if (!fetched.ok) throw new Error(`${fetched.status} ${candidate.url}`);
        return buildLeadFromArticle(candidate, fetched.text);
      } catch (error) {
        errors.push(`${candidate.url}: ${error.message || String(error)}`);
        return null;
      }
    },
    Number(options.concurrency || process.env.LEAD_CONCURRENCY || DEFAULT_CONCURRENCY),
  );

  const leads = unique(
    articles.filter(Boolean).filter((lead) => filterLead(lead, minScore)),
    (lead) => lead.url,
  ).sort((a, b) => {
    if (b.relevance.score !== a.relevance.score) return b.relevance.score - a.relevance.score;
    return String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
  });

  return {
    leads,
    meta: {
      scannedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      sourceCount: sources.length,
      candidateCount: candidates.length,
      leadCount: leads.length,
      minScore,
      errors,
    },
  };
}

module.exports = {
  fetchExpansionLeads,
};
