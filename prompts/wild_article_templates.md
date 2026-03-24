# WildPhotography Article Blueprint Templates

Use these templates by article type. Select the correct template based on the `article_type` field in the queue item.

---

## A. Location Guide (`location_guide`)

```
Article Type: location_guide

Target word count: 900–1400 words (or 1500–2200 for flagship destinations)

Structure:
  H1:    [Location Name], Costa Rica: Wildlife, Photography and Travel Guide
  Intro: What makes this place special — 2–4 sentences grounding the reader
  H2:    Why Visit [Location]
         — unique appeal, what sets it apart from other destinations
  H2:    What You Can See and Photograph There
         — specific wildlife, landscapes, habitats; use real species names
  H2:    Best Experiences in [Location]
         — activities, trails, viewpoints, guided options
  H2:    Best Time to Visit [Location]
         — seasonal guidance without fabricating schedules or guarantees
  H2:    Photography Tips for [Location]
         — light, timing, composition advice relevant to this specific place
  H2:    Nearby Places to Explore
         — 2–4 related destinations with internal links
  FAQ:   3–5 questions (best time, wildlife, photography, how long, nearby)
  Affiliate block: YES — travel intent applies
  Related links: species pages, gallery pages, region pages
```

---

## B. Species Guide (`species_guide`)

```
Article Type: species_guide

Target word count: 900–1400 words

Structure:
  H1:    [Species Name] in Costa Rica: Where to See and Photograph It
  Intro: Species overview — what it is, why it matters, what makes it compelling
  H2:    Where [Species Name] Is Found in Costa Rica
         — habitats, elevation range, regional distribution
  H2:    Best Places to See [Species Name]
         — 3–5 specific locations with brief context; link to location pages
  H2:    Best Time and Conditions for Sightings
         — season, time of day, weather without fabricating certainty
  H2:    Photography Tips for [Species Name]
         — focal length, approach distance, behaviour to watch for, light direction
  H2:    Similar Wildlife to Look For
         — 2–4 related species; link to their species pages where available
  FAQ:   3–5 questions (where to see it, best time, photography tips, behaviour)
  Affiliate block: NO — unless article has strong ecotourism tour intent
  Related links: location pages, gallery pages, related species pages
```

---

## C. Theme Roundup (`theme_roundup`)

```
Article Type: theme_roundup

Target word count: 900–1400 words

Structure:
  H1:    Best [Theme] in Costa Rica
  Intro: What makes this theme compelling — scope, why Costa Rica excels
  H2:    [Top Place / Example 1]
         — specific detail, photo hook, what to expect
  H2:    [Top Place / Example 2]
         — same pattern
  H2:    [Top Place / Example 3]
         — same pattern
  H2:    Best Time to Go
         — general seasonal guidance; no fabricated specifics
  H2:    Travel and Photography Tips
         — practical advice relevant to the theme
  FAQ:   3–5 questions
  Affiliate block: YES if user intent supports tours or travel planning
  Related links: location pages, gallery pages, species pages where relevant
```

---

## D. Photography Guide (`photography_guide`)

```
Article Type: photography_guide

Target word count: 1000–1400 words (flagship versions: 1500–2200)

Structure:
  H1:    Costa Rica [Subject] Photography Guide
  Intro: Why this subject is worth shooting in Costa Rica
  H2:    Best Locations for [Subject] Photography
         — 3–6 specific locations; link to location or region pages
  H2:    Best Light and Seasonal Conditions
         — golden hour, cloud cover, dry vs. wet season without guarantees
  H2:    Wildlife or Landscape Timing
         — species behaviour or weather patterns affecting shot quality
  H2:    Composition Ideas for [Subject]
         — specific angles, foreground elements, framing approaches
  H2:    Practical Field Advice
         — gear, safety, access logistics — keep general if specifics are uncertain
  FAQ:   3–5 questions (best time, gear, locations, access)
  Affiliate block: YES — photography guides have strong tour intent
  Related links: gallery pages, species pages, location pages
```

---

## Content Quality Checklist

Before finalising any article, verify:

- [ ] One clear primary keyword targeted throughout
- [ ] 2–6 secondary phrases used naturally (not stuffed)
- [ ] H1 and title are tightly aligned but not identical clones
- [ ] Meta title is 50–60 characters
- [ ] Meta description is 140–160 characters with primary keyword
- [ ] Intro grounds the reader within the first 2 sentences
- [ ] Every H2 section has at least 2 substantive paragraphs
- [ ] At least one image block with render-ready photos and captions
- [ ] No fabricated facts (fees, schedules, guarantees, species certainty)
- [ ] No empty filler paragraphs or generic AI-sounding sentences
- [ ] No "in conclusion" wrap-ups
- [ ] Affiliate block present and relevant (or intentionally omitted)
- [ ] FAQ contains 3–5 real search-intent questions with honest answers
- [ ] Related links section present with descriptive anchor text
- [ ] JSON-LD schema present and valid
- [ ] Internal links use only verified slug targets

---

## Image Block HTML Template

Use this pattern for the featured image:

```html
<figure class="article-hero-image">
  <img src="{{ photo.medium_url }}" alt="{{ photo.caption }}" loading="lazy" />
  <figcaption>{{ photo.caption }}</figcaption>
</figure>
```

Use this pattern for gallery blocks:

```html
<section class="article-gallery">
  <h2>Photo Gallery</h2>
  <div class="gallery-grid">
    <figure>
      <img src="{{ photo.thumb_url }}" alt="{{ photo.caption }}" loading="lazy" />
      <figcaption>{{ photo.caption }}</figcaption>
    </figure>
    <!-- repeat per selected photo -->
  </div>
</section>
```

---

## Related Links Section HTML Template

```html
<section class="related-links">
  <h2>Related Guides</h2>
  <ul>
    <li><a href="/galleries/{{ gallery_slug }}">{{ gallery_title }}</a></li>
    <li><a href="/species/{{ species_slug }}">{{ species_name }} in Costa Rica</a></li>
    <li><a href="/locations/{{ location_slug }}">{{ location_name }} Travel Guide</a></li>
    <!-- 5+ links total -->
  </ul>
</section>
```
