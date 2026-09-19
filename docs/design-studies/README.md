# Design studies

Interactive explorations made while working on the hero and the About dial.
Each file is a self-contained `<section>` with its own inline `<style>` and one
`<script>`: no build step, no dependency on the app, no shared assets.

They are **not shipped**. Nothing in `src/` imports them and no route serves
them. They are kept because the reasoning in them is the reasoning behind what
did ship, and that is worth being able to look up.

| File | Question it was exploring |
| --- | --- |
| `astrolabe-scroll-concepts.html` | Three ways the instrument could behave on scroll. |
| `portrait-integration-study.html` | How to give the portrait and the instrument shared depth rather than two planes at the same coordinates. |
| `infrastructure-reverse-side.html` | Treating infrastructure as the reverse plate of the dial. |

## Looking at one

They are fragments, not documents, so a browser needs a host page:

```sh
printf '<!doctype html><meta charset="utf-8"><body style="margin:2rem;background:#0e0818">' > /tmp/host.html
cat docs/design-studies/portrait-integration-study.html >> /tmp/host.html
# then open /tmp/host.html
```

## What reached the site

The portrait study settled the question the shipped hero answers: the portrait,
the reticle and the instrument are concentric on one derived point — the head —
rather than three elements placed at the same coordinates by hand. See the
`--hero-head-right` and `--hero-head-rise` custom properties in
`src/app/globals.css`.
