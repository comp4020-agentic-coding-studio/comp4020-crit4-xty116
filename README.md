# Orbit Choir

Orbit Choir is a polyphonic star-map instrument for COMP4020 Crit 4. It synthesises every note live in the browser with the Web Audio API and draws each gesture as a temporary constellation.

## Play

- Select **Touch the first star** to begin.
- Touch, click or drag anywhere in the sky.
- Use `A S D F G H J K L ;` as a keyboard performance row.
- Switch between Glass, Ember and Pulse voices.
- Horizontal position chooses pitch; vertical position changes brightness; touch pressure changes intensity.

Every pitch belongs to the same consonant scale, so there is no wrong note and no score.

## Development

```sh
pnpm install
pnpm dev
pnpm check
pnpm check:evidence
pnpm build
```

The deployed instrument lives at [comp4020-agentic-coding-studio.github.io/comp4020-crit4-xty116](https://comp4020-agentic-coding-studio.github.io/comp4020-crit4-xty116/).
