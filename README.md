# Mosaic

Mosaic is a live composition studio for COMP4020 Crit 4. It turns the browser into a six-instrument sequencer where every sound is synthesised in real time with the Web Audio API.

## Play

- Choose **Hear the first chord** for the opening sound gesture.
- Play Kick, Snare, Bass, Keys, Pluck and Bell with the on-screen pads or `A S D J K L`.
- Select one of three complete original pieces: After Rain, Night Tram or Sunday Kitchen.
- Start the main transport to hear all eight named bars perform in sequence.
- Open any bar and click or drag across its 16-step grid to rewrite the arrangement.
- Change the live performance with Velvet, Voltage and Porcelain palettes, tempo and swing.

The pieces store only arrangement data. Manual notes, grid previews and automatic playback all use the same six live synthesis recipes; there are no recordings or audio assets.

## Development

```sh
pnpm install
pnpm dev
pnpm check
pnpm check:evidence
pnpm build
```

The deployed studio lives at [comp4020-agentic-coding-studio.github.io/comp4020-crit4-xty116](https://comp4020-agentic-coding-studio.github.io/comp4020-crit4-xty116/).
