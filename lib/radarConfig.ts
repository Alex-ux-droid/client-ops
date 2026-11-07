// Напрямки AI-радару і джерела (без ШІ — просто довідник)
export const RADAR_AREAS = {
  creatives: { label: "Креативи", ico: "sparkles", focus: "генерація фото і відео для реклами, монтаж, моушен: Midjourney, Higgsfield, Runway, Kling, Veo, Sora, CapCut, Canva AI, інструменти Meta для креативів" },
  agents: { label: "Агенти і LLM", ico: "zap", focus: "нові моделі й можливості Claude, ChatGPT, Gemini; агенти, MCP, скіли, памʼять, computer use — що з цього вже готове для бізнесу" },
  automation: { label: "Автоматизація бізнесу", ico: "layers", focus: "CRM, чат-боти, AI в продажах і підтримці, n8n/Make/Zapier, інтеграції, AI-аналітика для малого бізнесу" },
  voice: { label: "Голос і дзвінки", ico: "phone", focus: "голосові агенти й AI-дзвінки, розпізнавання і синтез мовлення (ElevenLabs та інші), аналіз дзвінків менеджерів, телефонія з AI" },
  dev: { label: "Розробка", ico: "wrench", focus: "Claude Code, vibe-coding, нові інструменти розробника, деплой, бази, швидке створення внутрішніх програм" },
  ads: { label: "Реклама Meta", ico: "megaphone", focus: "Meta Ads: Advantage+, Andromeda, нові формати, правила і вимоги, лід-форми, Conversions API, що змінилось у налаштуванні кампаній" },
} as const;
export type RadarArea = keyof typeof RADAR_AREAS;
export const isArea = (a: string): a is RadarArea => a in RADAR_AREAS;

export const RADAR_SOURCES_DEFAULT = `Anthropic News і Engineering — anthropic.com/news, anthropic.com/engineering
Claude release notes — docs.claude.com (release notes)
OpenAI News — openai.com/news
Google DeepMind / Gemini — blog.google/technology/ai
Meta for Business — facebook.com/business/news
Simon Willison — simonwillison.net
Latent Space — latent.space
Ben's Bites — bensbites.com
TLDR AI — tldr.tech/ai
Product Hunt (AI) — producthunt.com
Hugging Face — huggingface.co/blog
n8n — blog.n8n.io
ElevenLabs — elevenlabs.io/blog
Midjourney updates — updates.midjourney.com
Higgsfield — higgsfield.ai/blog
Runway — runwayml.com/news`;
