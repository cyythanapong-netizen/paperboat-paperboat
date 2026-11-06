"""Blocks for Paperboat Voyager: sensors/probes, actuators/sources, and tack logic."""

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
    """Outputs boat heading, linear speed, yaw rate, and heel roll."""
    type, label, kind = "boat", "Boat", "probe"
    outputs = ["heading", "speed", "heel", "yaw_rate"]

    def step(self, ctx, inputs) -> dict:
        game = ctx.state
        return {"heading": game.heading, "speed": game.speed, "heel": game.heel, "yaw_rate": game.yaw_rate}


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

        diff_wind = bearing - game.wind_dir
        while diff_wind > math.pi:
            diff_wind -= 2 * math.pi
        while diff_wind < -math.pi:
            diff_wind += 2 * math.pi
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
    """Generates alternating +/- 48 deg tack setpoints when target lies in No-Go zone."""
    type, label, kind = "tack_generator", "Tack Gen", "function"
    inputs = ["in_nogo"]
    outputs = ["error", "target_hdg"]

    def __init__(self, params: dict | None = None) -> None:
        super().__init__(params or {})
        self.tack_dir = -1.0
        self.timer = 0.0
        self.cooldown = 0.0

    def step(self, ctx, inputs) -> dict:
        game = ctx.state
        in_nogo = inputs.get("in_nogo", 0.0) > 0.5
        dx = game.chest_x - game.x
        dz = game.chest_z - game.z
        dist = math.hypot(dx, dz)
        bearing = math.atan2(dz, dx)

        if not in_nogo and dist < 10.0:
            target_hdg = bearing
        else:
            self.timer += ctx.dt
            self.cooldown = max(0.0, self.cooldown - ctx.dt)
            if self.cooldown <= 0.0 and (self.timer > 3.2 or game.dist_to_nearest_shore() < 2.0 or (self.tack_dir > 0 and game.x > 5.0) or (self.tack_dir < 0 and game.z < -7.5)):
                self.tack_dir *= -1.0
                self.timer = 0.0
                self.cooldown = 2.0
            target_hdg = game.wind_dir + (math.radians(48) if self.tack_dir > 0 else -math.radians(48))

        err = target_hdg - game.heading
        while err > math.pi:
            err -= 2 * math.pi
        while err < -math.pi:
            err += 2 * math.pi

        return {"error": err, "target_hdg": target_hdg}


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
