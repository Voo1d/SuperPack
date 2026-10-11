import { FormEvent, useState } from 'react';
import { api, errorText } from './api';
import { formatDateTime, initials, ROLE_LABELS, STATUS_LABELS } from './labels';
import type { AccessStatus, Employee, Role } from './types';
import { useAsync } from './useAsync';

const ROLES = Object.keys(ROLE_LABELS) as Role[];

function Person(props: { e: Employee; isMe: boolean; busy: boolean; onPatch: (id: string, patch: Partial<{ role: Role; status: AccessStatus }>) => void }) {
  const { e } = props;
  const locked = e.protected || props.isMe;
  return (
    <div className="card staff-card">
      <div className="avatar">{initials(e.displayName)}</div>
      <div className="staff-info">
        <strong>{e.displayName}</strong>
        <small>
          {e.username ? `@${e.username} · ` : ''}Telegram ID <span className="mono">{e.telegramId}</span>
          {e.lastLoginAt ? ` · вход ${formatDateTime(e.lastLoginAt)}` : ''}
        </small>
      </div>
      {locked ? (
        <span className="chip">{e.protected ? 'Админ (сервер)' : 'Это вы'}</span>
      ) : (
        <>
          <select className="inline-select" aria-label={`Роль: ${e.displayName}`} value={e.role} disabled={props.busy} onChange={(ev) => props.onPatch(e.id, { role: ev.target.value as Role })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          {e.status === 'active' ? (
            <button className="button small" disabled={props.busy} onClick={() => props.onPatch(e.id, { status: 'blocked' })}>Заблокировать</button>
          ) : (
            <button className="button small primary" disabled={props.busy} onClick={() => props.onPatch(e.id, { status: 'active' })}>
              {e.status === 'pending' ? 'Разрешить' : 'Вернуть доступ'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function StaffView(props: { notify: (t: string) => void }) {
  const staff = useAsync(() => api<{ items: Employee[] }>('/staff'), []);
  const me = useAsync(() => api<{ id: string }>('/me'), []);
  const [busy, setBusy] = useState(false);
  const [tgId, setTgId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('storekeeper');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function patch(id: string, body: Partial<{ role: Role; status: AccessStatus }>) {
    setBusy(true);
    setActionError(null);
    try {
      await api(`/staff/${id}`, { method: 'PATCH', body });
      props.notify(body.status === 'active' ? 'Доступ разрешён' : body.status === 'blocked' ? 'Доступ заблокирован' : 'Роль изменена');
      staff.reload();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function add(ev: FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!/^\d{1,15}$/.test(tgId.trim())) {
      setFormError('Telegram ID — число, например 146205921.');
      return;
    }
    setBusy(true);
    try {
      await api('/staff', { method: 'POST', body: { telegramId: tgId.trim(), displayName: name.trim(), role } });
      props.notify('Сотрудник добавлен с открытым доступом');
      setTgId('');
      setName('');
      staff.reload();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const list = staff.data?.items ?? [];
  const pending = list.filter((e) => e.status === 'pending');
  const others = list.filter((e) => e.status !== 'pending');

  return (
    <>
      <div className="pagehead">
        <div>
          <p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p>
          <h1>Доступ сотрудников</h1>
          <p className="subtitle">Вход возможен только по подписанным данным Telegram и после вашего разрешения.</p>
        </div>
      </div>
      {staff.error ? <div className="error-box">{errorText(staff.error)}</div> : null}
      {actionError && <div className="error-box" role="alert">{actionError}</div>}
      <div className="columns">
        <div>
          <div className="section-row" style={{ marginTop: 0 }}>
            <h2>Ожидают доступа</h2>
            <span className={'chip' + (pending.length ? ' warn' : ' neutral')}>{pending.length}</span>
          </div>
          <div className="staff-list">
            {pending.map((e) => <Person key={e.id} e={e} isMe={e.id === me.data?.id} busy={busy} onPatch={patch} />)}
            {!pending.length && <div className="card panel muted" style={{ fontSize: 13 }}>Заявок нет. Новый сотрудник появится здесь, когда впервые откроет приложение.</div>}
          </div>

          <div className="section-row"><h2>Добавить по Telegram ID</h2></div>
          <form className="card form-card" onSubmit={add}>
            <div className="form-two">
              <label className="field">Telegram ID<input value={tgId} onChange={(e) => setTgId(e.target.value)} inputMode="numeric" placeholder="146205921" required /></label>
              <label className="field">Имя<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required /></label>
            </div>
            <label className="field">Роль
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
            </label>
            {formError && <div className="error-box" role="alert">{formError}</div>}
            <button className="button primary" type="submit" disabled={busy}>Добавить и разрешить доступ</button>
          </form>
        </div>
        <div>
          <div className="section-row" style={{ marginTop: 0 }}>
            <h2>Сотрудники</h2>
            <span className="chip neutral">{others.length}</span>
          </div>
          <div className="staff-list">
            {others.map((e) => (
              <div key={e.id}>
                <Person e={e} isMe={e.id === me.data?.id} busy={busy} onPatch={patch} />
                {e.status === 'blocked' && <small className="muted" style={{ marginLeft: 8 }}>{STATUS_LABELS.blocked}</small>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
