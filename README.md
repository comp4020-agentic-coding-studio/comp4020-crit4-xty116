# Loop Press

Loop Press is a playable pattern machine for COMP4020 Crit 4. Players print notes into a six-tone, eight-step grid, reshape example patterns and perform alongside an automatic loop. Every sound is synthesised live with the Web Audio API.

## Play

- Select **Print the first beat** or press any grid cell to begin.
- Click or drag across the press plate to write and hear notes.
- Load Soft Machine, Open Window or Paper Rain, then change any part of the pattern.
- Start the automatic press and adjust tempo, swing or voice while it runs.
- Perform manually with the coloured pads or `A S D J K L`.

The patterns contain note data only. The automatic performance and manual notes use the same live synthesis engine, with no recordings or audio assets.

## Development

```sh
pnpm install
pnpm dev
pnpm check
pnpm check:evidence
pnpm build
```

The deployed instrument lives at [comp4020-agentic-coding-studio.github.io/comp4020-crit4-xty116](https://comp4020-agentic-coding-studio.github.io/comp4020-crit4-xty116/).
