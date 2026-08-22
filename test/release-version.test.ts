import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { DashboardAPI } from '../src/api';
import type { Env } from '../src/index';
import { RELEASE_VERSION } from '../src/version';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const dashboardHtml = readFileSync(new URL('../dashboard/index.html', import.meta.url), 'utf8');

function seededConfigVersion(): string {
  const match = schemaSql.match(/VALUES \('version', '([^']+)'/);
  if (!match) throw new Error('schema.sql does not seed bot_config.version');
  return match[1];
}

describe('release version contract', () => {
  test('deployable metadata, config seed, runtime health, and dashboard footer agree', async () => {
    expect(RELEASE_VERSION).toBe('2.6.0');
    expect(packageJson.version).toBe(RELEASE_VERSION);
    expect(seededConfigVersion()).toBe(RELEASE_VERSION);
    expect(dashboardHtml).toContain(`canonical-release-version: ${RELEASE_VERSION}`);
    expect(dashboardHtml).toContain(`Alpaca AI Trading Bot v${RELEASE_VERSION}`);

    const response = await new DashboardAPI({} as Env).handle(new Request('https://bot.example/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ok',
      service: 'alpaca-trading-bot',
      version: RELEASE_VERSION,
    });
  });
});
