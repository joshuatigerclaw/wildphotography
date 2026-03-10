/**
 * Repair Mode - Fix incomplete records
 * 
 * Run to repair records stuck at any pipeline stage:
 * 1. Has smugmug_key but missing metadata_complete
 * 2. Has smugmug_key but missing original_stored
 * 3. Has original but missing derivatives
 * 4. Has derivatives but missing search_ready
 */

import { neon } from '@neondatabase/serverless';
import type { Env } from '../types';

export interface RepairResult {
  fixed: number;
  errors: string[];
}

export async function repairMetadata(env: Env): Promise<RepairResult> {
  const sql = neon(env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');
  
  // Fix metadata_complete based on required fields
  const result = await sql`
    UPDATE photos SET
      metadata_complete = (
        smugmug_key IS NOT NULL 
        AND slug IS NOT NULL 
        AND title IS NOT NULL
      ),
      updated_at = now()
    WHERE metadata_complete = false 
    AND smugmug_key IS NOT NULL
    AND slug IS NOT NULL
    AND title IS NOT NULL
  `;
  
  return { fixed: 0, errors: [] }; // Note: result.count not available in neon
}

export async function repairReadiness(env: Env): Promise<RepairResult> {
  const sql = neon(env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');
  
  // Fix ready_for_public_render
  await sql`
    UPDATE photos SET
      ready_for_public_render = (
        metadata_complete = true 
        AND derivatives_complete = true 
        AND status = 'public'
      ),
      updated_at = now()
    WHERE metadata_complete = true 
    AND derivatives_complete = true 
    AND status = 'public'
  `;
  
  // Fix search_ready
  await sql`
    UPDATE photos SET
      search_ready = (
        ready_for_public_render = true 
        AND thumb_url IS NOT NULL
      ),
      updated_at = now()
    WHERE ready_for_public_render = true 
    AND thumb_url IS NOT NULL
  `;
  
  return { fixed: 0, errors: [] };
}

export async function getIncompleteRecords(env: Env): Promise<{
  needMetadata: number;
  needDownload: number;
  needDerivatives: number;
  needIndex: number;
}> {
  const sql = neon(env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');
  
  const needMetadata = await sql`SELECT COUNT(*) as c FROM photos WHERE smugmug_key IS NOT NULL AND metadata_complete = false`;
  const needDownload = await sql`SELECT COUNT(*) as c FROM photos WHERE smugmug_key IS NOT NULL AND original_stored = false`;
  const needDerivatives = await sql`SELECT COUNT(*) as c FROM photos WHERE original_stored = true AND derivatives_complete = false`;
  const needIndex = await sql`SELECT COUNT(*) as c FROM photos WHERE search_ready = true`;
  
  return {
    needMetadata: needMetadata[0]?.c || 0,
    needDownload: needDownload[0]?.c || 0,
    needDerivatives: needDerivatives[0]?.c || 0,
    needIndex: needIndex[0]?.c || 0,
  };
}

export async function handleRepairMode(
  body: { action?: string },
  env: Env
): Promise<{ success: boolean; result?: RepairResult; status?: any; error?: string }> {
  console.log(`[repair] Running repair: ${body.action || 'status'}`);
  
  try {
    if (body.action === 'status') {
      const status = await getIncompleteRecords(env);
      return { success: true, status };
    }
    
    if (body.action === 'fix-metadata') {
      const result = await repairMetadata(env);
      return { success: true, result };
    }
    
    if (body.action === 'fix-readiness') {
      const result = await repairReadiness(env);
      return { success: true, result };
    }
    
    return { success: false, error: 'Unknown action. Use: status, fix-metadata, fix-readiness' };
    
  } catch (error: any) {
    console.error('[repair] Error:', error.message);
    return { success: false, error: error.message };
  }
}
