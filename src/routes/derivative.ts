/**
 * Derivative Generation - Simple stub
 * 
 * This is a placeholder. Real derivative generation requires:
 * 1. Download from SmugMug
 * 2. Resize with Sharp 
 * 3. Upload to R2
 * 
 * For now, this just logs the request.
 */

export async function handleDerivativeGeneration(
  data: { photoId: string; smugmugKey: string; slug: string },
  env: Env
): Promise<{ success: boolean; error?: string }> {
  const { photoId, smugmugKey, slug } = data;
  
  console.log(`[derivative] Would process: ${slug} (${smugmugKey})`);
  
  return { 
    success: true, 
    note: 'Derivative generation stub - needs external script processing'
  };
}
