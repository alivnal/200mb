-- Squik compress scene, shown while a video is being compressed: a log press
-- on the riverbank in autumn. A beaver carries loose logs onto the press,
-- another bounces on the beam to drive a stone plate down and squash them
-- into a tight bundle, cheers, and the first beaver pushes the tied bundle
-- down the slipway into the river, where it floats off and over the edge
-- fall. Upstream a mill wheel turns, a beaver dives into a leaf pile, one
-- rakes leaves, one stashes acorns, and the watcher waves the bundle by. One
-- bundle per loop.
--   aseprite -b --script-param lib=diorama.lua --script-param out=<dir> \
--     --script-param variant=day|night --script squik_compress.lua

local LEVEL = 3
local smooth = function(t) t = math.max(0, math.min(1, t)); return t * t * (3 - 2 * t) end
local function cy(x) return 30 + 5 * math.sin(x * 0.055 + 0.4) end
local function hw(x) return 5 + 2 * smooth((x - 60) / 30) end
-- A calm cove off the near bank, with lily pads and the lodge.
local COVE_X, COVE_Y, COVE_RX, COVE_RY = 66, 41, 9, 5
local function coveDist(x, y)
  return (math.sqrt(((x - COVE_X) / COVE_RX) ^ 2 + ((y - COVE_Y) / COVE_RY) ^ 2) - 1) * COVE_RY
end
local function inCove(x, y) return coveDist(x, y) <= 0 and math.abs(y - cy(x)) > hw(x) end
local function riverDist(x, y) return math.min(math.abs(y - cy(x)) - hw(x), coveDist(x, y)) end

local D = dofile(app.params.lib)({
  variant = app.params.variant,
  season = "autumn",
  flow = function(x, y) if not inCove(x, y) then return { 1, 0 } end end,
  waterLevel = function(x, y) return riverDist(x, y) <= 0 and LEVEL or 0 end,
})
local GX, GY, L, C, hash = D.GX, D.GY, D.L, D.C, D.hash
local setS, groundTop, proj = D.setS, D.groundTop, D.proj
local NAME = app.params.name or (D.NIGHT and "squik_compress_night" or "squik_compress_day")

-- World ------------------------------------------------------------------------

local ground = D.valley(riverDist, LEVEL)

-- Lodge on the cove's far shore.
local LODGE_X, LODGE_Y, LODGE_R = 71, 44, 4
for x = LODGE_X - LODGE_R, LODGE_X + LODGE_R do
  for y = LODGE_Y - LODGE_R, LODGE_Y + LODGE_R do
    local d2 = (x - LODGE_X) ^ 2 + (y - LODGE_Y) ^ 2
    if d2 < LODGE_R * LODGE_R then
      local g = groundTop(x, y)
      local h = math.max(g, 2) + 2 + math.floor(6 * math.sqrt(1 - d2 / (LODGE_R * LODGE_R)))
      for z = g, h - 1 do setS(x, y, z, "lodge") end
      D.setTop(x, y, h)
    end
  end
end

-- The press: two posts and a beam over the bed the bundle is built on.
-- Bundle footprint: x PX..PX+3, y PY..PY+2, standing on G0.
local PX, PY = 36, 12
local G0 = groundTop(PX, PY)
local BEAM = G0 + 8
for _, x in ipairs({ PX - 1, PX + 4 }) do
  for z = G0, BEAM - 1 do setS(x, PY + 1, z, "trunk") end
end
for x = PX - 1, PX + 4 do setS(x, PY + 1, BEAM, "log") end
setS(PX - 1, PY + 1, BEAM, "logEnd"); setS(PX + 4, PY + 1, BEAM, "logEnd")

