# Process overview

## What I built

WEAVE is a live browser instrument where six synthesised voices become moving coloured threads. Players can hear three complete original songs, perform alongside them, and rewrite any phrase through a note-labelled grid. Every example carries explicit pitch, duration, velocity and chord-quality data across 16 musical measures. The set list, song-form map and animated performance stage make the difference between listening to a whole piece and editing one moment visible.

## The moments that mattered

1. **Defining “complete melody” before adding polish.** The previous version technically crossed eight phrases, but its notes were derived from step numbers and sounded like related loops rather than authored songs. After direct feedback, I changed the harness first: each example needed Intro, Verse, Chorus, Bridge and Outro, at least 32 lead events spanning seven pitches, explicit chord data, and a live visual driven by the six voices ([`1caf282`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/1caf282)). That turned “more creative” into testable musical and interaction requirements.

2. **Rebuilding sound and interface as one system.** I wrote three distinct 64-note lead themes with bass movement, harmonic changes and high counterlines, added algorithmic reverb, and made full playback resolve once before returning to the opening. The same implementation replaced the utility dashboard with a full-width ribbon stage, artwork-led set list and note-labelled arranger ([`c16c9ab`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/c16c9ab)). Thirty-one checks passed. In-browser testing played Glasshouse Morning for its full 37 seconds through all six song sections, then confirmed automatic reset. Desktop and 390×844 inspection found and corrected a mobile readout overlap; direct mobile editing added an `E4` without overflow or runtime errors.
