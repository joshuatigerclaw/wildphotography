#!/usr/bin/env python3
import re

with open('src/routes/api-v1.ts', 'r') as f:
    content = f.read()

# Fix 1: sql(\`...\`) as any[] -> sql\`...\`
# Single-line queries with no params in handleApiPlans
content = re.sub(
    r'await sql\(\`([^\`]+)\`\) as any\[\];',
    lambda m: f'await sql`{m.group(1)}` as any[];',
    content
)

# Fix 2: multi-line handleApiPlans query
old_plans = '''await sql(`
    SELECT slug, name, launch_price_monthly, regular_price_monthly,
           monthly_call_limit, allowed_derivative_sizes, attribution_required,
           commercial_use_allowed, ai_agent_use_allowed
    FROM api_plans WHERE active = true ORDER BY launch_price_monthly ASC
  `) as any[];'''

new_plans = '''await sql`
    SELECT slug, name, launch_price_monthly, regular_price_monthly,
           monthly_call_limit, allowed_derivative_sizes, attribution_required,
           commercial_use_allowed, ai_agent_use_allowed
    FROM api_plans WHERE active = true ORDER BY launch_price_monthly ASC
  ` as any[];'''

content = content.replace(old_plans, new_plans)

# Fix 3: handleApiWaitlistForm query
old_waitlist = '''const plans = await sql(`
    SELECT slug, name, launch_price_monthly, monthly_call_limit
    FROM api_plans WHERE active = true ORDER BY launch_price_monthly ASC
  `)'''

new_waitlist = '''const plans = await sql`
    SELECT slug, name, launch_price_monthly, monthly_call_limit
    FROM api_plans WHERE active = true ORDER BY launch_price_monthly ASC
  `'''

content = content.replace(old_waitlist, new_waitlist)

# Fix 4: waitlist insert - this uses params so keep as template
# Already in correct tagged template form

# Fix 5: handleApiWaitlist insert
old_insert = '''await sql(`
      INSERT INTO api_waitlist (name, email, company, intended_use, selected_plan, message)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, name || null, email, company || null, intended_use || null, selected_plan || null, message || null)'''

# This one HAS params ($1, $2) so it needs sql.query() or we inline params with ${}
# But wait - tagged templates don't support positional params ($1, $2)
# This needs a different approach: use sql.query() for parameterized queries
# OR convert to sql`...${value}...` format

# Actually the neon serverless driver supports tagged templates with ${param}
# Let me convert: sql(\`...$1...\`, val1, val2) -> sql\`...${val1}...\${val2}...\`
# But we need to know the param order.

# For the INSERT with values, let's just keep it as a plain sql.query call
# by replacing sql( with sql.query(

# Fix: waitlist insert needs sql.query
old_waitlist_insert = '''const result = await sql(`
      INSERT INTO api_waitlist (name, email, company, intended_use, selected_plan, message)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, name || null, email, company || null, intended_use || null, selected_plan || null, message || null);'''

new_waitlist_insert = '''const result = await sql.query(`
      INSERT INTO api_waitlist (name, email, company, intended_use, selected_plan, message)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [name || null, email, company || null, intended_use || null, selected_plan || null, message || null]);'''

content = content.replace(old_waitlist_insert, new_waitlist_insert)

with open('src/routes/api-v1.ts', 'w') as f:
    f.write(content)

print('Done fixing api-v1.ts')
print('Checking for remaining sql() calls...')
import subprocess
result = subprocess.run(['grep', '-n', 'await sql(', 'src/routes/api-v1.ts'], capture_output=True, text=True)
print(result.stdout[:2000] if result.stdout else 'None found')