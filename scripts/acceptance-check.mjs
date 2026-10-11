// Сквозная проверка сценария приёмки на запущенном сервере (реальный HTTP + реальная БД).
// Использует ТЕСТОВЫЙ токен бота, подпись initData генерируется локально. Реальные токены не нужны.
//
//   TELEGRAM_BOT_TOKEN=<тот же токен, что у сервера> ADMIN_TELEGRAM_IDS=<id админа> \
//   BASE_URL=http://localhost:8000 node scripts/acceptance-check.mjs
//
// Нужен собранный сервер (npm run build): подпись берётся из server/dist.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { signInitData } = require(path.join(root, 'server/dist/auth/telegram-init-data.js'));

const BASE = process.env.BASE_URL ?? 'http://localhost:8000';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = Number((process.env.ADMIN_TELEGRAM_IDS ?? '').split(',')[0]);
if (!TOKEN || !ADMIN_ID) {
  console.error('Задайте TELEGRAM_BOT_TOKEN и ADMIN_TELEGRAM_IDS (те же, что у сервера).');
  process.exit(2);
}
const WORKER_ID = 900_000_000 + (Date.now() % 100_000_000); // новый «сотрудник» на каждый прогон

const auth = (id, name) =>
  'tma ' +
  signInitData(
    { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'acceptance', user: JSON.stringify({ id, first_name: name }) },
    TOKEN,
  );

let failed = 0;
async function call(method, url, as, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { ...(as ? { Authorization: as } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
function check(name, cond, extra) {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${cond ? '' : ' ' + JSON.stringify(extra)}`);
  if (!cond) failed++;
}

const admin = auth(ADMIN_ID, 'Админ');
const worker = auth(WORKER_ID, 'Акмал');

let r = await call('GET', '/health');
check('GET /health → 200', r.status === 200 && r.body.status === 'ok', r);

r = await call('GET', '/api/batches');
check('запрос без initData закрыт (401)', r.status === 401, r);

r = await call('GET', '/api/batches', auth(WORKER_ID, 'Акмал').replace(/.$/, (c) => (c === '0' ? '1' : '0')));
check('initData с испорченной подписью отклонён (401)', r.status === 401, r);

r = await call('GET', '/api/batches', worker);
check('новый сотрудник без разрешения не получает данные (403 ACCESS_PENDING)', r.status === 403 && r.body.code === 'ACCESS_PENDING', r);

r = await call('GET', '/api/staff', admin);
const person = r.body.items?.find((e) => e.telegramId === WORKER_ID);
check('админ видит заявку сотрудника', r.status === 200 && person?.status === 'pending', r);

r = await call('PATCH', `/api/staff/${person.id}`, admin, { status: 'active', role: 'storekeeper' });
check('админ разрешает доступ и назначает роль кладовщика', r.status === 200 && r.body.status === 'active', r);

const code = 'ACC-' + Date.now().toString(36).toUpperCase();
r = await call('POST', '/api/batches', worker, {
  code,
  item: { name: 'Картон пищевой (проверка)', category: 'raw', unit: 'кг' },
  quantity: '420.5',
  supplier: 'Paperline',
});
check('сотрудник принимает партию (201)', r.status === 201 && r.body.currentQuantity === '420.5', r);
const batchId = r.body?.id;

r = await call('POST', '/api/batches', worker, { code, item: { name: 'Картон пищевой (проверка)', category: 'raw', unit: 'кг' }, quantity: 1 });
check('повтор кода партии → 409', r.status === 409 && r.body.code === 'BATCH_CODE_EXISTS', r);

r = await call('POST', '/api/batches', worker, { item: { name: 'Картон пищевой (проверка)', category: 'raw', unit: 'кг' }, quantity: -5 });
check('отрицательное количество → 400', r.status === 400, r);

r = await call('GET', '/api/batches?category=raw&q=' + encodeURIComponent(code), worker);
check('партия видна в категории «Сырьё»', r.status === 200 && r.body.items.some((b) => b.code === code), r);
r = await call('GET', '/api/batches?category=finished&q=' + encodeURIComponent(code), worker);
check('и не видна в «Готовой продукции»', r.status === 200 && r.body.items.length === 0, r);

r = await call('GET', `/api/batches/${batchId}`, worker);
check('история партии: одно движение «Поступление» от сотрудника', r.status === 200 && r.body.movements.length === 1 && r.body.movements[0].type === 'receipt' && r.body.movements[0].employeeName === 'Акмал', r);

r = await call('POST', `/api/batches/${batchId}/movements`, worker, { type: 'writeoff', quantity: '1000', reason: 'Проверка' });
check('списание больше остатка → 409', r.status === 409 && r.body.code === 'INSUFFICIENT_STOCK', r);

r = await call('PATCH', `/api/staff/${person.id}`, admin, { status: 'blocked' });
r = await call('GET', '/api/batches', worker);
check('после блокировки доступ закрыт (403 ACCESS_BLOCKED)', r.status === 403 && r.body.code === 'ACCESS_BLOCKED', r);

console.log(failed ? `\nПровалено проверок: ${failed}` : '\nВсе проверки сценария приёмки пройдены');
process.exit(failed ? 1 : 0);
