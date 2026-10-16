/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AnimatedSection from './AnimatedSection';
import AnimatedText from './AnimatedText';
import { useFlipList } from '@/hooks/useFlipList';
import CompressOIcon from './CompressOIcon';
import MaterialIcon from './MaterialIcon';
import LandingMascotHero from './mascot/LandingMascotHero';
import PanelMascot from './mascot/PanelMascot';
import {
  PanelBody,
  PanelDivider,
  PanelHeader,
  PanelInset,
  ScreenPanel,
} from './ScreenPanel';

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
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<SelectorMode>('compress');
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<ClipEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clipListRef = useRef<HTMLUListElement>(null);
  const ignoreClickRef = useRef(false);
  const clipLayoutKey = clips.map((clip) => clip.id).join('|');
  const { captureBeforeUpdate: captureClipLayout } = useFlipList(clipListRef, clipLayoutKey);

  const addClips = (files: File[]) => {
    if (files.length === 0) return;
    captureClipLayout();
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
      setError(t('errors.invalidFile'));
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
      setError(t('errors.invalidFiles'));
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
      setError(t('errors.invalidFiles'));
      return;
    }
    setError(null);
    addClips(valid);
  };

  const moveClip = (index: number, direction: -1 | 1) => {
    captureClipLayout();
    setClips((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeClip = (index: number) => {
    captureClipLayout();
    setClips((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMerge = () => {
    if (clips.length < 2) {
      setError(t('errors.needTwoVideos'));
      return;
    }
    setError(null);
    onMergeAndCompress(clips.map((c) => c.file));
  };

  const switchMode = (nextMode: SelectorMode) => {
    if (clips.length > 0) captureClipLayout();
    setMode(nextMode);
    setError(null);
    setClips([]);
  };

  return (
    <div className="relative">
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
            <p className="text-lg font-semibold">{t('landing.dropAnywhere')}</p>
          </div>
        </div>
      )}

      <ScreenPanel size="xl" className="z-10">
        <PanelHeader>
          <LandingMascotHero />
          <AnimatedText
            key={`headline-${i18n.language}`}
            as="h1"
            split="words"
            className="mt-space-4 text-[clamp(1.125rem,3.5vw,1.375rem)] font-semibold text-ink tracking-tight"
            animateDots={false}
          >
            {t('landing.headlineBefore') && <>{t('landing.headlineBefore')} </>}
            <span className="text-accent">{t('landing.headlineAccent')}</span>
            {t('landing.headlineAfter') && <> {t('landing.headlineAfter')}</>}
          </AnimatedText>
          <AnimatedText
            key={`${mode}-${i18n.language}`}
            as="p"
            split="words"
            className="mt-space-2 text-body-sm leading-5 text-muted max-w-md mx-auto"
            animateDots={false}
          >
            {mode === 'compress' ? (
              <>
                {t('landing.compressSubtitleBefore')}{' '}
                <span className="text-ink font-medium">{t('common.mbLimit')}</span>{' '}
                {t('landing.compressSubtitleAfter')}
              </>
            ) : (
              <>
                {t('landing.mergeSubtitleBefore')}{' '}
                <span className="text-ink font-medium">{t('common.mbLimit')}</span>{' '}
                {t('landing.mergeSubtitleAfter')}
              </>
            )}
          </AnimatedText>
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
              {t('common.compress')}
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
              {t('common.merge')}
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
                {t('landing.dragDrop')}
                <span className="block text-xs mt-1">
                  {mode === 'merge' ? t('landing.browseMultiple') : t('landing.browseSingle')}
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-2">{t('landing.formats')}</p>
            </div>
          </PanelInset>

          <AnimatedSection show={mode === 'merge' && clips.length > 0} className="mt-space-4 space-y-3">
              <ul
                ref={clipListRef}
                className="scrollbar-hidden max-h-[min(12rem,28vh)] space-y-2 overflow-y-auto overscroll-contain"
              >
                {clips.map((clip, index) => (
                  <li
                    key={clip.id}
                    data-flip-id={clip.id}
                    className="flex items-center gap-2 app-inset px-3 py-2 text-body-sm"
                  >
                    <MaterialIcon name="movie" size={18} className="text-accent shrink-0" />
                    <span className="flex-1 truncate text-ink">{clip.file.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={t('a11y.moveUp')}
                        disabled={index === 0}
                        onClick={() => moveClip(index, -1)}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                      >
                        <MaterialIcon name="arrow_upward" size={18} />
                      </button>
                      <button
                        type="button"
                        aria-label={t('a11y.moveDown')}
                        disabled={index === clips.length - 1}
                        onClick={() => moveClip(index, 1)}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                      >
                        <MaterialIcon name="arrow_downward" size={18} />
                      </button>
                      <button
                        type="button"
                        aria-label={t('a11y.remove')}
                        onClick={() => removeClip(index)}
                        className="p-1 rounded hover:bg-gray-100 cursor-pointer"
                      >
                        <MaterialIcon name="close" size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  disabled={disabled || clips.length < 2}
                  onClick={handleMerge}
                  className="pixel-btn"
                >
                  {t('common.merge')}
                </button>
              </div>
          </AnimatedSection>

          {error && (
            <div className="mt-space-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-body-sm text-error">
              <PanelMascot variant="error" size="sm" className="shrink-0" />
              <span className="text-left">{error}</span>
            </div>
          )}
        </PanelBody>
      </ScreenPanel>
    </div>
  );
}
