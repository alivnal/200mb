'use client';

import * as React from 'react';
import { useInView, useStillness } from './iso/react/live';

type DamStage = 0 | 1 | 2 | 3;
type Point3 = [number, number, number];
type Palette = { top: string; x: string; y: string };

const STAGES = [0, 1, 2, 3] as const;
const WIDTH = 640;
const HEIGHT = 320;

const SOIL: Palette = { top: '#78934a', x: '#456b42', y: '#547b43' };
const EDGE_SOIL: Palette = { top: '#668345', x: '#3e6340', y: '#4b7041' };
const BASE: Palette = { top: '#394e45', x: '#263d3b', y: '#304542' };
const LOG: Palette = { top: '#c58a4e', x: '#74452f', y: '#94603a' };
const STONE: Palette = { top: '#a8b6a1', x: '#586d69', y: '#72857b' };
const MUD: Palette = { top: '#8c6740', x: '#57432f', y: '#705238' };

const project = ([x, y, z]: Point3): [number, number] => [
  Math.round(320 + (x - y) * 15),
  Math.round(160 + (x + y) * 8 - z * 12),
];

const pointString = (points: Point3[]) =>
  points
    .map((point) => project(point).join(','))
    .join(' ');

function PixelBox({
  x,
  y,
  z,
  w,
  d,
  h,
  palette,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  palette: Palette;
}) {
  const top: Point3[] = [
    [x, y, z + h],
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ];
  const front: Point3[] = [
    [x, y + d, z],
    [x + w, y + d, z],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ];
  const side: Point3[] = [
    [x + w, y, z],
    [x + w, y + d, z],
    [x + w, y + d, z + h],
    [x + w, y, z + h],
  ];

  return (
    <g>
      <polygon points={pointString(front)} fill={palette.y} />
      <polygon points={pointString(side)} fill={palette.x} />
      <polygon points={pointString(top)} fill={palette.top} />
    </g>
  );
}

function PixelTop({ x, y, z, fill }: { x: number; y: number; z: number; fill: string }) {
  return (
    <polygon
      points={pointString([
        [x, y, z],
        [x + 1, y, z],
        [x + 1, y + 1, z],
        [x, y + 1, z],
      ])}
      fill={fill}
    />
  );
}

function Waterfall() {
  const y = 6.02;
  const top = 0.08;
  const bottom = -25;
  const left = -4;
  const width = 8;
  const streaks = Array.from({ length: 17 }, (_, index) => ({
    x: left + 0.08 + index * 0.46,
    z: top - (index % 3) * 0.2,
  }));

  return (
    <g className="pixel-waterfall" data-step="1" aria-hidden="true">
      <polygon
        points={pointString([
          [left, y, top],
          [left + width, y, top],
          [left + width, y, bottom],
          [left, y, bottom],
        ])}
        fill="#258fa8"
        opacity="0.9"
      />
      {streaks.map(({ x }, index) => (
        <polygon
          key={`waterfall-column-${index}`}
          points={pointString([
            [x, y + 0.015, top],
            [x + 0.2, y + 0.015, top],
            [x + 0.2, y + 0.015, bottom],
            [x, y + 0.015, bottom],
          ])}
          fill={index % 2 ? '#38a8b8' : '#4bb6c1'}
        />
      ))}
      {streaks.map(({ x, z }, index) => {
        const [px, py] = project([x, y + 0.015, z]);
        return (
          <g
            key={`waterfall-flow-${index}`}
            className="pixel-waterfall-flow"
            style={{ animationDelay: `${index * 130}ms` }}
          >
            <rect x={px} y={py} width={index % 2 ? 4 : 5} height="12" fill="#57c0c9" />
            <rect x={px + 5} y={py + 4} width="3" height="8" fill="#b4e4d8" />
          </g>
        );
      })}
      {streaks.map(({ x }, index) => {
        const [px, py] = project([x + 0.12, y + 0.02, bottom]);
        return <rect key={`waterfall-splash-${index}`} x={px} y={py} width="5" height="3" fill="#b4e4d8" />;
      })}
    </g>
  );
}