-- Supply piles of loose logs the carrier takes from.
local function logPile(x0, y0, len, rows)
  for r = 0, rows - 1 do
    for y = y0, y0 + len - 1 do
      setS(x0 + r, y, groundTop(x0 + r, y), (y == y0 or y == y0 + len - 1) and "logEnd" or "logY")
    end
  end
  for y = y0 + 1, y0 + len - 2 do setS(x0, y, groundTop(x0, y) + 1, "logY") end
end
logPile(26, 11, 5, 2)
logPile(48, 6, 4, 2)

local TREE_A, TREE_B = { 18, 4 }, { 80, 10 }
D.chewedTree(TREE_A)
D.chewedTree(TREE_B)
D.leafyTree(5, 6, 4, 3.2)
D.pineTree(10, 15)
D.leafyTree(28, 3, 4, 3.0)
D.pineTree(42, 4)
D.leafyTree(57, 4, 4, 3.3)
D.pineTree(66, 7)
D.pineTree(88, 4, 6)
D.leafyTree(92, 16, 3, 3.0)
D.pineTree(4, 46)
D.leafyTree(12, 54, 3, 3.0)
D.pineTree(84, 54, 6)
D.leafyTree(90, 44, 3, 3.0)
D.pineTree(52, 50, 5)
D.leafyTree(78, 52, 4, 3.2)
local LANTERN = D.lantern(44, 13)

-- A mill hut on the far bank, its wheel turning in the river (a prop below).
local HUT_X0, HUT_X1, HUT_Y0, HUT_Y1 = 16, 21, 20, 24
local HUT_G = groundTop(HUT_X0, HUT_Y0)
for x = HUT_X0, HUT_X1 do
  for y = HUT_Y0, HUT_Y1 do
    local wall = x == HUT_X0 or x == HUT_X1 or y == HUT_Y0 or y == HUT_Y1
    local corner = (x == HUT_X0 or x == HUT_X1) and (y == HUT_Y0 or y == HUT_Y1)
    for z = HUT_G, HUT_G + 3 do
      if corner then setS(x, y, z, "trunk")
      elseif wall then setS(x, y, z, (y == HUT_Y0 or y == HUT_Y1) and "log" or "logY") end
    end
    -- A door facing the wheel.
    if y == HUT_Y1 and (x == 18 or x == 19) then D.clearS(x, y, HUT_G); D.clearS(x, y, HUT_G + 1) end
    -- Roof ridge along x.
    local dy = math.min(y - HUT_Y0, HUT_Y1 - y)
    for z = HUT_G + 4, HUT_G + 4 + dy do setS(x, y, z, (z == HUT_G + 4 + dy) and "lodge" or "dirt") end
  end
end
local WHEEL_X, WHEEL_Y, WHEEL_Z, WHEEL_R = 19, 31, HUT_G, 5
for y = HUT_Y1 + 1, WHEEL_Y - 2 do setS(WHEEL_X, y, WHEEL_Z, "logY") end

-- The raker's small heap, and the acorn stash (drawn after baking).
local HEAP = { 10, 9 }
for dx = 0, 1 do for dy = 0, 1 do setS(HEAP[1] + dx, HEAP[2] + dy, groundTop(HEAP[1] + dx, HEAP[2] + dy), "leaf") end end
local STASH, OAK = { 81, 19 }, { 90, 19 }

-- A heap of fallen leaves to dive into.
local PILE_X, PILE_Y = 44, 19
local PILE_G = groundTop(PILE_X + 2, PILE_Y + 2)
for x = PILE_X, PILE_X + 4 do
  for y = PILE_Y, PILE_Y + 4 do
    local d = math.max(math.abs(x - PILE_X - 2), math.abs(y - PILE_Y - 2))
    local h = ({ 5, 4, 2 })[d + 1]
    if d == 2 and (x == PILE_X or x == PILE_X + 4) and (y == PILE_Y or y == PILE_Y + 4) then h = 0 end
    local g = groundTop(x, y)
    for z = g, PILE_G + h - 1 do setS(x, y, z, "leaf") end
    if h > 0 then D.setTop(x, y, math.max(g, PILE_G + h)) end
  end
