import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  isPositive?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 96,
  height = 24,
  isPositive = true,
}) => {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="bg-broadsheet-rule/10 rounded" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const drawHeight = height - padding * 2;
  const drawWidth = width;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * drawWidth;
      const y = height - padding - ((val - min) / range) * drawHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const strokeColor = isPositive ? '#15803d' : '#b91c1c'; // Green or Red

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible inline-block align-middle"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};
