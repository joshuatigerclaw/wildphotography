// Quick patch to add region routes
const fs = require('fs');
let c = fs.readFileSync('src/worker.ts', 'utf8');

// Add import
if (!c.includes('renderRegion')) {
  c = c.replace(
    "import { renderSpeciesIndex } from './pages/species-index';",
    "import { renderSpeciesIndex } from './pages/species-index';\nimport { renderRegion } from './pages/region';"
  );
}

// Add route after species index
if (!c.includes("path.startsWith('region/')")) {
  c = c.replace(
    "return await renderSpeciesIndex(env, url);",
    "return await renderSpeciesIndex(env, url);\n\n        if (path.startsWith('region/')) {\n          const regionSlug = path.replace('region/', '').replace(/\\/$/, '');\n          return await renderRegion(regionSlug, env, url);\n        }"
  );
}

fs.writeFileSync('src/worker.ts', c);
console.log('Done');
