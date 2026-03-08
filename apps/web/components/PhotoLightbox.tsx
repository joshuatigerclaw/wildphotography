'use client';

import { useState, useCallback } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

export interface PhotoSlide {
  id: string;
  src: string;
  alt: string;
  title?: string;
}

interface PhotoLightboxProps {
  open: boolean;
  slides: PhotoSlide[];
  currentIndex?: number;
  onClose: () => void;
}

export function PhotoLightbox({ open, slides, currentIndex = 0, onClose }: PhotoLightboxProps) {
  if (!open || slides.length === 0) return null;

  return (
    <Lightbox
      open={open}
      close={onClose}
      slides={slides}
      index={currentIndex}
      styles={{
        container: {
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
        },
      }}
      animation={{ fade: 250, swipe: 250 }}
      carousel={{ preload: 2 }}
      controller={{ closeOnBackdropClick: true }}
    />
  );
}

export default PhotoLightbox;
