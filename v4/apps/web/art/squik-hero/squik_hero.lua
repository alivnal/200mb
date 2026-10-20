-- Squik hero: wide isometric voxel diorama where blue Squik beavers fell
-- trees, haul sticks, patch the dam and nap. Seamless loop, transparent bg.
-- Build every scene into public/hero with ./build.sh, or render this one:
--   aseprite -b --script-param lib=diorama.lua --script-param out=<dir> \
--     --script-param variant=day|night --script squik_hero.lua
-- The shared machinery (palette, voxels, beavers, sky, light) is diorama.lua.

local DAM_X0, DAM_X1 = 55, 60       -- shoulders at both ends, core 56..59
local NOTCH_Y0, NOTCH_Y1 = 24, 27   -- spillway through the dam top
local POND, DOWN = 6, 3             -- water column heights up/downstream

local function waterLevel(x)
  if x < DAM_X0 then return POND end
  if x > DAM_X1 then return DOWN end
  return 0
end

local D = dofile(app.params.lib)({
  variant = app.params.variant,
  -- Below the dam the river runs toward the edge; above it the pond is still.
  flow = function(x) if x > 60 then return { 1, 0 } end end,
  waterLevel = waterLevel,
})
local GX, GY, C, hash, smooth = D.GX, D.GY, D.C, D.hash, D.smooth
local setS, groundTop, proj = D.setS, D.groundTop, D.proj
local NAME = app.params.name or (D.NIGHT and "squik_hero_night" or "squik_hero_day")

-- World geometry -------------------------------------------------------------

local function cy(x) return 28 + 5 * math.sin(x * 0.07 + 0.5) end
local function hw(x)
  if x < 28 then return 5 end
  if x < DAM_X0 then return 5 + 11 * smooth((x - 28) / 22) end
  if x <= DAM_X1 then return 16 end
  -- Widens toward the edge so the fall pours as a broad curtain.
  return 4 + 2 * smooth((x - 78) / 14)
end
local function riverDist(x, y) return math.abs(y - cy(x)) - hw(x) end

local LODGE_X, LODGE_Y, LODGE_R = 40, 33, 5
local function lodgeH(x, y)
  local d2 = (x - LODGE_X) ^ 2 + (y - LODGE_Y) ^ 2
  if d2 >= LODGE_R * LODGE_R then return 0 end
  return 2 + math.floor(8 * math.sqrt(1 - d2 / (LODGE_R * LODGE_R)))
end

-- Ground column height and top material, ignoring the dam.
local function ground(x, y)
  local d = riverDist(x, y)
  if x <= DAM_X1 then
    if d <= 0 then return (d < -3 and x > 32) and 2 or 3, "bed" end
    if d <= 1.5 then return 6, "sand" end
    return 7, "grass"
  end
  if d <= 0 then return 2, "bed" end
  if d <= 1.5 then return 4, "sand" end
  if d <= 3 then return 5, "grass" end
  if d <= 4.5 then return 6, "grass" end
  return 7, "grass"
end

local function damH(x, y)
  if x < DAM_X0 or x > DAM_X1 or riverDist(x, y) > 1.5 then return 0 end
  local h = 8
  if y >= NOTCH_Y0 and y <= NOTCH_Y1 then
    h = (x == DAM_X1) and 4 or 5
  elseif x == DAM_X0 or x == DAM_X1 then
    h = 7
  end
  return h
end

for x = 0, GX - 1 do
  for y = 0, GY - 1 do
    local h, topMat = ground(x, y)
    for z = 0, h - 1 do
      local m
      if z <= 1 then m = "base"
      elseif z == h - 1 then m = topMat
      else m = "dirt" end
      setS(x, y, z, m)
    end
    local lh = lodgeH(x, y)
    for z = h, lh - 1 do setS(x, y, z, "lodge") end
    local dh = damH(x, y)
    for z = h, dh - 1 do setS(x, y, z, "log") end
    D.setTop(x, y, math.max(h, lh, dh))
  end
end

-- Trees being felled, with an hourglass notch chewed into the trunk.
local TREE_A = { 30, 10 }
local TREE_B = { 24, 48 }
D.chewedTree(TREE_A)
D.chewedTree(TREE_B)

