import { useEffect, useState } from 'react';
import type { Focus } from './App';
import { api, errorText } from './api';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  formatDate,
  formatDateTime,
  formatDelta,
  formatQty,
  MOVEMENT_LABELS,
} from './labels';
import type { View } from './Shell';
import type { Batch, BatchDetail, Category } from './types';
import { useAsync } from './useAsync';

interface Summary {
  categories: { category: Category; batches: number; inStock: number }[];
}

const ICON = { receipt: '↓', writeoff: '↗', correction: '≋' } as const;
const ICON_CLASS = { receipt: 'blue', writeoff: 'amber', correction: 'purple' } as const;

export function InventoryView(props: { canWrite: boolean; go: (v: View) => void; focus?: Focus }) {
  const [category, setCategory] = useState<Category>(props.focus?.category ?? 'finished');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [inStock, setInStock] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>(props.focus?.batchId);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput.trim()), 250);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const summary = useAsync(() => api<Summary>('/inventory/summary'), []);
  const list = useAsync(() => {
    const p = new URLSearchParams({ category, limit: '200' });
    if (q) p.set('q', q);
    if (inStock) p.set('inStock', 'true');
    return api<{ items: Batch[]; total: number }>('/batches?' + p);
  }, [category, q, inStock]);

  const rows = list.data?.items ?? [];
  // Выбираем первую партию списка, если выбранной в нём нет (кроме момента, пока список грузится).
  useEffect(() => {
    if (list.loading || !list.data) return;
    if (!rows.some((b) => b.id === selectedId)) setSelectedId(rows[0]?.id);
  }, [list.loading, list.data, rows, selectedId]);

  const detail = useAsync(() => (selectedId ? api<BatchDetail>('/batches/' + selectedId) : Promise.resolve(undefined)), [selectedId]);
  const batch = detail.data;
  const count = (c: Category) => summary.data?.categories.find((x) => x.category === c);

  return (
    <>
      <div className="pagehead">
        <div>
          <p className="eyebrow">СКЛАД</p>
          <h1>Склад и партии</h1>
          <p className="subtitle">Остатки по категориям и партиям с датами поступления и историей движений.</p>
        </div>
        {props.canWrite && (
          <button className="button primary" onClick={() => props.go('receive')}>＋ Новое поступление</button>
        )}
      </div>

      <div className="category-tabs" role="tablist" aria-label="Категории склада">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            className={category === c ? 'active' : ''}
            onClick={() => {
              setCategory(c);
              setQInput('');
            }}
          >
            {CATEGORY_LABELS[c]}
            {count(c) ? ` · ${count(c)!.inStock}` : ''}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Поиск по названию или номеру партии"
          aria-label="Поиск партий"
        />
        <select aria-label="Состояние партии" value={inStock ? 'stock' : 'all'} onChange={(e) => setInStock(e.target.value === 'stock')}>
          <option value="stock">Только с остатком</option>
          <option value="all">Все, включая закончившиеся</option>
        </select>
      </div>

      {list.error ? <div className="error-box">{errorText(list.error)} <button className="link" onClick={list.reload}>Повторить</button></div> : null}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Наименование / партия</th><th>Поступило</th><th>Остаток</th><th>Статус</th><th>Действие</th></tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className={'tr-click' + (b.id === selectedId ? ' tr-selected' : '')} onClick={() => setSelectedId(b.id)}>
                <td><strong>{b.itemName}</strong><small>{b.code}</small></td>
                <td>{formatDate(b.receivedAt)}</td>
                <td><strong className="mono">{formatQty(b.currentQuantity)} {b.unit}</strong></td>
                <td><span className={'chip' + (b.status === 'depleted' ? ' neutral' : '')}>{b.status === 'depleted' ? 'Закончилась' : 'В наличии'}</span></td>
                <td><button className="table-action" onClick={() => setSelectedId(b.id)}>История →</button></td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5}>
                  {list.loading ? 'Загрузка…' : q || !inStock ? 'Партии не найдены. Измените поиск или фильтр.' : `В категории «${CATEGORY_LABELS[category]}» пока нет партий.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section-row"><h2>История партии</h2></div>
      {batch ? (
        <>
          <div className="card item-hero">
            <div>
              <span className="chip blue">{CATEGORY_LABELS[batch.category]}</span>
              <h2 style={{ marginTop: 11 }}>{batch.itemName} · {batch.code}</h2>
              <p>
                {batch.category === 'finished' ? 'Выпущена' : 'Поступила'} {formatDate(batch.receivedAt)}
                {batch.supplier ? ` · Источник: ${batch.supplier}` : ''} · Остаток: <strong>{formatQty(batch.currentQuantity)} {batch.unit}</strong>
                {' '}из {formatQty(batch.initialQuantity)} {batch.unit}
              </p>
              {batch.note && <p style={{ marginTop: 6 }}>Примечание: {batch.note}</p>}
            </div>
          </div>
          <div className="card panel" style={{ marginTop: 12 }}>
            <div className="rows">
              {batch.movements.map((m) => (
                <div className="row" key={m.id}>
                  <span className={'iconbox ' + ICON_CLASS[m.type]}>{ICON[m.type]}</span>
                  <div className="row-main">
                    <strong>{MOVEMENT_LABELS[m.type]}: {formatDelta(m.delta)} {batch.unit}</strong>
                    <small>
                      {formatDateTime(m.createdAt)} · {m.employeeName}
                      {m.reason && m.type !== 'receipt' ? ` · ${m.reason}` : ''}
                      {m.reference ? ` · ${m.reference}` : ''}
                    </small>
                  </div>
                  <div className="row-right mono">{formatQty(m.balanceAfter)} {batch.unit}<small>остаток после</small></div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card panel">
          <p className="subtitle">{detail.loading ? 'Загрузка…' : 'Выберите партию в таблице, чтобы увидеть историю движений.'}</p>
        </div>
      )}
      {detail.error ? <div className="error-box">{errorText(detail.error)}</div> : null}
    </>
  );
}
