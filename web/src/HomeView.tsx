import { api, errorText } from './api';
import { CATEGORIES, CATEGORY_LABELS } from './labels';
import type { View } from './Shell';
import type { Category, Me } from './types';
import { useAsync } from './useAsync';

interface Summary {
  categories: { category: Category; batches: number; inStock: number }[];
}

export function HomeView(props: { me: Me; go: (v: View) => void }) {
  const summary = useAsync(() => api<Summary>('/inventory/summary'), []);
  const total = summary.data?.categories.reduce((s, c) => s + c.inStock, 0) ?? 0;
  return (
    <>
      <div className="pagehead">
        <div>
          <p className="eyebrow">ОБЗОР СКЛАДА</p>
          <h1>Здравствуйте, {props.me.displayName.split(' ')[0]}</h1>
          <p className="subtitle">Сводка строится из реальных партий на складе.</p>
        </div>
        {props.me.permissions['stock.write'] && (
          <button className="button primary" onClick={() => props.go('receive')}>＋ Новое поступление</button>
        )}
      </div>
      {summary.error ? <div className="error-box">{errorText(summary.error)}</div> : null}
      <div className="grid four">
        {CATEGORIES.map((c) => {
          const s = summary.data?.categories.find((x) => x.category === c);
          return (
            <div className="card stat" key={c}>
              <div className="stat-top">{CATEGORY_LABELS[c]}</div>
              <div>
                <div className="metric">{s ? s.inStock : '—'}</div>
                <div className="stat-foot">{s ? `партий с остатком · всего ${s.batches}` : 'загрузка…'}</div>
              </div>
            </div>
          );
        })}
      </div>
      {summary.data && total === 0 && (
        <div className="note" style={{ marginTop: 16 }}>
          На складе пока нет партий. {props.me.permissions['stock.write'] ? 'Начните с приёмки первой партии.' : 'Партии появятся после приёмки кладовщиком.'}
        </div>
      )}
      <div className="section-row"><h2>Быстрый доступ</h2></div>
      <div className="inventory-cards">
        <button className="card inv-card" onClick={() => props.go('inventory')}>
          <span className="inv-icon">◫</span>
          <span className="inv-info"><strong>Склад и партии</strong><small>Остатки по категориям, история</small></span>
          <span className="chevron">›</span>
        </button>
        {props.me.permissions['stock.write'] && (
          <button className="card inv-card" onClick={() => props.go('receive')}>
            <span className="inv-icon">▣</span>
            <span className="inv-info"><strong>Приёмка партии</strong><small>Поступление сырья, запчастей и прочего</small></span>
            <span className="chevron">›</span>
          </button>
        )}
      </div>
      <p className="footer-note">Производство, QR и аналитика подключатся на следующих этапах.</p>
    </>
  );
}