D.leafyTree(4, 4, 4, 3.2)
D.leafyTree(11, 15, 3, 3.0)
D.pineTree(18, 5)
D.pineTree(40, 5)
D.leafyTree(46, 4, 4, 3.3)
D.pineTree(64, 8)
D.leafyTree(71, 3, 4, 3.4)
D.pineTree(80, 10)
D.leafyTree(88, 5, 4, 3.2)
D.pineTree(93, 15, 5)
D.pineTree(6, 50)
D.leafyTree(12, 41, 3, 3.0)
D.pineTree(28, 54, 6)
D.leafyTree(40, 50, 4, 3.2)
D.pineTree(62, 55)
D.pineTree(83, 56, 6)
D.leafyTree(86, 49, 3, 3.0)
D.pineTree(57, 2, 5)

-- Lantern post by the dam; it lights up in the night variant.
local LANTERN = D.lantern(66, 34)

-- Cut log pile: the hauler's supply.
local PILE = { 31, 36, 12, 13 }
for y = PILE[3], PILE[4] do
  local g = groundTop(PILE[1], y)
  for x = PILE[1], PILE[2] do setS(x, y, g, (x == PILE[1] or x == PILE[2]) and "logEnd" or "log") end
end
do
  local g = groundTop(PILE[1], PILE[3]) + 1
  for x = PILE[1] + 1, PILE[2] - 1 do setS(x, PILE[3], g, (x == PILE[1] + 1 or x == PILE[2] - 1) and "logEnd" or "log") end
end
-- A felled log on the front bank near the second tree.
for x = 78, 85 do setS(x, 51, groundTop(x, 51), (x == 78 or x == 85) and "logEnd" or "log") end

for _, r in ipairs({ { 9, 22, true }, { 52, 41 }, { 68, 36, true }, { 23, 44 }, { 86, 17, true }, { 2, 40 }, { 76, 30 } }) do
  D.rock(r[1], r[2], r[3])
end

-- Reeds sprout along the sandy shore, kept off the hauler's lane.
local function onHaulLane(x, y) return x >= 29 and x <= 51 and y >= 16 and y <= 26 end
for x = 1, GX - 2 do
  for y = 1, GY - 2 do
    local _, m = ground(x, y)
    if m == "sand" and not onHaulLane(x, y) and lodgeH(x, y) == 0 and damH(x, y) == 0 and hash(x, y, 71) < 0.09 then
      D.reeds(x, y, 2 + math.floor(hash(x, y, 72) * 2))
    end
  end
end

