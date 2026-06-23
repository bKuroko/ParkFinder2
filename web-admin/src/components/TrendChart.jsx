export default function TrendChart({ history }) {
  const ordered = [...history].reverse();
  const points = ordered.map((item, index) => {
    const x = ordered.length <= 1 ? 0 : (index / (ordered.length - 1)) * 100;
    const y = 100 - item.occupancy_percentage;
    return `${x},${y}`;
  });

  return (
    <div className="trend-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Occupancy trend">
        <polyline points={points.join(" ")} fill="none" stroke="#276749" strokeWidth="3" />
      </svg>
      <div className="trend-axis">
        <span>Earlier</span>
        <span>Now</span>
      </div>
    </div>
  );
}
