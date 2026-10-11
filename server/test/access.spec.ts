import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ADMIN_ID, createTestApp, OUTSIDER_ID, resetDb, STOREKEEPER_ID, tma } from './helpers';

describe('Доступ сотрудников', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => app.close());
  beforeEach(async () => resetDb(app));

  it('/health открыт без авторизации', async () => {
    const res = await http().get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('запросы без Authorization закрыты', async () => {
    await http().get('/api/batches').expect(401);
    await http().get('/api/me').expect(401);
    await http().get('/api/staff').expect(401);
  });

  it('подделанный initData (чужой токен, подмена ID, мусор) отклоняется', async () => {
    const forged = await http().get('/api/me').set('Authorization', tma(ADMIN_ID, { token: '999:ATTACKER' })).expect(401);
    expect(forged.body.code).toBe('INIT_DATA_BAD_SIGNATURE');

    // подпись выпущена для обычного пользователя, user.id заменён на ID администратора
    const initData = new URLSearchParams(tma(OUTSIDER_ID).slice(4));
    initData.set('user', JSON.stringify({ id: ADMIN_ID, first_name: 'Админ' }));
    await http().get('/api/me').set('Authorization', `tma ${initData.toString()}`).expect(401);

    await http().get('/api/me').set('Authorization', 'tma garbage').expect(401);
    await http().get('/api/me').set('Authorization', 'Bearer abc').expect(401);
  });

  it('устаревший initData отклоняется', async () => {
    const old = Math.floor(Date.now() / 1000) - 3 * 86400;
    const res = await http().get('/api/me').set('Authorization', tma(ADMIN_ID, { authDate: old })).expect(401);
    expect(res.body.code).toBe('INIT_DATA_EXPIRED');
  });

  it('неизвестный сотрудник получает статус «ожидает» и не видит данные', async () => {
    const me = await http().get('/api/me').set('Authorization', tma(OUTSIDER_ID)).expect(200);
    expect(me.body).toMatchObject({ telegramId: OUTSIDER_ID, status: 'pending', role: 'viewer' });
    expect(me.body.permissions['stock.read']).toBe(false);

    const res = await http().get('/api/batches').set('Authorization', tma(OUTSIDER_ID)).expect(403);
    expect(res.body.code).toBe('ACCESS_PENDING');
    await http().post('/api/batches').set('Authorization', tma(OUTSIDER_ID)).send({}).expect(403);
    await http().get('/api/staff').set('Authorization', tma(OUTSIDER_ID)).expect(403);
  });

  it('администратор из окружения получает роль admin сразу', async () => {
    const me = await http().get('/api/me').set('Authorization', tma(ADMIN_ID)).expect(200);
    expect(me.body).toMatchObject({ role: 'admin', status: 'active' });
    await http().get('/api/staff').set('Authorization', tma(ADMIN_ID)).expect(200);
  });

  it('админ разрешает, назначает роль и блокирует сотрудника', async () => {
    await http().get('/api/me').set('Authorization', tma(STOREKEEPER_ID, { firstName: 'Акмал' }));
    const admin = tma(ADMIN_ID);

    const list = await http().get('/api/staff').set('Authorization', admin).expect(200);
    const pending = list.body.items.find((e: { telegramId: number }) => e.telegramId === STOREKEEPER_ID);
    expect(pending).toMatchObject({ status: 'pending', displayName: 'Акмал' });

    await http().patch(`/api/staff/${pending.id}`).set('Authorization', admin).send({ status: 'active', role: 'storekeeper' }).expect(200);
    await http().get('/api/batches').set('Authorization', tma(STOREKEEPER_ID)).expect(200);

    // блокировка немедленно закрывает доступ
    await http().patch(`/api/staff/${pending.id}`).set('Authorization', admin).send({ status: 'blocked' }).expect(200);
    const blocked = await http().get('/api/batches').set('Authorization', tma(STOREKEEPER_ID)).expect(403);
    expect(blocked.body.code).toBe('ACCESS_BLOCKED');
  });

  it('сотрудник без прав admin не управляет доступом', async () => {
    const admin = tma(ADMIN_ID);
    const created = await http()
      .post('/api/staff')
      .set('Authorization', admin)
      .send({ telegramId: STOREKEEPER_ID, displayName: 'Акмал', role: 'storekeeper' })
      .expect(201);
    expect(created.body.status).toBe('active');
    await http().get('/api/staff').set('Authorization', tma(STOREKEEPER_ID)).expect(403);
    await http().patch(`/api/staff/${created.body.id}`).set('Authorization', tma(STOREKEEPER_ID)).send({ role: 'admin' }).expect(403);
  });

  it('нельзя завести дубликат Telegram ID и запретить самому себе доступ', async () => {
    const admin = tma(ADMIN_ID);
    await http().post('/api/staff').set('Authorization', admin).send({ telegramId: STOREKEEPER_ID, displayName: 'А' }).expect(201);
    await http().post('/api/staff').set('Authorization', admin).send({ telegramId: STOREKEEPER_ID, displayName: 'Б' }).expect(409);
    await http().post('/api/staff').set('Authorization', admin).send({ telegramId: 'abc', displayName: 'Б' }).expect(400);

    const me = await http().get('/api/me').set('Authorization', admin);
    await http().patch(`/api/staff/${me.body.id}`).set('Authorization', admin).send({ status: 'blocked' }).expect(409);
  });

  it('роль viewer читает склад, но не принимает партии', async () => {
    const admin = tma(ADMIN_ID);
    await http().post('/api/staff').set('Authorization', admin).send({ telegramId: OUTSIDER_ID, displayName: 'Малика', role: 'viewer' }).expect(201);
    await http().get('/api/batches').set('Authorization', tma(OUTSIDER_ID)).expect(200);
    const res = await http()
      .post('/api/batches')
      .set('Authorization', tma(OUTSIDER_ID))
      .send({ item: { name: 'Картон', category: 'raw', unit: 'кг' }, quantity: 5 })
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

describe('Dev-режим', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp({ devAuth: { telegramId: 4242, name: 'Dev' }, adminTelegramIds: [4242], botToken: undefined });
  });
  afterAll(async () => app.close());

  it('без заголовка работает только как серверный DEV_TELEGRAM_ID', async () => {
    const res = await request(app.getHttpServer()).get('/api/me').expect(200);
    expect(res.body).toMatchObject({ telegramId: 4242, role: 'admin' });
  });

  it('клиент не может выбрать другой ID: посторонние заголовки игнорируются, tma без токена отвергается', async () => {
    const res = await request(app.getHttpServer()).get('/api/me').set('X-Telegram-Id', '1').set('X-Dev-User', '1').expect(200);
    expect(res.body.telegramId).toBe(4242);
    await request(app.getHttpServer()).get('/api/me').set('Authorization', tma(1)).expect(401);
  });
});

describe('Без dev-режима и без initData доступ закрыт', () => {
  it('нет «тихого» dev-пользователя', async () => {
    const app = await createTestApp();
    await request(app.getHttpServer()).get('/api/me').set('X-Dev-User', '1000001').expect(401);
    await app.close();
  });
});