-- Lily pads in clusters on the pond surface.
for x = 30, DAM_X0 - 2 do
  for y = 0, GY - 1 do
    if riverDist(x, y) < -2 and lodgeH(x, y) == 0 and not onHaulLane(x, y) and hash(x // 2, y // 2, 73) < 0.07 then
      D.lily[x * 100 + y] = (hash(x, y, 74) < 0.15) and C.lilyFlower or C.lily
    end
  end
end

-- Static water body: shape is fixed, colours animate per frame.
for x = 0, GX - 1 do
  for y = 0, GY - 1 do
    local top = groundTop(x, y)
    for z = top, waterLevel(x) - 1 do D.addWater(x, y, z, "water") end
  end
end
for y = NOTCH_Y0, NOTCH_Y1 do
  for x = DAM_X0, DAM_X1 do
    for z = damH(x, y), POND - 1 do D.addWater(x, y, z, "spill") end
  end
  for z = DOWN, POND - 2 do D.addWater(DAM_X1 + 1, y, z, "fall") end
end
-- The river runs off the diorama's far edge and pours into the void.
do
  local y0, y1 = GY, -1
  for y = 0, GY - 1 do
    if groundTop(GX - 1, y) < DOWN then y0, y1 = math.min(y0, y), math.max(y1, y) end
  end
  D.edgeFall(y0, y1, DOWN)
end

D.bake()
D.chips(TREE_A)
D.chips(TREE_B)

-- Actors ---------------------------------------------------------------------
-- Each returns its state for frame t in [0, L). Paths are padded so every
-- cycle length divides L and the loop is seamless.

-- Hauler: grab a stick from the pile, swim it to the dam, place it, return.
local HAUL = D.path()
do
  local push, walk = HAUL.push, HAUL.walk
  local HX, HY, LANE = 33, 17, 21
  push { bx = HX, by = HY, face = "-y", head = "down" }
  push { bx = HX, by = HY, face = "-y", head = "down" }
  push { bx = HX, by = HY, face = "-y", head = "down", stick = true }
  push { bx = HX, by = HY, face = "-y", head = "up", stick = true }
  push { bx = HX, by = HY, face = "+y", head = "up", stick = true }
  walk("y", HY + 1, LANE, HX, "+y", { stick = true })
  push { bx = HX, by = LANE, face = "+x", head = "up", stick = true }
  walk("x", HX + 1, 49, LANE, "+x", { stick = true })
  push { bx = 52, by = LANE, bz = 7, face = "+x", head = "up", stick = true, legs = 1 }
  push { bx = 56, by = LANE, face = "+x", head = "up", stick = true, legs = 2 }
  push { bx = 56, by = LANE, face = "+x", head = "down", stick = true }
  push { bx = 56, by = LANE, face = "+x", head = "down", puff = true }
  push { bx = 56, by = LANE, face = "+x", head = "up" }
  push { bx = 56, by = LANE, face = "-x", head = "up" }
  push { bx = 52, by = LANE, bz = 6, face = "-x", head = "up", legs = 1, splash = true, splashZ = POND }
  walk("x", 49, HX, LANE, "-x")
  push { bx = HX, by = LANE, face = "-y", head = "up" }
  walk("y", LANE - 1, HY, HX, "-y")
  HAUL.pad(60, function(n) return { bx = HX, by = HY, face = "-y", head = "up", blink = (n % 9 == 0) } end)
end

-- Swimmer: laps up and down the upper river, 60 frames per lap.
local SWIM = {}
do
  local X0, X1 = 6, 32
  for x = X0, X1 - 1 do SWIM[#SWIM + 1] = { bx = x, by = math.floor(cy(x) + 0.5) - 2, face = "+x" } end
  local yTop, yBot = math.floor(cy(X1) + 0.5) - 2, math.floor(cy(X1) + 0.5) + 2
  for y = yTop, yBot - 1 do SWIM[#SWIM + 1] = { bx = X1, by = y, face = "+y" } end
  for x = X1, X0 + 1, -1 do SWIM[#SWIM + 1] = { bx = x, by = math.floor(cy(x) + 0.5) + 2, face = "-x" } end
  local y0 = math.floor(cy(X0) + 0.5)
  for y = y0 + 2, y0 - 1, -1 do SWIM[#SWIM + 1] = { bx = X0, by = y, face = "-y" } end
  assert(D.L % #SWIM == 0, "swim lap must divide loop: " .. #SWIM)
end
local function swimmer(t)
  local base = SWIM[t % #SWIM + 1]
  return D.settle { bx = base.bx, by = base.by, face = base.face, head = "up", wake = true, bob = 0 }
end

-- Builder on the dam, slapping mud down with its tail every 12 frames.
local function builder(t)
  local p = t % 12
  return D.settle {
    bx = 57, by = 12, face = "+y", head = (p < 6) and "up" or "down",
    tail = (p < 4) and "up" or nil, mud = (p == 4),
    blink = (t % 60) < 2,
  }
end

local ACTORS = {
  D.chewer(TREE_A[1] - 1, TREE_A[2] + 2, 0), D.chewer(TREE_B[1] - 1, TREE_B[2] + 2, 3), HAUL.at, swimmer, builder,
  D.napper(LODGE_X, LODGE_Y), D.watcher(92, 40),
}

-- Scene effects ----------------------------------------------------------------

local FIREFLIES = { { 20, 18 }, { 12, 22 }, { 44, 14 }, { 66, 12 }, { 78, 18 }, { 88, 30 }, { 30, 44 }, { 46, 46 },
  { 60, 50 }, { 72, 42 }, { 84, 46 }, { 10, 46 }, { 52, 8 }, { 36, 52 } }

local function sceneFx(img, t)
  -- A fish leaps in the pond every 60 frames.
  D.fishLeap(img, t, 36, 29, POND)
  -- Mist off the dam spill.
  for m = 1, 7 do
    local mx, my = proj(DAM_X1 + 2, NOTCH_Y0 + math.floor(hash(m, t, 31) * 4), DOWN)
    D.fx(img, mx + math.floor(hash(m, t, 33) * 5) - 2, my - math.floor(hash(m, t, 32) * 5), m % 2 == 0 and C.foam or C.waterHi)
  end
  D.fallFoam(img, t)
  D.lanternHalo(img, t, LANTERN)
  D.fireflies(img, t, FIREFLIES)
end

-- Night mist drifts down the river above the dam and below it.
local function riverRun(xa, xb)
  return function(u)
    local wx = xa + u * (xb - xa)
    return wx, cy(wx) + 0.35 * hw(wx) * math.sin(2 * math.pi * u * 1.5)
  end
end

D.render {
  name = NAME,
  actors = ACTORS,
  fx = sceneFx,
  mist = { { riverRun(2, 54), POND + 1, 6, 1 }, { riverRun(61, GX - 1), DOWN + 1, 3, 1 } },
}
