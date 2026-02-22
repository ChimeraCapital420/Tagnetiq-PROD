// FILE: api/boardroom/lib/provider-caller/towers.ts
// ═══════════════════════════════════════════════════════════════════════
// LOCAL GPU TOWER HEALTH CHECKS
// ═══════════════════════════════════════════════════════════════════════
//
// Checks if local Ollama/vLLM towers are reachable.
// Used by sandbox orchestrator to route jobs to available towers.
//
// ═══════════════════════════════════════════════════════════════════════

import { fetchWithTimeout } from './utils.js';
import type { TowerHealthResult } from './types.js';

/**
 * Check if a local tower is reachable.
 * Used by sandbox orchestrator to route jobs to available towers.
 */
export async function checkTowerHealth(towerId: string): Promise<TowerHealthResult> {
  const envPrefix = towerId.toUpperCase().replace(/-/g, '_');
  const ip = process.env[`${envPrefix}_IP`] || '192.168.1.101';
  const port = process.env[`${envPrefix}_PORT`] || '11434';
  const start = Date.now();

  try {
    const response = await fetchWithTimeout(
      `http://${ip}:${port}/api/tags`,
      { method: 'GET' },
      5000,
    );
    const data = await response.json();
    const models = data.models?.map((m: any) => m.name) || [];

    return {
      reachable: true,
      responseTime: Date.now() - start,
      models,
    };
  } catch (err: any) {
    return {
      reachable: false,
      responseTime: Date.now() - start,
      error: err.message,
    };
  }
}

/**
 * Check all configured local towers.
 */
export async function checkAllTowers(): Promise<Record<string, TowerHealthResult>> {
  const results: Record<string, TowerHealthResult> = {};
  const towerEnvs = Object.keys(process.env).filter(k => k.match(/^LOCAL_TOWER_\d+_IP$/));

  for (const envKey of towerEnvs) {
    const towerId = envKey.replace('_IP', '').toLowerCase();
    results[towerId] = await checkTowerHealth(towerId);
  }

  // Also check default tower if no numbered towers found
  if (towerEnvs.length === 0 && process.env.LOCAL_TOWER_IP) {
    results['local_tower_1'] = await checkTowerHealth('local_tower_1');
  }

  return results;
}