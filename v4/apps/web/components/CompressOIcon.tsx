/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

const icons = {
  addMedia: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22 9V15C22 15.23 22 15.45 21.98 15.67C21.94 15.61 21.89 15.55 21.84 15.5C21.83 15.49 21.82 15.47 21.81 15.46C21 14.56 19.81 14 18.5 14C17.24 14 16.09 14.52 15.27 15.36C14.48 16.17 14 17.28 14 18.5C14 19.34 14.24 20.14 14.65 20.82C14.87 21.19 15.15 21.53 15.47 21.81C15.49 21.82 15.5 21.83 15.51 21.84C15.56 21.89 15.61 21.93 15.67 21.98C15.46 22 15.23 22 15 22H9C4 22 2 20 2 15V9C2 4 4 2 9 2H15C20 2 22 4 22 9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.52002 7.10986H21.48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.52002 2.10986V6.96985" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.48 2.10986V6.5199" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M23 18.5C23 18.86 22.96 19.21 22.87 19.55C22.76 20 22.58 20.43 22.35 20.82C21.57 22.12 20.14 23 18.5 23C17.42 23 16.44 22.62 15.68 21.98C15.61 21.93 15.56 21.89 15.51 21.84C15.5 21.83 15.49 21.82 15.47 21.81C15.15 21.53 14.87 21.19 14.65 20.82C14.24 20.14 14 19.34 14 18.5C14 17.28 14.48 16.17 15.27 15.36C16.09 14.52 17.24 14 18.5 14C19.81 14 21 14.56 21.81 15.46C21.82 15.47 21.83 15.49 21.84 15.5C21.89 15.55 21.94 15.61 21.98 15.67C22.62 16.44 23 17.43 23 18.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20.1801 18.48H16.8201" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 16.8401V20.2001" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  curvedArrow: (
    <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6,3a13.17,13.17,0,0,1,9,12.49V21"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <polyline
        points="12 18 15 21 18 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22H15C20 22 22 20 22 15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.51953 7.10986H21.4795" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.51953 2.10986V6.96986" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.4805 2.10986V6.51986" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M9.75 14.4501V13.2501C9.75 11.7101 10.84 11.0801 12.17 11.8501L13.21 12.4501L14.25 13.0501C15.58 13.8201 15.58 15.0801 14.25 15.8501L13.21 16.4501L12.17 17.0501C10.84 17.8201 9.75 17.1901 9.75 15.6501V14.4501V14.4501Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 12L12 16M12 16L16 12M12 16V8M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  fileExplorer: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 21H3C2.44772 21 2 20.5523 2 20L2 4C2 3.44772 2.44771 3 3 3H7.73381C8.08507 3 8.41058 3.1843 8.5913 3.4855L9.8087 5.5145C9.98942 5.8157 10.3149 6 10.6662 6H20C20.5523 6 21 6.44772 21 7V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.79903 10.7369L2.34449 19.7369C2.17099 20.373 2.64988 21 3.30925 21H19.2362C19.6872 21 20.0823 20.6982 20.201 20.2631L22.6555 11.2631C22.829 10.627 22.3501 10 21.6908 10H5.7638C5.31284 10 4.91769 10.3018 4.79903 10.7369Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  ),
  tick: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 12.6111L8.92308 17.5L20 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 8C2 4.68629 4.68629 2 8 2H16C19.3137 2 22 4.68629 22 8V16C22 19.3137 19.3137 22 16 22H8C4.68629 22 2 19.3137 2 16V8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M9.00012 9L15.0001 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 9L9 14.9999" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
} as const;

export type CompressOIconName = keyof typeof icons;

interface CompressOIconProps {
  name: CompressOIconName;
  size?: number;
  className?: string;
}

export default function CompressOIcon({ name, size = 24, className = '' }: CompressOIconProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {React.cloneElement(icons[name], {
        width: size,
        height: size,
        className: 'w-full h-full',
      })}
    </span>
  );
}
