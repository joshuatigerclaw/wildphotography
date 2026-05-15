-- Pinterest Pins Queue Table
-- Stores generated Pinterest pins with board assignment, destination URLs, and analytics tracking.

CREATE TABLE IF NOT EXISTS pinterest_pins (
  id BIGSERIAL PRIMARY KEY,
  photo_id BIGINT NOT NULL,
  gallery_slug TEXT,
  photo_slug TEXT,
  source_image_url TEXT NOT NULL,
  pin_image_path TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  board TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  keywords TEXT[],
  status TEXT NOT NULL DEFAULT 'queued',
  dry_run BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for DATE,
  posted_at TIMESTAMPTZ,
  pinterest_pin_id TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  outbound_ctr NUMERIC DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_pinterest_pins_photo_id ON pinterest_pins(photo_id);
CREATE INDEX IF NOT EXISTS idx_pinterest_pins_status ON pinterest_pins(status);
CREATE INDEX IF NOT EXISTS idx_pinterest_pins_board ON pinterest_pins(board);
CREATE INDEX IF NOT EXISTS idx_pinterest_pins_created_at ON pinterest_pins(created_at);