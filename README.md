# Baseball-Analytics

## GitHub Pages version

A GitHub Pages-ready build now lives in `docs/`. It keeps the original implementation intact while providing a
self-contained, browser-friendly version of the simulator that loads assets relative to `docs/`.

- Open `docs/index.html` locally with a static server (for example, `python -m http.server`) or enable GitHub Pages
  using the `docs/` folder as the site source.
- The simulator logic is refactored into `docs/js/simulator.js` and wired up by `docs/js/app.js`.
