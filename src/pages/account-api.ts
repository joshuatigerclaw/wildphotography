/**
 * Account API Dashboard
 * WildPhotography.com — Phase 10
 */

import { neon } from '@neondatabase/serverless';

const NEON_CONNECTION = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

export async function renderAccountApi(email: string, env: any): Promise<Response> {
  const sql = neon(NEON_CONNECTION);

  // Look up customer by email (simplified auth for now)
  const customers = await sql`
    SELECT ac.id, ac.email, ac.name, ac.company, ac.status,
           ac.current_period_start, ac.current_period_end,
           ap.slug as plan_slug, ap.name as plan_name,
           ap.launch_price_monthly, ap.regular_price_monthly,
           ap.monthly_call_limit, ap.allowed_derivative_sizes,
           ap.attribution_required, ap.commercial_use_allowed, ap.ai_agent_use_allowed,
           ap.max_results_limit
    FROM api_customers ac
    JOIN api_plans ap ON ac.plan_id = ap.id
    WHERE ac.email = ${email} AND ac.status = 'active'
    LIMIT 1
  `;

  if (customers.length === 0) {
    return new Response(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#0f0f0f;color:#f0ede6">
      <h1>No API Account Found</h1>
      <p>No active API account found for ${email}. <a href="/api-access" style="color:#c9a84c">Apply for early access</a> to get started.</p>
    </body></html>`, { headers: { 'Content-Type': 'text/html' } });
  }

  const customer = customers[0];

  // Get API keys
  const keys = await sql`
    SELECT id, name, key_prefix, status, last_used_at, created_at, revoked_at
    FROM api_keys
    WHERE customer_id = ${customer.id}
    ORDER BY created_at DESC
  `;

  // Get current usage
  const now = new Date();
  const period = parseInt(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);
  const usageRows = await sql`
    SELECT COALESCE(SUM(calls_used), 0) as calls_used
    FROM api_monthly_usage
    WHERE customer_id = ${customer.id} AND period_yyyymm = ${period}
  `;
  const callsUsed = Number(usageRows[0]?.calls_used || 0);
  const monthlyLimit = Number(customer.monthly_call_limit);
  const callsRemaining = Math.max(0, monthlyLimit - callsUsed);
  const usagePercent = Math.round((callsUsed / monthlyLimit) * 100);

  // Get API docs URL
  const docsUrl = 'https://wildphotography.com/api-access';

  const allowedSizes = typeof customer.allowed_derivative_sizes === 'string'
    ? JSON.parse(customer.allowed_derivative_sizes)
    : customer.allowed_derivative_sizes;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Dashboard — WildPhotography</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root{--bg:#0f0f0f;--bg2:#181818;--bg3:#222;--text:#f0ede6;--text-muted:#8a8680;--accent:#c9a84c;--border:#2a2a2a;--green:#4ade80;--red:#f87171;--yellow:#fbbf24}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'DM Sans',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}
    a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:960px;margin:0 auto;padding:0 24px}
    nav{padding:20px 0;border-bottom:1px solid var(--border)}
    nav .container{display:flex;justify-content:space-between;align-items:center}
    .logo{font-size:20px;font-weight:700;letter-spacing:-0.5px}.logo span{color:var(--accent)}
    .nav-links{display:flex;gap:24px;font-size:14px}.nav-links a{color:var(--text-muted)}.nav-links a:hover{color:var(--text);text-decoration:none}
    .dashboard{padding:48px 0}
    .dash-header{margin-bottom:40px}
    .dash-header h1{font-size:28px;font-weight:700;letter-spacing:-0.5px;margin-bottom:8px}
    .dash-header p{color:var(--text-muted);font-size:15px}
    .dash-grid{display:grid;grid-template-columns:2fr 1fr;gap:24px}
    .card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:20px}
    .card-title{font-size:14px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:16px}
    .plan-badge{display:inline-block;background:var(--accent);color:#0f0f0f;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;margin-bottom:12px}
    .stat-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px}
    .stat-row:last-child{border-bottom:none}.stat-label{color:var(--text-muted)}.stat-value{font-weight:500}
    .usage-bar{height:8px;background:var(--bg3);border-radius:4px;overflow:hidden;margin:12px 0}
    .usage-bar-fill{height:100%;border-radius:4px;transition:width 0.3s;background:var(--accent)}
    .usage-bar-fill.warning{background:var(--yellow)}.usage-bar-fill.danger{background:var(--red)}
    .key-list{list-style:none}.key-item{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px}
    .key-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
    .key-name{font-weight:600;font-size:14px}.key-status{font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px}
    .key-status.active{background:rgba(74,222,128,0.15);color:var(--green)}.key-status.revoked{background:rgba(248,113,113,0.15);color:var(--red)}
    .key-prefix{font-family:'Courier New',monospace;font-size:13px;color:var(--text-muted);margin-bottom:4px}
    .key-secret{font-family:'Courier New',monospace;font-size:13px;color:var(--text-muted);margin-bottom:4px;word-break:break-all}
    .key-secret.hidden{filter:blur(5px);user-select:none}
    .key-meta{font-size:12px;color:var(--text-muted)}
    .key-actions{display:flex;gap:8px;margin-top:8px}
    .btn-sm{padding:6px 12px;font-size:12px;border-radius:6px;font-weight:600;cursor:pointer;border:none;font-family:inherit}
    .btn-sm-danger{background:rgba(248,113,113,0.15);color:var(--red)}.btn-sm-danger:hover{background:rgba(248,113,113,0.25)}
    .btn-sm-primary{background:var(--accent);color:#0f0f0f}.btn-sm-primary:hover{background:#d4b45a}
    .btn-sm-secondary{background:var(--bg3);color:var(--text)}.btn-sm-secondary:hover{background:var(--border)}
    .no-keys{text-align:center;padding:32px;color:var(--text-muted);font-size:14px}
    .copy-field{display:flex;gap:8px;align-items:center}
    .copy-field input{flex:1;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:'Courier New',monospace;font-size:12px}
    .copy-btn{padding:8px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);cursor:pointer;font-size:12px}
    .copy-btn:hover{background:var(--border)}
    .example-request{margin-top:16px}.example-request label{font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px}
    .example-request code{display:block;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;font-family:'Courier New',monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;color:var(--text-muted)}
    .alert{padding:12px 16px;border-radius:8px;font-size:14px;margin-bottom:16px}
    .alert-warning{background:rgba(251,191,36,0.1);border:1px solid var(--yellow);color:var(--yellow)}
    .alert-success{background:rgba(74,222,128,0.1);border:1px solid var(--green);color:var(--green)}
    .modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;align-items:center;justify-content:center}
    .modal.show{display:flex}
    .modal-content{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:32px;max-width:400px;width:90%}
    .modal-title{font-size:18px;font-weight:600;margin-bottom:16px}
    .modal-form{margin-bottom:16px}.modal-form input{width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:14px;margin-bottom:12px}
    .modal-form input:focus{outline:none;border-color:var(--accent)}
    .modal-actions{display:flex;gap:8px;justify-content:flex-end}
    footer{padding:32px 0;border-top:1px solid var(--border);text-align:center;font-size:13px;color:var(--text-muted)}
    @media(max-width:768px){.dash-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <nav>
    <div class="container">
      <a href="/" class="logo">Wild<span>Photography</span></a>
      <div class="nav-links">
        <a href="/galleries">Galleries</a>
        <a href="/species">Species</a>
        <a href="/api-access">API Access</a>
        <a href="/account/api">Dashboard</a>
      </div>
    </div>
  </nav>

  <div class="dashboard">
    <div class="container">
      <div class="dash-header">
        <h1>API Dashboard</h1>
        <p>Manage your API keys and monitor usage for <strong>${customer.email}</strong></p>
      </div>

      <div class="dash-grid">
        <div class="main-col">
          <div class="card">
            <div class="card-title">Current Plan</div>
            <div class="plan-badge">${customer.plan_name}</div>
            <div class="stat-row"><span class="stat-label">Monthly calls</span><span class="stat-value">${customer.monthly_call_limit.toLocaleString()} / month</span></div>
            <div class="stat-row"><span class="stat-label">Price</span><span class="stat-value">$${(customer.launch_price_monthly / 100).toFixed(2)}/mo (launch) · $${(customer.regular_price_monthly / 100).toFixed(2)}/mo regular</span></div>
            <div class="stat-row"><span class="stat-label">Derivatives available</span><span class="stat-value">${allowedSizes.join(', ')}</span></div>
            <div class="stat-row"><span class="stat-label">Commercial use</span><span class="stat-value">${customer.commercial_use_allowed ? '✓ Allowed' : '✗ Not allowed'}</span></div>
            <div class="stat-row"><span class="stat-label">Attribution required</span><span class="stat-value">${customer.attribution_required ? '✓ Required' : '✗ Not required'}</span></div>
            <div class="stat-row"><span class="stat-label">AI/agent use</span><span class="stat-value">${customer.ai_agent_use_allowed ? '✓ Allowed' : '✗ Not allowed'}</span></div>
          </div>

          <div class="card">
            <div class="card-title">Monthly Usage — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
            <div class="stat-row"><span class="stat-label">Calls used</span><span class="stat-value">${callsUsed.toLocaleString()} / ${monthlyLimit.toLocaleString()}</span></div>
            <div class="stat-row"><span class="stat-label">Calls remaining</span><span class="stat-value">${callsRemaining.toLocaleString()}</span></div>
            <div class="usage-bar"><div class="usage-bar-fill ${usagePercent > 90 ? 'danger' : usagePercent > 70 ? 'warning' : ''}" style="width:${usagePercent}%"></div></div>
            ${usagePercent > 80 ? `<div class="alert alert-warning">You've used ${usagePercent}% of your monthly quota. Consider upgrading if you need more calls.</div>` : ''}
            <div class="stat-row"><span class="stat-label">Period resets</span><span class="stat-value">${new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
          </div>

          <div class="card">
            <div class="card-title">API Keys</div>
            <div style="margin-bottom:16px">
              <span style="font-size:13px;color:var(--text-muted)">Documentation: </span>
              <a href="${docsUrl}" style="font-size:13px">${docsUrl}</a>
            </div>
            <div class="example-request">
              <label>Quick test (search endpoint):</label>
              <code>curl -H "Authorization: Bearer wild_live_xxxx_yourkeyhere" \\
  "https://wildphotography.com/api/v1/search?q=macaw&limit=3"</code>
            </div>
            ${keys.length === 0 ? '<div class="no-keys">No API keys yet. Create one below.</div>' : `
            <ul class="key-list">
              ${keys.map((k: any) => `
              <li class="key-item">
                <div class="key-header">
                  <span class="key-name">${k.name}</span>
                  <span class="key-status ${k.status}">${k.status}</span>
                </div>
                <div class="key-prefix">${k.key_prefix}_••••••••</div>
                ${k.status === 'active' ? `<div class="key-meta" style="margin-top:8px">Created: ${new Date(k.created_at).toLocaleDateString()} · Last used: ${k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</div>` : `<div class="key-meta">Revoked: ${k.revoked_at ? new Date(k.revoked_at).toLocaleDateString() : 'N/A'}</div>`}
                ${k.status === 'active' ? `<div class="key-actions"><button class="btn-sm btn-sm-danger" onclick="revokeKey(${k.id})">Revoke</button></div>` : ''}
              </li>
              `).join('')}
            </ul>
            `}
            <button class="btn btn-sm btn-sm-primary" onclick="showCreateModal()" style="margin-top:12px">+ Create New Key</button>
          </div>
        </div>

        <div class="side-col">
          <div class="card">
            <div class="card-title">API Endpoints</div>
            <div style="font-size:13px;color:var(--text-muted);line-height:2">
              <div><code style="color:var(--accent)">GET</code> /api/v1/search</div>
              <div><code style="color:var(--accent)">GET</code> /api/v1/photos/:slug</div>
              <div><code style="color:var(--accent)">GET</code> /api/v1/galleries/:slug</div>
              <div><code style="color:var(--accent)">GET</code> /api/v1/species/:slug</div>
              <div><code style="color:var(--accent)">GET</code> /api/v1/locations/:slug</div>
              <div><code style="color:var(--accent)">GET</code> /api/v1/nearby</div>
              <div><code style="color:var(--accent)">GET</code> /api/v1/random</div>
              <div><code style="color:var(--accent)">GET</code> /api/v1/usage</div>
              <div><code style="color:var(--accent)">GET</code> /api/v1/plans</div>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Quick Reference</div>
            <div style="font-size:13px;color:var(--text-muted)">
              <p style="margin-bottom:8px">Authorization header:</p>
              <code style="display:block;background:var(--bg);border:1px solid var(--border);padding:8px;border-radius:6px;font-size:12px;word-break:break-all">Authorization: Bearer wild_live_xxxx_key</code>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Plan Limits</div>
            <div class="stat-row"><span class="stat-label">Max results/request</span><span class="stat-value">${customer.max_results_limit}</span></div>
            <div class="stat-row"><span class="stat-label">Monthly call limit</span><span class="stat-value">${monthlyLimit.toLocaleString()}</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Key Modal -->
  <div class="modal" id="createModal">
    <div class="modal-content">
      <div class="modal-title">Create New API Key</div>
      <div class="modal-form">
        <input type="text" id="keyName" placeholder="Key name (e.g., Production, Development)">
      </div>
      <div id="newKeyDisplay" style="display:none;margin-bottom:16px">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">New API Key (shown only once — save it now):</div>
        <code id="newKeyValue" style="display:block;background:var(--bg);border:1px solid var(--border);padding:10px;border-radius:6px;font-size:11px;word-break:break-all;color:var(--green)"></code>
        <div style="font-size:11px;color:var(--red);margin-top:8px">⚠️ This key will only be shown once. Copy it now.</div>
      </div>
      <div class="modal-actions">
        <button class="btn-sm btn-sm-secondary" onclick="hideCreateModal()">Cancel</button>
        <button class="btn-sm btn-sm-primary" id="createKeyBtn" onclick="createKey()">Create Key</button>
      </div>
    </div>
  </div>

  <footer>
    <div class="container">
      <p>© 2026 Joshua ten Brink / WildPhotography.com · <a href="/">Home</a> · <a href="/api-access">API Access</a></p>
    </div>
  </footer>

  <script>
    let pendingKeyId = null;

    function showCreateModal() {
      document.getElementById('createModal').classList.add('show');
      document.getElementById('keyName').value = '';
      document.getElementById('newKeyDisplay').style.display = 'none';
      document.getElementById('createKeyBtn').style.display = '';
    }
    function hideCreateModal() {
      document.getElementById('createModal').classList.remove('show');
    }

    async function createKey() {
      const name = document.getElementById('keyName').value || 'Default Key';
      const btn = document.getElementById('createKeyBtn');
      btn.disabled = true;
      btn.textContent = 'Creating...';
      try {
        const res = await fetch('/api/v1/account/key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: '${customer.email}', name })
        });
        const data = await res.json();
        if (data.key) {
          document.getElementById('newKeyValue').textContent = data.key;
          document.getElementById('newKeyDisplay').style.display = 'block';
          btn.style.display = 'none';
          setTimeout(() => { alert('Key created! Please copy and save it now — it will not be shown again.'); location.reload(); }, 500);
        } else {
          alert('Failed to create key: ' + (data.error || 'Unknown error'));
          btn.disabled = false;
          btn.textContent = 'Create Key';
        }
      } catch(e) {
        alert('Failed to create key');
        btn.disabled = false;
        btn.textContent = 'Create Key';
      }
    }

    async function revokeKey(keyId) {
      if (!confirm('Are you sure you want to revoke this API key? Any systems using it will immediately stop working.')) return;
      try {
        const res = await fetch('/api/v1/account/key/' + keyId, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: '${customer.email}' }) });
        if (res.ok) { location.reload(); } else { alert('Failed to revoke key'); }
      } catch(e) { alert('Failed to revoke key'); }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' }
  });
}