end

for _, r in ipairs({ { 8, 22, true }, { 31, 18 }, { 54, 18, true }, { 70, 24 }, { 86, 25, true }, { 58, 44 }, { 90, 36 }, { 22, 44, true } }) do
  D.rock(r[1], r[2], r[3])
end

-- Reeds along the sand, kept off the bundle's slipway.
local function onSlip(x, y)
  return (x >= PX - 1 and x <= PX + 4 and y >= PY and y <= 30) or (math.abs(x - WHEEL_X) <= WHEEL_R + 1 and y >= HUT_Y1 and y <= WHEEL_Y + 2)
end
for x = 1, GX - 2 do
  for y = 1, GY - 2 do
    local _, m = ground(x, y)
    if m == "sand" and not onSlip(x, y) and hash(x, y, 71) < 0.12 then D.reeds(x, y, 2 + math.floor(hash(x, y, 72) * 2)) end
  end
end
-- Lily pads in the cove.
for x = COVE_X - COVE_RX, COVE_X + COVE_RX do
  for y = COVE_Y - COVE_RY, COVE_Y + COVE_RY do
    if inCove(x, y) and coveDist(x, y) < -1 and hash(x // 2, y // 2, 73) < 0.25 then
      D.lily[x * 100 + y] = (hash(x, y, 74) < 0.15) and C.lilyFlower or C.lily
    end
  end
end

D.fillWater(LEVEL)
D.bake()
D.chips(TREE_A)
D.chips(TREE_B)
for i = 1, 7 do
  D.decal(STASH[1] + i % 2, STASH[2] + (i // 4), math.floor(hash(i, 1, 96) * 3), math.floor(hash(i, 2, 97) * 2), (i % 3 == 0) and C.mud[2] or C.mud[1])
end

-- The bundle -----------------------------------------------------------------
-- Three layers of three logs along x. Built loose (a gap under each layer),
-- squashed flat by the plate, tied, pushed down the slipway, floated off.

local DROPS = { 7, 21, 35 }      -- the carrier adds a layer on these frames
local PRESS0, PRESS1 = 42, 48    -- the plate touches, then the pile is flat
local LIFT0, LIFT1 = 56, 62      -- the plate rises back under the beam
local TIE, PUSH, FLOAT = 54, 66, 87

local function layer(dz, roped)
  local s = {}
  for dy = 0, 2 do
    for dx = 0, 3 do
      local m = (dx == 0 or dx == 3) and "logEnd" or "log"
      if roped and dx == 1 then m = "rope" end
      s[#s + 1] = { dx, dy, dz, m }
    end
  end
  return s
end
local PLATE = {}
for dy = 0, 2 do for dx = 0, 3 do PLATE[#PLATE + 1] = { dx, dy, 0, "stone" } end end

-- Layer heights above the press bed at frame t: loose gaps close one by one
-- as the plate comes down.
local function layers(t)
  local n = 0
  for _, d in ipairs(DROPS) do if t >= d then n = n + 1 end end
  local squash = math.max(0, math.min(1, (t - PRESS0) / (PRESS1 - PRESS0)))
  local gapTop = (squash >= 0.4) and 1 or 2
  local gapLow = (squash >= 1) and 1 or 2
  local zs, gaps = {}, { gapLow, gapTop }
  for k = 1, n do zs[k] = (k == 1) and 0 or (zs[k - 1] + gaps[k - 1]) end
  return zs
end

-- The plate's height: parked under the beam, down on the pile, back up.
local function plateZ(t)
  local park = BEAM - 1
  if t < PRESS0 - 4 or t >= LIFT1 then return park end
  local zs = layers(t)
  local onPile = G0 + (zs[#zs] or -1) + 1
  if t < PRESS0 then return park - math.floor((park - (G0 + 5)) * (t - (PRESS0 - 4)) / 4 + 0.5) end
  if t < LIFT0 then return onPile end
  return onPile + math.floor((park - onPile) * (t - LIFT0) / (LIFT1 - LIFT0) + 0.5)
end

local BUNDLE = {}
for z = 0, 2 do for _, v in ipairs(layer(z, true)) do BUNDLE[#BUNDLE + 1] = v end end

local SLIP_END = math.floor(cy(PX + 1) + 0.5) - 1
local function slipY(t) return math.min(PY + (t - PUSH), SLIP_END) end
-- Height of the bundle on the slipway: the highest ground under it, or
-- floating one layer into the water.
local function slipZ(y)
  local top = 0
  for dx = 0, 3 do for dy = 0, 2 do top = math.max(top, groundTop(PX + dx, y + dy)) end end
  if top < LEVEL then return LEVEL - 1 end
  return top
end

-- The mill wheel: a dark rim and spokes, and pale paddles sticking out both
-- sides that make the turning easy to read. Two turns a loop, the bottom
-- running with the current.
local WHEEL_RIM = {}
for dx = -WHEEL_R, WHEEL_R do
  for dz = -WHEEL_R, WHEEL_R do
    if math.abs(math.sqrt(dx * dx + dz * dz) - WHEEL_R) < 0.5 then WHEEL_RIM[#WHEEL_RIM + 1] = { dx, dz } end
  end
end
local function wheel(list, t)
  local function add(dx, dy, dz, m)
    if WHEEL_Z + dz >= 2 then list[#list + 1] = { WHEEL_X + dx, WHEEL_Y + dy, WHEEL_Z + dz, m } end
  end
  for _, p in ipairs(WHEEL_RIM) do add(p[1], 0, p[2], "trunk") end
  local a0 = -2 * (2 * math.pi) * t / L
  for k = 0, 3 do
    local a = a0 + k * math.pi / 2
    local c, s = math.cos(a), math.sin(a)
    for r = 1, WHEEL_R - 1 do add(math.floor(c * r + 0.5), 0, math.floor(s * r + 0.5), "trunk") end
  end
  for k = 0, 7 do
    local a = a0 + k * math.pi / 4
    local dx, dz = math.floor(math.cos(a) * (WHEEL_R + 1) + 0.5), math.floor(math.sin(a) * (WHEEL_R + 1) + 0.5)
    for dy = -1, 1 do add(dx, dy, dz, "logEnd") end
  end
  for dy = -1, 1 do add(0, dy, 0, "logEnd") end
end

local function props(t)
  local list = {}
  wheel(list, t)
  local pz = plateZ(t)
  D.place(list, PLATE, PX, PY, pz)
  for z = pz + 1, BEAM - 1 do list[#list + 1] = { PX + 1, PY + 1, z, "rope" }; list[#list + 1] = { PX + 2, PY + 1, z, "rope" } end
  if t < PUSH then
    for _, z in ipairs(layers(t)) do D.place(list, layer(0, t >= TIE), PX, PY, G0 + z) end
  elseif t < FLOAT then
    local y = slipY(t)
    D.place(list, BUNDLE, PX, y, slipZ(y))
  end
  -- Floating, then over the fall: it outlives the loop, so the previous
  -- loop's bundle is still on its way at the start of this one.
  for _, age in ipairs({ t - FLOAT, t - FLOAT + L }) do
    if age >= 0 then D.float(list, BUNDLE, PX, function(x) return cy(x) - 1 end, age, LEVEL) end
  end
  return list
end

-- Actors ---------------------------------------------------------------------

-- Worker: three trips from the supply pile to the press, a layer each; then
-- round behind the press to shove the tied bundle down the slipway into the
-- river, and back to the pile.
local WORK = D.path()
for _ = 1, 3 do
  WORK.push { bx = 28, by = 13, face = "-x", head = "down" }
  WORK.push { bx = 28, by = 13, face = "+x", head = "up", stick = true }
  WORK.walk("x", 29, 33, 13, "+x", { stick = true })
  WORK.push { bx = 34, by = 13, face = "+x", head = "down", puff = true }
  WORK.push { bx = 34, by = 13, face = "-x", head = "up" }
  WORK.walk("x", 33, 29, 13, "-x")
end
for _, d in ipairs(DROPS) do assert(WORK.list[d + 1].puff, "worker puffs must land on the drop frames") end
WORK.walk("y", 12, PY - 2, 29, "-y")
WORK.walk("x", 30, PX + 1, PY - 2, "+x")
local BEHIND = PY - 1
while #WORK.list < PUSH do
  local n = #WORK.list
  WORK.list[n + 1] = { bx = PX + 1, by = BEHIND, face = "+y", head = "up", blink = (n % 30) < 2 }
end
for t = PUSH, FLOAT - 1 do
  WORK.push { bx = PX + 1, by = math.min(slipY(t) - 1, 22), face = "+y", head = "down", legs = (t % 2) + 1 }
end
WORK.walk("y", 21, PY - 2, PX + 1, "-y")
WORK.walk("x", PX, 29, PY - 2, "-x")
WORK.walk("y", PY - 1, 13, 29, "+y")
while #WORK.list < L do
  local n = #WORK.list
  WORK.list[n + 1] = { bx = 28, by = 13, face = "-x", head = (n % 12 < 6) and "up" or "chew", blink = (n % 40) < 2 }
end
assert(#WORK.list == L, "worker path must fill the loop exactly: " .. #WORK.list)

-- Jumper: sits on the press beam and bounces to drive the plate down.
local BOUNCE = { 0, 2, 4, 5, 4, 2 }
-- Once the pile is flat it cheers, and waves the bundle off down the slipway.
local function jumper(t)
  local pressing = t >= PRESS0 - 4 and t < PRESS1
  local cheering = t >= PRESS1 and t < LIFT0
  local waving = t >= PUSH and t < FLOAT
  local p = (t - (PRESS0 - 4)) % 6
  local lift = pressing and BOUNCE[p + 1] or (cheering and ((t - PRESS1) % 4 < 2) and 2 or 0)
  return { bx = PX + 2, by = PY + 1, bz = BEAM + 1, face = "+y",
    lift = lift, head = (pressing and p == 0) and "down" or "up",
    arms = cheering and "up" or ((waving and (t // 4) % 2 == 0) and "wave" or nil),
    tail = ((pressing and p >= 2 and p <= 4) or (cheering and t % 2 == 0)) and "up" or nil, puff = (t == PRESS1),
    blink = not pressing and not cheering and (t % 50) < 2 }
end

-- Leaf diver: crouches, leaps into the leaf pile, is buried for a moment,
-- pops out cheering, and walks back. 40 frames.
local DIVE = D.path()
local DIVE_LAND = 18
do
  local Y0 = PILE_Y - 3
  local function at(y, st) st.bx, st.by = PILE_X + 2, y; return st end
  for i = 0, 5 do DIVE.push(at(Y0, { face = "+y", head = "up", blink = i == 3 })) end
  for _ = 1, 4 do DIVE.push(at(Y0, { face = "+y", head = "down", lift = -1 })) end
  local ARC = { 4, 8, 10, 11, 11, 10, 7, 3 }
  for i = 1, 8 do DIVE.push(at(Y0 + (i + 1) // 2, { face = "+y", head = "up", lift = ARC[i], tail = "up", arms = (i <= 4) and "up" or nil })) end
  -- Buried: standing on the ground under the heap, only the ears poking out.
  for i = 1, 6 do DIVE.push(at(PILE_Y + 2, { bz = PILE_G, face = "+y", head = "down", lift = i // 2 - 2, blink = true })) end
  for i = 1, 8 do DIVE.push(at(PILE_Y + 2, { face = "+y", head = "up", arms = "up", lift = (i % 4 < 2) and 2 or 0, tail = (i % 2 == 0) and "up" or nil })) end
  for i = 1, 8 do DIVE.push(at(PILE_Y + 2 - math.floor((i * 5) / 8 + 0.5), { face = "-y", legs = i % 2 + 1 })) end
  assert(#DIVE.list == 40 and L % 40 == 0, "dive must last 40 frames: " .. #DIVE.list)
end

-- Where the floating bundle is (its x), for the watcher's wave.
local function bundleX(t)
  for _, age in ipairs({ t - FLOAT, t - FLOAT + L }) do
    if age >= 0 and PX + age < GX then return PX + age + 2 end
  end
end
local WATCH_X, WATCH_Y = 86, 22
local function watcher(t)
  local bx = bundleX(t)
  if bx and math.abs(bx - WATCH_X) < 9 then
    return D.settle { bx = WATCH_X, by = WATCH_Y, face = "+y", arms = ((t // 3) % 2 == 0) and "wave" or "up", tail = "up" }
  end
  return D.watcher(WATCH_X, WATCH_Y, "+x", 7)(t)
end

-- Swimmer: laps in the river below the press, 60 frames per lap.
local SWIM = {}
do
  local X0, X1 = 48, 72
  for x = X0, X1 - 1 do SWIM[#SWIM + 1] = { bx = x, by = math.floor(cy(x) + 0.5) - 2, face = "+x" } end
  for x = X1, X0 + 13, -1 do SWIM[#SWIM + 1] = { bx = x, by = math.floor(cy(x) + 0.5) + 2, face = "-x" } end
  local n = 60 - #SWIM
  for i = 1, n do SWIM[#SWIM + 1] = { bx = X0 + 12 - math.floor(12 * i / n), by = math.floor(cy(X0) + 0.5) + 2, face = "-x" } end
  assert(L % #SWIM == 0, "swim lap must divide loop: " .. #SWIM)
end
local function swimmer(t)
  local s = SWIM[t % #SWIM + 1]
  return D.settle { bx = s.bx, by = s.by, face = s.face, head = "up", wake = true }
end

-- Raker: sweeps the leaves toward the heap with a stick, two frames a step,
-- and walks back for more. 20 frames.
local RAKE = D.path()
for x = HEAP[1] + 7, HEAP[1] + 2, -1 do
  for k = 0, 1 do RAKE.push { bx = x, by = HEAP[2], face = "-x", head = "down", stick = true, legs = k + 1, leaves = true } end
end
RAKE.walk("x", HEAP[1] + 3, HEAP[1] + 7, HEAP[2], "+x")
for i = 1, 3 do RAKE.push { bx = HEAP[1] + 7, by = HEAP[2], face = "-x", head = "up", blink = i == 2 } end
assert(#RAKE.list == 20, "rake must last 20 frames: " .. #RAKE.list)

-- Acorn carrier: picks one up under the oak, carries it to the stash, and
-- goes back. 40 frames.
local ACORN = D.path()
for i = 1, 6 do ACORN.push { bx = OAK[1], by = OAK[2], face = "+x", head = (i % 3 == 0) and "up" or "down" } end
ACORN.walk("x", OAK[1] - 1, STASH[1] + 1, OAK[2], "-x", { hold = "acorn" })
for i = 1, 4 do ACORN.push { bx = STASH[1] + 1, by = OAK[2], face = "-x", head = "down", puff = i == 2 } end
ACORN.walk("x", STASH[1] + 2, OAK[1], OAK[2], "+x")
ACORN.pad(40, function(n) return { bx = OAK[1], by = OAK[2], face = "+y", head = "up", blink = n % 9 == 0 } end)

local ACTORS = {
  RAKE.at, ACORN.at, WORK.at, jumper, swimmer, watcher, DIVE.at,
}

-- Effects --------------------------------------------------------------------

local FIREFLIES = { { 10, 10 }, { 24, 20 }, { 46, 10 }, { 60, 14 }, { 72, 18 }, { 88, 18 }, { 30, 44 }, { 50, 46 },
  { 66, 52 }, { 82, 46 }, { 12, 40 }, { 40, 2 }, { 62, 34 }, { 76, 36 } }

-- The frame the bundle first floats on the slipway, for its splash.
local HIT
for tt = PUSH, FLOAT - 1 do if not HIT and slipZ(slipY(tt)) == LEVEL - 1 then HIT = tt end end

local function sceneFx(img, t, states)
  -- Dust bursts out from under the plate as the pile goes flat.
  local age = t - PRESS1
  if age >= 0 and age < 5 then
    local sx, sy = proj(PX + 2, PY + 1, G0)
    for i = 1, 14 do
      local a = (i / 14) * 2 * math.pi
      local r = 6 + age * 3
      D.fx(img, sx + math.floor(math.cos(a) * r + 0.5), sy - 3 + math.floor(math.sin(a) * r / 2 + 0.5), i % 2 == 0 and C.chip or C.mud[1])
    end
  end
  if HIT and t >= HIT and t < HIT + 3 then
    local sx, sy = proj(PX + 2, slipY(HIT) + 1, LEVEL)
    D.splash(img, sx - 4, sy); D.splash(img, sx + 4, sy + 1)
  end
  -- Leaves burst up as the diver lands, and drift back down.
  local la = (t - DIVE_LAND) % 40
  if la < 12 then
    local sx, sy = proj(PILE_X + 2, PILE_Y + 2, PILE_G + 5)
    local LEAF = C.leaf
    for i = 1, 18 do
      local vx = (hash(i, 1, 91) - 0.5) * 3.2
      local vy = 1.6 + hash(i, 2, 92) * 1.8
      local x = sx + math.floor(vx * la + 0.5)
      local y = sy - 4 - math.floor(vy * la - 0.18 * la * la + 0.5)
      D.fx(img, x, y, LEAF[1 + i % #LEAF])
      if i % 3 == 0 then D.fx(img, x + 1, y, LEAF[1 + (i + 1) % #LEAF]) end
    end
  end
  -- Foam where the paddles dip into the river.
  for i = 1, 6 do
    local wx = WHEEL_X - 2 + math.floor(hash(i, t // 2, 93) * 5)
    local fx_, fy = proj(wx, WHEEL_Y + math.floor(hash(i, t // 2, 94) * 3) - 1, LEVEL)
    D.fx(img, fx_, fy - 1, i % 2 == 0 and C.foam or C.waterHi)
  end
  -- Leaves scuffed up ahead of the rake.
  for _, st in ipairs(states) do
    if st.leaves then
      local ax, ay = proj(st.bx, st.by, st.bz)
      local _, mirror = D.screenFacing(st.face)
      local side = mirror and -1 or 1
      for i = 1, 4 do
        D.fx(img, ax + side * (5 + math.floor(hash(i, t, 98) * 6)), ay - 1 - math.floor(hash(i, t, 99) * 4), C.leaf[1 + i % #C.leaf])
      end
    end
  end
  D.particles(img, t, "leaves", 8)
  D.fishLeap(img, t, 64, 42, LEVEL, 60, 20)
  D.fallFoam(img, t)
  D.lanternHalo(img, t, LANTERN)
  D.fireflies(img, t, FIREFLIES)
end

local function riverRun(xa, xb)
  return function(u)
    local wx = xa + u * (xb - xa)
    return wx, cy(wx) + 0.35 * hw(wx) * math.sin(2 * math.pi * u * 1.5)
  end
end

D.render {
  name = NAME,
  actors = ACTORS,
  props = props,
  fx = sceneFx,
  mist = { { riverRun(2, GX - 1), LEVEL + 1, 7, 1 } },
}
