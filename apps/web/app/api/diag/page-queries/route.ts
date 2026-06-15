import { NextResponse } from 'next/server';
import { getGalleries, getAllPhotos, getRandomPhotos, getPopularPhotos, getAllArticles } from '@/lib/db';

export async function GET() {
  const results: Record<string, { ok: boolean; error?: string; count?: number }> = {};

  // Test getGalleries
  try {
    const galleries = await getGalleries();
    results.getGalleries = { ok: true, count: galleries.length };
  } catch (e: any) {
    results.getGalleries = { ok: false, error: e.message };
  }

  // Test getAllPhotos
  try {
    const photos = await getAllPhotos(8);
    results.getAllPhotos = { ok: true, count: photos.length };
  } catch (e: any) {
    results.getAllPhotos = { ok: false, error: e.message };
  }

  // Test getRandomPhotos
  try {
    const photos = await getRandomPhotos(12);
    results.getRandomPhotos = { ok: true, count: photos.length };
  } catch (e: any) {
    results.getRandomPhotos = { ok: false, error: e.message };
  }

  // Test getPopularPhotos
  try {
    const photos = await getPopularPhotos(8);
    results.getPopularPhotos = { ok: true, count: photos.length };
  } catch (e: any) {
    results.getPopularPhotos = { ok: false, error: e.message };
  }

  // Test getAllArticles
  try {
    const articles = await getAllArticles();
    results.getAllArticles = { ok: true, count: articles.length };
  } catch (e: any) {
    results.getAllArticles = { ok: false, error: e.message };
  }

  return NextResponse.json(results);
}
