# Process overview

## What I built

Loop Press is a live browser instrument organised as a six-tone, eight-step printing plate. A player can click or drag to write notes, improvise with coloured pads or keyboard keys, load and alter three example patterns, and start an automatic performance. Tempo, swing and three synth voices reshape the loop. The automatic and manual paths share one Web Audio engine, so the examples are editable note data rather than recordings.

## The moments that mattered

1. **Throwing away the polished direction.** The first shipped response was visually finished but based on a star-map metaphor. After user feedback rejected that premise, I did not reskin the same interaction. I changed the harness first: example patterns had to remain editable, automatic performance had to use the live synthesis engine, and the full workstation had to remain reachable at 390x844 ([`7315d64`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/7315d64)). I then replaced the canvas with a tested sequencer model, pattern library, drag editing, keyboard pads and transport controls ([`7315d64...8814c1e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/compare/7315d64...8814c1e)). Thirty checks and browser inspection at both marking viewports showed that the new idea worked as a system rather than a visual theme.

2. **Correcting the clock, not retrying the click.** During browser verification, Start Loop loaded the pattern but the playhead stayed on step 01. The preview had created an `AudioContext` that remained suspended, so its audio clock never advanced. I separated transport time from synthesis time: a running context provides the high-precision clock, while permission recovery uses page time. I extracted that decision into `transportClockSeconds` and added regression cases for running, suspended and unavailable audio states ([`8b3ef44`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xty116/commit/8b3ef44)). The same interaction then advanced through steps 01, 05 and 06 while pattern editing and keyboard performance remained live.
