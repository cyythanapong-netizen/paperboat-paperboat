// Paperboat: 3D pixel sailing station (Scheme C · Mediterranean Azure)
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
  const sailBoomGroupSvg = document.getElementById("sailBoomGroupSvg");
  const sailAppWindGroup = document.getElementById("sailAppWindGroup");
  const hudSailTack = document.getElementById("hudSailTack");

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

  // Helper: Procedural Retro Pixel Textures with Nearest Neighbor Filtering
  function createPixelTexture(width, height, drawFn, repX = 1, repY = 1) {
    const cvs = document.createElement("canvas");
    cvs.width = width;
    cvs.height = height;
    const ctx = cvs.getContext("2d");
    drawFn(ctx, width, height);
    const tex = new THREE.CanvasTexture(cvs);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repX, repY);
    return tex;
  }

  // 1. Procedural Pixel Sea Texture
  const seaTexture = createPixelTexture(32, 32, (ctx, w, h) => {
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(0, 0, w, h);
    const blues = ["#0369a1", "#0284c7", "#0ea5e9", "#075985", "#38bdf8"];
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const n = Math.sin(x * 0.9) * Math.cos(y * 0.9);
        const idx = Math.floor(Math.abs(n * 5)) % blues.length;
        ctx.fillStyle = blues[idx];
        ctx.fillRect(x, y, 2, 2);
        if ((x * 5 + y * 11) % 19 === 0) {
          ctx.fillStyle = "#bae6fd"; // Crisp pixel whitecap fleck
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }, 24, 24);

  // 2. Procedural Pixel Sand Texture
  const sandTexture = createPixelTexture(16, 16, (ctx, w, h) => {
    ctx.fillStyle = "#fde047";
    ctx.fillRect(0, 0, w, h);
    const sands = ["#facc15", "#eab308", "#fde047", "#ca8a04"];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if ((x * 3 + y * 7) % 4 === 0) {
          ctx.fillStyle = sands[(x + y) % sands.length];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }, 8, 8);

  // 3. Procedural Pixel Stepped Cliff Texture
  const cliffTexture = createPixelTexture(16, 16, (ctx, w, h) => {
    ctx.fillStyle = "#b45309";
    ctx.fillRect(0, 0, w, h);
    const strata = ["#92400e", "#78350f", "#b45309", "#d97706", "#451a03"];
    for (let y = 0; y < h; y++) {
      const band = strata[Math.floor(y / 3) % strata.length];
      ctx.fillStyle = band;
      ctx.fillRect(0, y, w, 1);
      for (let x = 0; x < w; x++) {
        if ((x * 5 + y * 13) % 7 === 0) {
          ctx.fillStyle = "#451a03";
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }, 6, 6);

  // 4. Procedural Pixel Grass Texture
  const grassTexture = createPixelTexture(16, 16, (ctx, w, h) => {
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(0, 0, w, h);
    const grasses = ["#16a34a", "#15803d", "#22c55e", "#166534", "#4ade80"];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if ((x * 7 + y * 5) % 4 === 0) {
          ctx.fillStyle = grasses[(x * 2 + y) % grasses.length];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }, 8, 8);

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

  // 3D Sail Boom Group (pivoting on mast at x=0.05, y=0.0, z=0.0)
  const sailBoomGroup = new THREE.Group();
  sailBoomGroup.position.set(0.05, 0.0, 0.0);
  paperboatGroup.add(sailBoomGroup);

  // Sail vertices local to sailBoomGroup (mast is at local 0,0,0)
  const sailApex = [0.0, 2.2, 0.0];
  const sailBaseBow = [0.60, 0.5, 0.0];
  const sailBaseStern = [-0.70, 0.5, 0.0];
  const sailPortFoot = [-0.05, 0.55, 0.75];
  const sailStbdFoot = [-0.05, 0.55, -0.75];

  const portSailPositions = [];
  addTri(portSailPositions, sailApex, sailPortFoot, sailBaseBow);
  addTri(portSailPositions, sailApex, sailBaseStern, sailPortFoot);
  const portSailGeom = new THREE.BufferGeometry();
  portSailGeom.setAttribute("position", new THREE.Float32BufferAttribute(portSailPositions, 3));
  portSailGeom.computeVertexNormals();
  const portSailMesh = new THREE.Mesh(portSailGeom, sailLitMat);
  portSailMesh.castShadow = true;
  sailBoomGroup.add(portSailMesh);

  const stbdSailPositions = [];
  addTri(stbdSailPositions, sailApex, sailBaseBow, sailStbdFoot);
  addTri(stbdSailPositions, sailApex, sailBaseStern, sailStbdFoot);
  const stbdSailGeom = new THREE.BufferGeometry();
  stbdSailGeom.setAttribute("position", new THREE.Float32BufferAttribute(stbdSailPositions, 3));
  stbdSailGeom.computeVertexNormals();
  const stbdSailMesh = new THREE.Mesh(stbdSailGeom, sailShadeMat);
  stbdSailMesh.castShadow = true;
  sailBoomGroup.add(stbdSailMesh);

  // Central crease line (Mast)
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

  // --- Water Surface with Procedural Pixel Texture ---
  const waterGeom = new THREE.PlaneGeometry(80, 80, 64, 64);
  waterGeom.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshLambertMaterial({
    map: seaTexture,
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

  // --- Multi-Frequency Wave Dynamics ---
  function getWaveHeight(x, z, time, shipX, shipZ, shipSpeed) {
    // 1. Primary Wind Swell (NW Northwest wind: direction ~ 315 deg = 5.497 rad)
    const windAngle = (315 * Math.PI) / 180;
    const cosW = Math.cos(windAngle);
    const sinW = Math.sin(windAngle);
    const d1 = x * cosW + z * sinW;
    const swell = Math.sin(d1 * 0.38 + time * 2.6) * 0.16;

    // 2. Secondary Cross-Swell (interference chop)
    const d2 = x * -sinW + z * cosW;
    const chop = Math.cos(d2 * 0.55 - time * 1.9) * 0.08;

    // 3. High-Frequency Surface Ripple
    const ripple = Math.sin((x + z) * 1.1 + time * 3.4) * 0.035;

    // 4. Dynamic Boat Wake Ring Disturbance
    let wake = 0;
    if (shipX !== undefined && shipZ !== undefined) {
      const dist = Math.hypot(x - shipX, z - shipZ);
      if (dist > 0.5 && dist < 6.0) {
        const wakeFade = 1.0 - dist / 6.0;
        const spd = shipSpeed !== undefined ? shipSpeed : 9.0;
        wake = Math.sin(dist * 3.2 - time * 5.0) * wakeFade * 0.10 * Math.min(1.5, spd / 8.0);
      }
    }

    // Trochoidal crest sharpening
    const raw = swell + chop + ripple + wake;
    return raw > 0 ? Math.pow(raw, 0.9) * 1.15 : raw;
  }

  // --- Archipelago Islands with Procedural Pixel Land Textures ---
  const islandGroup = new THREE.Group();
  scene.add(islandGroup);

  const grassMat = new THREE.MeshLambertMaterial({ map: grassTexture, color: PALETTE.grass, flatShading: true });
  const grassDarkMat = new THREE.MeshLambertMaterial({ map: grassTexture, color: PALETTE.grassDark, flatShading: true });
  const cliffMat = new THREE.MeshLambertMaterial({ map: cliffTexture, color: PALETTE.cliff, flatShading: true });
  const sandMat = new THREE.MeshLambertMaterial({ map: sandTexture, color: PALETTE.sand, flatShading: true });
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
        } else if (m.text.includes("retrieved")) {
          statusBadge.textContent = "Loot Collected!";
          statusBadge.className = "won";
          setTimeout(() => {
            if (state.running) {
              statusBadge.textContent = "Running";
              statusBadge.className = "running";
            }
          }, 2000);
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
        if (shipEnt.wind_dir !== undefined) state.wind.dir = shipEnt.wind_dir;
        if (shipEnt.wind_speed !== undefined) state.wind.speed = shipEnt.wind_speed;
      }
      const chestEnt = paperboat.entities.get("chest");
      if (chestEnt && chestEnt.pos) {
        state.chest.x = chestEnt.pos[0];
        state.chest.z = chestEnt.pos[2];
        chestGroup.position.set(state.chest.x, 0.45, state.chest.z);
      }
    }

    // Apparent Wind & Sail Trim Physics
    function wrapAngle(a) {
      while (a > Math.PI) a -= 2 * Math.PI;
      while (a < -Math.PI) a += 2 * Math.PI;
      return a;
    }
    const relWind = wrapAngle(state.wind.dir - state.ship.heading);
    // If relWind > 0 (wind blowing from starboard): boom trims to Port (+Z in Three.js, -rotation.y)
    // If relWind <= 0 (wind blowing from port): boom trims to Starboard (-Z in Three.js, +rotation.y)
    const isPortTack = Math.sin(relWind) > 0;
    const boomTrimDeg = Math.min(80, Math.max(10, state.ship.sailAngle));
    const boomTrimRad = (boomTrimDeg * Math.PI) / 180;
    // 3D sail boom rotation around mast
    const boom3DYaw = (isPortTack ? -1 : 1) * boomTrimRad * 0.45;
    sailBoomGroup.rotation.y = boom3DYaw;

    // Telemetry updates
    if (hudSpeed) hudSpeed.textContent = Math.round(state.ship.speed);
    if (hudSailAngle) hudSailAngle.textContent = `${Math.round(state.ship.sailAngle)}°`;
    if (sailThumb) sailThumb.style.top = `${((state.ship.sailAngle - 5) / 80) * 100}%`;
    if (helmWheel) helmWheel.style.transform = `rotate(${state.ship.rudder * 140}deg)`;
    if (lootCoins) lootCoins.textContent = state.ship.coins;
    if (lootChest) lootChest.textContent = Math.floor(state.ship.coins / 25);
    if (windNeedleBox) windNeedleBox.style.transform = `rotate(${(state.wind.dir * 180) / Math.PI}deg)`;

    // Sail Direction HUD Dial & Badge
    if (sailBoomGroupSvg) {
      // Boom swinging to Port (-angle in SVG), Starboard (+angle in SVG)
      const boomSvgAngle = isPortTack ? -boomTrimDeg : boomTrimDeg;
      sailBoomGroupSvg.setAttribute("transform", `rotate(${boomSvgAngle} 32 28)`);
    }

    if (sailAppWindGroup) {
      // Relative wind direction in dial: relative to boat heading
      const relWindDeg = (relWind * 180) / Math.PI;
      sailAppWindGroup.setAttribute("transform", `rotate(${relWindDeg} 32 32)`);
    }

    if (hudSailTack) {
      const tackSide = isPortTack ? "PORT" : "STBD";
      hudSailTack.textContent = `${tackSide} ${Math.round(boomTrimDeg)}°`;
      hudSailTack.className = `sail-tack-badge ${isPortTack ? "port" : "stbd"}`;
    }

    // Dynamic Multi-Frequency Wave Vertices with Trochoidal Wake
    for (let i = 0; i < waterPosAttr.count; i++) {
      const vx = waterPosAttr.getX(i);
      const vz = waterPosAttr.getZ(i);
      const waveY = getWaveHeight(vx, vz, state.time, state.ship.x, state.ship.z, state.ship.speed);
      waterPosAttr.setY(i, initialWaterY[i] + waveY);
    }
    waterPosAttr.needsUpdate = true;
    waterGeom.computeVertexNormals();

    // Authentic Dynamic Buoyancy & Wave Crest Pitching
    const bowX = state.ship.x + Math.cos(state.ship.heading) * 1.6;
    const bowZ = state.ship.z + Math.sin(state.ship.heading) * 1.6;
    const sternX = state.ship.x - Math.cos(state.ship.heading) * 1.6;
    const sternZ = state.ship.z - Math.sin(state.ship.heading) * 1.6;

    const bowWave = getWaveHeight(bowX, bowZ, state.time);
    const sternWave = getWaveHeight(sternX, sternZ, state.time);
    const midWave = getWaveHeight(state.ship.x, state.ship.z, state.time);
    const pitch = Math.atan2(bowWave - sternWave, 3.2);

    paperboatGroup.position.set(state.ship.x, midWave + 0.55, state.ship.z);
    paperboatGroup.rotation.y = -state.ship.heading + Math.PI / 2;
    paperboatGroup.rotation.z = (state.ship.heel * Math.PI) / 180;
    paperboatGroup.rotation.x = -pitch;

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

    // Chest bobbing on waves
    const chestWave = getWaveHeight(state.chest.x, state.chest.z, state.time);
    chestGroup.position.y = 0.40 + chestWave + Math.sin(state.time * 2.8) * 0.05;
    chestGroup.rotation.y = state.time * 0.5;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
