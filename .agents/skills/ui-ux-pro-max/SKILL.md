---
name: ui-ux-pro-max
description: Master UI/UX Design System for Awwwards-grade portfolios, Techno-Medieval aesthetics, typography pairing, motion choreography, and visual hierarchy.
---

# UI/UX Pro Max Skill Guide

## Design Core & Aesthetic Philosophy
1. **Techno-Medieval Aesthetic Fusion**:
   - Primary Base: Warm parchment/cream (`#FAF7F0`, `#F5F0E8`, `#EDE5D8`) representing craftsmanship, antiquity, and medieval manuscript warmth.
   - Secondary Accents: Burnished gold (`#B8860B`), warm amber (`#D4A053`), and deep bronze (`#8B6914`).
   - Sci-Fi Touches: Holographic blue (`#6B9FCC`), soft violet (`#8B7FC7`), and metallic silver (`#A0A5B5`) for HUD elements, sci-fi line work, and glowing hover states.
   - Contrast Anchor: Dark Walnut (`#2C2418`) for dramatic dark contrast sections (Contact & Footer).

2. **Typography System**:
   - Display/Headings: `Cinzel` (Engraved, authoritative serif)
   - Body/UI: `Inter` (Precise geometric sans)
   - Code/Labels: `JetBrains Mono` (Technical HUD monospace)
   - Generous tracking (`letter-spacing: 0.15em`) on monospace HUD micro-labels.

3. **Motion & Interaction Standards**:
   - Purposeful Motion: Every animation reinforces spatial hierarchy or guides scroll flow.
   - Spring Lerp Cursor: Custom cursor with section-aware blend mode (`multiply` on warm light bg, inverted on dark walnut bg).
   - Magnetic Pull: Touchpoints pull toward the cursor with spring physics.
   - Micro-Interactions: Rune corner ornaments (`::before`/`::after`), border glows, line sweeps, and hover depth shifts.

4. **Layout Grid & Hierarchy**:
   - Asymmetric two-column grids for About and Contact.
   - Sticky pinned sections for Hero and Works Chapter Portal.
   - Generous vertical whitespace (`clamp(6rem, 12vh, 10rem)`).
