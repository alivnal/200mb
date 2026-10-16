/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { forwardRef } from 'react';
import { CELEBRATE_CONFETTI } from './poseAnimations';
import type { PixelBeaverRefs } from './pixelBeaverTypes';

export function createPixelBeaverRefs(): PixelBeaverRefs {
  return {
    root: React.createRef(),
    body: React.createRef(),
    head: React.createRef(),
    eyesOpen: React.createRef(),
    eyesClosed: React.createRef(),
    tail: React.createRef(),
    leftArm: React.createRef(),
    rightArm: React.createRef(),
    legs: React.createRef(),
    block: React.createRef(),
    wrench: React.createRef(),
    file: React.createRef(),
    errorMark: React.createRef(),
    questionMark: React.createRef(),
    zzz: React.createRef(),
    confetti: React.createRef(),
  };
}

interface PixelBeaverRigProps {
  refs: PixelBeaverRefs;
  size?: number;
  className?: string;
}

const PixelBeaverRig = forwardRef<SVGSVGElement, PixelBeaverRigProps>(function PixelBeaverRig(
  { refs, size = 96, className = '' },
  svgRef,
) {
  return (
    <svg
      ref={svgRef}
      className={`pixel-mascot block ${className}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden
    >
      <g ref={refs.root}>
        <g ref={refs.confetti} opacity={0}>
          {CELEBRATE_CONFETTI.map((piece, i) => (
            <rect
              key={i}
              data-confetti={i}
              x={piece.x}
              y={piece.y}
              width={piece.w}
              height={piece.h}
              fill={piece.color}
              transform={`rotate(${piece.rotation} ${piece.x + piece.w / 2} ${piece.y + piece.h / 2})`}
            />
          ))}
        </g>

        <g ref={refs.zzz} opacity={0}>
          <rect data-zzz="0" x="28" y="4" width="2" height="2" className="fill-beaver-blue-dark" />
          <rect data-zzz="1" x="30" y="2" width="2" height="2" className="fill-beaver-blue-dark" />
          <rect data-zzz="2" x="32" y="0" width="2" height="2" className="fill-beaver-blue-light" />
          <rect x="34" y="2" width="2" height="2" className="fill-beaver-blue-light" />
        </g>

        <g ref={refs.errorMark} opacity={0}>
          <rect x="31" y="3" width="6" height="2" className="fill-error" />
          <rect x="33" y="1" width="2" height="6" className="fill-error" />
        </g>

        <g ref={refs.questionMark} opacity={0}>
          <rect x="35" y="2" width="2" height="2" className="fill-beaver-blue-dark" />
          <rect x="35" y="5" width="2" height="2" className="fill-beaver-blue-dark" />
          <rect x="35" y="9" width="2" height="2" className="fill-beaver-blue-dark" />
        </g>

        <g ref={refs.tail} style={{ transformOrigin: '8px 34px' }}>
          <rect x="1" y="27" width="10" height="3" className="fill-beaver-blue-dark" />
          <rect x="0" y="30" width="12" height="3" className="fill-beaver-blue-light" />
          <rect x="1" y="33" width="11" height="3" className="fill-beaver-blue-dark" />
          <rect x="2" y="36" width="10" height="3" className="fill-beaver-blue" />
        </g>

        <g ref={refs.legs}>
          <rect x="16" y="34" width="4" height="6" className="fill-beaver-blue-dark" />
          <rect x="22" y="34" width="4" height="6" className="fill-beaver-blue-dark" />
          <rect x="28" y="34" width="4" height="6" className="fill-beaver-blue-dark" />
        </g>

        <g ref={refs.block} opacity={0} style={{ transformOrigin: '24px 30px' }}>
          <rect x="18" y="26" width="12" height="8" className="fill-gray-300" />
          <rect x="19" y="27" width="10" height="2" className="fill-gray-400" />
        </g>

        <g ref={refs.body} style={{ transformOrigin: '24px 28px' }}>
          <rect x="14" y="22" width="18" height="12" className="fill-beaver-blue" />
          <rect x="17" y="25" width="9" height="7" className="fill-beaver-belly" />
          <rect x="15" y="24" width="6" height="4" className="fill-beaver-blue-light" />
        </g>

        <g ref={refs.wrench} opacity={0} style={{ transformOrigin: '14px 24px' }}>
          <rect x="8" y="20" width="6" height="2" className="fill-gray-400" />
          <rect x="6" y="22" width="2" height="4" className="fill-gray-500" />
          <rect x="10" y="18" width="2" height="3" className="fill-gray-300" />
        </g>

        <g ref={refs.file} opacity={0} style={{ transformOrigin: '36px 22px' }}>
          <rect x="34" y="18" width="8" height="10" className="fill-beaver-blue-light" />
          <rect x="38" y="18" width="4" height="4" className="fill-beaver-blue" />
          <rect x="35" y="22" width="5" height="2" className="fill-beaver-blue-dark" />
        </g>

        <g ref={refs.leftArm} style={{ transformOrigin: '18px 24px' }}>
          <rect x="12" y="22" width="5" height="7" className="fill-beaver-blue-dark" />
        </g>

        <g ref={refs.rightArm} style={{ transformOrigin: '30px 24px' }}>
          <rect x="28" y="22" width="5" height="7" className="fill-beaver-blue-dark" />
        </g>

        <g ref={refs.head} style={{ transformOrigin: '30px 16px' }}>
          <rect x="22" y="10" width="16" height="13" className="fill-beaver-blue" />
          <rect x="24" y="12" width="11" height="8" className="fill-beaver-blue-light" />
          <rect x="22" y="8" width="4" height="3" className="fill-beaver-blue-dark" />
          <rect x="32" y="8" width="4" height="3" className="fill-beaver-blue-dark" />
          <rect x="35" y="17" width="3" height="3" className="fill-beaver-nose" />
          <rect x="33" y="19" width="2" height="3" className="fill-beaver-teeth" />
          <rect x="36" y="19" width="2" height="3" className="fill-beaver-teeth" />
          <g ref={refs.eyesOpen}>
            <rect x="28" y="15" width="2" height="2" className="fill-beaver-nose" />
            <rect x="32" y="15" width="2" height="2" className="fill-beaver-nose" />
          </g>
          <g ref={refs.eyesClosed} opacity={0}>
            <rect x="28" y="16" width="2" height="1" className="fill-beaver-nose" />
            <rect x="32" y="16" width="2" height="1" className="fill-beaver-nose" />
          </g>
        </g>
      </g>
    </svg>
  );
});

export default PixelBeaverRig;
