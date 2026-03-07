'use client';

import { Suspense } from 'react';

function SearchContent() {
  // Import the search component
  const { SearchInner } = require('./SearchInner');
  return <SearchInner />;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}
