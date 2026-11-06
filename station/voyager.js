// Paperboat Voyager: 3D pixel sailing station (Scheme C · Mediterranean Azure)
"use strict";

(function () {
  // Palettes: Scheme C · Mediterranean Azure
  const PALETTE = {
    bg: 0x0369a1,
    water: 0x0284c7,
    rippleGold: 0xfef08a,
    rippleOrange: 0xff5a1f,
    boatHull: 0xffffff,
    boatLit: 0xffffff,
    boatShade: 0xcbd5e1,
    sand: 0xfde047,
    cliff: 0xb45309,
    grass: 0x22c55e,
    grassDark: 0x166534,
    lighthouse: 0xffffff,
    chestBody: 0x975a16,
    chestGold: 0xfbbf24,
  };

  const container = document.getElementById("stationContainer");
  const canvas = document.getElementById("threeCanvas");

  // Telemetry DOM
  const hudSpeed = document.getElementById("hudSpeed");
  const hudSailAngle = document.getElementById("hudSailAngle");
  const sailThumb = document.getElementById("sailThumb");
  const helmWheel = document.getElementById("helmWheel");
  const windNeedleBox = document.getElementById("windNeedleBox");
  const lootCoins = document.getElementById("lootCoins");
  const lootChest = document.getElementById("lootChest");
  const statusBadge = document.getElementById("statusBadge");

  // Local state
  const state = {
    time: 0,
    running: false,
    ship: {
      x: -4.0,
      z: 7.0,
      heading: (45 * Math.PI) / 180,
      speed: 9.0,
      rudder: 0.1,
      sailAngle: 42.0,
      heel: -4.2,
      coins: 0,
      chestCollected: false,
    },
    wind: { dir: (315 * Math.PI) / 180, speed: 14.0 },
    chest: { x: 5.5, z: -8.0, collected: false },
  };

  // Three.js renderer
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);

  // Orthographic Top-Down Axonometric Camera
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(18, 24, 18);
  camera.lookAt(0, 0, 0);

  const pixelScale = 2;
  function resizeViewport() {
    const rect = container.getBoundingClientRect();
    const w = Math.max(100, Math.floor(rect.width / pixelScale));
    const h = Math.max(100, Math.floor(rect.height / pixelScale));
    renderer.setSize(w, h, false);

    const aspect = rect.width / rect.height;
    const frustumSize = 24;
    camera.left = (-frustumSize * aspect) / 2;
    camera.right = (frustumSize * aspect) / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resizeViewport);
  setTimeout(resizeViewport, 50);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
  sunLight.position.set(16, 26, 12);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 512;
  sunLight.shadow.mapSize.height = 512;
  const sd = 22;
  sunLight.shadow.camera.left = -sd;
  sunLight.shadow.camera.right = sd;
  sunLight.shadow.camera.top = sd;
  sunLight.shadow.camera.bottom = -sd;
  scene.add(sunLight);

  function addTri(arr, a, b, c) {
    arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }

  // --- Origami Paperboat Mesh (1.75x Heroic Scale) ---
  const paperboatGroup = new THREE.Group();
  paperboatGroup.scale.set(1.75, 1.75, 1.75);
  scene.add(paperboatGroup);

  const hullMat = new THREE.MeshLambertMaterial({
    color: PALETTE.boatHull,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const sailLitMat = new THREE.MeshLambertMaterial({
    color: PALETTE.boatLit,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const sailShadeMat = new THREE.MeshLambertMaterial({
    color: PALETTE.boatShade,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const bow = [1.7, 0.55, 0.0];
  const stern = [-1.6, 0.55, 0.0];
  const portGunwale = [0.0, 0.65, 0.95];
  const stbdGunwale = [0.0, 0.65, -0.95];
  const keelBow = [1.1, -0.45, 0.0];
  const keelMid = [0.0, -0.55, 0.0];
  const keelStern = [-1.1, -0.45, 0.0];

  const hullPositions = [];
  addTri(hullPositions, bow, portGunwale, keelBow);
  addTri(hullPositions, portGunwale, keelMid, keelBow);
  addTri(hullPositions, portGunwale, keelStern, keelMid);
  addTri(hullPositions, portGunwale, stern, keelStern);
  addTri(hullPositions, bow, keelBow, stbdGunwale);
  addTri(hullPositions, stbdGunwale, keelBow, keelMid);
  addTri(hullPositions, stbdGunwale, keelMid, keelStern);
  addTri(hullPositions, stbdGunwale, keelStern, stern);

  const hullGeom = new THREE.BufferGeometry();
  hullGeom.setAttribute("position", new THREE.Float32BufferAttribute(hullPositions, 3));
  hullGeom.computeVertexNormals();
  const hullMesh = new THREE.Mesh(hullGeom, hullMat);
  hullMesh.castShadow = true;
  paperboatGroup.add(hullMesh);

  // Sail
  const sailApex = [0.05, 2.2, 0.0];
  const sailBaseBow = [0.65, 0.5, 0.0];
  const sailBaseStern = [-0.65, 0.5, 0.0];
  const sailPortFoot = [0.0, 0.55, 0.75];
  const sailStbdFoot = [0.0, 0.55, -0.75];

  const portSailPositions = [];
  addTri(portSailPositions, sailApex, sailPortFoot, sailBaseBow);
  addTri(portSailPositions, sailApex, sailBaseStern, sailPortFoot);
  const portSailGeom = new THREE.BufferGeometry();
  portSailGeom.setAttribute("position", new THREE.Float32BufferAttribute(portSailPositions, 3));
  portSailGeom.computeVertexNormals();
  const portSailMesh = new THREE.Mesh(portSailGeom, sailLitMat);
  portSailMesh.castShadow = true;
  paperboatGroup.add(portSailMesh);

  const stbdSailPositions = [];
  addTri(stbdSailPositions, sailApex, sailBaseBow, sailStbdFoot);
  addTri(stbdSailPositions, sailApex, sailBaseStern, sailPortFoot);
  const stbdSailGeom = new THREE.BufferGeometry();
  stbdSailGeom.setAttribute("position", new THREE.Float32BufferAttribute(stbdSailPositions, 3));
  stbdSailGeom.computeVertexNormals();
  const stbdSailMesh = new THREE.Mesh(stbdSailGeom, sailShadeMat);
  stbdSailMesh.castShadow = true;
  paperboatGroup.add(stbdSailMesh);

  // Central crease line
  const mastMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 1.8, 4),
    new THREE.MeshBasicMaterial({ color: 0x2e2e2e })
  );
  mastMesh.position.set(0.05, 1.35, 0.0);
  paperboatGroup.add(mastMesh);

  // --- 5-Dot W2 Ripple Cushion Under Keel ---
  const rippleDots = [];
  const rippleMat = new THREE.MeshBasicMaterial({ color: PALETTE.rippleOrange });
  for (let k = 0; k < 5; k++) {
    const xPos = (k - 2) * 0.65;
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), rippleMat);
    dot.position.set(xPos, -0.48, 0.0);
    dot.baseY = -0.48;
    dot.phaseIndex = k;
    paperboatGroup.add(dot);
    rippleDots.push(dot);

    if (k >= 1 && k <= 3) {
      for (const zOffset of [-0.45, 0.45]) {
        const sideDot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), rippleMat);
        sideDot.position.set(xPos, -0.48, zOffset);
        sideDot.baseY = -0.48;
        sideDot.phaseIndex = k;
        paperboatGroup.add(sideDot);
        rippleDots.push(sideDot);
      }
    }
  }

  // --- Water Surface ---
  const waterGeom = new THREE.PlaneGeometry(70, 70, 52, 52);
  waterGeom.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshLambertMaterial({
    color: PALETTE.water,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const waterMesh = new THREE.Mesh(waterGeom, waterMat);
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);
  const waterPosAttr = waterGeom.attributes.position;
  const initialWaterY = new Float32Array(waterPosAttr.count);
  for (let i = 0; i < waterPosAttr.count; i++) initialWaterY[i] = waterPosAttr.getY(i);

  // --- Archipelago Islands & Lighthouse ---
  const islandGroup = new THREE.Group();
  scene.add(islandGroup);

  const grassMat = new THREE.MeshLambertMaterial({ color: PALETTE.grass, flatShading: true });
  const grassDarkMat = new THREE.MeshLambertMaterial({ color: PALETTE.grassDark, flatShading: true });
  const cliffMat = new THREE.MeshLambertMaterial({ color: PALETTE.cliff, flatShading: true });
  const sandMat = new THREE.MeshLambertMaterial({ color: PALETTE.sand, flatShading: true });
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x78350f, flatShading: true });
  const lightTowerMat = new THREE.MeshLambertMaterial({ color: PALETTE.lighthouse, flatShading: true });

  // Main Cove with Lighthouse
  const i1 = new THREE.Group();
  i1.position.set(7.5, 0, 3.0);

  const sand1 = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.25, 18), sandMat);
  sand1.position.y = 0.12;
  sand1.receiveShadow = true;
  i1.add(sand1);

  const foam1 = new THREE.Mesh(new THREE.CylinderGeometry(5.9, 5.9, 0.05, 18), foamMat);
  foam1.position.y = 0.02;
  i1.add(foam1);

  const cliff1 = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.4, 0.7, 16), cliffMat);
  cliff1.position.y = 0.55;
  cliff1.castShadow = true;
  cliff1.receiveShadow = true;
  i1.add(cliff1);

  const grass1 = new THREE.Mesh(new THREE.CylinderGeometry(4.02, 4.02, 0.1, 16), grassMat);
  grass1.position.y = 0.95;
  i1.add(grass1);

  const cliff2 = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 0.8, 12), cliffMat);
  cliff2.position.set(-0.8, 1.4, -0.6);
  cliff2.castShadow = true;
  i1.add(cliff2);

  const grass2 = new THREE.Mesh(new THREE.CylinderGeometry(2.42, 2.42, 0.1, 12), grassDarkMat);
  grass2.position.set(-0.8, 1.85, -0.6);
  i1.add(grass2);

  // Lighthouse
  const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 1.8, 8), lightTowerMat);
  lhBase.position.set(-0.8, 2.8, -0.6);
  lhBase.castShadow = true;
  i1.add(lhBase);

  const lhRedBand = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.65, 0.5, 8), new THREE.MeshLambertMaterial({ color: 0xff5a1f }));
  lhRedBand.position.set(-0.8, 2.8, -0.6);
  i1.add(lhRedBand);

  const lhLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.4, 6), new THREE.MeshBasicMaterial({ color: PALETTE.rippleGold }));
  lhLantern.position.set(-0.8, 3.85, -0.6);
  i1.add(lhLantern);

  const lhRoof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 8), new THREE.MeshLambertMaterial({ color: 0x1e293b }));
  lhRoof.position.set(-0.8, 4.25, -0.6);
  i1.add(lhRoof);

  // Wooden Pier
  const dock = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 3.2), woodMat);
  dock.position.set(-3.8, 0.3, 1.8);
  dock.rotation.y = -0.3;
  dock.castShadow = true;
  i1.add(dock);

  // Pine trees
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x14532d, flatShading: true });
  for (const p of [[1.2, 1.0, 1.0], [0.5, 1.0, 2.0], [-1.8, 1.0, 1.5], [1.8, 1.0, -1.0]]) {
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 5), treeMat);
    tree.position.set(p[0], p[1] + 0.65, p[2]);
    tree.castShadow = true;
    i1.add(tree);
  }
  islandGroup.add(i1);

  // Island 2: Lagoon Islet
  const i2 = new THREE.Group();
  i2.position.set(-8.5, 0, -3.5);
  const sand2 = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 0.25, 16), sandMat);
  sand2.position.y = 0.12;
  sand2.receiveShadow = true;
  i2.add(sand2);

  const cliffB1 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 0.6, 14), cliffMat);
  cliffB1.position.y = 0.5;
  cliffB1.castShadow = true;
  i2.add(cliffB1);

  const grassB1 = new THREE.Mesh(new THREE.CylinderGeometry(2.62, 2.62, 0.1, 14), grassMat);
  grassB1.position.y = 0.85;
  i2.add(grassB1);
  islandGroup.add(i2);

  // Breaker rocks
  for (const rockPos of [[-4.0, 3.5], [3.0, -6.0], [9.5, -4.5]]) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), cliffMat);
    rock.position.set(rockPos[0], 0.35, rockPos[1]);
    rock.castShadow = true;
    islandGroup.add(rock);

    const rFoam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.05, 10), foamMat);
    rFoam.position.set(rockPos[0], 0.02, rockPos[1]);
    islandGroup.add(rFoam);
  }

  // Floating Chest
  const chestGroup = new THREE.Group();
  chestGroup.position.set(state.chest.x, 0.45, state.chest.z);
  const chestBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: PALETTE.chestBody, flatShading: true }));
  chestBody.castShadow = true;
  chestGroup.add(chestBody);
  const chestBands = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.92, 0.92), new THREE.MeshLambertMaterial({ color: PALETTE.chestGold, flatShading: true }));
  chestGroup.add(chestBands);
  scene.add(chestGroup);

  // Wire Paperboat Station Events
  if (window.paperboat) {
    paperboat
      .on("run.started", () => {
        state.running = true;
        statusBadge.textContent = "Running";
        statusBadge.className = "running";
      })
      .on("log", (m) => {
        if (m.text.includes("grounded") || m.text.includes("crashed")) {
          statusBadge.textContent = "Grounded";
          statusBadge.className = "crashed";
        } else if (m.text.includes("retrieved") || m.text.includes("completed")) {
          statusBadge.textContent = "Retrieved!";
          statusBadge.className = "won";
        }
      })
      .on("run.finished", (m) => {
        state.running = false;
        if (m.status !== "done") {
          statusBadge.textContent = m.status;
          statusBadge.className = "crashed";
        }
      });
  }

  // Render & Animation Loop
  let lastTime = performance.now();
  function animate(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    state.time += dt;

    // Pull entities from engine if available
    if (window.paperboat && paperboat.entities) {
      const shipEnt = paperboat.entities.get("ship");
      if (shipEnt) {
        if (shipEnt.pos) {
          state.ship.x = shipEnt.pos[0];
          state.ship.z = shipEnt.pos[2];
        }
        if (shipEnt.rot) {
          state.ship.heading = -shipEnt.rot[1];
          state.ship.heel = shipEnt.rot[2];
        }
        if (shipEnt.speed !== undefined) state.ship.speed = shipEnt.speed;
        if (shipEnt.rudder !== undefined) state.ship.rudder = shipEnt.rudder;
        if (shipEnt.sail_angle !== undefined) state.ship.sailAngle = shipEnt.sail_angle;
        if (shipEnt.coins !== undefined) state.ship.coins = shipEnt.coins;
        if (shipEnt.chest_collected !== undefined) state.ship.chestCollected = shipEnt.chest_collected;
      }
    }

    // Telemetry updates
    if (hudSpeed) hudSpeed.textContent = Math.round(state.ship.speed);
    if (hudSailAngle) hudSailAngle.textContent = `${Math.round(state.ship.sailAngle)}°`;
    if (sailThumb) sailThumb.style.top = `${((state.ship.sailAngle - 5) / 80) * 100}%`;
    if (helmWheel) helmWheel.style.transform = `rotate(${state.ship.rudder * 140}deg)`;
    if (lootCoins) lootCoins.textContent = state.ship.coins;
    if (lootChest) lootChest.textContent = state.ship.chestCollected ? "1" : "0";
    if (windNeedleBox) windNeedleBox.style.transform = `rotate(${(state.wind.dir * 180) / Math.PI}deg)`;

    // Dynamic Buoyancy (NEVER clips water!)
    const waveHeight = Math.sin(state.ship.x * 0.4 + state.time * 2.2) * 0.12 + Math.cos(state.ship.z * 0.4 + state.time * 1.8) * 0.08;
    paperboatGroup.position.set(state.ship.x, waveHeight + 0.55, state.ship.z);
    paperboatGroup.rotation.y = -state.ship.heading + Math.PI / 2;
    paperboatGroup.rotation.z = (state.ship.heel * Math.PI) / 180;
    paperboatGroup.rotation.x = Math.sin(state.time * 3.0) * 0.04;

    // Ripple dot animation under keel
    for (let k = 0; k < rippleDots.length; k++) {
      const dot = rippleDots[k];
      const dotTime = (state.time * 1.4 - dot.phaseIndex * 0.12) % 1.4;
      if (dotTime > 0) {
        dot.position.y = dot.baseY + 0.16 * Math.sin(Math.PI * (dotTime / 1.4));
      } else {
        dot.position.y = dot.baseY;
      }
    }

    // Water wave vertices
    for (let i = 0; i < waterPosAttr.count; i++) {
      const vx = waterPosAttr.getX(i);
      const vz = waterPosAttr.getZ(i);
      const waveY = Math.sin(vx * 0.4 + state.time * 2.2) * 0.12 + Math.cos(vz * 0.4 + state.time * 1.8) * 0.08;
      waterPosAttr.setY(i, initialWaterY[i] + waveY);
    }
    waterPosAttr.needsUpdate = true;
    waterGeom.computeVertexNormals();

    // Chest bobbing
    chestGroup.position.y = 0.35 + Math.sin(state.time * 3) * 0.08;
    chestGroup.rotation.y = state.time * 0.5;
    if (state.ship.chestCollected) {
      chestGroup.visible = false;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
