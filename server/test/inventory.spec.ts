import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ADMIN_ID, createTestApp, OUTSIDER_ID, resetDb, STOREKEEPER_ID, tma } from './helpers';

describe('Склад и приёмка', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const admin = () => tma(ADMIN_ID);
  const keeper = () => tma(STOREKEEPER_ID, { firstName: 'Акмал' });

  const carton = { name: 'Картон пищевой', category: 'raw', unit: 'кг' };
  const receive = (body: object, as = keeper()) => http().post('/api/batches').set('Authorization', as).send(body);

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => app.close());
  beforeEach(async () => {
    await resetDb(app);
    await http().post('/api/staff').set('Authorization', admin()).send({ telegramId: STOREKEEPER_ID, displayName: 'Акмал', role: 'storekeeper' }).expect(201);
  });

  it('сценарий приёмки: админ открыл доступ → сотрудник принял партию → она в своей категории с историей', async () => {
    // новый сотрудник сначала без доступа
    await http().get('/api/batches').set('Authorization', tma(OUTSIDER_ID)).expect(403);
    const staff = await http().get('/api/staff').set('Authorization', admin());
    const person = staff.body.items.find((e: { telegramId: number }) => e.telegramId === OUTSIDER_ID);
    await http().patch(`/api/staff/${person.id}`).set('Authorization', admin()).send({ status: 'active', role: 'storekeeper' }).expect(200);

    const created = await receive(
      { code: 'rm-2031', item: carton, receivedAt: '2026-10-11', quantity: '420', supplier: 'Paperline' },
      tma(OUTSIDER_ID, { firstName: 'Зухра' }),
    ).expect(201);
    expect(created.body).toMatchObject({
      code: 'RM-2031',
      category: 'raw',
      unit: 'кг',
      initialQuantity: '420',
      currentQuantity: '420',
      status: 'in_stock',
      supplier: 'Paperline',
    });
    expect(created.body.movements).toHaveLength(1);
    expect(created.body.movements[0]).toMatchObject({ type: 'receipt', delta: '420', balanceAfter: '420', employeeName: 'Зухра' });

    const raw = await http().get('/api/batches?category=raw').set('Authorization', admin()).expect(200);
    expect(raw.body.items.map((b: { code: string }) => b.code)).toEqual(['RM-2031']);
    const finished = await http().get('/api/batches?category=finished').set('Authorization', admin()).expect(200);
    expect(finished.body.items).toEqual([]);

    const detail = await http().get(`/api/batches/${created.body.id}`).set('Authorization', admin()).expect(200);
    expect(detail.body.movements[0].type).toBe('receipt');

    const summary = await http().get('/api/inventory/summary').set('Authorization', admin()).expect(200);
    expect(summary.body.categories).toEqual([
      { category: 'finished', batches: 0, inStock: 0 },
      { category: 'raw', batches: 1, inStock: 1 },
      { category: 'spares', batches: 0, inStock: 0 },
      { category: 'other', batches: 0, inStock: 0 },
    ]);
  });

  it('принимает дробное количество сырья без потери точности', async () => {
    const res = await receive({ item: carton, quantity: '12.345' }).expect(201);
    expect(res.body.currentQuantity).toBe('12.345');
    const res2 = await receive({ item: carton, quantity: 0.1 }).expect(201);
    expect(res2.body.currentQuantity).toBe('0.1');
  });

  it('генерирует коды по категории и не допускает повтора кода (регистр не важен)', async () => {
    const a = await receive({ item: carton, quantity: 1 }).expect(201);
    const b = await receive({ item: carton, quantity: 1 }).expect(201);
    expect([a.body.code, b.body.code]).toEqual(['RM-0001', 'RM-0002']);

    const spare = await receive({ item: { name: 'Ремень привода', category: 'spares', unit: 'шт.' }, quantity: 3 }).expect(201);
    expect(spare.body.code).toBe('SP-0001');

    await receive({ code: 'X-1', item: carton, quantity: 5 }).expect(201);
    const dup = await receive({ code: 'x-1', item: carton, quantity: 7 }).expect(409);
    expect(dup.body.code).toBe('BATCH_CODE_EXISTS');

    // ручной код не ломает автогенерацию
    await receive({ code: 'RM-0003', item: carton, quantity: 1 }).expect(201);
    const next = await receive({ item: carton, quantity: 1 }).expect(201);
    expect(next.body.code).toBe('RM-0004');
  });

  it('повтор кода не оставляет следов: ни партии, ни движения, ни остатка', async () => {
    await receive({ code: 'DUP-1', item: carton, quantity: 5 }).expect(201);
    await receive({ code: 'DUP-1', item: { name: 'Новая позиция', category: 'other', unit: 'шт.' }, quantity: 9 }).expect(409);
    const list = await http().get('/api/batches').set('Authorization', admin()).expect(200);
    expect(list.body.total).toBe(1);
    const items = await http().get('/api/items').set('Authorization', admin()).expect(200);
    expect(items.body.items.map((i: { name: string }) => i.name)).toEqual(['Картон пищевой']);
  });

  it.each([
    ['отрицательное', -5],
    ['нулевое', 0],
    ['«0.000»', '0.000'],
    ['текст', 'много'],
    ['пустое', ''],
    ['слишком точное', '1.2345'],
    ['научная запись', 1e21],
    ['null', null],
  ])('отклоняет %s количество', async (_name, quantity) => {
    const res = await receive({ item: carton, quantity }).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const list = await http().get('/api/batches').set('Authorization', admin());
    expect(list.body.total).toBe(0);
  });

  it('штучные единицы требуют целого количества', async () => {
    const item = { name: 'Подшипник', category: 'spares', unit: 'шт.' };
    const res = await receive({ item, quantity: '2.5' }).expect(400);
    expect(res.body.issues[0].path).toBe('quantity');
    await receive({ item, quantity: '3.000' }).expect(201);
  });

  it('валидирует категорию, единицу, код, дату и лишнее', async () => {
    await receive({ item: { ...carton, category: 'food' }, quantity: 1 }).expect(400);
    await receive({ item: { ...carton, unit: 'пуд' }, quantity: 1 }).expect(400);
    await receive({ item: { name: 'x', category: 'raw', unit: 'кг' }, quantity: 1 }).expect(400);
    await receive({ code: 'плохой код!', item: carton, quantity: 1 }).expect(400);
    await receive({ item: carton, quantity: 1, receivedAt: '2026-02-31' }).expect(400);
    await receive({ item: carton, quantity: 1, receivedAt: '2999-01-01' }).expect(400);
    await receive({ quantity: 1 }).expect(400);
  });

  it('позиция с другой единицей не подменяется молча', async () => {
    await receive({ item: carton, quantity: 1 }).expect(201);
    const res = await receive({ item: { ...carton, name: 'картон ПИЩЕВОЙ', unit: 'м' }, quantity: 1 }).expect(409);
    expect(res.body.code).toBe('ITEM_UNIT_MISMATCH');
    // то же имя в другой единице-регистре — та же позиция
    const ok = await receive({ item: { ...carton, name: 'картон ПИЩЕВОЙ' }, quantity: 1 }).expect(201);
    const items = await http().get('/api/items').set('Authorization', admin());
    expect(items.body.items).toHaveLength(1);
    expect(ok.body.itemName).toBe('Картон пищевой');
  });

  it('выбор существующей позиции по id', async () => {
    const first = await receive({ item: carton, quantity: 1 }).expect(201);
    const second = await receive({ item: { id: first.body.itemId }, quantity: 2 }).expect(201);
    expect(second.body.itemId).toBe(first.body.itemId);
    await receive({ item: { id: '00000000-0000-4000-8000-000000000000' }, quantity: 2 }).expect(404);
  });

  it('списание создаёт движение, остаток не уходит в минус', async () => {
    const batch = (await receive({ item: carton, quantity: 100 }).expect(201)).body;
    const move = (body: object) => http().post(`/api/batches/${batch.id}/movements`).set('Authorization', keeper()).send(body);

    const ok = await move({ type: 'writeoff', quantity: '40.5', reason: 'В выпуск FG-1024' }).expect(201);
    expect(ok.body.currentQuantity).toBe('59.5');
    expect(ok.body.movements[0]).toMatchObject({ type: 'writeoff', delta: '-40.5', balanceAfter: '59.5', reason: 'В выпуск FG-1024' });

    const over = await move({ type: 'writeoff', quantity: '59.501', reason: 'Слишком много' }).expect(409);
    expect(over.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', available: '59.5' });

    await move({ type: 'writeoff', quantity: -1, reason: 'Минус' }).expect(400);
    await move({ type: 'writeoff', quantity: 1 }).expect(400); // причина обязательна

    const after = await http().get(`/api/batches/${batch.id}`).set('Authorization', admin());
    expect(after.body.currentQuantity).toBe('59.5');
    expect(after.body.movements).toHaveLength(2); // приход + одно списание; неудачные попытки не оставили следов

    await move({ type: 'writeoff', quantity: '59.5', reason: 'Всё' }).expect(201);
    const empty = await http().get(`/api/batches/${batch.id}`).set('Authorization', admin());
    expect(empty.body).toMatchObject({ currentQuantity: '0', status: 'depleted' });
    const stocked = await http().get('/api/batches?inStock=true').set('Authorization', admin());
    expect(stocked.body.items).toEqual([]);
  });

  it('исправление — отдельная операция, история сохраняется', async () => {
    const batch = (await receive({ item: carton, quantity: 10 }).expect(201)).body;
    const fix = await http()
      .post(`/api/batches/${batch.id}/movements`)
      .set('Authorization', keeper())
      .send({ type: 'correction', delta: '-2', reason: 'Ошибка при вводе' })
      .expect(201);
    expect(fix.body.currentQuantity).toBe('8');
    expect(fix.body.initialQuantity).toBe('10');
    expect(fix.body.movements.map((m: { type: string }) => m.type)).toEqual(['correction', 'receipt']);
    await http().post(`/api/batches/${batch.id}/movements`).set('Authorization', keeper()).send({ type: 'correction', delta: '-9', reason: 'Слишком много' }).expect(409);
    await http().post(`/api/batches/${batch.id}/movements`).set('Authorization', keeper()).send({ type: 'correction', delta: 0, reason: 'Ноль' }).expect(400);
  });

  it('параллельные списания не создают отрицательный остаток', async () => {
    const batch = (await receive({ item: carton, quantity: 100 }).expect(201)).body;
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        http().post(`/api/batches/${batch.id}/movements`).set('Authorization', keeper()).send({ type: 'writeoff', quantity: 30, reason: 'Гонка' }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    const after = await http().get(`/api/batches/${batch.id}`).set('Authorization', admin());
    expect(after.body.currentQuantity).toBe('10');
  });

  it('фильтры: поиск по названию и коду, остаток, пагинация', async () => {
    await receive({ code: 'RM-1', item: carton, quantity: 5, receivedAt: '2026-10-01' }).expect(201);
    await receive({ code: 'RM-2', item: { name: 'Клей пищевой', category: 'raw', unit: 'кг' }, quantity: 5, receivedAt: '2026-10-02' }).expect(201);
    const codes = async (qs: string) => (await http().get(`/api/batches?${qs}`).set('Authorization', admin()).expect(200)).body.items.map((b: { code: string }) => b.code);
    expect(await codes('')).toEqual(['RM-2', 'RM-1']); // новые сверху
    expect(await codes('q=клей')).toEqual(['RM-2']);
    expect(await codes('q=rm-1')).toEqual(['RM-1']);
    expect(await codes('q=%25')).toEqual([]); // спецсимвол LIKE не работает как маска
    expect(await codes('limit=1&offset=1')).toEqual(['RM-1']);
    await http().get('/api/batches?category=bad').set('Authorization', admin()).expect(400);
    await http().get('/api/batches/not-a-uuid').set('Authorization', admin()).expect(400);
    await http().get('/api/batches/00000000-0000-4000-8000-000000000000').set('Authorization', admin()).expect(404);
  });

  it('все четыре категории принимаются и хранятся отдельно', async () => {
    const defs = [
      ['finished', 'Бумажные стаканы', 'шт.'],
      ['raw', 'Картон', 'кг'],
      ['spares', 'Ремень', 'шт.'],
      ['other', 'Перчатки', 'пар'],
    ] as const;
    for (const [category, name, unit] of defs) {
      await receive({ item: { name, category, unit }, quantity: 4 }).expect(201);
    }
    for (const [category, name] of defs) {
      const r = await http().get(`/api/batches?category=${category}`).set('Authorization', admin());
      expect(r.body.items.map((b: { itemName: string }) => b.itemName)).toEqual([name]);
    }
  });
});
