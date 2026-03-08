'use client';

interface KeywordChipsProps {
  keywords: string[];
  onKeywordClick?: (keyword: string) => void;
}

export function KeywordChips({ keywords, onKeywordClick }: KeywordChipsProps) {
  if (!keywords || keywords.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map((keyword) => (
        <button
          key={keyword}
          onClick={() => onKeywordClick?.(keyword)}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-full transition"
        >
          {keyword}
        </button>
      ))}
    </div>
  );
}

export default KeywordChips;
