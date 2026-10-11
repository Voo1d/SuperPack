import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, errorText } from './api';
import { HomeView } from './HomeView';
import { InventoryView } from './InventoryView';
import { ReceiveView } from './ReceiveView';
import { Shell, View } from './Shell';
import { StaffView } from './StaffView';
import { StubView } from './StubView';
import type { Category, Me } from './types';
import { useAsync } from './useAsync';

export interface Focus {
  category: Category;
  batchId: string;
}

function CenterCard(props: { title: string; children: React.ReactNode; retry?: () => void }) {
  return (
    <div className="center-screen">
      <div className="card center-card">
        <div className="brand-mark" style={{ margin: '0 auto 16px', color: '#fff' }}>◈</div>
        <h1>{props.title}</h1>
        <div className="subtitle">{props.children}</div>
        {props.retry && (
          <div className="form-actions" style={{ justifyContent: 'center' }}>
            <button className="button" onClick={props.retry}>Повторить</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function App() {
  const me = useAsync(() => api<Me>('/me'), []);
  const [view, setView] = useState<View>('home');
  const [focus, setFocus] = useState<Focus | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3300);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const go = useCallback((v: View) => {
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  if (me.loading && !me.data) return <CenterCard title="SuperPack">Загрузка…</CenterCard>;
  if (me.error || !me.data) {
    const e = me.error;
    if (e instanceof ApiError && e.status === 401) {
      return <CenterCard title="Откройте из Telegram">{e.message}. Приложение работает только как Telegram Mini App.</CenterCard>;
    }
    return <CenterCard title="Не удалось войти" retry={me.reload}>{errorText(e)}</CenterCard>;
  }

  const user = me.data;
  if (user.status === 'pending') {
    return (
      <CenterCard title="Доступ ожидает подтверждения" retry={me.reload}>
        Администратор ещё не открыл вам доступ. Сообщите ему свой Telegram ID: <strong className="mono">{user.telegramId}</strong>.
      </CenterCard>
    );
  }
  if (user.status === 'blocked') {
    return <CenterCard title="Доступ закрыт">Администратор заблокировал ваш доступ. Обратитесь к нему, если это ошибка.</CenterCard>;
  }

  const canWrite = user.permissions['stock.write'];
  let body: React.ReactNode;
  switch (view) {
    case 'home':
      body = <HomeView me={user} go={go} />;
      break;
    case 'inventory':
      body = <InventoryView canWrite={canWrite} go={go} focus={focus} />;
      break;
    case 'receive':
      body = canWrite ? (
        <ReceiveView
          onDone={(f) => {
            setFocus(f);
            notify(`Партия ${f.code} принята`);
            go('inventory');
          }}
          onCancel={() => go('inventory')}
        />
      ) : (
        <StubView title="Приёмка недоступна" text="Принимать партии могут администратор и кладовщик." />
      );
      break;
    case 'staff':
      body = user.permissions['staff.manage'] ? (
        <StaffView notify={notify} />
      ) : (
        <StubView title="Нет доступа" text="Раздел доступен только администратору." />
      );
      break;
    case 'production':
      body = <StubView title="Производство" text="Выпуск готовой продукции со списанием сырья появится на втором этапе." />;
      break;
    case 'labels':
      body = <StubView title="QR и этикетки" text="Генерация QR и экспорт PDF/PNG появятся на третьем и четвёртом этапах." />;
      break;
    case 'analytics':
      body = <StubView title="Аналитика" text="Отчёты по выпуску и расходу сырья появятся после модуля производства." />;
      break;
  }
  return (
    <Shell me={user} view={view} go={go} toast={toast}>
      {body}
    </Shell>
  );
}
