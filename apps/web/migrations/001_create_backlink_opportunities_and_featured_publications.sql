-- Migration: create_backlink_opportunities_and_featured_publications
-- Date: 2026-05-05

-- 1. Create backlink_opportunities table
CREATE TABLE IF NOT EXISTS backlink_opportunities (
  id SERIAL PRIMARY KEY,
  source_domain VARCHAR(255) NOT NULL,
  page_url TEXT,
  page_title VARCHAR(500),
  credit_found BOOLEAN DEFAULT false,
  backlink_found BOOLEAN DEFAULT false,
  contact_email VARCHAR(255),
  outreach_status VARCHAR(50) DEFAULT 'pending',
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_checked_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- 2. Create featured_publications table (for the photography-featured page)
CREATE TABLE IF NOT EXISTS featured_publications (
  id SERIAL PRIMARY KEY,
  publication VARCHAR(255) NOT NULL,
  article_title VARCHAR(500) NOT NULL,
  url TEXT,
  topic VARCHAR(255),
  credit_status VARCHAR(50) DEFAULT 'mentioned',
  active BOOLEAN DEFAULT true,
  featured_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_backlink_opportunities_domain ON backlink_opportunities(source_domain);
CREATE INDEX IF NOT EXISTS idx_backlink_opportunities_status ON backlink_opportunities(outreach_status);
CREATE INDEX IF NOT EXISTS idx_featured_publications_active ON featured_publications(active);
CREATE INDEX IF NOT EXISTS idx_featured_publications_order ON featured_publications(featured_order);

-- 4. Insert sample featured publications data (replace/extend as needed)
INSERT INTO featured_publications (publication, article_title, url, topic, credit_status, featured_order)
VALUES
  ('Central America Living', 'Costa Rica Bird Photography Guide', 'https://centralamericaliving.com/costa-rica-bird-photography', 'Birding', 'credited', 1),
  ('Central America Living', 'Best Costa Rica Wildlife Photography Locations', 'https://centralamericaliving.com/costa-rica-wildlife-photography-locations', 'Wildlife', 'licensed', 2)
ON CONFLICT DO NOTHING;