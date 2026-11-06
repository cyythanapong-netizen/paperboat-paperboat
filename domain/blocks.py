"""Blocks for Paperboat: sensors/probes, actuators/sources, and tack logic."""

import math
import paperboat


class Wind(paperboat.Block):
    """Outputs true wind direction (deg & rad) and wind speed in knots."""
    type, label, kind = "wind", "Wind", "probe"
    outputs = ["direction", "speed"]

    def step(self, ctx, inputs) -> dict:
        game = ctx.state
        return {"direction": game.wind_dir, "speed": game.wind_speed}


class Boat(paperboat.Block):
    """Outputs boat heading, linear speed, yaw rate, heel roll, and coins."""
    type, label, kind = "boat", "Boat", "probe"
    outputs = ["heading", "speed", "heel", "yaw_rate", "coins"]

    def step(self, ctx, inputs) -> dict:
        game = ctx.state
        return {
            "heading": game.heading,
            "speed": game.speed,
            "heel": game.heel,
            "yaw_rate": game.yaw_rate,
            "coins": float(game.coins_collected),
        }


class NextTreasure(paperboat.Block):
    """Vectors to the upwind pirate treasure chest and whether it lies in the No-Go zone."""
    type, label, kind = "treasure", "Treasure", "probe"
    outputs = ["bearing", "dist", "in_nogo"]

    def step(self, ctx, inputs) -> dict:
        game = ctx.state
        dx = game.chest_x - game.x
        dz = game.chest_z - game.z
        dist = math.hypot(dx, dz)
        bearing = math.atan2(dz, dx)

        diff_wind = math.atan2(math.sin(bearing - game.wind_dir), math.cos(bearing - game.wind_dir))
        in_nogo = abs(diff_wind) < math.radians(45)

        return {"bearing": bearing, "dist": dist, "in_nogo": 1.0 if in_nogo else 0.0}


class DepthSounder(paperboat.Block):
    """Ultrasonic shore sensor: distance in meters to nearest island cliff."""
    type, label, kind = "depth_sounder", "Depth Sounder", "probe"
    outputs = ["dist_shore"]

    def step(self, ctx, inputs) -> dict:
        game = ctx.state
        return {"dist_shore": game.dist_to_nearest_shore()}


class TackGenerator(paperboat.Block):
    """Generates target heading setpoint for sailing: direct bearing or optimal upwind tacks."""
    type, label, kind = "tack_generator", "Tack Gen", "function"
    inputs = ["bearing", "dist", "in_nogo", "dist_shore", "wind_dir"]
    outputs = ["target_hdg"]

    def __init__(self, params: dict | None = None) -> None:
        super().__init__(params or {})
        self.tack_sign = -1.0
        self.tack_timer = 0.0

    def step(self, ctx, inputs) -> dict:
        game = ctx.state
        bearing = inputs.get("bearing", 0.0)
        in_nogo = inputs.get("in_nogo", 0.0) > 0.5
        dist_shore = inputs.get("dist_shore", 99.0)
        wind_dir = inputs.get("wind_dir", game.wind_dir)

        if not in_nogo:
            target_hdg = bearing
            self.tack_timer = 0.0
        else:
            self.tack_timer += ctx.dt
            dx = game.chest_x - game.x
            dz = game.chest_z - game.z
            cross = dx * math.sin(wind_dir) - dz * math.cos(wind_dir)

            if dist_shore < 2.5:
                self.tack_sign *= -1.0
                self.tack_timer = 0.0
            elif self.tack_timer > 3.0:
                if cross > 1.2 and self.tack_sign < 0:
                    self.tack_sign = 1.0
                    self.tack_timer = 0.0
                elif cross < -1.2 and self.tack_sign > 0:
                    self.tack_sign = -1.0
                    self.tack_timer = 0.0
                elif self.tack_timer > 6.0:
                    self.tack_sign *= -1.0
                    self.tack_timer = 0.0

            target_hdg = wind_dir + math.radians(46) * self.tack_sign

        return {"target_hdg": target_hdg}


class Sail(paperboat.Block):
    """Trims the sail boom to the commanded angle (5° to 85°)."""
    type, label, kind = "sail", "Sail", "source"
    inputs = ["trim_angle", "u"]

    def step(self, ctx, inputs) -> dict:
        game = ctx.state
        val = inputs.get("trim_angle", inputs.get("u", None))
        if val is not None:
            game.sail_angle = max(5.0, min(85.0, float(val)))
        return {}


class Rudder(paperboat.Block):
    """Commands ship helm wheel turn rate [-1.0 .. 1.0]."""
    type, label, kind = "rudder", "Rudder", "source"
    inputs = ["turn", "u"]

    def step(self, ctx, inputs) -> dict:
        game = ctx.state
        val = inputs.get("turn", inputs.get("u", None))
        if val is not None:
            game.rudder = max(-1.0, min(1.0, float(val)))
        return {}


BLOCKS = [Wind, Boat, NextTreasure, DepthSounder, TackGenerator, Sail, Rudder]
