# Process overview

## What I built

Mosaic is a live browser composition studio with six recognisably different synthesised instruments. A player can perform with pads or keyboard keys, paint notes into a 16-step grid, and reshape any bar of three complete original pieces. Each piece has eight named bars, its own tempo, swing and sound palette, and an automatic performance lasting roughly 30–42 seconds. No recordings are used: Kick, Snare, Bass, Keys, Pluck and Bell are generated through separate Web Audio signal paths.

## The moments that mattered

1. **Turning feedback into a stronger contract.** I first replaced a rejected star-map concept with a short-loop sequencer, but the result still felt visually harsh and the examples did not read as finished music. Before redesigning again, I made the new standard explicit: three eight-bar compositions, six synthesis recipes, three palettes, automatic bar progression and editing during playback ([`3550584`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/3550584)). This prevented “more decoration” from becoming the solution to a structural problem.

2. **Building and testing the whole musical experience.** I replaced the print-shop interface with a library, song map, arranger and mixer, then implemented distinct signal chains from a pitch-dropping sine kick to noise-based snare and harmonic bell. The same commit added model contracts for all 24 bars and browser contracts for live synthesis and interaction ([`2199259`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/2199259)). Thirty automated checks passed. Browser testing at 1920×1080 and 390×844 confirmed no horizontal overflow; a timed playback test visibly advanced from Mist into First light, and direct grid editing changed the bar to “YOUR ARRANGEMENT” without runtime errors.
