# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.

## The link-preview card

`public/card.jpg` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.jpg` is wrong one directory down, and nothing in CI
checks it, so look at the deployed head when you add pages.

## The checks

`pnpm check` runs them (`pnpm check:evidence` is the extra gate before you
ship); CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## This file is yours

A starting point, not a rulebook. As you learn what your prototype needs --- a
convention the work has to hold to, a sensor that keeps catching you out (a
linter, say), a fact about the stack that is easy to get wrong --- write it down
here and wire it into `check`. Growing this file is the work.

## Instrument constraints

- The browser must synthesize every sound live with Web Audio. Do not use an
  `<audio>` element, downloaded sample, or prerecorded backing track.
- Create or resume the shared `AudioContext` only inside a player gesture. The
  opening state must invite that first gesture without requiring instructions.
- Keep every generated pitch inside one consonant scale and apply short attack
  and release envelopes. The instrument has no score, failure state, or
  musically invalid action.
- Pointer input must cover both mouse and touch; keyboard input must reach the
  same sound engine. Player position, movement, or timing must change at least
  two audible parameters so two performances can differ.
- The sequencer and manual performance surface must use the same synthesis
  engine. Automatic performance may begin only after the player presses its
  transport control; it must never be a recording or unprompted autoplay.
- Example patterns are editable note data, not audio assets. Loading one must
  visibly replace the grid so a player can hear it, alter it, and make it their
  own.
- At 390x844 the first note, pattern library, grid and transport must all remain
  reachable without horizontal overflow.
- A week-specific contract may be committed red once as a deliberate baseline.
  The implementation commit immediately after it must return the full roster to
  green.
- Tests can verify wiring and state, but the ear is the final harness. Before
  accepting the instrument, play it cold in a real browser at desktop and phone
  widths, listen for clicks and runaway gain, and verify resize during a phrase.
