# Leos Universe Explorer

Interactive universe cockpit with 4 destructive tools.

## Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

Creates `dist/` with the static site ready for hosting.

## Verify

```bash
npm run verify
```

Builds `dist/` first, then smoke checks the built files through a local server.

## Deploy

```bash
npm run deploy
```

Best publish path: GitHub Pages from the `dist/` artifact via the workflow in `.github/workflows/deploy.yml`.
After pushing to GitHub, set Pages to use GitHub Actions in repo settings.

## Controls

- `1` Pulse
- `2` Nova
- `3` Singularity
- `4` Rift
- `R` reset
- `Space` pause
- mouse wheel zoom
- shift-drag or middle mouse pan
- arrow keys / WASD nudge the view
- click to fire
- drag with Rift
