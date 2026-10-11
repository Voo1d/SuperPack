import { loadConfig } from '../src/config';

const base = { DATABASE_URL: 'postgres://x', TELEGRAM_BOT_TOKEN: 't' };

describe('loadConfig', () => {
  it('читает значения по умолчанию', () => {
    const c = loadConfig({ ...base, ADMIN_TELEGRAM_IDS: '1, 2' });
    expect(c.port).toBe(8000);
    expect(c.adminTelegramIds).toEqual([1, 2]);
    expect(c.devAuth).toBeNull();
  });

  it('требует токен бота, если DEV_AUTH не включён', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgres://x' })).toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('DEV_AUTH запрещён в production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', DEV_AUTH: 'true', DEV_TELEGRAM_ID: '5' })).toThrow(/production/);
  });

  it('DEV_AUTH требует серверный DEV_TELEGRAM_ID', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgres://x', DEV_AUTH: 'true' })).toThrow(/DEV_TELEGRAM_ID/);
    const c = loadConfig({ DATABASE_URL: 'postgres://x', DEV_AUTH: 'true', DEV_TELEGRAM_ID: '77' });
    expect(c.devAuth).toEqual({ telegramId: 77, name: 'Dev User' });
  });

  it('пустые значения из .env.example считаются незаданными', () => {
    const c = loadConfig({ ...base, DEV_AUTH: '', DEV_TELEGRAM_ID: '', ADMIN_TELEGRAM_IDS: '', PORT: '' });
    expect(c.devAuth).toBeNull();
    expect(c.port).toBe(8000);
    expect(c.adminTelegramIds).toEqual([]);
  });

  it('отвергает некорректные ADMIN_TELEGRAM_IDS', () => {
    expect(() => loadConfig({ ...base, ADMIN_TELEGRAM_IDS: 'abc' })).toThrow(/ADMIN_TELEGRAM_IDS/);
  });
});
