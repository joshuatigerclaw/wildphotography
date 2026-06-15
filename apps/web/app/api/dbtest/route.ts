import { NextResponse } from 'next/server';
import { getAllSpecies } from '@/lib/db';

export async function GET() {
  try {
    const species = await getAllSpecies();
    return NextResponse.json({ count: species.length, first: species[0] || null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack });
  }
}
