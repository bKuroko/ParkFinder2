export default function TrendChart({ history }) {
  const ordered = [...history].reverse();
  const points = ordered.map((item, index) => {
    const x = ordered.length <= 1 ? 0 : (index / (ordered.length - 1)) * 100;
    const y = 100 - item.occupancy_percentage;
    return `${x},${y}`;
  });
  const areaPoints = points.length ? `0,100 ${points.join(" ")} 100,100` : "";
  const latest = ordered.at(-1);
  const peak = ordered.reduce(
    (max, item) => Math.max(max, Number(item.occupancy_percentage || 0)),
    0
  );

  if (!ordered.length) {
    return (
      <div className="trend-empty">
        <strong>No occupancy samples yet</strong>
        <span>AI updates will appear here after the first detection cycle.</span>
      </div>
    );
  }

  return (
    <div className="trend-chart">
      <div className="trend-body">
        <div className="trend-y-axis">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Occupancy trend">
          <defs>
            <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#14a45f" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#14a45f" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#trendFill)" />
          <polyline points={points.join(" ")} fill="none" stroke="#087d30" strokeWidth="3" />
          {points.map((point) => {
            const [cx, cy] = point.split(",");
            return <circle cx={cx} cy={cy} fill="#ffffff" key={point} r="2.1" stroke="#087d30" strokeWidth="1.4" />;
          })}
        </svg>
      </div>
      <div className="trend-axis">
        <span>Earlier</span>
        <strong>{latest?.occupancy_percentage ?? 0}% now</strong>
        <span>{peak}% peak</span>
      </div>
    </div>
  );
}
