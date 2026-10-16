/**
 * Grapheme-aware text splitting (emoji-safe). SplitText-style without the Club plugin.
 */

import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';

export type SplitUnit = 'chars' | 'words';

export interface SplitToken {
  /** Single grapheme, word, or whitespace run */
  value: string;
  className?: string;
  isEmoji: boolean;
  isSpace: boolean;
}

const EMOJI_RE =
  /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*|\p{Regional_Indicator}{2})$/u;

function segmentGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return [...segmenter.segment(text)].map((part) => part.segment);
  }
  return [...text];
}

function isEmojiGrapheme(value: string): boolean {
  return EMOJI_RE.test(value);
}

function splitWords(text: string): string[] {
  const parts: string[] = [];
  const re = /\S+|\s+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    parts.push(match[0]);
  }
  return parts;
}

function pushChars(tokens: SplitToken[], text: string, className?: string) {
  const units = segmentGraphemes(text);
  for (const value of units) {
    tokens.push({
      value,
      className,
      isEmoji: isEmojiGrapheme(value),
      isSpace: value.trim() === '',
    });
  }
}

function pushWords(tokens: SplitToken[], text: string, className?: string) {
  for (const word of splitWords(text)) {
    const isSpace = word.trim() === '';
    tokens.push({
      value: word,
      className,
      isEmoji: !isSpace && [...segmentGraphemes(word)].every(isEmojiGrapheme),
      isSpace,
    });
  }
}

function walkNode(node: ReactNode, className: string | undefined, tokens: SplitToken[], unit: SplitUnit) {
  if (node == null || typeof node === 'boolean') return;

  if (typeof node === 'string' || typeof node === 'number') {
    const text = String(node);
    if (unit === 'words') pushWords(tokens, text, className);
    else pushChars(tokens, text, className);
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) walkNode(child, className, tokens, unit);
    return;
  }

  if (isValidElement(node)) {
    const el = node as ReactElement<{ className?: string; children?: ReactNode }>;
    const mergedClass = [className, el.props.className].filter(Boolean).join(' ') || undefined;
    walkNode(el.props.children, mergedClass, tokens, unit);
  }
}

export function splitReactContent(content: ReactNode, unit: SplitUnit = 'chars'): SplitToken[] {
  const tokens: SplitToken[] = [];
  walkNode(content, undefined, tokens, unit);
  return tokens;
}

export function splitPlainText(text: string, unit: SplitUnit = 'chars'): SplitToken[] {
  return splitReactContent(text, unit);
}

/** Flatten React children to a plain string (for aria). */
export function reactNodeToText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (isValidElement(child)) return reactNodeToText((child.props as { children?: ReactNode }).children);
      return '';
    })
    .join('');
}
