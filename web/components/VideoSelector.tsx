/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useRef, useState } from 'react';
import AnimatedText from './AnimatedText';
import CompressOIcon from './CompressOIcon';
import MaterialIcon from './MaterialIcon';
import LandingMascotHero from './mascot/LandingMascotHero';
import PanelMascot from './mascot/PanelMascot';
import {
  PanelBody,
  PanelDivider,
  PanelFooter,
  PanelHeader,
  PanelInset,
  ScreenPanel,
} from './ScreenPanel';
import { TRUST_PILL_LOCAL } from '@/lib/platform';

const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv';
const VIDEO_EXT = /\.(mp4|mov|mkv|webm|avi|m4v)$/i;

export type SelectorMode = 'compress' | 'merge';

export interface ClipEntry {
  id: string;
  file: File;
}

interface VideoSelectorProps {
  onVideoSelected: (file: File) => void;
  onMergeAndCompress: (files: File[]) => void;
  disabled?: boolean;
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || VIDEO_EXT.test(file.name);
}

function clipKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export default function VideoSelector({
  onVideoSelected,
  onMergeAndCompress,
  disabled = false,
}: VideoSelectorProps) {
  const [mode, setMode] = useState<SelectorMode>('compress');
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<ClipEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ignoreClickRef = useRef(false);

  const addClips = (files: File[]) => {
    if (files.length === 0) return;
    setClips((prev) => {
      const seen = new Set(prev.map((c) => c.id));
      const next = [...prev];
      for (const file of files) {
        if (!isVideoFile(file)) continue;
        const id = clipKey(file);
        if (!seen.has(id)) {
          seen.add(id);
          next.push({ id, file });
        }
      }
      return next;
    });
  };

  const pickFile = (file: File | undefined) => {
    if (!file || disabled) return;
    if (!isVideoFile(file)) {
      setError('Please choose a supported video file (MP4, MOV, WebM, MKV).');
      return;
    }
    setError(null);
    onVideoSelected(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled) return;

    ignoreClickRef.current = true;
    window.setTimeout(() => {
      ignoreClickRef.current = false;
    }, 400);

    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;

    if (mode === 'compress') {
      pickFile(files[0]);
      return;
    }

    const valid = files.filter(isVideoFile);
    if (valid.length === 0) {
      setError('Please choose supported video files (MP4, MOV, WebM, MKV).');
      return;
    }
    setError(null);
    addClips(valid);
  };

  const handleZoneClick = () => {
    if (disabled || ignoreClickRef.current) return;
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';

    if (mode === 'compress') {
      pickFile(files[0]);
      return;
    }

    if (files.length === 0) return;
    const valid = files.filter(isVideoFile);
    if (valid.length === 0) {
      setError('Please choose supported video files (MP4, MOV, WebM, MKV).');
      return;
    }
    setError(null);
    addClips(valid);
  };

  const moveClip = (index: number, direction: -1 | 1) => {
    setClips((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeClip = (index: number) => {
    setClips((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMerge = () => {
    if (clips.length < 2) {
      setError('Add at least two videos to merge.');
      return;
    }
    setError(null);
    onMergeAndCompress(clips.map((c) => c.file));
  };

  const switchMode = (nextMode: SelectorMode) => {
    setMode(nextMode);
    setError(null);
    setClips([]);
  };

  return (
    <div className="screen-content text-ink overflow-hidden relative">
      <input
        ref={fileInputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        multiple={mode === 'merge'}
        className="hidden"
        onChange={handleInputChange}
      />

      {isDragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/90 pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-accent">
            <CompressOIcon name="addMedia" size={52} />
            <p className="text-lg font-semibold">Drop anywhere...</p>
          </div>
        </div>
      )}

      <ScreenPanel size="xl" className="z-10">
        <PanelHeader>
          <LandingMascotHero />
          <AnimatedText
            text="Optimize your academic videos"
            as="h1"
            className="mt-space-4 text-[clamp(1.125rem,3.5vw,1.375rem)] font-semibold text-ink tracking-tight"
            animateDots={false}
            colorAnimation="ink"
          />
          <p className="mt-space-2 text-body-sm leading-5 text-muted max-w-md mx-auto">
            {mode === 'compress'
              ? 'Compress any video under 200 MB without losing quality.'
              : 'Combine multiple clips into one video under 200 MB.'}
          </p>
        </PanelHeader>

        <PanelDivider />

        <PanelBody>
          <div className="mb-space-4 flex rounded-lg border border-border p-1 bg-gray-50">
            <button
              type="button"
              disabled={disabled}
              onClick={() => switchMode('compress')}
              className={`flex-1 min-h-9 rounded-md text-body-sm font-medium transition-colors cursor-pointer ${
                mode === 'compress'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Compress
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => switchMode('merge')}
              className={`flex-1 min-h-9 rounded-md text-body-sm font-medium transition-colors cursor-pointer ${
                mode === 'merge'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Merge &amp; Compress
            </button>
          </div>

          <PanelInset className="relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] stitch-grid-bg" />
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleZoneClick()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleZoneClick}
              className={`drop-zone w-full relative z-10 ${
                isDragActive ? 'is-dragging' : ''
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <CompressOIcon name="addMedia" size={52} className="text-accent" />
              <p className="text-sm mt-4 text-muted text-center">
                Drag &amp; Drop
                <span className="block text-xs mt-1">
                  {mode === 'merge' ? 'Add multiple clips or click to browse' : 'Or click to browse'}
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-2">MP4, MOV, WebM, MKV</p>
            </div>
          </PanelInset>

          {mode === 'merge' && clips.length > 0 && (
            <ul className="mt-space-4 space-y-2">
              {clips.map((clip, index) => (
                <li
                  key={clip.id}
                  className="flex items-center gap-2 app-inset px-3 py-2 text-body-sm"
                >
                  <MaterialIcon name="movie" size={18} className="text-accent shrink-0" />
                  <span className="flex-1 truncate font-mono text-ink">{clip.file.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => moveClip(index, -1)}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                    >
                      <MaterialIcon name="arrow_upward" size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === clips.length - 1}
                      onClick={() => moveClip(index, 1)}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                    >
                      <MaterialIcon name="arrow_downward" size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => removeClip(index)}
                      className="p-1 rounded hover:bg-gray-100 cursor-pointer"
                    >
                      <MaterialIcon name="close" size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <div className="mt-space-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-body-sm text-error">
              <PanelMascot variant="error" size="sm" className="shrink-0" />
              <span className="text-left">{error}</span>
            </div>
          )}
        </PanelBody>

        <PanelFooter className="space-y-space-3">
          {mode === 'merge' && (
            <button
              type="button"
              disabled={disabled || clips.length < 2}
              onClick={handleMerge}
              className="btn-tactile w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-body-sm font-medium min-h-11 px-5 py-2.5 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <MaterialIcon name="call_merge" size={18} />
              Merge &amp; Compress ({clips.length} clip{clips.length === 1 ? '' : 's'})
            </button>
          )}

          <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-2">
            <div className="trust-pill">
              <MaterialIcon name="lock" size={18} className="text-accent shrink-0" />
              <span>{TRUST_PILL_LOCAL}</span>
            </div>
            <div className="trust-pill">
              <MaterialIcon name="memory" size={18} className="text-accent shrink-0" />
              <span>Browser (WebAssembly)</span>
            </div>
            <div className="trust-pill">
              <MaterialIcon name="high_quality" size={18} className="text-accent shrink-0" />
              <span>Under 200 MB</span>
            </div>
          </div>
        </PanelFooter>
      </ScreenPanel>
    </div>
  );
}
