"""Flagship Paperboat backend: Paperboat Voyager (3D sailing game).

The paperboat, ocean waves, islands, and treasure are the domain state (domain/plant.py);
the starter flow in descriptor.toml is an autonomous upwind tacking autopilot.
"""

from pathlib import Path

from domain.blocks import BLOCKS
from domain.plant import VoyagerGame
import paperboat

if __name__ == "__main__":
    paperboat.serve(paperboat.Backend(
        engine="paperboat-paperboat",
        descriptor=Path(__file__).with_name("descriptor.toml"),
        state=VoyagerGame,
        blocks=BLOCKS,
        mode="clock",
        dt=0.02,
        duration=35.0,
        emit_every=2,
        speed=2.0,
        port=8774,
    ))
