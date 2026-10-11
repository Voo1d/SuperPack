import { FormEvent, useMemo, useState } from 'react';
import { api, ApiError, errorText } from './api';
import { CATEGORIES, CATEGORY_LABELS, INTEGER_UNITS, todayLocal, UNITS_FALLBACK } from './labels';
import type { BatchDetail, Category, Item } from './types';
import { useAsync } from './useAsync';

export function ReceiveView(props: { onDone: (f: { category: Category; batchId: string; code: string }) => void; onCancel: () => void }) {
  const [category, setCategory] = useState<Category>('raw');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('кг');
  const [code, setCode] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [quantity, setQuantity] = useState('');
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = useAsync(() => api<{ units: string[] }>('/meta'), []);
  const known = useAsync(() => api<{ items: Item[] }>('/items?category=' + category), [category]);
  const units = meta.data?.units ?? UNITS_FALLBACK;
  // Если название совпало с существующей позицией, единица берётся от неё: у позиции она одна.
  const existing = useMemo(
    () => known.data?.items.find((i) => i.name.trim().toLowerCase() === name.trim().toLowerCase()),
    [known.data, name],
  );
  const effectiveUnit = existing ? existing.unit : unit;
  const integerOnly = INTEGER_UNITS.includes(effectiveUnit);
  const qty = quantity.trim().replace(',', '.');
  const qtyOk = /^\d{1,12}(\.\d{1,3})?$/.test(qty) && Number(qty) > 0 && (!integerOnly || /^\d+(\.0+)?$/.test(qty));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!qtyOk) {
      setError(integerOnly ? 'Количество должно быть целым числом больше нуля.' : 'Количество — число больше нуля, не более трёх знаков после запятой.');
      return;
    }
    setBusy(true);
    try {
      const created = await api<BatchDetail>('/batches', {
        method: 'POST',
        body: {
          code: code.trim() || undefined,
          item: existing ? { id: existing.id } : { name: name.trim(), category, unit },
          receivedAt: date,
          quantity: qty,
          supplier: supplier.trim() || undefined,
          note: note.trim() || undefined,
        },
      });
      props.onDone({ category: created.category, batchId: created.id, code: created.code });
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'BATCH_CODE_EXISTS' ? 'Партия с таким кодом уже есть. Укажите другой код или оставьте поле пустым.' : errorText(err));
      setBusy(false);
    }
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <p className="eyebrow">СКЛАД</p>
          <h1>Приёмка партии</h1>
          <p className="subtitle">Партия, остаток и первое движение «Поступление» сохраняются одной операцией.</p>
        </div>
      </div>
      <form className="card form-card" onSubmit={submit} style={{ maxWidth: 760 }}>
        <h2>Данные поступления</h2>
        <p>Выберите категорию и введите наименование. Если такая позиция уже есть, она будет использована, а единица измерения подставится автоматически.</p>

        <label className="field">
          Категория
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>

        <div className="form-two">
          <label className="field">
            Наименование
            <input list="known-items" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={160} placeholder="Например, картон пищевой" />
            <datalist id="known-items">{known.data?.items.map((i) => <option key={i.id} value={i.name} />)}</datalist>
            {existing && <small>Существующая позиция · единица «{existing.unit}»</small>}
          </label>
          <label className="field">
            Единица измерения
            <select value={effectiveUnit} onChange={(e) => setUnit(e.target.value)} disabled={!!existing}>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <small>{integerOnly ? 'Только целые количества.' : 'Допустимы дробные количества.'}</small>
          </label>
        </div>

        <div className="form-two">
          <label className="field">
            Количество, {effectiveUnit}
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" required placeholder={integerOnly ? '12' : '420 или 12,5'} />
          </label>
          <label className="field">
            Дата поступления
            <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>

        <div className="form-two">
          <label className="field">
            Код партии
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} placeholder="Пусто — присвоится автоматически" />
            <small>Латиница, цифры, «-». Код уникален.</small>
          </label>
          <label className="field">
            Поставщик / источник
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={160} placeholder="Необязательно" />
          </label>
        </div>

        <label className="field">
          Примечание
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Необязательно" />
        </label>

        {error && <div className="error-box" role="alert">{error}</div>}

        <div className="form-actions">
          <button className="button primary" type="submit" disabled={busy || !name.trim()}>{busy ? 'Сохраняем…' : 'Принять партию'}</button>
          <button className="button" type="button" onClick={props.onCancel} disabled={busy}>Отмена</button>
        </div>
      </form>
    </>
  );
}
