const DEFAULT_BASE_URL = 'http://ollama:11434';
const DEFAULT_MODEL = 'llama3.2:3b';
const DEFAULT_TIMEOUT_MS = 5000;

function getTimeout(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(20000, Math.max(500, Math.floor(parsed))) : DEFAULT_TIMEOUT_MS;
}

function trimText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

/**
 * Validate the only model output the API is allowed to return.
 * The model never receives permission to execute an action; it can only
 * explain already-computed deterministic facts.
 */
export function parseBriefing(value) {
  let parsed = value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text || text.startsWith('```')) return null;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const briefingKeys = Object.keys(parsed);
  if (briefingKeys.length !== 2 || !briefingKeys.includes('summary') || !briefingKeys.includes('actions')) {
    return null;
  }
  const summary = trimText(parsed.summary, 1200);
  if (!summary || !Array.isArray(parsed.actions) || parsed.actions.length > 5) return null;

  const actions = [];
  for (const action of parsed.actions) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
    const actionKeys = Object.keys(action);
    if (actionKeys.length !== 3
      || !actionKeys.includes('title')
      || !actionKeys.includes('reason')
      || !actionKeys.includes('priority')) return null;
    const priority = action.priority;
    if (!['low', 'medium', 'high'].includes(priority)) return null;
    const title = trimText(action.title, 160);
    const reason = trimText(action.reason, 500);
    if (!title || !reason) return null;
    actions.push({ title, reason, priority });
  }
  return { summary, actions };
}

export function buildFallbackBriefing(facts = {}) {
  const inventoryActions = Array.isArray(facts.inventoryActions) ? facts.inventoryActions : [];
  const forecast = Array.isArray(facts.forecast) ? facts.forecast : [];
  const priceSuggestions = Array.isArray(facts.priceSuggestions) ? facts.priceSuggestions : [];
  const combos = Array.isArray(facts.combos) ? facts.combos : [];
  const urgent = inventoryActions.filter((item) => ['stockout', 'critical'].includes(item.status));
  const changes = priceSuggestions.filter((item) => item.action !== 'hold');
  const summaryParts = [];
  if (urgent.length > 0) summaryParts.push(`${urgent.length} inventory action${urgent.length === 1 ? '' : 's'} need attention`);
  if (forecast.length > 0) summaryParts.push(`${forecast.length} menu forecasts are available`);
  if (changes.length > 0) summaryParts.push(`${changes.length} guarded price signal${changes.length === 1 ? '' : 's'} are available`);
  if (summaryParts.length === 0) summaryParts.push('No urgent analytics actions were found');

  const actions = [];
  for (const item of urgent.slice(0, 3)) {
    actions.push({
      title: `Review ${item.name} inventory`,
      reason: item.reason,
      priority: item.status === 'stockout' ? 'high' : 'medium',
    });
  }
  if (changes.length > 0 && actions.length < 5) {
    actions.push({
      title: 'Review guarded menu price signals',
      reason: 'These are advisory signals only and require Manager approval before any menu edit.',
      priority: 'low',
    });
  }
  if (combos.length > 0 && actions.length < 5) {
    actions.push({
      title: 'Consider a basket-tested combo',
      reason: 'The combo list is based on completed-order co-occurrence, not a model-generated action.',
      priority: 'low',
    });
  }
  return {
    summary: `${summaryParts.join('; ')}.`,
    actions,
  };
}

function buildPrompt(facts) {
  const safeFacts = {
    locationId: facts.locationId ?? null,
    windowDays: facts.windowDays,
    horizonDays: facts.horizonDays,
    forecast: Array.isArray(facts.forecast) ? facts.forecast.slice(0, 20) : [],
    inventoryActions: Array.isArray(facts.inventoryActions) ? facts.inventoryActions.slice(0, 20) : [],
    combos: Array.isArray(facts.combos) ? facts.combos.slice(0, 10) : [],
    priceSuggestions: Array.isArray(facts.priceSuggestions) ? facts.priceSuggestions.slice(0, 20) : [],
    staffing: Array.isArray(facts.staffing) ? facts.staffing.slice(0, 20) : [],
  };
  return [
    'You are a café operations assistant. Summarize the supplied deterministic facts.',
    'Do not invent numbers, do not give legal or financial advice, and do not propose database changes.',
    'Return JSON only with exactly this shape: {"summary":"string","actions":[{"title":"string","reason":"string","priority":"low|medium|high"}]}.',
    'Actions are advisory and must refer only to the supplied facts.',
    JSON.stringify(safeFacts),
  ].join('\n');
}

/**
 * Create a small Ollama client. fetchImpl is injectable so tests never need a
 * live model or network access.
 */
export function createOllamaClient(config = {}) {
  const baseUrl = String(config.baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = String(config.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL);
  const timeoutMs = getTimeout(config.timeoutMs || process.env.OLLAMA_TIMEOUT_MS);
  const fetchImpl = config.fetchImpl || globalThis.fetch;
  const enabled = config.enabled !== undefined
    ? Boolean(config.enabled)
    : config.fetchImpl !== undefined
      ? true
      : process.env.OLLAMA_ENABLED === 'true';

  async function generateBriefing(facts) {
    const fallback = buildFallbackBriefing(facts);
    if (!enabled || typeof fetchImpl !== 'function') return { ...fallback, source: 'deterministic-fallback' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: buildPrompt(facts),
          stream: false,
          format: 'json',
          options: { temperature: 0 },
        }),
        signal: controller.signal,
      });
      if (!response.ok) return { ...fallback, source: 'deterministic-fallback' };
      const payload = await response.json();
      const validated = parseBriefing(payload?.response);
      return validated
        ? { ...validated, source: 'ollama' }
        : { ...fallback, source: 'deterministic-fallback' };
    } catch (error) {
      return { ...fallback, source: 'deterministic-fallback' };
    } finally {
      clearTimeout(timer);
    }
  }

  return { generateBriefing };
}
