# Safe Zone

An HTML clone of the *Safe Zone* mode of Roz Michelle's *Mental Blocker*.

Slide the blocks onto every white tile. A block slides until the next square is a hole, the edge
of the board, or another block. Safe zones don't stop it. To unlock the next level you must solve
each level in the minimum number of moves (the second number in `0/5 moves`).

## Playing

Open `index.html` directly, or serve the folder:

```sh
npm start            # python3 -m http.server 8000 --bind 127.0.0.1, then open http://localhost:8000
```

Press on a block and swipe in a direction, with a mouse or a finger. Swiping is the only way to
move a block. The buttons under the board restart the level, turn sound off and on, and open the
level menu.

Progress is saved in `localStorage` under `safezone.v1`, and the sound setting under
`safezone.sound`.

## Sound

The swipe sound (`audio/Swipe.wav`) plays each time a block starts to slide. Browsers don't allow
sound until the player interacts with the page, so it is unlocked by the first click, tap or key
press. The microphone button in the footer turns sound off and on.

## Levels

`js/levels.js` holds the original game's 21 levels. Each has a map, a block colour, and an optimal
solution; the level's par is the length of that solution. The maps and solutions come from the
original level data, and each block colour from the level's starting screenshot. Levels 20 and 21
were made in 2026 to replace two accidental copies of level 18.

## Tests

```sh
npm install
npm test             # unit tests (node:test) + headless Playwright end-to-end suite
```

The end-to-end suite runs every spec twice: as a desktop with a mouse, and as a phone using real
touch events.

## Credits

The game design and look are from *Mental Blocker* by Roz Michelle. The fonts are Nunito Sans and
Fira Sans Condensed (SIL Open Font License; see `fonts/`). On macOS, Avenir Next is used when it
is available.
