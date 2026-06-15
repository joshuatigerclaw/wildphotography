#!/usr/bin/env python3
import re

with open('src/routes/api-v1.ts', 'r') as f:
    content = f.read()

lines = content.split('\n')
fixed = []
i = 0
fixed_count = 0
while i < len(lines):
    line = lines[i]
    if 'await sql(' not in line:
        fixed.append(line)
        i += 1
        continue

    # Collect the sql(...) block
    block = [line]
    j = i + 1
    paren_depth = line.count('(') - line.count(')')
    while j < len(lines) and paren_depth > 0:
        block.append(lines[j])
        paren_depth += lines[j].count('(') - lines[j].count(')')
        j += 1
    if j < len(lines):
        block.append(lines[j])

    full_block = '\n'.join(block)
    
    # Check if this uses $N placeholders (positional)
    if re.search(r'\$\d+|\$\{paramIdx\}', full_block):
        # Replace await sql(`...`, ...params) with await sql.query(`...`, params)
        # First fix the template literal start
        block_fixed = re.sub(
            r'(await sql)\(`',
            r'\1.query(`',
            full_block
        )
        # Fix the closing: `, ...params) as any[] 
        block_fixed = re.sub(
            r'`,\s*\.\.\.(params|queryParams|dataParams|countParams|searchParams)\s*\) as any\[\]',
            r'`, \1) as any[]',
            block_fixed
        )
        fixed.extend(block_fixed.split('\n'))
        print(f'Fixed multi-line at line {i+1}')
        fixed_count += 1
        i = j + 1
    else:
        fixed.append(line)
        i += 1

with open('src/routes/api-v1.ts', 'w') as f:
    f.write('\n'.join(fixed))

print(f'Done. Fixed {fixed_count} multi-line sql blocks')