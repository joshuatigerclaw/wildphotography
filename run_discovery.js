#!/usr/bin/env node
process.argv.push('--mode=historical','--maxResults=200');
process.argv.push('--maxResults=200','--mode=historical');
require('/Users/joshuatenbrink/.openclaw/workspace/wildphotography/scripts/discover-photo-usage-credits.js');