function BankTree({ x, y, z, id }: { x: number; y: number; z: number; id: string }) {
  const [sx, sy] = project([x, y, z]);
  return (
    <g transform={`translate(${sx} ${sy})`} shapeRendering="crispEdges">
      <rect x="-3" y="-24" width="9" height="24" fill="#765038" />
      <rect x="-9" y="-30" width="9" height="9" fill="#456b3e" />
      <rect x="0" y="-36" width="12" height="12" fill="#6e9649" />
      <rect x="9" y="-30" width="9" height="9" fill="#4c763e" />
      <rect x="-3" y="-39" width="9" height="9" fill="#86a64b" />
      <rect x="-12" y="-21" width="6" height="6" fill="#789a4b" />
      <rect x="9" y="-21" width="6" height="6" fill="#719144" />
      <rect x="0" y="-27" width="6" height="6" fill="#a0b855" />
      <title>{id}</title>
    </g>
  );
}

function StreamScene({ stage }: { stage: DamStage }) {
  const channelBounds = (y: number) => (y >= 3 ? [-4, 4] : y >= 1 ? [-3, 3] : [-2, 2]);
  const bankTiles = Array.from({ length: 20 * 12 }, (_, index) => {
    const x = -10 + (index % 20);
    const y = -6 + Math.floor(index / 20);
    return { x, y };
  })
    .filter(({ x, y }) => {
      const [left, right] = channelBounds(y);
      return x < left || x >= right;
    })
    .sort((left, right) => left.x + left.y - (right.x + right.y));

  const waterTiles = Array.from({ length: 12 }, (_, row) => {
    const y = -6 + row;
    const [left, right] = channelBounds(y);
    return Array.from({ length: right - left }, (_, column) => ({ x: left + column, y }));
  })
    .flat()
    .sort((left, right) => left.x + left.y - (right.x + right.y));

  return (
    <>
      <PixelBox x={-10} y={-6} z={-1} w={20} d={12} h={1} palette={BASE} />
      <g className="pixel-land">
        {bankTiles.map(({ x, y }) => (
          <PixelBox
            key={`bank-${x}-${y}`}
            x={x}
            y={y}
            z={0}
            w={1}
            d={1}
            h={0.82}
            palette={(x + y) % 3 === 0 ? EDGE_SOIL : SOIL}
          />
        ))}
      </g>
      <g className="pixel-water">
        {waterTiles.map(({ x, y }) => (
          <PixelTop key={`water-${x}-${y}`} x={x} y={y} z={0.08} fill="#389bb2" />
        ))}
        {[
          [-1.55, -5.2], [0.45, -4.2], [-0.55, -3.1], [0.55, -2.1],
          [-1.45, -1], [0.45, 0], [-0.55, 1], [0.55, 2],
          [-1.45, 3], [0.45, 4.2], [-3.4, 3.6], [2.8, 4.5],
          [-2.5, 5.4], [1.8, 5.1],
        ].map(([x, y], index) => {
          const [px, py] = project([x, y, 0.1]);
          return (
            <rect
              key={`water-glint-${index}`}
              className="pixel-water-glint"
              x={px}
              y={py}
              width="4"
              height="3"
              fill={index % 2 ? '#a7d7bf' : '#76c4c2'}
              style={{ animationDelay: `${index * 110}ms` }}
            />
          );
        })}
      </g>
      <g className="pixel-stones">
        {[
          [-2.35, 4.7], [1.35, 3.3], [-2.25, -2.4], [1.5, -4.6],
          [-5.2, 0.8], [5.2, -0.3],
        ].map(([x, y], index) => (
          <PixelBox
            key={`stone-${index}`}
            x={x}
            y={y}
            z={0.08}
            w={0.48}
            d={0.38}
            h={0.18}
            palette={STONE}
          />
        ))}
      </g>
      <g className="pixel-bank-plants">
        <BankTree x={-3.45} y={-4.2} z={0.85} id="willow-back" />
        <BankTree x={3.1} y={-3.8} z={0.85} id="willow-front" />
        <BankTree x={-8.3} y={1.8} z={0.85} id="left-bank" />
        <BankTree x={7.2} y={-1.8} z={0.85} id="right-bank" />
        <BankTree x={-7.4} y={-3.3} z={0.85} id="far-bank" />
        <BankTree x={7.3} y={3.2} z={0.85} id="near-bank" />
        {[
          [-8.6, 0.1], [-7.2, 2.7], [-5.1, -4.6], [-3.55, -3.2],
          [2.15, -4.5], [4.2, -2.8], [7.1, -0.2], [7.7, 2.6],
        ].map(([x, y], index) => {
          const [px, py] = project([x, y, 0.9]);
          return (
            <g key={`reed-${index}`}>
              <rect x={px} y={py - 15} width="3" height="18" fill="#79994b" />
              <rect x={px - 6} y={py - 11} width="3" height="12" fill="#96ad51" />
              <rect x={px + 6} y={py - 13} width="3" height="14" fill="#587b43" />
            </g>
          );
        })}
      </g>
      <g className="pixel-upstream-pool" data-step="2">
        {[
          [-2, -6], [1, -6], [-2, -5], [1, -5], [-2, -4], [1, -4],
          [-2, -3], [1, -3], [-2, -2], [1, -2], [-2, -1], [1, -1],
        ].map(([x, y], index) => (
          <PixelTop key={`pool-wide-${index}`} x={x} y={y} z={0.095} fill="#4eafc1" />
        ))}
      </g>
      <g className="pixel-upstream-pool" data-step="3">
        {[
          [-2, 0], [1, 0],
        ].map(([x, y], index) => (
          <PixelTop key={`pool-full-${index}`} x={x} y={y} z={0.1} fill="#4eafc1" />
        ))}
      </g>
      <g className="pixel-branch-pile" data-step="0">
        {[
          [-1.7, 1.8], [-0.9, 2.1], [0.4, 1.9], [1.2, 2.2],
        ].map(([dx, dy], index) => (
          <g key={`loose-branch-${index}`} transform={`translate(${project([dx, dy, 0.12]).join(' ')})`}>
            <rect x="-5" y="0" width={index % 2 ? 16 : 20} height="4" fill={index % 2 ? '#c48b4d' : '#9a6339'} />
          </g>
        ))}
      </g>
      <g className="pixel-dam-foundation" data-step="1">
        {[-2, -1, 0, 1].map((x) => (
          <PixelBox
            key={`dam-base-${x}`}
            x={x}
            y={-0.28}
            z={0.2}
            w={1}
            d={0.48}
            h={0.34}
            palette={LOG}
          />
        ))}
      </g>
      <g className="pixel-dam-weave" data-step="2">
        {[-1.6, -0.65, 0.3, 1.25].map((x, index) => (
          <PixelBox
            key={`dam-cross-${index}`}
            x={x}
            y={-0.62}
            z={0.5}
            w={0.28}
            d={1.12}
            h={0.32}
            palette={LOG}
          />
        ))}
        {[-2, -1, 0, 1].map((x) => (
          <PixelBox
            key={`dam-upper-${x}`}
            x={x}
            y={0.08}
            z={0.83}
            w={1}
            d={0.3}
            h={0.28}
            palette={LOG}
          />
        ))}
      </g>
      <g className="pixel-dam-mud" data-step="3">
        {[-1.8, -1.1, -0.4, 0.3, 1].map((x, index) => (
          <PixelBox
            key={`mud-${index}`}
            x={x}
            y={-0.22}
            z={1.08}
            w={0.44}
            d={0.24}
            h={0.22}
            palette={MUD}
          />
        ))}
      </g>
      <Waterfall />
      <g className="pixel-waterline" data-step="1" aria-hidden="true">
        {[-1.35, -0.2, 0.95].map((x, index) => {
          const [px, py] = project([x, -0.8, 0.22]);
          return <rect key={`waterline-${index}`} x={px} y={py} width="6" height="3" fill="#d1eac6" />;
        })}
      </g>
    </>
  );
}

export default function DamEnvironment() {
  const still = useStillness();
  const [stage, setStage] = React.useState<DamStage>(0);
  const root = React.useRef<HTMLDivElement | null>(null);
  const visible = useInView(root);

  React.useEffect(() => {
    if (!visible || still) return;
    const timer = window.setInterval(() => {
      setStage((current) => ((current + 1) % STAGES.length) as DamStage);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [still, visible]);

  return (
    <div ref={root} className="dam-environment" aria-hidden="true">
      <svg
        className="dam-pixel-svg dam-environment-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        data-stage={stage}
        shapeRendering="crispEdges"
        focusable="false"
      >
        <StreamScene stage={stage} />
      </svg>
    </div>
  );
}
