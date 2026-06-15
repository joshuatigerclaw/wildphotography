#!/usr/bin/env python3
import re

with open('src/routes/api-v1.ts', 'r') as f:
    content = f.read()

# Pattern 1: Simple sql(`query`) as any[] -> sql`query` as any[]
content = re.sub(
    r'await sql\(\`([^\`]+)\`\) as any\[\];',
    lambda m: f'await sql`{m.group(1).strip()}` as any[];',
    content
)

# Pattern 2: const x = await sql(`query`) -> const x = await sql`query`
content = re.sub(
    r'await sql\(\`([^\`]+)\`\)',
    lambda m: f'await sql`{m.group(1).strip()}`',
    content
)

# Pattern 3: sql(`query`) -> sql`query` (no await, no assignment)
content = re.sub(
    r'(?<!await\s)sql\(\`([^\`]+)\`\)',
    lambda m: f'sql`{m.group(1).strip()}`',
    content
)

with open('src/routes/api-v1.ts', 'w') as f:
    f.write(content)

print('Fixed template literals')
result = __import__('subprocess').run(['grep', '-n', 'await sql(', 'src/routes/api-v1.ts'], capture_output=True, text=True)
if result.stdout:
    print('Remaining sql( calls:')
    print(result.stdout[:3000])
else:
    print('No remaining sql( calls - all converted to template literals')