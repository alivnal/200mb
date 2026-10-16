/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function CircularProgress({
  value,
  size = 480,
  strokeWidth = 2,
  className = '',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <svg
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-md ${className}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke="transparent"
        strokeWidth={strokeWidth}
      />
      <circle
        className="progress-ring-circle text-accent"
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
}
