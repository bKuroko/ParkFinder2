export default function MetricCard({ label, value, helper, tone = "default", icon: Icon }) {
  return (
    <section className={`metric-card metric-card-${tone}`}>
      {Icon ? (
        <span className="metric-icon" aria-hidden="true">
          <Icon size={34} />
        </span>
      ) : null}
      <div className="metric-copy">
        {Icon ? (
          <span>{label}</span>
        ) : null}
        {!Icon ? <span>{label}</span> : null}
        <strong>{value}</strong>
        <small>{helper || "Current facility"}</small>
      </div>
    </section>
  );
}
