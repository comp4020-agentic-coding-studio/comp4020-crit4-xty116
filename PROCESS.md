# Process overview

## What I built

WEAVE is a two-room browser instrument. Song Studio turns six synthesised voices into moving coloured threads while players hear, perform and rewrite three complete original songs. Piano Room replaces the abstract grid with a direct keyboard, three live-synth voices and an authored full-song performance. Both rooms use the same explicit pitch, duration, velocity and chord-quality data; neither uses samples or recordings.

## The moments that mattered

1. **Defining “complete melody” before adding polish.** The previous version technically crossed eight phrases, but its notes were derived from step numbers and sounded like related loops rather than authored songs. After direct feedback, I changed the harness first: each example needed Intro, Verse, Chorus, Bridge and Outro, at least 32 lead events spanning seven pitches, explicit chord data, and a live visual driven by the six voices ([`1caf282`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/1caf282)). That turned “more creative” into testable musical and interaction requirements.

2. **Rebuilding sound and interface as one system.** I wrote three distinct lead themes with bass movement, harmonic changes and high counterlines, added algorithmic reverb, and made full playback resolve once before returning to the opening. The same implementation replaced the utility dashboard with a full-width ribbon stage, artwork-led set list and note-labelled arranger ([`c16c9ab`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/c16c9ab)).

3. **Changing the interaction, not just its styling.** Feedback that the grid did not feel like a musical instrument led to a second harness defining a linked, playable piano ([`3df38da`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/3df38da)). Piano Room then added 37 desktop keys, pointer glissando, computer-key attack and release, sustain, register, volume and three oscillator recipes. Its automatic performance reuses Glasshouse Morning's event data and illuminates each played key ([`0e881ce`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/0e881ce)). Forty-four checks pass. Inspection at 1440×900 and 390×844 confirmed full-height layouts, two-way navigation, 22 desktop white keys, eight finger-sized mobile white keys and no horizontal overflow.
