// Diagnostic endpoint — intentionally minimal to avoid any bundling issues
export async function GET() {
  return new Response(JSON.stringify({
    diag: 'ok',
    worker: 'wildphotography-new',
    timestamp: Date.now()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
