export default function MetricCard({ label, value, helper, tone = "default" }) {
  return (
    <section className={`metric-card metric-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </section>
  );
}
