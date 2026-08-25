# WEAVE

WEAVE is a live song instrument for COMP4020 Crit 4. Six synthesised voices appear as moving coloured threads, responding to both a complete automatic performance and the player's own gestures.

The prototype now has two linked performance rooms: **Song Studio** for arranging the six-part compositions and **Piano Room** for direct, expressive keyboard performance.

## Play

- Select **Hear the opening** to wake the live Web Audio ensemble.
- Choose Glasshouse Morning, Neon Letters or Small Hours from the set list.
- Select **Play the song** to hear its intro, verses, chorus, bridge and outro unfold.
- Perform Pulse, Clap, Lowline, Harmony, Lead and Glint with the on-screen pads or `A S D J K L`.
- Open any of the eight phrases and edit its 16-step grid. Pitched cells display their actual note names.
- Recompose a phrase or reshape the full performance with three palettes, tempo and swing.
- Move to **Piano Room** for a continuous, scrollable 88-key piano from A0 to C8.
- Play Concert, Felt and Electric voices with pointer glissando or the `A W S E D F T G Y H U J K` keys.
- Move across the full keybed with its range navigator or register controls; the mobile viewport keeps one finger-sized octave in view.
- Shape register, sustain and volume, or perform the complete 34-second public-domain **Ode to Joy** theme, credited to Ludwig van Beethoven.

Each example contains explicit pitches, note lengths, dynamics and chord qualities. The automatic arrangement, opening gesture, grid previews and manual pads share the same six Web Audio signal paths. No samples or recordings are used.

## Development

```sh
pnpm install
pnpm dev
pnpm check
pnpm check:evidence
pnpm build
```

The deployed instrument lives at [comp4020-agentic-coding-studio.github.io/comp4020-crit4-xty116](https://comp4020-agentic-coding-studio.github.io/comp4020-crit4-xty116/).
