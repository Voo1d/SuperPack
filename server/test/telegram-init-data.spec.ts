import { InitDataError, signInitData, verifyInitData } from '../src/auth/telegram-init-data';

const TOKEN = '123456:TEST-TOKEN-NOT-REAL';
const NOW = 1_800_000_000;
const user = JSON.stringify({ id: 555, first_name: 'Акмал', username: 'akmal' });
const fields = (over: Record<string, string> = {}) => ({ auth_date: String(NOW - 10), query_id: 'q1', user, ...over });
const verify = (initData: string | undefined, token = TOKEN, maxAge = 3600) =>
  verifyInitData(initData, token, { maxAgeSeconds: maxAge, now: NOW });
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof InitDataError ? e.code : `other:${String(e)}`;
  }
  return 'no-error';
};

describe('verifyInitData', () => {
  it('принимает корректно подписанные данные и берёт ID из подписанного user', () => {
    const r = verify(signInitData(fields(), TOKEN));
    expect(r.user).toEqual({ id: 555, firstName: 'Акмал', lastName: undefined, username: 'akmal' });
    expect(r.authDate).toBe(NOW - 10);
  });

  it('отклоняет пустые данные', () => {
    expect(codeOf(() => verify(undefined))).toBe('INIT_DATA_MISSING');
    expect(codeOf(() => verify('  '))).toBe('INIT_DATA_MISSING');
  });

  it('отклоняет данные без hash или с мусорным hash', () => {
    expect(codeOf(() => verify('auth_date=1&user=%7B%7D'))).toBe('INIT_DATA_MALFORMED');
    expect(codeOf(() => verify('auth_date=1&hash=zzz'))).toBe('INIT_DATA_MALFORMED');
  });

  it('отклоняет подпись другого бота', () => {
    expect(codeOf(() => verify(signInitData(fields(), '999:OTHER-TOKEN')))).toBe('INIT_DATA_BAD_SIGNATURE');
  });

  it('отклоняет подмену user.id после подписи (поддельный Telegram ID)', () => {
    const signed = new URLSearchParams(signInitData(fields(), TOKEN));
    signed.set('user', JSON.stringify({ id: 1, first_name: 'Админ' }));
    expect(codeOf(() => verify(signed.toString()))).toBe('INIT_DATA_BAD_SIGNATURE');
  });

  it('отклоняет подмену auth_date и добавление полей', () => {
    const a = new URLSearchParams(signInitData(fields(), TOKEN));
    a.set('auth_date', String(NOW));
    expect(codeOf(() => verify(a.toString()))).toBe('INIT_DATA_BAD_SIGNATURE');
    const b = new URLSearchParams(signInitData(fields(), TOKEN));
    b.set('start_param', 'x');
    expect(codeOf(() => verify(b.toString()))).toBe('INIT_DATA_BAD_SIGNATURE');
  });

  it('отклоняет устаревшие данные', () => {
    const old = signInitData(fields({ auth_date: String(NOW - 7200) }), TOKEN);
    expect(codeOf(() => verify(old, TOKEN, 3600))).toBe('INIT_DATA_EXPIRED');
    expect(codeOf(() => verify(old, TOKEN, 86400))).toBe('no-error');
  });

  it('отклоняет auth_date из будущего', () => {
    expect(codeOf(() => verify(signInitData(fields({ auth_date: String(NOW + 600) }), TOKEN)))).toBe('INIT_DATA_FROM_FUTURE');
  });

  it('отклоняет корректную подпись без пользователя, с битым JSON, ботом и невалидным id', () => {
    const noUser = { auth_date: String(NOW), query_id: 'q' };
    expect(codeOf(() => verify(signInitData(noUser, TOKEN)))).toBe('INIT_DATA_MALFORMED');
    expect(codeOf(() => verify(signInitData(fields({ user: '{oops' }), TOKEN)))).toBe('INIT_DATA_MALFORMED');
    expect(codeOf(() => verify(signInitData(fields({ user: JSON.stringify({ id: 5, is_bot: true }) }), TOKEN)))).toBe('INIT_DATA_MALFORMED');
    expect(codeOf(() => verify(signInitData(fields({ user: JSON.stringify({ id: '5' }) }), TOKEN)))).toBe('INIT_DATA_MALFORMED');
    expect(codeOf(() => verify(signInitData(fields({ user: JSON.stringify({ id: -5 }) }), TOKEN)))).toBe('INIT_DATA_MALFORMED');
  });

  it('отклоняет слишком длинные данные', () => {
    expect(codeOf(() => verify('a'.repeat(9000)))).toBe('INIT_DATA_MALFORMED');
  });
});
