# Paperboat (`paperboat-paperboat`)

**Paperboat** is the flagship brand showcase for Paperboat: a 3D pixel sailing game and domain service featuring an autonomous upwind tacking controller, aerodynamic sail trimming, stepped voxel archipelago terrain, procedural pixel textures, multi-frequency waves, and authentic origami papercraft aesthetics.

Art Direction: **Scheme C · Mediterranean Azure**
- **Ocean Water**: Vibrant tropical azure `#0284c7` with procedural pixel textures, multi-frequency trochoidal waves, and dynamic wake.
- **Pixelated Landscapes**: Procedural pixel textures for sand beaches (`#fde047`), stepped terracotta cliffs (`#b45309`), and lush grass terraces (`#22c55e`).
- **W2 Ripple Cushion**: Signal orange (`#ff5a1f`) and radiant gold (`#fef08a`) ripple wafers positioned directly beneath the paperboat's keel.
- **Heroic Scale Origami Boat**: 1.75× scale white origami hull (`#ffffff`) and two-tone folded sail (`#ffffff` / `#cbd5e1`) with dynamic wave pitch and buoyancy that never clips wave troughs.
- **Archipelago**: Golden sand beaches, terracotta cliffs, tropical grass terraces, wooden mooring dock, and white origami lighthouse with signal orange bands.

---

## Endless Exploration: Upwind Tacking Run

Sunken pirate treasure chests lie anchored in the lagoon. A sailing ship cannot sail into the wind's "No-Go Zone" ($\pm 42^\circ$ relative to oncoming wind).

The starter flow blocks solve two coupled control problems:
1. **Aerodynamic Sail Trim Optimizer**: Computes apparent wind angle and trims the sail to $\theta_{\text{sail}} = \frac{1}{2} \theta_{\text{apparent}}$, maximizing aerofoil lift.
2. **Autonomous Upwind Tacking Controller**: When the target is in the No-Go zone, alternates heading setpoints between $+48^\circ$ (starboard tack) and $-48^\circ$ (port tack), steered by a closed-loop PID controller with ultrasonic shore avoidance.
3. **Infinite Gameplay**: Collect chests and coins in an endless voyage across the archipelago, with dynamic waypoint respawning and resilient shoreline reef deflection.

---

## Directory Structure

```text
paperboat-paperboat/
├── backend.toml          # Format = 0 backend manifest
├── descriptor.toml       # Domain blocks, web station, and starter flow
├── expected.json         # Golden run benchmark assertions
├── pyproject.toml        # Standalone package metadata
├── server.py             # Backend bootstrap: serves ws://localhost:8774 & --run
├── README.md             # Documentation
├── .paperboatignore      # Archive packaging exclusions
├── .github/
│   └── workflows/
│       └── package.yml   # Automated verification & packaging CI
├── domain/
│   ├── __init__.py       # Exports BLOCKS list
│   ├── plant.py          # PaperboatGame (DomainState): aerodynamics, buoyancy, collision, score
│   └── blocks.py         # Wind, Boat, NextTreasure, DepthSounder, TackGenerator, Sail, Rudder
└── station/
    ├── _static/
    │   └── three.min.js  # Bundled Three.js (r128)
    ├── index.html        # Web station view: loads /paperboat/station.js
    ├── style.css         # Mediterranean Azure styling and HUD overlay
    └── paperboat.js      # Three.js orthographic renderer & paperboat station integration
```

---

## Verification & Packaging

### 1. Verify Backend
Verify manifest syntax, block catalog completeness, live WebSocket protocol smoke test, and golden run assertions:
```bash
paperboat check .
```
For fast layout and catalog syntax checks only:
```bash
paperboat check . --fast
```

### 2. Package Backend Archive
Package into a portable `.ppk` archive with SHA-256 integrity digests (stripping build and cache artifacts):
```bash
paperboat pack .
```
Produces `paperboat-paperboat-0.1.0.ppk`.

### 3. Unpack and Install
Extract and verify archive integrity into a destination directory:
```bash
paperboat unpack paperboat-paperboat-0.1.0.ppk --dir ~/.paperboat/backends/paperboat-paperboat-0.1.0
```

### 4. Automated Releases
The GitHub Actions workflow (`.github/workflows/package.yml`) verifies backend layout, builds the `.ppk` archive, and computes SHA-256 checksums on all pull requests and pushes.

When pushing to `main`, the workflow automatically extracts `version` from `backend.toml` and creates a GitHub Release (e.g. `v0.1.0`) attaching `paperboat-paperboat-<version>.ppk` and `checksums.txt` as downloadable release assets.

---

## Running Standalone

To run the backend directly:
```bash
python3 server.py --port 8774
```

To run the starter graph headless and verify golden assertions:
```bash
python3 server.py --run
```
