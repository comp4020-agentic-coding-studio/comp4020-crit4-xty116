# Process overview

## What I built

WEAVE is a two-room browser instrument. Song Studio turns six synthesised voices into moving coloured threads while players perform and rewrite three original songs. Piano Room offers a continuous 88-key instrument and a credited public-domain Beethoven performance. Both rooms use explicit pitch, duration, velocity and chord-quality data; neither uses recordings or downloaded samples.

## The moments that mattered

1. **Defining “complete melody” before polish.** The first version crossed eight phrases but derived pitches from step numbers, so it sounded like related loops. I changed the harness first: each example needed a complete song form, at least 32 lead events spanning seven pitches, explicit chord data and a six-voice live visual ([`1caf282`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/1caf282)).

2. **Rebuilding sound and interface together.** I wrote three lead themes with bass movement, harmonic changes and counterlines, added algorithmic reverb, and made playback return to its opening. The same implementation replaced the utility dashboard with a ribbon stage, set list and note-labelled arranger ([`c16c9ab`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/c16c9ab)).

3. **Changing the interaction, then verifying the music.** Grid feedback led to a linked, playable Piano Room ([`3df38da`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/3df38da)) and direct performance ([`0e881ce`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/0e881ce)). Electronic tone and a 37-key limit then triggered an 88-key rebuild, mobile navigator and Concert synthesis from detuned partials, hammer noise, stereo position and pitch-dependent decay ([`b33accd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/b33accd)). The demo first became a credited 34-second *Ode to Joy* arrangement ([`cf09328`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/cf09328)), but feedback exposed flattened dotted rhythms and guessed accompaniment. I used Mutopia's public-domain LilyPond source to transcribe exact soprano, alto, tenor and bass timing, protected by a complete-melody regression test ([`794b12d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/794b12d)). Forty-nine checks pass; browser inspection confirmed 88 keys, attribution and responsive containment.
