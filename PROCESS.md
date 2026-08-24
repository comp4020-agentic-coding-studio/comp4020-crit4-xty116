# Process overview

## What I built

Orbit Choir is a browser instrument that turns a star map into a shared musical surface. Horizontal position chooses one of fifteen notes from a consonant scale; vertical position opens or closes the timbre; pressure changes intensity. Pointer drags, touch gestures and the `A` to `;` keys all enter the same synthesis engine. Three voices change the instrument's character without creating a wrong note, while each performance draws a temporary constellation.

## The moments that mattered

1. **Making the brief executable.** I first directed the work by carrying the Crit 4 constraints into `CLAUDE.md`: one gesture-created `AudioContext`, live synthesis rather than recordings, a shared input model, two expressive parameters and no failure language ([`9419f83`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/9419f83)). I then encoded those decisions as a deliberately red contract before building the interface ([`2593df9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/2593df9)). The useful evidence was not that the first attempt looked plausible, but that five failing checks became 27 passing checks after the instrument existed ([`2593df9...29bd67c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/compare/2593df9...29bd67c)).

2. **Giving judgement a separate harness.** Automated checks could prove the input paths and synthesis nodes existed, but not whether the first gesture felt immediate. The embedded preview exposed no Web Audio API, so I kept the live Web Audio path for normal browsers and made visual response independent of audio availability rather than replacing synthesis with samples. I then played the page at the two marking viewports: 1920x1080 and 390x844. The first tap produced note 01, keyboard `A` produced C3, Ember changed both state and sound mapping, and neither viewport overflowed. The final viewport and preview-card pass is captured across [`29bd67c...1d43323`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/compare/29bd67c...1d43323).
