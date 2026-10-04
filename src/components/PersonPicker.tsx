import { useData } from "../data";

export function PersonPicker({ onDone }: { onDone: () => void }) {
  const { people, me, setMe } = useData();
  return (
    <div className="overlay">
      <div className="sheet picker">
        <h2>Who's this?</h2>
        <p className="muted">Pick yourself so your points and ideas are yours. This browser will remember.</p>
        <div className="picker-options">
          {people.map((p) => (
            <button
              key={p.id}
              className={`picker-option ${me?.id === p.id ? "selected" : ""}`}
              style={{ borderColor: p.color }}
              onClick={() => {
                setMe(p.id);
                onDone();
              }}
            >
              <span className="avatar" style={{ background: p.color }}>
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              {p.name}
            </button>
          ))}
        </div>
        {me && (
          <button className="btn ghost" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
