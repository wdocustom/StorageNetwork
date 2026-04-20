// ═══════════════════════════════════════════════════════════════════════════
// Bot Detection — User-agent patterns for known bots, crawlers, and scrapers
// ═══════════════════════════════════════════════════════════════════════════

const BOT_PATTERNS: RegExp[] = [
  // Search engine crawlers
  /googlebot/i, /bingbot/i, /yandexbot/i, /baiduspider/i,
  /duckduckbot/i, /slurp/i, /ia_archiver/i,

  // Social media crawlers
  /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /whatsapp/i, /telegrambot/i, /discordbot/i, /pinterestbot/i,
  /slackbot/i, /redditbot/i,

  // SEO / analytics bots
  /semrushbot/i, /ahrefsbot/i, /mj12bot/i, /dotbot/i,
  /rogerbot/i, /screaming frog/i, /majestic/i,

  // AI crawlers
  /gptbot/i, /claudebot/i, /anthropic-ai/i, /perplexitybot/i,
  /ccbot/i, /chatgpt-user/i, /cohere-ai/i, /google-extended/i,

  // Performance / monitoring tools
  /lighthouse/i, /pagespeed/i, /gtmetrix/i, /pingdom/i,
  /uptimerobot/i, /statuscake/i, /site24x7/i,

  // Headless browsers / automation
  /headlesschrome/i, /phantomjs/i, /selenium/i, /puppeteer/i,
  /playwright/i, /webdriver/i,

  // CLI / library user agents
  /curl\//i, /wget\//i, /python-requests/i, /httpx/i,
  /aiohttp/i, /go-http-client/i, /java\//i, /axios\//i,
  /node-fetch/i, /undici/i, /libwww-perl/i,

  // Generic patterns
  /bot\b/i, /crawl/i, /spider/i, /scrape/i, /mediapartners/i,

  // Misc known bots
  /petalbot/i, /bytespider/i, /applebot/i, /archive\.org_bot/i,
  /dataforseobot/i, /zoominfobot/i,
];

/**
 * Returns true if the user-agent string matches known bot patterns.
 */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}
