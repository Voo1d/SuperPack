export function StubView(props: { title: string; text: string }) {
  return (
    <>
      <div className="pagehead">
        <div>
          <p className="eyebrow">РАЗДЕЛ В РАЗРАБОТКЕ</p>
          <h1>{props.title}</h1>
        </div>
      </div>
      <div className="card stub">
        <div className="inv-icon">◫</div>
        <h2>Пока недоступно</h2>
        <p className="subtitle" style={{ marginTop: 8 }}>{props.text}</p>
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>Данные здесь не показываются, пока раздел не подключён к учёту.</p>
      </div>
    </>
  );
}
