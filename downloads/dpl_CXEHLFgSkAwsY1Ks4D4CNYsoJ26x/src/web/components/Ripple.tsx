/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface RippleProps {
  size?: number;
  className?: string;
}

export default function Ripple({ size = 300, className = '' }: RippleProps) {
  const rings = [1, 0.82, 0.64, 0.46];

  return (
    <div
      className={`pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={{ width: size, height: size }}
    >
      {rings.map((scale, i) => (
        <span
          key={i}
          className="ripple-ring absolute inset-0 rounded-full border border-primary/25"
          style={{
            transform: `scale(${scale})`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}
