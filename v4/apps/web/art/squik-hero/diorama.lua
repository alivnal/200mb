-- Squik diorama engine: the shared machinery behind every Squik scene (the
-- homepage hero and the compress, merge and trim scenes on the encoding
-- screen). A scene script builds its world and actors on top of it:
--
--   local D = dofile(app.params.lib)({ variant = "day" | "night", flow = ..., waterLevel = ... })
--   D.setS(x, y, z, "grass") ... D.render({ actors = {...}, fx = ..., name = ... })
--
-- The world is voxels: each is a 4x4 pixel cube stepping (+2,+1) per x,
-- (-2,+1) per y and -2 rows per z. A per-pixel depth key ((x+y), z) replaces
-- painter sorting, so the static world renders once; water, moving props and
-- the beaver sprites depth-test against it.
--
-- Every scene shares the canvas, grid, projection and loop length, so the
-- site places all of them the same way: the empty front meadow sits at the
-- same art point under the tool card, and the sun and moon sprites
-- (celestial.lua) sit over the same patch of sky.

return function(opts)
  local D = {}
  local W, H = 320, 260 -- tall canvas: the edge fall runs down toward the page footer
  local OX, OY = 124, 36
  local GX, GY = 96, 60
  local L = 120 -- loop length in frames; every cycle in a scene divides it
  local FRAME_MS = 90
  -- Mirrored so the action sits left and the empty meadow sits under the
  -- site's tool card. Swapping x/y keeps the light coming from the same side.
  local FLIP = true
  local NIGHT = opts.variant == "night"
  local SX0 = FLIP and (W - 4 - OX) or OX
  local pc = app.pixelColor
  D.W, D.H, D.GX, D.GY, D.L, D.FLIP, D.NIGHT, D.pc = W, H, GX, GY, L, FLIP, NIGHT, pc

  local function hex(s)
    return pc.rgba(tonumber(s:sub(2, 3), 16), tonumber(s:sub(4, 5), 16), tonumber(s:sub(6, 7), 16), 255)
  end

  local function sh(c, f)
    local function m(v) return math.max(0, math.min(255, math.floor(v * f + 0.5))) end
    return pc.rgba(m(pc.rgbaR(c)), m(pc.rgbaG(c)), m(pc.rgbaB(c)), 255)
  end

  local function hash(x, y, s)
    local n = ((x + 97) * 374761393 + (y + 89) * 668265263 + (s or 0) * 1442695041) % 2147483647
    n = ((n ~ (n >> 13)) * 1274126177) % 2147483647
    return (n % 1000) / 1000
  end

  local function smooth(t)
    t = math.max(0, math.min(1, t))
    return t * t * (3 - 2 * t)
  end
  D.hex, D.sh, D.hash, D.smooth = hex, sh, hash, smooth

  -- Palette follows the site's DamEnvironment colours.
  local C = {
    grassA = hex("#78934a"), grassB = hex("#6f8a46"), grassC = hex("#668345"),
    grassL = hex("#547b43"), grassR = hex("#456b42"),
    flowerA = hex("#e8d36a"), flowerB = hex("#eef0e2"),
    dirt = { hex("#7a5a3a"), hex("#5f4630"), hex("#4b3726") },
    base = { hex("#394e45"), hex("#304542"), hex("#263d3b") },
    sand = { hex("#b5a676"), hex("#988b62"), hex("#7d7250") },
    bed = { hex("#5e6b58"), hex("#4d584a"), hex("#3f493d") },
    stone = { hex("#a8b6a1"), hex("#72857b"), hex("#586d69") },
    log = { hex("#c58a4e"), hex("#94603a"), hex("#74452f") },
    logLight = hex("#d49a5c"), logEnd = hex("#e2c08a"),
    mud = { hex("#8c6740"), hex("#705238"), hex("#57432f") },
    trunk = { hex("#765038"), hex("#63432f"), hex("#4f3626") },
    leaf = { hex("#6e9649"), hex("#86a64b"), hex("#4c763e"), hex("#a0b855") },
    pine = { hex("#456b3e"), hex("#3f6a43"), hex("#4f7a46") },
    reed = { hex("#79994b"), hex("#96ad51") }, cattail = hex("#765038"),
    lily = hex("#5f9a4a"), lilyFlower = hex("#e8a0b8"),
    water = hex("#389bb2"), waterHi = hex("#4eafc1"), glint = hex("#a7d7bf"), foam = hex("#d1eac6"),
    waterL = hex("#2a7f96"), waterR = hex("#226b80"), waterLipL = hex("#45a6bd"), waterLipR = hex("#3a93a9"),
    fall = hex("#38a8b8"), fallHi = hex("#57c0c9"), fallFoam = hex("#b4e4d8"),
    -- Squik mascot blues.
    blue = hex("#3f8ef5"), blueL = hex("#2f74dc"), blueR = hex("#245bb5"),
    blue2 = hex("#3480ea"), ear = hex("#2a63c4"), muzzle = hex("#7fb6f8"),
    eye = hex("#0d1f4d"), nose = hex("#14306e"), feet = hex("#1f4fa8"),
    belly = { hex("#c7cdd6"), hex("#a9b0bb"), hex("#8f97a3") },
    tailA = hex("#a3d3fa"), tailB = hex("#6fb2f0"), teeth = hex("#ffffff"),
    chip = hex("#e2c08a"), zz = hex("#d8e6ff"), fish = hex("#f0a35a"), outline = hex("#10306e"),
    rope = hex("#d9c79a"), ropeShade = hex("#b39f72"),
  }
  D.C = C

  -- Seasons recolour the world: autumn leaves, spring blossom, winter snow.
  -- The homepage hero has none: its own summer palette above.
  local SEASON = opts.season
  D.SEASON = SEASON
  if SEASON == "autumn" then
    C.grassA, C.grassB, C.grassC = hex("#b3a24b"), hex("#a89746"), hex("#9b8a42")
    C.leaf = { hex("#d9822b"), hex("#e8a23a"), hex("#b8582a"), hex("#f0c050") }
    C.flowerA, C.flowerB = hex("#c8572a"), hex("#e8a23a") -- fallen leaves on the grass
  elseif SEASON == "spring" then
    C.grassA, C.grassB, C.grassC = hex("#7fa64c"), hex("#759c49"), hex("#6c9146")
    C.flowerA, C.flowerB = hex("#f4bfd3"), hex("#fff4a8")
  elseif SEASON == "winter" then
    C.snow = { hex("#eef3f8"), hex("#e2e9f1"), hex("#cdd8e4"), hex("#b7c6d6") }
    C.ice = { hex("#a9d8ea"), hex("#8cc7de"), hex("#e6f6fc") }
  end
  -- Reeds dry out in autumn and winter.
  if SEASON == "autumn" or SEASON == "winter" then C.reed = { hex("#a08a52"), hex("#b8a064") } end
  C.blossom = { hex("#f4bfd3"), hex("#ea9fbd"), hex("#f9dbe7"), hex("#ffffff") }
  C.carrot, C.coal = hex("#f08a2c"), hex("#2b2f36")

  local function tri(c) return c, sh(c, 0.8), sh(c, 0.62) end
  -- Seasonal scenes shade with hue-shifted ramps: the side faces darken and
  -- drift toward the season's shadow hue (plum in autumn, violet in spring,
  -- blue in winter) instead of going flat and muddy.
  local SHADOW = ({ autumn = hex("#6b2a4a"), spring = hex("#6a4a9a"), winter = hex("#5874b4") })[SEASON]
  local function mix(a, b, k)
    local function m(u, v) return math.floor(u + (v - u) * k + 0.5) end
    return pc.rgba(m(pc.rgbaR(a), pc.rgbaR(b)), m(pc.rgbaG(a), pc.rgbaG(b)), m(pc.rgbaB(a), pc.rgbaB(b)), 255)
  end
  local function ramp(c)
    if not SHADOW then return tri(c) end
    return c, mix(sh(c, 0.84), SHADOW, 0.16), mix(sh(c, 0.68), SHADOW, 0.28)
  end
  if SEASON then
    local _, l, r = ramp(C.grassB)
    C.grassL, C.grassR = l, r
  end
  if SEASON == "winter" then
    local _, l, r = ramp(C.snow[1])
    C.snow[3], C.snow[4] = l, r
  end
  local function t3(p) return p[1], p[2], p[3] end
  D.tri = tri

  -- Night grade: darken and pull toward moonlit blue. Light sources (lantern,
  -- fireflies, moon glints) are emissive and keep their own colours.
  local LIGHT = {
    core = hex("#fff3b0"), glass = hex("#ffd27a"), glassDim = hex("#f0b85a"),
    halo = hex("#8a6a3a"), fly = hex("#f6ffa8"), flyHalo = hex("#7f9a3e"), moon = hex("#e4ecff"),
  }
  D.LIGHT = LIGHT
  local EMISSIVE = {}
  for _, c in pairs(LIGHT) do EMISSIVE[c] = true end

  local function clamp8(v) return math.max(0, math.min(255, math.floor(v + 0.5))) end
  local function nightGrade(c, lift)
    if EMISSIVE[c] then return c end
    local r, g, b = pc.rgbaR(c), pc.rgbaG(c), pc.rgbaB(c)
    local l = 0.3 * r + 0.59 * g + 0.11 * b
    local k = lift or 0
    return pc.rgba(
      clamp8((r * 0.5 + l * 0.2) * (0.58 + k) + 10),
      clamp8((g * 0.5 + l * 0.2) * (0.64 + k) + 16),
      clamp8((b * 0.5 + l * 0.2) * (0.74 + k) + 44), 255)
  end
  -- Beavers get a little extra light so they still read at night.
  local function G(c, lift) if NIGHT then return nightGrade(c, lift) end return c end
  D.G = G

  -- Materials return: top, left (+y face), right (+x face), lipL, lipR, speck, rows.
  local MAT = {}
  D.MAT = MAT
  MAT.base = function() return t3(C.base) end
  MAT.dirt = function() return t3(C.dirt) end
  MAT.sand = function()
    if SEASON == "winter" then return C.snow[2], C.snow[3], C.snow[4] end
    return t3(C.sand)
  end
  MAT.bed = function() return t3(C.bed) end
  MAT.stone = function() return t3(C.stone) end
  -- Flowers (or fallen leaves) are denser in spring and autumn.
  local SPECK_A, SPECK_B = 0.014, 0.02
  if SEASON == "spring" then SPECK_A, SPECK_B = 0.05, 0.08 elseif SEASON == "autumn" then SPECK_A, SPECK_B = 0.05, 0.09 end
  MAT.grass = function(x, y)
    if SEASON == "winter" then
      -- Drifts, not tiles: soft patches of the second tone.
      local top = (hash(x // 2, y // 2, 12) < 0.3) and C.snow[2] or C.snow[1]
      return top, C.snow[3], C.snow[4], nil, nil, (hash(x, y, 11) < 0.03) and C.snow[3] or nil
    end
    local top = (((x // 4) + (y // 4)) % 2 == 0) and C.grassA or C.grassB
    if hash(x, y, 1) < 0.1 then top = C.grassC end
    local speck
    local hs = hash(x, y, 11)
    if hs < SPECK_A then speck = C.flowerA elseif hs < SPECK_B then speck = C.flowerB end
    return top, C.grassL, C.grassR, nil, nil, speck
  end
  MAT.log = function(x, y, z)
    local hs = hash(x, z, (y + math.floor(hash(x, z, 2) * 4)) // 4)
    local top = (hs < 0.45 and C.log[1]) or (hs < 0.75 and C.logLight) or (hs < 0.9 and C.log[2]) or C.mud[1]
    return top, sh(top, 0.76), sh(top, 0.6)
  end
  -- Logs lying along y: the grain runs the other way.
  MAT.logY = function(x, y, z)
    local hs = hash(y, z, (x + math.floor(hash(y, z, 2) * 4)) // 4)
    local top = (hs < 0.45 and C.log[1]) or (hs < 0.75 and C.logLight) or (hs < 0.9 and C.log[2]) or C.mud[1]
    return top, sh(top, 0.76), sh(top, 0.6)
  end
  MAT.logEnd = function() return C.logEnd, sh(C.logEnd, 0.85), sh(C.logEnd, 0.7) end
  MAT.rope = function() return C.rope, C.ropeShade, sh(C.ropeShade, 0.85) end
  MAT.lodge = function(x, y, z, top)
    local hs = hash(x, y, z)
    local c = (hs < 0.35 and C.mud[1]) or (hs < 0.65 and C.log[2]) or (hs < 0.85 and C.log[1]) or C.mud[2]
    if SEASON == "winter" and top then return C.snow[2], select(2, ramp(c)) end
    return ramp(c)
  end
  MAT.trunk = function() return t3(C.trunk) end
  MAT.branch = function(x, y, z, top)
    if top and SEASON == "winter" then return C.snow[1], C.trunk[2], C.trunk[3] end
    return t3(C.trunk)
  end
  MAT.chewed = function() return C.logEnd, sh(C.logEnd, 0.85), sh(C.logEnd, 0.7) end
  MAT.leaf = function(x, y, z, top)
    local hs = hash(x + z, y, 4)
    local c = (hs < 0.4 and C.leaf[1]) or (hs < 0.7 and C.leaf[2]) or (hs < 0.95 and C.leaf[3]) or C.leaf[4]
    if SEASON == "winter" and top then return C.snow[1], select(2, ramp(c)) end
    return ramp(c)
  end
  MAT.pine = function(x, y, z, top)
    local c = C.pine[1 + math.floor(hash(x, y + z, 5) * 3)]
    if SEASON == "winter" and top then return C.snow[1], select(2, ramp(c)) end
    return ramp(c)
  end
  MAT.blossom = function(x, y, z)
    local hs = hash(x + z, y, 6)
    return ramp((hs < 0.45 and C.blossom[1]) or (hs < 0.75 and C.blossom[2]) or (hs < 0.95 and C.blossom[3]) or C.blossom[4])
  end
  MAT.snow = function() return C.snow[1], C.snow[3], C.snow[4] end
  -- Packed snow blocks: shaded harder than drifts so a wall of them stands out
  -- on snow, with a darker joint along the bottom of each face.
  local BLOCK = { hex("#f4f8fc"), hex("#b9c8e0"), hex("#9cb0d2"), hex("#9fb2d2"), hex("#8399c2") }
  MAT.snowblock = function()
    return BLOCK[1], BLOCK[2], BLOCK[4], nil, nil, nil, { BLOCK[2], BLOCK[3], BLOCK[4], BLOCK[5] }
  end
  MAT.carrot = function() return tri(C.carrot) end
  MAT.coal = function() return tri(C.coal) end
  MAT.reed = function(x, y, z) return tri(C.reed[1 + (x + y + z) % 2]) end
  MAT.cattail = function() return tri(C.cattail) end
  MAT.lantern = function()
    if NIGHT then return LIGHT.core, LIGHT.glass, LIGHT.glassDim end
    return hex("#f2d58a"), hex("#d9b46a"), hex("#b8924f")
  end

  -- Water colours animate; state is set per frame before drawing. A scene's
  -- flow(x, y) gives the downstream direction { dx, dy } of running water,
  -- or nil for still water.
  local waterT, wakeCells = 0, {}
  local lily = {}
  D.lily = lily
  local flow = opts.flow or function() return nil end
  MAT.water = function(x, y, z, top)
    local c = C.water
    local f = flow(x, y)
    if f then
      -- Scattered flecks drifting downstream; (u - t) wraps with the loop.
      local u, v = x * f[1] + y * f[2], y * f[1] - x * f[2]
      local h = hash((u - waterT) % L, v, 81)
      if h < 0.05 then c = C.foam elseif h < 0.16 then c = C.waterHi end
    else
      -- Still pond: sparse glints that twinkle on their own phase.
      local h = hash(x, y, 82)
      if h < 0.05 and (waterT + math.floor(hash(x, y, 83) * L)) % 40 < 6 then c = NIGHT and LIGHT.moon or C.glint
      elseif h > 0.94 then c = C.waterHi end
    end
    local lp = lily[x * 100 + y]
    if lp then c = lp end
    if wakeCells[x * 100 + y] then c = C.foam end
    if top then return c, C.waterL, C.waterR, C.waterLipL, C.waterLipR end
    return c, C.waterL, C.waterR
  end
  MAT.ice = function(x, y, z, top)
    local c = C.ice[1]
    local h = hash(x, y, 84)
    if h < 0.06 and (waterT + math.floor(hash(x, y, 85) * L)) % 40 < 6 then c = NIGHT and LIGHT.moon or C.ice[3]
    elseif h > 0.9 then c = C.ice[2] end
    if top then return c, C.waterL, C.waterR, C.ice[2], C.ice[2] end
    return c, C.waterL, C.waterR
  end
  MAT.spill = function(x, y, z, top)
    local c = ((x * 2 - waterT + y) % 5 == 0) and C.foam or C.waterHi
    if top then return c, C.waterL, C.waterR, C.waterLipL, C.waterLipR end
    return c, C.waterL, C.waterR
  end

  -- Falling water: streaks drop 2 px per frame; p counts pixel rows upward.
  local FADE_Z, BOTTOM_Z = -33, -38
  D.BOTTOM_Z = BOTTOM_Z
  local function fallColor(y, p)
    if p < 2 * FADE_Z then
      local gone = (2 * FADE_Z - p) / (2 * (FADE_Z - BOTTOM_Z))
      if hash(y * 13 + p, waterT, 41) < gone then return false end
    end
    -- Vertical streaks per column, with bright drops sliding down them. The
    -- period 8 divides 2 * L, so the motion loops seamlessly.
    local v = (p + 2 * waterT + math.floor(hash(y, 0, 77) * 8)) % 8
    if v == 0 then return C.fallFoam end
    if v == 1 then return C.fallHi end
    return (y % 3 == 0) and C.fallHi or C.fall
  end
  local function dim(c) return c and sh(c, 0.86) end
  MAT.fall = function(x, y, z)
    local hi, lo = fallColor(y, 2 * z + 1), fallColor(y, 2 * z)
    return C.fallHi, sh(C.fall, 0.86), C.fall, nil, nil, nil, { dim(hi), dim(lo), hi, lo }
  end

  -- Voxel raster ---------------------------------------------------------------

  local function K(x, y, z) return (x + 8) + (y + 8) * 128 + (z + 16) * 16384 end
  local function unK(k)
    local z = k // 16384 - 16
    local r = k % 16384
    return r % 128 - 8, r // 128 - 8, z
  end
  D.K = K

  local TOP = { { 1, 0 }, { 2, 0 }, { 0, 1 }, { 1, 1 }, { 2, 1 }, { 3, 1 } }
  local LEFT = { { 0, 2 }, { 1, 2 }, { 0, 3 }, { 1, 3 } }
  local RIGHT = { { 2, 2 }, { 3, 2 }, { 2, 3 }, { 3, 3 } }
  local NPIX = W * H

  local function newBuf()
    local b = { col = {}, dep = {}, own = {} }
    for i = 1, NPIX do b.col[i] = 0; b.dep[i] = -100000; b.own[i] = 0 end
    return b
  end

  local function copyBuf(s)
    return {
      col = table.move(s.col, 1, NPIX, 1, {}),
      dep = table.move(s.dep, 1, NPIX, 1, {}),
      own = table.move(s.own, 1, NPIX, 1, {}),
    }
  end

  local function plot(b, x, y, c, key, owner)
    if x < 0 or y < 0 or x >= W or y >= H then return end
    local i = y * W + x + 1
    if key >= b.dep[i] then b.col[i] = c; b.dep[i] = key; b.own[i] = owner end
  end

  -- Faces with a solid neighbour are skipped: that neighbour covers them exactly.
  local function drawVoxel(b, x, y, z, mat, owner, occ)
    local topOpen = not occ(x, y, z + 1)
    local top, left, right, lipL, lipR, speck, rows = MAT[mat](x, y, z, topOpen)
    local sx, sy = (FLIP and (y - x) or (x - y)) * 2 + SX0, (x + y) - 2 * z + OY
    local key = (x + y) * 64 + z
    if topOpen then
      for j, p in ipairs(TOP) do plot(b, sx + p[1], sy + p[2], (speck and j == 5) and speck or top, key, owner) end
    end
    if not (FLIP and occ(x + 1, y, z) or (not FLIP and occ(x, y + 1, z))) then
      for j, p in ipairs(LEFT) do
        local c = (lipL and j <= 2 and topOpen) and lipL or left
        if rows then c = rows[j <= 2 and 1 or 2] end
        if c then plot(b, sx + p[1], sy + p[2], c, key, owner) end
      end
    end
    if not (FLIP and occ(x, y + 1, z) or (not FLIP and occ(x + 1, y, z))) then
      for j, p in ipairs(RIGHT) do
        local c = (lipR and j <= 2 and topOpen) and lipR or right
        if rows then c = rows[j <= 2 and 3 or 4] end
        if c then plot(b, sx + p[1], sy + p[2], c, key, owner) end
      end
    end
  end

  local function proj(x, y, z) return (FLIP and (y - x) or (x - y)) * 2 + SX0 + 2, (x + y) - 2 * z + OY end
  D.proj = proj

  -- World ------------------------------------------------------------------------
  -- S holds the static voxels; colH the top of each column (set by setColumn).

  local S, colH = {}, {}
  D.S = S
  local function setS(x, y, z, m) S[K(x, y, z)] = m end
  local function occS(x, y, z) return S[K(x, y, z)] ~= nil end
  local function groundTop(x, y) return colH[x * 100 + y] or 0 end
  D.setS, D.occS, D.groundTop = setS, occS, groundTop
  function D.clearS(x, y, z) S[K(x, y, z)] = nil end
  function D.setTop(x, y, h) colH[x * 100 + y] = h end

  function D.leafyTree(tx, ty, trunk, r, mat)
    local g = groundTop(tx, ty)
    for z = g, g + trunk - 1 do
      for dx = 0, 1 do for dy = 0, 1 do setS(tx + dx, ty + dy, z, "trunk") end end
    end
    local cz = g + trunk + 2
    if SEASON == "winter" and not mat then
      -- Bare in winter: the trunk goes on up and four snowy branches reach out.
      for z = g + trunk, cz + 1 do setS(tx, ty, z, "branch") end
      setS(tx + 1, ty + 1, cz + 2, "branch"); setS(tx, ty, cz + 2, "branch")
      -- Branches fork off at different heights and climb as they reach out.
      for k, d in ipairs({ { -1, 0 }, { 1, 0 }, { 0, -1 }, { 0, 1 } }) do
        local z0 = cz - 3 + k
        for i = 1, math.floor(r) - (k % 2) do
          local x = tx + (d[1] > 0 and 1 or 0) + d[1] * i
          local y = ty + (d[2] > 0 and 1 or 0) + d[2] * i
          setS(x, y, z0 + i, "branch")
        end
      end
      return g
    end
    for x = tx - 5, tx + 6 do
      for y = ty - 5, ty + 6 do
        for z = cz - 4, cz + 4 do
          local d = (x - tx - 0.5) ^ 2 + (y - ty - 0.5) ^ 2 + ((z - cz) * 1.2) ^ 2
          if d <= r * r and x >= 0 and y >= 0 and x < GX and y < GY then setS(x, y, z, mat or "leaf") end
        end
      end
    end
    return g
  end

  function D.pineTree(tx, ty, scale)
    local g = groundTop(tx, ty)
    for z = g, g + 1 do setS(tx, ty, z, "trunk") end
    local radii = { 3.0, 2.6, 2.2, 1.9, 1.5, 1.1, 0.6 }
    local n = scale or #radii
    for i = #radii - n + 1, #radii do
      local r = radii[i]
      for x = tx - 3, tx + 3 do
        for y = ty - 3, ty + 3 do
          if (x - tx) ^ 2 + (y - ty) ^ 2 <= r * r and x >= 0 and y >= 0 then
            setS(x, y, g + 1 + i - (#radii - n), "pine")
          end
        end
      end
    end
  end

  function D.rock(x, y, big)
    local g = groundTop(x, y)
    setS(x, y, g, "stone")
    if big then setS(x + 1, y, g, "stone"); setS(x, y + 1, g, "stone"); setS(x, y, g + 1, "stone") end
  end

  function D.reeds(x, y, h)
    local g = groundTop(x, y)
    for z = g, g + h - 1 do setS(x, y, z, "reed") end
    if (x + y) % 2 == 0 then setS(x, y, g + h, "cattail") end
  end

  -- A tree being felled, with an hourglass notch chewed into the trunk.
  function D.chewedTree(t)
    local g = D.leafyTree(t[1], t[2], 11, 3.6)
    for _, d in ipairs({ { 0, 0 }, { 1, 0 }, { 0, 1 } }) do S[K(t[1] + d[1], t[2] + d[2], g + 4)] = nil end
    setS(t[1] + 1, t[2] + 1, g + 4, "chewed")
    for dy = 0, 1 do setS(t[1], t[2] + dy, g + 5, "chewed") end
    return g
  end

  -- Lantern post; it lights up in the night variant. Returns { x, y, z } of the light.
  function D.lantern(x, y)
    local g = groundTop(x, y)
    for z = g, g + 3 do setS(x, y, z, "trunk") end
    setS(x, y, g + 4, "lantern")
    setS(x, y, g + 5, "trunk")
    return { x, y, g + 4 }
  end

  -- Static water body: shape is fixed, colours animate per frame.
  local WATER = {}
  D.WATER = WATER
  function D.addWater(x, y, z, m) WATER[#WATER + 1] = { x, y, z, m or "water" } end

  -- The river runs off the diorama's far edge (x = GX) between y0 and y1 and
  -- pours into the void from height `top`. The curtain steps outward and
  -- widens as it drops, which reads as depth.
  local FALL
  local function fallX(z) return GX + ((z < -6) and 1 or 0) + ((z < -20) and 1 or 0) end
  function D.edgeFall(y0, y1, top)
    FALL = { y0 = y0, y1 = y1, top = top }
    for z = BOTTOM_Z, top - 1 do
      local spread = (top - z) // 12
      for y = y0 - spread, y1 + spread do WATER[#WATER + 1] = { fallX(z), y, z, "fall" } end
    end
  end

  -- A river valley across the whole grid: banks step down from the meadow (7)
  -- through sand (4) to the bed (2), water stands at `level`, and the river
  -- pours off the far edge. dist(x, y) is the signed distance from the
  -- river's edge (negative in the water). Returns ground(x, y) -> h, mat.
  function D.valley(dist, level)
    level = level or 3
    local function ground(x, y)
      local d = dist(x, y)
      if d <= 0 then return 2, "bed" end
      if d <= 1.5 then return 4, "sand" end
      if d <= 3 then return 5, "grass" end
      if d <= 4.5 then return 6, "grass" end
      return 7, "grass"
    end
    for x = 0, GX - 1 do
      for y = 0, GY - 1 do
        local h, top = ground(x, y)
        for z = 0, h - 1 do setS(x, y, z, (z <= 1) and "base" or ((z == h - 1) and top or "dirt")) end
        colH[x * 100 + y] = h
      end
    end
    return ground
  end

  -- Water up to `level` wherever the ground is lower, and the edge fall where
  -- the river leaves the grid. Call once the ground is final.
  function D.fillWater(level, matAt)
    level = level or 3
    for x = 0, GX - 1 do
      for y = 0, GY - 1 do
        for z = groundTop(x, y), level - 1 do WATER[#WATER + 1] = { x, y, z, matAt and matAt(x, y, z) or "water" } end
      end
    end
    local y0, y1 = GY, -1
    for y = 0, GY - 1 do
      if groundTop(GX - 1, y) < level then y0, y1 = math.min(y0, y), math.max(y1, y) end
    end
    if y1 >= y0 then D.edgeFall(y0, y1, level) end
  end

  -- Props: voxel shapes that move. A shape is a list of { dx, dy, dz, mat };
  -- D.place adds one at (x, y, z) to a frame's prop list.
  function D.place(list, shape, x, y, z)
    for _, v in ipairs(shape) do list[#list + 1] = { x + v[1], y + v[2], z + v[3], v[4] } end
  end
  -- A log of n voxels along "x" or "y", end grain at both ends.
  function D.logShape(n, axis, dz)
    local s = {}
    for i = 0, n - 1 do
      local m = (i == 0 or i == n - 1) and "logEnd" or (axis == "y" and "logY" or "log")
      s[#s + 1] = (axis == "y") and { 0, i, dz or 0, m } or { i, 0, dz or 0, m }
    end
    return s
  end
  -- Carries a floating prop down the river: `route(x)` gives the river's
  -- centre y at x. Moves one voxel per frame from x0 at age 0, sitting one
  -- layer into the water, then tumbles down the edge fall and is gone.
  -- Returns false once it has gone.
  function D.float(list, shape, x0, route, age, level)
    level = level or 3
    local x = x0 + age
    if x < GX then
      D.place(list, shape, x, math.floor(route(x) + 0.5), level - 1)
      return true
    end
    local drop = (x - GX) * 3
    local z = level - 1 - drop
    if z < BOTTOM_Z + 2 then return false end
    D.place(list, shape, GX + ((z < -6) and 1 or 0), math.floor(route(GX - 1) + 0.5), z)
    return true
  end

  local staticBuf
  -- Flat decals (wood chips) depth-tied to their ground cell; call after D.bake().
  function D.decal(x, y, dx, dy, c)
    local sx, sy = proj(x, y, groundTop(x, y))
    plot(staticBuf, sx + dx, sy + dy, c, (x + y) * 64 + groundTop(x, y) - 1, 1)
  end
  function D.chips(t, n)
    for i = 1, n or 14 do
      local x = t[1] - 2 + math.floor(hash(i, t[1], 51) * 6)
      local y = t[2] - 1 + math.floor(hash(i, t[2], 52) * 5)
      D.decal(x, y, math.floor(hash(i, 3, 53) * 3), math.floor(hash(i, 4, 54) * 2), C.chip)
    end
  end

  local WATER_OCC = {}
  -- Renders the static world once; call after the world and water are built.
  function D.bake()
    for _, v in ipairs(WATER) do WATER_OCC[K(v[1], v[2], v[3])] = true end
    staticBuf = newBuf()
    for k, m in pairs(S) do
      local x, y, z = unK(k)
      drawVoxel(staticBuf, x, y, z, m, 1, occS)
    end
  end

  -- Beaver sprites -------------------------------------------------------------
  -- Hand-placed 13x16 pixel sprites of the Squik mascot (3/4 view), mirrored
  -- for the other two diagonals. Voxels at this size turned into blobs; flat
  -- sprites keep the face, buck teeth, ears and checkered tail readable.

  local SPC = {
    O = C.outline, B = hex("#3f8ef5"), L = hex("#6db1ff"), D = hex("#2459b0"),
    G = C.belly[1], E = C.eye, N = C.nose, M = hex("#b9d6fb"), W = C.teeth, F = C.feet,
    X = C.teeth, k = hex("#5f7fb8"),
    T = C.tailA, t = C.tailB, S = C.logLight, s = C.log[3], f = C.foam, w = C.waterHi,
    H = hex("#ffffff"), h = hex("#c9d6e3"), P = hex("#f4bfd3"),
    A = hex("#9a6a34"), a = hex("#5e3b1c"), Q = C.fish, q = sh(C.fish, 0.78),
  }
  -- One spare column on the right so the head can lean toward the snout.
  local SPRITE_W = 16

  -- Facing screen-right, toward the viewer: round near ear set back on the
  -- crown with a smaller far ear, both with a dark inner ear,
  -- blunt pale muzzle with the nose on top, whisker dots, and buck teeth
  -- hanging over the chest.
  local FRONT = {
    "...OOO..OO.....",
    "..OLDLOODLO....",
    "..OLLLLLBBBO...",
    "..OLLLBBXEBBO..",
    "..OLBBBBMMNNO..",
    "..OBBBBMMkMMMO.",
    "..ODBBBMMMkMMO.",
    "...ODBBOMMMMO..",
    "....ODDDOWWO...",
    "....OBBGGWWO...",
    "...OBBGGGGGBO..",
    "...OBBGGGGGBO..",
    "....OBGGGGBO...",
    "....OODDDDDO...",
    ".....OFFOFFO...",
    "......OO.OO....",
  }
  -- Facing screen-right, away from the viewer: back of the head, both ears,
  -- and the cheek of the muzzle peeking past the right edge.
  local BACK = {
    "...OOO...OOO...",
    "..OLDLOOOLDLO..",
    "..OLLLLBBBBBO..",
    "...OLLBBBBBBBO.",
    "...OLBBBBBBBDMO",
    "...OBBBBBBBBDO.",
    "...ODBBBBBBDO..",
    "....ODBBBBDO...",
    ".....ODDDDO....",
    "....OLBBBBDO...",
    "...OLBBBBBBDO..",
    "...OBBBBBBBDO..",
    "....OBBBBBDO...",
    "....OODDDDDO...",
    ".....OFOOFO....",
    "......O..O.....",
  }
  -- Tail overlays: { firstRow, firstCol, rows, behindBody }. The paddle is
  -- wide and checkered, the beaver's most recognisable shape after the teeth.
  local TAIL_FLAT = { 12, 1, { ".OOOO.", "OTtTtO", "OtTtTO", "OTtTtO", ".OOOO." }, true }
  local TAIL_UP = { 6, 1, { ".OO.", "OTtO", "OtTO", "OTtO", "OtTO", ".OtO", "..OO" }, true }
  local TAIL_BACK = { 12, 2, { ".OOOO.", "OTtTtO", "OtTtTO", "OTtTtO", ".OOOO." }, false }
  -- Raised paws (behind the body, so they never cover the face): the far one
  -- waves over the back of the head; both up is a cheer.
  local ARM_FAR = { 3, 1, { "OO..", "OLO.", "OBO.", "OBO.", ".OBO", ".OBO", "..OB", "..OB" }, true }
  local ARM_NEAR = { 7, 14, { ".OO", "OLO", "OBO", "OBO", "OO." }, true }
  -- Something held against the chest: { colour, shade } (snowball, blossom).
  local function heldOverlay(c, d) return { 9, 12, { ".OO.", "O" .. c .. c .. "O", "O" .. d .. c .. "O", ".OO." }, false } end

  local function grid(src)
    local g = {}
    for r, row in ipairs(src) do
      g[r] = {}
      for c = 1, SPRITE_W do g[r][c] = (c <= #row) and row:sub(c, c) or "." end
    end
    return g
  end

  local function overlay(g, o)
    local r0, c0, rows, behind = o[1], o[2], o[3], o[4]
    for dr, row in ipairs(rows) do
      for dc = 1, #row do
        local ch = row:sub(dc, dc)
        local r, c = r0 + dr - 1, c0 + dc - 1
        if ch ~= "." and g[r] and (not behind or g[r][c] == ".") then g[r][c] = ch end
      end
    end
  end

  local function buildSprite(st, front, t)
    local g = grid(front and FRONT or BACK)
    if st.head == "chew" or st.head == "down" then
      -- Nudge the head toward the snout side.
      for r = 1, 10 do
        table.insert(g[r], 1, ".")
        table.remove(g[r])
      end
    end
    if st.blink then
      for r = 1, 9 do for c = 1, SPRITE_W do if g[r][c] == "E" or g[r][c] == "X" then g[r][c] = "D" end end end
    end
    if front then overlay(g, st.tail == "up" and TAIL_UP or TAIL_FLAT) else overlay(g, TAIL_BACK) end
    if st.arms == "up" or st.arms == "wave" then overlay(g, ARM_FAR) end
    if st.arms == "up" then overlay(g, ARM_NEAR) end
    if st.hold == "snowball" then overlay(g, heldOverlay("H", "h")) end
    if st.hold == "blossom" then overlay(g, heldOverlay("P", "H")) end
    if st.hold == "acorn" then overlay(g, { 9, 12, { ".aa.", "OAAO", "OAaO", ".OO." }, false }) end
    if st.hold == "fish" then overlay(g, { 9, 11, { ".OOO.", "OQQqO", "OqQQO", ".OOO." }, false }) end
    if st.stick then
      for c = 2, SPRITE_W do g[10][c] = (c == 2 or c == SPRITE_W) and "s" or "S" end
    end
    if st.swim then
      for r = 12, 16 do g[r] = nil end
      for c = 2, SPRITE_W do g[11][c] = ((c + t) % 3 == 0) and "f" or "w" end
    end
    return g
  end

  local DIRS = { ["+x"] = { 1, 0 }, ["-x"] = { -1, 0 }, ["+y"] = { 0, 1 }, ["-y"] = { 0, -1 } }
  D.DIRS = DIRS

  -- Toward-viewer world directions show the front sprite; screen-left ones mirror.
  local function screenFacing(face)
    local d = DIRS[face]
    local dx = FLIP and (d[2] - d[1]) or (d[1] - d[2])
    return (d[1] + d[2]) > 0, dx < 0
  end
  D.screenFacing = screenFacing

  -- Depth-tested blit. Surfaces at or below the beaver's feet never cover it,
  -- so flat ground in front does not clip its feet; trees, rocks and the dam do.
  local function drawSprite(b, st, t)
    local front, mirror = screenFacing(st.face)
    local g = buildSprite(st, front, t)
    local ax, ay = proj(st.bx, st.by, st.bz)
    local anchor = st.swim and 11 or 16
    local key = (st.bx + st.by + 1) * 64 + 63
    local floorZ = st.bz - 1
    for r = 1, 16 do
      local row = g[r]
      if row then
        for c = 1, SPRITE_W do
          local ch = row[c]
          if ch ~= "." then
            local x = ax - 8 + (mirror and (SPRITE_W + 1 - c) or c)
            local y = ay + 1 - anchor + r - (st.lift or 0)
            if x >= 0 and y >= 0 and x < W and y < H then
              local i = y * W + x + 1
              local d = b.dep[i]
              if key >= d or d - ((d + 16) // 64) * 64 <= floorZ then
                b.col[i] = SPC[ch]; b.dep[i] = key; b.own[i] = 3
              end
            end
          end
        end
      end
    end
  end

  -- Resolve height: stand on the ground, or float with the head above water.
  -- A scene's waterLevel(x, y) gives the water surface height there (0: dry).
  local waterLevel = opts.waterLevel or function() return 0 end
  function D.settle(st)
    if st.bz then return st end
    local g = groundTop(st.bx, st.by)
    local wl = waterLevel(st.bx, st.by)
    if wl > g then
      st.swim = true
      st.bz = wl
    else
      st.bz = g
    end
    return st
  end

  -- Builds a looping path of states: push them in order, then pad() fills the
  -- start with idle frames up to `cycle`, which must divide L.
  function D.path()
    local P = { list = {} }
    function P.push(st) P.list[#P.list + 1] = st end
    function P.walk(axis, from, to, fixed, face, extra)
      local step = (to >= from) and 1 or -1
      for v = from, to, step do
        local st = { face = face, legs = (v % 2 == 0) and 1 or 2, head = "up", wake = true }
        for k, val in pairs(extra or {}) do st[k] = val end
        if axis == "y" then st.bx, st.by = fixed, v else st.bx, st.by = v, fixed end
        P.push(st)
      end
    end
    function P.pad(cycle, idle)
      assert(#P.list <= cycle, "path longer than its cycle: " .. #P.list)
      assert(L % cycle == 0, "cycle must divide the loop: " .. cycle)
      while #P.list < cycle do table.insert(P.list, 1, idle(#P.list)) end
    end
    function P.at(t)
      local st = {}
      for k, v in pairs(P.list[t % #P.list + 1]) do st[k] = v end
      return D.settle(st)
    end
    return P
  end

  -- Common poses.
  function D.chewer(bx, by, phase, face)
    return function(t)
      local p = (t + phase) % 8
      return D.settle {
        bx = bx, by = by, face = face or "+x",
        head = (p < 4) and "up" or "chew",
        blink = ((t + phase * 5) % 40) < 2,
        chips = (p == 4 or p == 5),
      }
    end
  end
  function D.napper(bx, by, face)
    return function() return D.settle { bx = bx, by = by, face = face or "+y", head = "down", blink = true, zz = true } end
  end
  function D.watcher(bx, by, face, phase)
    return function(t)
      local p = (t + (phase or 0)) % 30
      return D.settle { bx = bx, by = by, face = face or "+x", tail = (p >= 24 and p % 2 == 0) and "up" or nil, blink = (t % 50) < 2 }
    end
  end

  -- Flat effects ---------------------------------------------------------------

  local function fx(img, x, y, c) if x >= 0 and y >= 0 and x < W and y < H then img:drawPixel(x, y, G(c)) end end
  D.fx = fx

  local function splash(img, x, y)
    for i, d in ipairs({ { -2, -1 }, { 2, -1 }, { -1, -3 }, { 1, -3 }, { 0, -2 }, { -4, 0 }, { 4, 0 }, { -3, -2 }, { 3, -2 } }) do
      fx(img, x + d[1], y + d[2], i % 2 == 0 and C.waterHi or C.foam)
    end
  end
  D.splash = splash

  local function drawZ(img, x, y)
    for _, d in ipairs({ { 0, 0 }, { 1, 0 }, { 2, 0 }, { 3, 0 }, { 2, 1 }, { 1, 2 }, { 0, 3 }, { 1, 3 }, { 2, 3 }, { 3, 3 } }) do fx(img, x + d[1], y + d[2], C.zz) end
  end

  -- Per-actor effects driven by state flags: chips, mud, puff, splash
  -- (at height st.splashZ), zz.
  function D.actorFx(img, t, states)
    for _, st in ipairs(states) do
      -- Screen anchor at the sprite's feet; snout points along `side`.
      local ax, ay = proj(st.bx, st.by, st.bz)
      local _, mirror = screenFacing(st.face)
      local side = mirror and -1 or 1
      if st.chips then
        for i = 1, 4 do
          local a = hash(i, t, 61)
          fx(img, ax + side * (6 + math.floor(a * 5)), ay - 9 - math.floor(hash(i, t, 62) * 5), C.chip)
        end
      end
      if st.mud then
        for i = 1, 6 do fx(img, ax - side * (6 + math.floor(hash(i, t, 63) * 5)), ay - math.floor(hash(i, t, 64) * 4), C.mud[1]) end
      end
      if st.puff then
        for i = 1, 8 do
          fx(img, ax + side * (5 + math.floor(hash(i, t, 65) * 6)), ay - 4 - math.floor(hash(i, t, 66) * 6), i % 2 == 0 and C.chip or C.mud[1])
        end
      end
      if st.splash then
        local sx, sy = proj(st.bx, st.by, st.splashZ)
        splash(img, sx, sy)
      end
      if st.zz then
        for k = 0, 2 do
          local age = (t + k * 10) % 30
          drawZ(img, ax + 5 + age // 5 + k, ay - 18 - age // 2)
        end
      end
    end
  end

  -- Falling leaves, petals or snow across the canvas. Each falls one or two
  -- canvas heights per loop and sways a whole number of times: seamless.
  local PARTICLES = {
    leaves = { hex("#d9822b"), hex("#e8a23a"), hex("#b8582a"), hex("#f0c050") },
    petals = { hex("#f4bfd3"), hex("#ffffff"), hex("#ea9fbd") },
    snow = { hex("#ffffff"), hex("#e2e9f1"), hex("#ffffff") },
  }
  function D.particles(img, t, kind, n)
    local colors = PARTICLES[kind]
    for i = 1, n do
      local speed = 1 + i % 2
      local y = math.floor((hash(i, 3, 123) * H + t * H * speed / L) % H)
      local sway = (kind == "snow") and 3 or 6
      local x = math.floor(hash(i, 1, 121) * W + sway * math.sin(2 * math.pi * (t / L * (1 + i % 3) + hash(i, 2, 122))) + 0.5)
      local c = colors[1 + i % #colors]
      fx(img, x, y, c)
      -- Leaves and petals tumble: two pixels, turning every few frames.
      if kind ~= "snow" then
        local turn = ((t + i) // 3) % 2 == 0
        fx(img, x + (turn and 1 or 0), y + (turn and 0 or 1), c)
      elseif i % 4 == 0 then
        fx(img, x + 1, y, c); fx(img, x, y + 1, c); fx(img, x + 1, y + 1, c)
      end
    end
  end

  -- A fish leaps out of the water at (x, y, z) every `period` frames.
  function D.fishLeap(img, t, x, y, z, period, offset)
    local ft = (t + (offset or 0)) % (period or 60)
    if ft < 10 then
      local sx, sy = proj(x, y, z)
      local fxx = sx + ft * 2 - 9
      local fy = sy - math.floor(math.sin(ft / 9 * math.pi) * 9)
      fx(img, fxx, fy, C.fish); fx(img, fxx + 1, fy, C.fish); fx(img, fxx - 1, fy + 1, C.fish)
      if ft == 0 or ft == 9 then splash(img, fxx, sy) end
    end
  end

  -- Churning foam and kicked-up drops where the edge fall ends. Crests stay
  -- bright at night (moonlit) so the end of the water reads.
  function D.fallFoam(img, t)
    if not FALL then return end
    local crest = NIGHT and LIGHT.moon or C.teeth
    local spread = (FALL.top - BOTTOM_Z) // 12
    for y = FALL.y0 - spread, FALL.y1 + spread do
      local bx, by = proj(fallX(BOTTOM_Z), y, BOTTOM_Z)
      by = by + 3
      for dy = -4, 4 do
        for dx = -6, 6 do
          if dx * dx / 36 + dy * dy / 16 <= 1 then
            local h = hash(bx + dx, by + dy, t + 200)
            if h < 0.62 then fx(img, bx + dx, by + dy, (h < 0.22) and crest or C.fallFoam)
            elseif h < 0.85 then fx(img, bx + dx, by + dy, C.fallHi) end
          end
        end
      end
    end
    local x0, y0 = proj(fallX(BOTTOM_Z), FALL.y0 - spread, BOTTOM_Z)
    local x1 = proj(fallX(BOTTOM_Z), FALL.y1 + spread, BOTTOM_Z)
    for m = 1, 26 do
      local u = hash(m, t, 34)
      local x = math.floor(x0 + (x1 - x0) * u) + math.floor(hash(m, t, 35) * 9) - 4
      local y = y0 + math.floor((x1 - x0) * u / 2) - math.floor(hash(m, t, 36) * 12)
      fx(img, x, y, (m % 3 == 0) and crest or C.fallFoam)
    end
  end

  -- Warm halo around a lantern at night, with a slow flicker.
  function D.lanternHalo(img, t, lantern)
    if not NIGHT then return end
    local lx, ly = proj(lantern[1], lantern[2], lantern[3])
    local r = (t % 24 < 2) and 3 or 4
    for dy = -r - 1, r + 1 do
      for dx = -r - 1, r + 1 do
        local d = dx * dx + dy * dy
        if d >= 6 and d <= r * r + 2 and (dx + dy + t // 6) % 2 == 0 then fx(img, lx + dx, ly + 1 + dy, LIGHT.halo) end
      end
    end
  end

  -- Fireflies drift on 60/40-frame orbits over the given cells at night.
  function D.fireflies(img, t, spots)
    if not NIGHT then return end
    -- No fireflies in winter: the snow glints in the moonlight instead.
    if SEASON == "winter" then
      for i = 1, 40 do
        local x, y = math.floor(hash(i, 1, 131) * GX), math.floor(hash(i, 2, 132) * GY)
        if (t + math.floor(hash(i, 3, 133) * L)) % 30 < 4 then
          local sx, sy = proj(x, y, groundTop(x, y))
          fx(img, sx, sy, LIGHT.moon)
          if (t + i) % 30 < 2 then fx(img, sx - 1, sy, LIGHT.moon); fx(img, sx + 1, sy, LIGHT.moon) end
        end
      end
      return
    end
    for n, s in ipairs(spots) do
      local ph = math.floor(hash(n, 7, 91) * L)
      if (t + ph) % 40 < 24 then
        local fx0, fy0 = proj(s[1], s[2], groundTop(s[1], s[2]) + 3 + n % 4)
        local x = fx0 + math.floor(3 * math.sin(2 * math.pi * (t + ph) / 60) + 0.5)
        local y = fy0 + math.floor(2 * math.sin(2 * math.pi * (t + ph) / 40) + 0.5)
        for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do fx(img, x + d[1], y + d[2], LIGHT.flyHalo) end
        fx(img, x, y, LIGHT.fly)
      end
    end
  end

  -- Sky ------------------------------------------------------------------------
  -- Drawn on its own bottom layer, so the diorama covers whatever falls behind
  -- it. Every motion repeats within the loop.

  -- The sun and moon are separate sprites (celestial.lua) that the site moves
  -- behind the scene when the theme changes; the sky keeps a clear patch for
  -- them around this point.
  local SKY = {
    cloud = hex("#dceaf6"), cloudShade = hex("#c3d8ea"), bird = hex("#3d4b5c"),
    star = hex("#eef2ff"), starDim = hex("#8fa3cc"),
  }
  local SUN_X, SUN_Y = 280, 40

  local function skyPx(img, x, y, c) if x >= 0 and y >= 0 and x < W and y < H then img:drawPixel(x, y, c) end end

  local CLOUD_PARTS = { { 0, 0, 7, 2.6 }, { -5, 1, 4.5, 2 }, { 5, 1, 5, 2 }, { 1, -2, 3.5, 2 } }
  local function cloud(img, cx, cy)
    for y = cy - 5, cy + 4 do
      for x = cx - 12, cx + 12 do
        for _, p in ipairs(CLOUD_PARTS) do
          local dx, dy = (x - cx - p[1]) / p[3], (y - cy - p[2]) / p[4]
          if dx * dx + dy * dy <= 1 then skyPx(img, x, y, (y - cy) >= 2 and SKY.cloudShade or SKY.cloud); break end
        end
      end
    end
  end

  local function drawSky(img, t)
    local wave = math.sin(2 * math.pi * t / L)
    if not NIGHT then
      cloud(img, 128 + math.floor(4 * wave + 0.5), 36)
      cloud(img, 54 + math.floor(-3 * wave + 0.5), 42)
      cloud(img, 300 + math.floor(-2 * wave + 0.5), 62)
      -- Three birds cross once per loop, flapping every 4 frames.
      for n = 0, 2 do
        local x = -24 + t * 3 - n * 9
        local y = 46 + n * 4 + math.floor(math.sin((t + n * 7) / 6) + 0.5)
        local up = ((t + n * 2) // 4) % 2 == 0
        skyPx(img, x, y, SKY.bird)
        skyPx(img, x - 1, y + (up and -1 or 0), SKY.bird); skyPx(img, x + 1, y + (up and -1 or 0), SKY.bird)
        skyPx(img, x - 2, y + (up and -1 or 1), SKY.bird); skyPx(img, x + 2, y + (up and -1 or 1), SKY.bird)
      end
    else
      -- Stars twinkle on their own phase; a few bright ones get a cross.
      for n = 1, 60 do
        local x, y = math.floor(hash(n, 1, 101) * W), math.floor(hash(n, 2, 102) * 110)
        local ph = math.floor(hash(n, 3, 103) * L)
        local lit = (t + ph) % 30 < 24
        if (x - SUN_X) ^ 2 + (y - SUN_Y) ^ 2 < 18 * 18 then
          -- Keep the moon's patch of sky clear.
        elseif n % 9 == 0 then
          skyPx(img, x, y, lit and SKY.star or SKY.starDim)
          if lit then for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do skyPx(img, x + d[1], y + d[2], SKY.starDim) end end
        elseif lit then
          skyPx(img, x, y, (n % 3 == 0) and SKY.star or SKY.starDim)
        end
      end
      -- One shooting star per loop.
      local st = t - 72
      if st >= 0 and st < 8 then
        local hx, hy = 70 + st * 6, 8 + st * 3
        for k = 0, 5 do skyPx(img, hx - k * 2, hy - k, k == 0 and SKY.star or SKY.starDim) end
      end
    end
  end

  -- Atmosphere ------------------------------------------------------------------
  -- A translucent layer between the beavers and the FX, so foam, fireflies and
  -- the lantern stay crisp on top. By day, light shafts fan out from the sun
  -- across the diorama with dust drifting in them; by night, wisps of mist
  -- drift over the water. Rays only touch the diorama, never the empty canvas
  -- around it, and are posterised into a few soft bands: dithering reads as
  -- grain and nearly doubles the WebPs.

  -- Index into an alpha table for `v` (0..1).
  local function band(v, alphas) return alphas[math.floor(v * (#alphas - 1) + 0.5) + 1] end

  -- World distance (x+y) and height z from a depth key; z spans -40..23.
  local function fromKey(d) local s = (d + 40) // 64; return s, d - s * 64 end

  local RAY = { r = 255, g = 241, b = 196 }
  local RAY_ALPHA = { 0, 28, 52, 76 }
  -- Beam centre (radians below the horizon, looking left from the sun), half
  -- width, and pulse: cycles per loop and phase.
  local BEAMS = {
    { 0.22, 0.035, 1, 0.0 }, { 0.38, 0.05, 2, 1.3 }, { 0.55, 0.03, 1, 2.6 },
    { 0.70, 0.055, 2, 4.0 }, { 0.88, 0.04, 1, 5.1 }, { 1.05, 0.03, 2, 0.7 },
  }
  local rayAngle, rayFade
  local function initRays()
    rayAngle, rayFade = {}, {}
    for p = 1, NPIX do
      local dx, dy = SUN_X - (p - 1) % W, (p - 1) // W - SUN_Y
      rayAngle[p] = math.atan(dy, dx)
      local r = math.sqrt(dx * dx + dy * dy)
      rayFade[p] = smooth((r - 24) / 40) * (1 - 0.55 * smooth((r - 140) / 160))
    end
  end

  local function rayAt(p, t)
    local sway = 0.018 * math.sin(2 * math.pi * t / L)
    local a, v = rayAngle[p], 0
    for _, bm in ipairs(BEAMS) do
      local u = math.abs(a - bm[1] - sway) / bm[2]
      if u < 1 then
        local pulse = 0.65 + 0.35 * math.sin(2 * math.pi * bm[3] * t / L + bm[4])
        v = math.max(v, (1 - u * u) * pulse)
      end
    end
    return v * rayFade[p]
  end

  -- Night mist: soft wisps that drift low over the water, plus a cloud of
  -- spray billowing up where the edge fall lands. Each wisp sits at a world
  -- height and depth-tests like the beavers: trees, the lodge and the dam in
  -- front hide it, low ground and water never do. Beavers stay unveiled.
  local MIST_EDGE = pc.rgba(168, 186, 224, 58)
  local MIST_CORE = pc.rgba(192, 208, 240, 96)
  local MIST_PARTS = { { 0, 0, 1 }, { -8, 1, 0.65 }, { 8, 1, 0.7 }, { -3, -1, 0.6 }, { 4, -2, 0.5 } }

  -- Max-blends an ellipse cluster into `mist` (1 edge, 2 core).
  local function stamp(mist, b, cx, cy, rx, ry, zw, key)
    if rx < 1.5 then return end
    for y = math.floor(cy - ry * 2), math.ceil(cy + ry * 2) do
      for x = math.floor(cx - rx * 1.8), math.ceil(cx + rx * 1.8) do
        if x >= 0 and y >= 0 and x < W and y < H then
          local p = y * W + x + 1
          local best = 0
          for _, q in ipairs(MIST_PARTS) do
            local dx = (x - cx - q[1] * rx / 9) / (rx * q[3])
            local dy = (y - cy - q[2]) / (ry * q[3])
            local d = dx * dx + dy * dy
            if d <= 0.4 then best = 2; break elseif d <= 1 then best = 1 end
          end
          if best > (mist[p] or 0) then
            local o = b.own[p]
            local visible = o == 0 or not key
            if o ~= 0 and o ~= 3 and key then
              local _, z = fromKey(b.dep[p])
              visible = z <= zw or b.dep[p] <= key
            end
            if visible then mist[p] = best end
          end
        end
      end
    end
  end

  -- runs: wisps drifting along a path. Each run is { at = function(u) return
  -- wx, wy end, z, count, slots moved per loop }. Wisp shape depends on where
  -- it is in the run, not which wisp it is, so after a loop every wisp has
  -- moved into the next one's place: seamless.
  local function drawMist(img, t, b, runs)
    local mist = {}
    for _, run in ipairs(runs or {}) do
      local at, zw, n, k = run[1], run[2], run[3], run[4]
      for i = 0, n - 1 do
        local u = ((i + k * t / L) / n) % 1
        local wx, wy = at(u)
        local size = smooth(u / 0.18) * smooth((1 - u) / 0.18) * (0.9 + 0.12 * math.sin(2 * math.pi * 3 * u))
        local sx, sy = proj(wx, wy, zw)
        stamp(mist, b, sx, sy, 16 * size, 4 * size, zw, math.floor((wx + wy) * 64 + zw))
      end
    end
    -- Spray puffs rise and swell off the plunge pool, on a 60-frame life.
    if FALL then
      for j = 0, 7 do
        local u = ((t + j * 15) % 60 + (j % 2) * 7) % 60 / 60
        local fy = FALL.y0 + (j * 5) % math.max(1, FALL.y1 - FALL.y0 + 1)
        local bx, by = proj(fallX(BOTTOM_Z), fy, BOTTOM_Z)
        local s = math.sin(math.pi * u)
        stamp(mist, b, bx + (j % 2 == 0 and -1 or 1) * u * 9, by + 3 - u * 22, (7 + 8 * u) * s, (4 + 3 * u) * s, 0, nil)
      end
    end
    for p, v in pairs(mist) do
      img:drawPixel((p - 1) % W, (p - 1) // W, v == 2 and MIST_CORE or MIST_EDGE)
    end
  end

  local function drawAtmos(img, t, b, mistRuns)
    if NIGHT then return drawMist(img, t, b, mistRuns) end
    for p = 1, NPIX do
      if b.own[p] ~= 0 then
        local a = band(rayAt(p, t), RAY_ALPHA)
        if a > 0 then img:drawPixel((p - 1) % W, (p - 1) // W, pc.rgba(RAY.r, RAY.g, RAY.b, a)) end
      end
    end
    do
      -- Dust motes drift down the shafts and glint only where the light is.
      local mote = pc.rgba(255, 248, 220, 220)
      for n = 1, 40 do
        local x0, y0 = math.floor(hash(n, 4, 111) * 260), math.floor(hash(n, 5, 112) * 200) + 40
        local ph = hash(n, 6, 113)
        local x = x0 + math.floor(4 * math.sin(2 * math.pi * (t / L + ph)) + 0.5)
        local y = y0 + math.floor(3 * math.sin(2 * math.pi * (2 * t / L + ph)) + 0.5)
        if x >= 0 and y >= 0 and x < W and y < H then
          local p = y * W + x + 1
          if b.own[p] ~= 0 and rayAt(p, t) > 0.35 then img:drawPixel(x, y, mote) end
        end
      end
    end
  end

  -- Frame render ---------------------------------------------------------------

  local function wakeFor(st, t)
    if not st.swim or not st.wake then return end
    local d = DIRS[st.face]
    for dist = 5, 12 do
      if (dist + t) % 3 ~= 0 then
        local s = (dist - 3) // 2
        for _, sg in ipairs({ -s, s }) do
          wakeCells[(st.bx - dist * d[1] - sg * d[2]) * 100 + (st.by - dist * d[2] + sg * d[1])] = true
        end
      end
    end
  end

  -- props: voxels that move, { x, y, z, mat } per frame, drawn into the water
  -- layer's pass so they occlude and are occluded like the world.
  local function renderFrame(t, states, props)
    waterT = t
    wakeCells = {}
    for _, st in ipairs(states) do wakeFor(st, t) end
    local propOcc = {}
    for _, v in ipairs(props) do propOcc[K(v[1], v[2], v[3])] = true end
    local function occAll(x, y, z)
      local k = K(x, y, z)
      return S[k] ~= nil or WATER_OCC[k] ~= nil or propOcc[k] ~= nil
    end
    local b = copyBuf(staticBuf)
    for _, v in ipairs(WATER) do drawVoxel(b, v[1], v[2], v[3], v[4], 2, occAll) end
    for _, v in ipairs(props) do drawVoxel(b, v[1], v[2], v[3], v[4], 4, occAll) end
    -- Back to front, so nearer beavers overlap farther ones.
    local order = {}
    for _, st in ipairs(states) do order[#order + 1] = st end
    table.sort(order, function(a, c) return a.bx + a.by < c.bx + c.by end)
    for _, st in ipairs(order) do drawSprite(b, st, t) end
    return b
  end

  -- Builds the looping sprite and saves it as <out>/<name>.aseprite.
  --   actors: functions t -> beaver state
  --   props:  optional function t -> list of moving voxels
  --   fx:     optional function (img, t, states) for the scene's own effects
  --   mist:   night mist runs (see drawMist)
  function D.render(scene)
    initRays()
    local spr = Sprite(W, H, ColorMode.RGB)
    local Lterrain = spr.layers[1]
    Lterrain.name = "World"
    local function layer(name) local l = spr:newLayer(); l.name = name; return l end
    local Lwater = layer("Water")
    local Lbeaver = layer("Beavers")
    local Latmos = layer("Atmosphere")
    local Lfx = layer("FX")
    local Lsky = layer("Sky")
    Lsky.stackIndex = 1

    Lterrain.isContinuous = true
    local terrainImg = Image(W, H, ColorMode.RGB)
    for i = 1, NPIX do
      if staticBuf.own[i] == 1 then terrainImg:drawPixel((i - 1) % W, (i - 1) // W, G(staticBuf.col[i])) end
    end
    spr:newCel(Lterrain, 1, terrainImg, Point(0, 0))
    for _ = 2, L do spr:newFrame() end

    for i = 1, L do
      local t = i - 1
      spr.frames[i].duration = FRAME_MS / 1000
      local states = {}
      for _, actor in ipairs(scene.actors) do states[#states + 1] = actor(t) end

      local b = renderFrame(t, states, scene.props and scene.props(t) or {})

      local wImg, bImg = Image(W, H, ColorMode.RGB), Image(W, H, ColorMode.RGB)
      for p = 1, NPIX do
        local o = b.own[p]
        if o == 2 or o == 4 then wImg:drawPixel((p - 1) % W, (p - 1) // W, G(b.col[p]))
        elseif o == 3 then bImg:drawPixel((p - 1) % W, (p - 1) // W, G(b.col[p], 0.18)) end
      end
      spr:newCel(Lwater, i, wImg, Point(0, 0))
      spr:newCel(Lbeaver, i, bImg, Point(0, 0))

      local aImg = Image(W, H, ColorMode.RGB)
      drawAtmos(aImg, t, b, scene.mist)
      spr:newCel(Latmos, i, aImg, Point(0, 0))

      local fImg = Image(W, H, ColorMode.RGB)
      D.actorFx(fImg, t, states)
      if scene.fx then scene.fx(fImg, t, states) end
      spr:newCel(Lfx, i, fImg, Point(0, 0))

      local sImg = Image(W, H, ColorMode.RGB)
      drawSky(sImg, t)
      spr:newCel(Lsky, i, sImg, Point(0, 0))
    end

    local tag = spr:newTag(1, L)
    tag.name = "loop"
    tag.aniDir = AniDir.FORWARD

    spr:saveAs((app.params.out or ".") .. "/" .. scene.name .. ".aseprite")
    return spr, Lterrain
  end

  return D
end
