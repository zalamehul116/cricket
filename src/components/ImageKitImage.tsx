'use client';

import React from 'react';
import { Image as IKImage } from '@imagekit/next';

const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/i087hdblp';

interface ImageKitImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  sizes?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

function stripTransform(url: string): string {
  const [path, query] = url.split('?');
  if (!query) return url;
  const params = query.split('&').filter((p) => !p.startsWith('tr='));
  return params.length ? `${path}?${params.join('&')}` : path;
}

function buildImageKitSrcSet(src: string, widths = [100, 200, 400, 800]): string {
  const base = stripTransform(src);
  const separator = base.includes('?') ? '&' : '?';
  return widths.map((w) => `${base}${separator}tr=w-${w},c-at_max ${w}w`).join(', ');
}

export default function ImageKitImage({
  src,
  alt,
  width,
  height,
  className = '',
  style,
  sizes = '(max-width: 480px) 48px, (max-width: 768px) 96px, 200px',
  onError
}: ImageKitImageProps) {
  const isImageKit = src && src.includes('ik.imagekit.io');
  const hasDimensions = width != null && height != null;
  const imgClassName = ['imagekit-img', className].filter(Boolean).join(' ');
  const coverClassName = style?.objectFit === 'cover'
    ? ['imagekit-img-cover', className].filter(Boolean).join(' ')
    : imgClassName;
  const srcSet = isImageKit ? buildImageKitSrcSet(src) : undefined;

  if (isImageKit && hasDimensions) {
    return (
      <IKImage
        urlEndpoint={urlEndpoint}
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={coverClassName}
        style={style}
        sizes={sizes}
        loading="lazy"
        onError={onError}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={coverClassName}
      style={style}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      loading="lazy"
      decoding="async"
      onError={onError}
    />
  );
}
