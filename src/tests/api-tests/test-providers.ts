// FILE: api/test-providers.ts
// HYDRA v8.0 — AI Provider Configuration Check
// Tests which providers are configured (env vars only — no live API calls)
// For live API key validation, use /api/test-provider-keys
//
// v8.0: Added Kimi K2.6 (Moonshot AI) + Llama 4 (was missing from v7.x)
// Now covers all 10 HYDRA providers.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const allowCors = (fn: Function) => async (req: VercelRequest, res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  return await fn(req, res);
};

// All 10 HYDRA providers in consensus order
const PROVIDERS = [
  // ── PRIMARY VISION (Stage 1) ──────────────────────────────
  {
    name: 'OpenAI',
    stage: 'Primary Vision',
    hydraRole: 'Vision + Reasoning',
    supportsVision: true,
    weight: 1.0,
    env: 'OPENAI_API_KEY',
    altEnv: ['OPEN_AI_API_KEY', 'OPENAI_TOKEN', 'OPEN_AI_TOKEN'],
    model: 'gpt-4o',
    boardMember: 'Legolas (CPA)',
  },
  {
    name: 'Anthropic',
    stage: 'Primary Vision',
    hydraRole: 'Vision + Reasoning',
    supportsVision: true,
    weight: 1.0,
    env: 'ANTHROPIC_API_KEY',
    altEnv: ['ANTHROPIC_SECRET'],
    model: 'claude-sonnet-4-20250514',
    boardMember: 'Cerebro (CTO-AI)',
  },
  {
    name: 'Google',
    stage: 'Primary Vision',
    hydraRole: 'Vision + Speed',
    supportsVision: true,
    weight: 1.0,
    env: 'GOOGLE_AI_API_KEY',
    altEnv: ['GOOGLE_AI_TOKEN', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
    model: 'gemini-2.0-flash',
    boardMember: 'SHA-1 (CPO)',
  },
  {
    name: 'Llama 4',
    stage: 'Primary Vision',
    hydraRole: 'Vision + Open Source',
    supportsVision: true,
    weight: 0.95,
    env: 'GROQ_API_KEY',
    altEnv: [],
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    boardMember: 'Athena (CSO) — open source strategy',
    note: 'Uses GROQ_API_KEY — independent from the Groq provider below',
  },
  {
    name: 'Kimi K2.6',
    stage: 'Primary Vision',
    hydraRole: 'Vision + Long Context + Agent Swarm',
    supportsVision: true,
    weight: 0.90,
    env: 'MOONSHOT_API_KEY',
    altEnv: ['KIMI_API_KEY'],
    model: 'kimi-k2.6',
    boardMember: 'Janus (CIO) — Chinese AI intelligence',
    note: 'New v8.0. 262K context. 80.2 SWE-bench. OpenAI-compatible API.',
  },
  // ── SECONDARY TEXT/REASONING (Stage 2) ───────────────────
  {
    name: 'Mistral',
    stage: 'Secondary',
    hydraRole: 'Text Reasoning',
    supportsVision: false,
    weight: 0.75,
    env: 'MISTRAL_API_KEY',
    altEnv: [],
    model: 'mistral-small-latest',
    boardMember: 'Sentinel (CISO)',
  },
  {
    name: 'Groq (Llama 3)',
    stage: 'Secondary',
    hydraRole: 'Fast Text Inference',
    supportsVision: false,
    weight: 0.75,
    env: 'GROQ_API_KEY',
    altEnv: [],
    model: 'llama-3.3-70b-versatile',
    boardMember: 'Sal (COO) — operational speed',
    note: 'Llama 3 models only. Llama 4 votes separately as its own provider.',
  },
  {
    name: 'xAI Grok',
    stage: 'Secondary',
    hydraRole: 'Real-time Knowledge',
    supportsVision: false,
    weight: 0.80,
    env: 'XAI_API_KEY',
    altEnv: ['XAI_SECRET', 'GROK_API_KEY'],
    model: 'grok-3',
    boardMember: 'Glitch (CMO)',
  },
  {
    name: 'Perplexity',
    stage: 'Secondary',
    hydraRole: 'Market Search + Web',
    supportsVision: false,
    weight: 0.85,
    env: 'PERPLEXITY_API_KEY',
    altEnv: ['PPLX_API_KEY'],
    model: 'sonar',
    boardMember: 'Orion (CKO)',
  },
  // ── TIEBREAKER ────────────────────────────────────────────
  {
    name: 'DeepSeek',
    stage: 'Tiebreaker',
    hydraRole: 'Text Tiebreaker',
    supportsVision: false,
    weight: 0.6,
    env: 'DEEPSEEK_API_KEY',
    altEnv: ['DEEPSEEK_TOKEN'],
    model: 'deepseek-chat',
    boardMember: 'Janus (CIO) — dual with Kimi',
    note: 'Only activates when primary providers disagree.',
  },
];

async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('HYDRA v8.0 provider config check — 10 providers');

  const results = PROVIDERS.map(provider => {
    let configured = !!process.env[provider.env];
    let keyName = provider.env;

    if (!configured && provider.altEnv.length > 0) {
      for (const altKey of provider.altEnv) {
        if (process.env[altKey]) {
          configured = true;
          keyName = altKey;
          break;
        }
      }
    }

    return {
      provider: provider.name,
      stage: provider.stage,
      hydraRole: provider.hydraRole,
      boardMember: provider.boardMember,
      supportsVision: provider.supportsVision,
      consensusWeight: provider.weight,
      primaryModel: provider.model,
      configured,
      keyName: configured ? keyName : null,
      checkedVars: [provider.env, ...provider.altEnv],
      ...(provider.note ? { note: provider.note } : {}),
    };
  });

  const configured = results.filter(r => r.configured);
  const missing = results.filter(r => !r.configured);
  const visionReady = configured.filter(r => r.supportsVision);

  const summary = {
    totalProviders: results.length,
    configured: configured.length,
    missing: missing.length,
    visionProviders: visionReady.length,
    hydraStatus:
      visionReady.length >= 4
        ? 'OPTIMAL — full consensus capability'
        : visionReady.length >= 2
        ? 'DEGRADED — reduced vision consensus'
        : 'CRITICAL — insufficient vision providers',
    missingProviders: missing.map(r => r.provider),
    newInV8: ['Kimi K2.6 (Moonshot AI)'],
  };

  const isProduction =
    req.headers.host?.includes('tagnetiq') ||
    process.env.VERCEL_URL?.includes('tagnetiq');

  return res.status(200).json({
    success: true,
    message: 'HYDRA v8.0 — 10-provider AI consensus engine',
    version: '8.0',
    environment: {
      isProduction,
      host: req.headers.host,
      vercelUrl: process.env.VERCEL_URL,
      nodeEnv: process.env.NODE_ENV,
    },
    summary,
    providers: results,
    stageBreakdown: {
      primaryVision: results.filter(r => r.stage === 'Primary Vision').map(r => r.provider),
      secondary: results.filter(r => r.stage === 'Secondary').map(r => r.provider),
      tiebreaker: results.filter(r => r.stage === 'Tiebreaker').map(r => r.provider),
    },
    timestamp: new Date().toISOString(),
  });
}

export default allowCors(handler);