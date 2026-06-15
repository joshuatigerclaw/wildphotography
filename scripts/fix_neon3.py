#!/usr/bin/env python3
import re

with open('src/routes/api-v1.ts', 'r') as f:
    content = f.read()

# Fix remaining sql(sqlStr, ...params) patterns
# These are in handleApiSearch (lines 149, 172) and possibly other places

# Pattern: await sql(countSql, ...params) as any[]
# Fix: await sql.query(countSql, params) as any[]
content = re.sub(
    r'(await sql\()(countSql|dataSql|sqlStr|sql|mysql|queryStr|searchSql|insertSql)(,\s*\.\.\.params)',
    lambda m: m.group(1) + '.query(' + m.group(2) + ', params)',
    content
)

# Also fix in places where params variable might be named differently
# Pattern: await sql(STRING_LITERAL, ...VARIABLE) as any[]
# Find all such occurrences
# Strategy: find sql( where the first arg contains backticks and has $N params

# Pattern: sql(\`...\$1...\$\{paramIdx\}...`, params)
# This is more complex - let me find all await sql(...) that have $N in the template

lines = content.split('\n')
fixed_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    # If line contains "await sql(" followed by a template with $1, $2, etc.
    if 'await sql(' in line and ('${' in line or '$' in line) and '`' in line:
        # This is a multi-line template with params
        # Collect all lines until we find the closing ` as any[] or similar
        block = [line]
        j = i + 1
        while j < len(lines) and not re.search(r'\`\s*(as|;|\)\s*$)', lines[j]):
            block.append(lines[j])
            j += 1
        if j < len(lines):
            block.append(lines[j])
        
        full_block = '\n'.join(block)
        # Check if this uses $1, $2 etc. (positional params)
        if re.search(r'\$\d+|\$\{paramIdx\}', full_block):
            # This needs sql.query() instead of sql()
            # Replace await sql(`...`, params) with await sql.query(`...`, params)
            # But our template literals already got partially converted
            # Find and fix the pattern
            fixed_block = re.sub(
                r'(await sql)\((\`[^\`]*\`)(,\s*params)(\s*(?:as\s+any\[\]|;))',
                r'\1.query(\2, params)\4',
                full_block
            )
            fixed_lines.append(fixed_block)
            i = j + 1
            continue
    fixed_lines.append(line)
    i += 1

content = '\n'.join(fixed_lines)

with open('src/routes/api-v1.ts', 'w') as f:
    f.write(content)

print('Done')
result = __import__('subprocess').run(['grep', '-n', 'await sql(', 'src/routes/api-v1.ts'], capture_output=True, text=True)
print(result.stdout[:2000] if result.stdout else 'None')