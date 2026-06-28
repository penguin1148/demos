# Demos — The Dawn Era

A 2D strategy game set in ancient Greece (Phase 1: 900 BC – 750 BC), built with
plain HTML, CSS and **native ES modules** — no build tools, no dependencies.

## Running

ES modules require HTTP (not `file://`). Serve the folder and open `index.html`:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000/
```

## Project structure

```
index.html        markup + module entry point (<script type="module" src="js/main.js">)
css/styles.css    all styling
js/               game code, split by concern
```

### Modules (`js/`)

| File              | Responsibility |
|-------------------|----------------|
| `config.js`       | Core constants: economy, jobs, yields, civic & Hekatomb config |
| `religionData.js` | Religion data: tiers, Aspects, Epithets, harmony, the Mythic Cycle script |
| `state.js`        | The central mutable `GameState` object |
| `content.js`      | Game content: events, crises, techs, buildings, hamlets, trade stories |
| `engine.js`       | Turn loop: tick, growth/famine, seasons, era end/collapse |
| `culture.js`      | Civic investments, crises, catastrophes, choice & god events |
| `tech.js`         | The Tech Tree (Ergon + Muthos research) |
| `buildings.js`    | Structures (the Mines, the Docks) |
| `merchants.js`    | Foreign merchants and the Phoenician negotiation |
| `festival.js`     | The Hekatomb festival minigame + modal controls |
| `religion.js`     | Religion engine: cults, offerings, happiness, jealousy, ascent-readiness |
| `myth.js`         | The Mythic Cycle (the survived text story that raises a god's tier) |
| `synoikismos.js`  | Uniting neighbouring hamlets into the Polis |
| `render.js`       | All DOM rendering (HUD, map, panels and modals) |
| `main.js`         | Bootstrap: initialise `GameState` and wire up event handlers |

Data flows through `import` / `export`. The data layer (`config`, `religionData`,
`content`, `state`) holds no logic; the feature modules hold logic; `render.js`
and `main.js` own the DOM. Modules reference each other freely at call time, so a
change to one feature (e.g. the Tech Tree) usually only touches its own file.
