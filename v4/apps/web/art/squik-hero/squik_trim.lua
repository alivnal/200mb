-- Squik trim scene, shown while a video is being trimmed: a sawbench on the
-- riverbank in winter. A beaver drags a long log over and heaves it onto two
-- stone supports; two beavers chew through it at both cuts, the ends drop off
-- and are chewed to chips, and the kept middle is pushed down into the river,
-- where it floats off and over the edge fall. On the near bank two beavers
-- have a snowball fight by a snowman, one skates on a frozen pond while
-- another fishes through a hole in the ice; up the far bank one builds a
-- snow fort and one sleds down to the river. One log per loop, under
-- falling snow.
--   aseprite -b --script-param lib=diorama.lua --script-param out=<dir> \
--     --script-param variant=day|night --script squik_trim.lua

local LEVEL = 3
local smooth = function(t) t = math.max(0, math.min(1, t)); return t * t * (3 - 2 * t) end
local function cy(x) return 31 + 4 * math.sin(x * 0.05 + 1.0) end
local function hw(x) return 5 + 2 * smooth((x - 60) / 30) end
local function streamDist(x, y) return math.abs(y - cy(x)) - hw(x) end
-- A frozen pond on the near bank.
local POND_X, POND_Y, POND_RX, POND_RY = 62, 52, 7, 4
local function pondDist(x, y)
  return (math.sqrt(((x - POND_X) / POND_RX) ^ 2 + ((y - POND_Y) / POND_RY) ^ 2) - 1) * POND_RY
end
local function riverDist(x, y) return math.min(streamDist(x, y), pondDist(x, y)) end

local D = dofile(app.params.lib)({
  variant = app.params.variant,
  season = "winter",
  flow = function(x, y) if pondDist(x, y) > 0 then return { 1, 0 } end end,
  -- Only the river is open water: beavers stand on the pond's ice.
  waterLevel = function(x, y) return streamDist(x, y) <= 0 and LEVEL or 0 end,
})
local GX, GY, L, C, hash = D.GX, D.GY, D.L, D.C, D.hash
local setS, groundTop, proj = D.setS, D.groundTop, D.proj
local NAME = app.params.name or (D.NIGHT and "squik_trim_night" or "squik_trim_day")

-- World ------------------------------------------------------------------------

local ground = D.valley(riverDist, LEVEL)

-- The bench: two stone supports under the part that is kept. The log lies
-- along x from BX to BX+N-1 at y = BY, on top of the supports.
local BX, BY, N = 24, 15, 16
local G0 = groundTop(BX, BY)
local SUPPORTS = { BX + 5, BX + 10 }
for _, x in ipairs(SUPPORTS) do
  for z = G0, G0 + 1 do setS(x, BY, z, "stone") end
end
local ON_BENCH = G0 + 2
local CUTS = { BX + 3, BX + 12 } -- chewed through, between the ends and the middle

-- A heap of long logs the dragger takes from.
for _, y in ipairs({ 9, 10 }) do
  for x = 1, 16 do setS(x, y, groundTop(x, y), (x == 1 or x == 16) and "logEnd" or "log") end
end
for x = 2, 15 do setS(x, 9, groundTop(x, 9) + 1, (x == 2 or x == 15) and "logEnd" or "log") end

-- A low heap of chips by the bench, from earlier logs.
local TREE_A, TREE_B = { 22, 3 }, { 78, 8 }
D.chewedTree(TREE_A)
D.chewedTree(TREE_B)
D.leafyTree(4, 4, 4, 3.0)
D.pineTree(14, 3, 6)
D.leafyTree(36, 4, 4, 3.2)
D.pineTree(46, 6)
D.leafyTree(56, 4, 4, 3.3)
D.pineTree(66, 10)
D.pineTree(88, 4, 6)
D.leafyTree(92, 16, 3, 3.0)
D.pineTree(4, 48)
D.leafyTree(14, 54, 3, 3.0)
D.pineTree(84, 54, 6)
D.leafyTree(90, 46, 3, 3.0)
D.pineTree(52, 57, 5)
D.leafyTree(74, 50, 4, 3.2)
local LANTERN = D.lantern(44, 16)

-- Lodge on the near bank, downstream.
local LODGE_X, LODGE_Y, LODGE_R = 70, 42, 4
for x = LODGE_X - LODGE_R, LODGE_X + LODGE_R do
  for y = LODGE_Y - LODGE_R, LODGE_Y + LODGE_R do
    local d2 = (x - LODGE_X) ^ 2 + (y - LODGE_Y) ^ 2
    if d2 < LODGE_R * LODGE_R then
      local g = groundTop(x, y)
      local h = g + 1 + math.floor(6 * math.sqrt(1 - d2 / (LODGE_R * LODGE_R)))
      for z = g, h - 1 do setS(x, y, z, "lodge") end
      D.setTop(x, y, h)
    end
  end
end

for _, r in ipairs({ { 8, 20, true }, { 26, 20 }, { 52, 19, true }, { 66, 24 }, { 82, 25, true }, { 56, 42 }, { 88, 36 }, { 20, 46, true } }) do
  D.rock(r[1], r[2], r[3])
end

-- Reeds along the sand, kept off the slipway.
local SLED_X, SLED_Y0, SLED_Y1 = 12, 20, 28
local function onSlip(x, y)
  return (x >= BX + 3 and x <= BX + 12 and y >= BY and y <= 34) or (math.abs(x - SLED_X) <= 1 and y >= SLED_Y0 and y <= SLED_Y1 + 2)
end
for x = 1, GX - 2 do
  for y = 1, GY - 2 do
    local _, m = ground(x, y)
    if m == "sand" and not onSlip(x, y) and pondDist(x, y) > 2 and hash(x, y, 71) < 0.05 then D.reeds(x, y, 2 + math.floor(hash(x, y, 72) * 2)) end
  end
end

-- A snowman on the near bank; its face and arms are drawn as effects.
local SNOWMAN = { 30, 50 }
do
  local sx, sy = SNOWMAN[1], SNOWMAN[2]
  local g = groundTop(sx, sy)
  -- Three stacked balls, as the radius of each layer.
  for dz, r in ipairs({ 1.5, 2.2, 1.5, 1.0, 1.5, 1.0, 1.0, 0.5 }) do
    for dx = -2, 2 do
      for dy = -2, 2 do
        if dx * dx + dy * dy <= r * r then setS(sx + dx, sy + dy, g + dz - 1, "snow") end
      end
    end
  end
  SNOWMAN[3] = g
end

-- The river freezes along its banks; the pond freezes over, but for the
-- fishing hole.
local HOLE, FISHER = { 57, 52 }, { 55, 52 }
D.fillWater(LEVEL, function(x, y)
  if x == HOLE[1] and y == HOLE[2] then return "water" end
  if pondDist(x, y) <= 0 or streamDist(x, y) > -1.5 then return "ice" end
end)
D.bake()
D.chips(TREE_A)
D.chips(TREE_B)
-- Old chips around the bench.
for i = 1, 22 do
  local x = BX + math.floor(hash(i, 5, 55) * N)
  local y = BY + 1 + math.floor(hash(i, 6, 56) * 3)
  D.decal(x, y, math.floor(hash(i, 7, 57) * 3), math.floor(hash(i, 8, 58) * 2), C.chip)
end

-- The log -----------------------------------------------------------------------

local LANE = BY - 3                    -- the dragger hauls the log along here
local DRAG0, DRAG1 = 0, 8              -- dragged from x = BX - 8 to BX
local HEAVE1 = 18                      -- onto the bench (up and over)
local CHEW0, NOTCH, CUT = 24, 34, 44   -- chewing starts, notches show, cut through
local DROP, CHIPPED = 46, 60           -- the ends fall off, then are chewed away
local PUSH, FLOAT = 74, 0              -- FLOAT is set from the slipway below

local function logVoxels(list, x0, y, z, n, mats)
  for i = 0, n - 1 do
    local m = mats and mats(i) or ((i == 0 or i == n - 1) and "logEnd" or "log")
    if m then list[#list + 1] = { x0 + i, y, z, m } end
  end
end

-- The kept middle piece on the slipway: highest ground under it, or floating.
local MID0, MID_N = CUTS[1] + 1, CUTS[2] - CUTS[1] - 1
local SLIP_END = math.floor(cy(MID0 + MID_N / 2) + 0.5)
local function slipY(t) return math.min(BY + 1 + (t - PUSH), SLIP_END) end
local function slipZ(y)
  local top = 0
  for dx = 0, MID_N - 1 do top = math.max(top, groundTop(MID0 + dx, y)) end
  if top < LEVEL then return LEVEL end
  return top
end
FLOAT = PUSH + (SLIP_END - (BY + 1)) + 1
local MID = D.logShape(MID_N, "x")

-- Fort builder: packs snow blocks (two voxels tall) into a wall, three rows
-- of five, one block every 6 frames; then admires it, and the wall
-- crumbles. 120 frames.
local FORT_X, FORT_Y = 74, 14
local FORT_G = groundTop(FORT_X, FORT_Y)
local FORT_FALL = 108
local BUILD = D.path()
local FORT_N, BLOCK_T = 15, 6
for i = 0, FORT_N - 1 do
  local x = FORT_X + i % 5
  local back = i % 5 == 0 and i > 0
  BUILD.push { bx = x, by = FORT_Y - 1, face = back and "-x" or "+x", legs = 1 }
  for _ = 1, 2 do BUILD.push { bx = x, by = FORT_Y - 1, face = "+y", head = "down" } end
  for _ = 1, 2 do BUILD.push { bx = x, by = FORT_Y - 1, face = "+y", hold = "snowball" } end
  BUILD.push { bx = x, by = FORT_Y - 1, face = "+y", head = "down", puff = true }
end
BUILD.walk("x", FORT_X + 3, FORT_X, FORT_Y - 1, "-x")
while #BUILD.list < FORT_FALL do BUILD.push { bx = FORT_X, by = FORT_Y - 1, face = "+y", arms = "up", tail = "up" } end
for i = 1, 4 do BUILD.push { bx = FORT_X, by = FORT_Y - 1, face = "+y", head = "down", blink = true, lift = (i == 1) and 2 or 0 } end
while #BUILD.list < L do BUILD.push { bx = FORT_X, by = FORT_Y - 1, face = "+y", arms = ((#BUILD.list // 2) % 2 == 0) and "up" or "wave" } end
local function fortBlocks(t)
  if t >= FORT_FALL then return 0 end
  return math.min(FORT_N, (t + 1) // BLOCK_T)
end

-- Sledder: sits on a sled at the top of the bank, slides down to the river
-- and cheers, then drags the sled back up. 40 frames.
local SLIDE = { 0, 0, 1, 1, 2, 3, 4, 5, 7, 8 }
local function sledPos(t)
  local p = t % 40
  if p < 4 then return SLED_Y0, true end
  if p < 14 then return SLED_Y0 + SLIDE[p - 3], true end
  if p < 20 then return SLED_Y1, false end
  if p < 29 then return SLED_Y1 - (p - 20), false end
  return SLED_Y0, false
end
local function props(t)
  local list = {}
  for i = 0, fortBlocks(t) - 1 do
    for dz = 0, 1 do list[#list + 1] = { FORT_X + i % 5, FORT_Y, FORT_G + (i // 5) * 2 + dz, "snowblock" } end
  end
  local sy = sledPos(t)
  list[#list + 1] = { SLED_X, sy, groundTop(SLED_X, sy), "logY" }
  list[#list + 1] = { SLED_X, sy + 1, groundTop(SLED_X, sy + 1), "logEnd" }
  if t < DRAG1 then
    logVoxels(list, BX - DRAG1 + t, LANE, G0, N)
  elseif t < HEAVE1 then
    local k = (t - DRAG1 + 1) / (HEAVE1 - DRAG1)
    logVoxels(list, BX, LANE + math.floor((BY - LANE) * k + 0.5), G0 + math.floor((ON_BENCH - G0) * math.min(1, k * 1.5) + 0.5), N)
  elseif t < DROP then
    -- Notches show at the cuts, then the cuts go through and every piece
    -- shows its own end grain.
    logVoxels(list, BX, BY, ON_BENCH, N, function(i)
      local x = BX + i
      for _, c in ipairs(CUTS) do
        if x == c then return (t < CUT) and ((t >= NOTCH) and "chewed" or "log") or nil end
        if t >= CUT and math.abs(x - c) == 1 then return "logEnd" end
      end
      return (i == 0 or i == N - 1) and "logEnd" or "log"
    end)
  elseif t < PUSH then
    -- The middle stays on the bench; the ends drop off and shrink to chips.
    logVoxels(list, MID0, BY, ON_BENCH, MID_N)
    if t < CHIPPED then
      local left = math.max(1, 3 - (t - DROP) // 5)
      logVoxels(list, CUTS[1] - left, BY + 1, G0, left)
      logVoxels(list, CUTS[2] + 1, BY + 1, G0, left)
    end
  elseif t < FLOAT then
    local y = slipY(t)
    D.place(list, MID, MID0, y, slipZ(y))
  end
  for _, age in ipairs({ t - FLOAT, t - FLOAT + L }) do
    if age >= 0 then D.float(list, MID, MID0, function(x) return cy(x) end, age, LEVEL + 1) end
  end
  return list
end

-- Actors ---------------------------------------------------------------------

-- Dragger: hauls the log from the heap to the bench, heaves it up, walks round
-- to the front to chew the near cut, chews its end to chips, then goes round
-- behind to push the trimmed log into the river, and back to the heap.
local DRAG = D.path()
for t = DRAG0, DRAG1 - 1 do DRAG.push { bx = BX - DRAG1 + t + N, by = LANE, face = "+x", head = "down", legs = (t % 2) + 1 } end
for _ = DRAG1, HEAVE1 - 1 do DRAG.push { bx = BX + N, by = LANE, face = "+x", head = "up", tail = "up" } end
-- Chewers work from behind the bench, facing out, so the log stays in view.
local CHEW_Y = BY - 1
DRAG.walk("y", LANE + 1, CHEW_Y, BX + N, "+y")
DRAG.walk("x", BX + N - 1, CUTS[2], CHEW_Y, "-x")
while #DRAG.list < CHEW0 do DRAG.push { bx = CUTS[2], by = CHEW_Y, face = "+y", head = "up" } end
local function chewPose(n, x, y) return { bx = x, by = y, face = "+y", head = (n % 8 < 4) and "up" or "chew", chips = (n % 8 == 4 or n % 8 == 5) } end
while #DRAG.list < CHIPPED do DRAG.push(chewPose(#DRAG.list, CUTS[2], CHEW_Y)) end
DRAG.walk("x", CUTS[2] - 1, MID0 + 1, CHEW_Y, "-x")
while #DRAG.list < PUSH do DRAG.push { bx = MID0 + 1, by = BY - 1, face = "+y", head = "up" } end
for t = PUSH, FLOAT - 1 do DRAG.push { bx = MID0 + 1, by = math.min(slipY(t) - 1, 23), face = "+y", head = "down", legs = (t % 2) + 1 } end
DRAG.walk("y", 22, LANE, MID0 + 1, "-y")
local HOME = BX - DRAG1 + N
DRAG.walk("x", MID0, HOME, LANE, "-x")
while #DRAG.list < L do DRAG.push { bx = HOME, by = LANE, face = "+x", head = "down", blink = (#DRAG.list % 30) < 2 } end
assert(#DRAG.list == L, "dragger path must fill the loop exactly: " .. #DRAG.list)

-- Second chewer: takes the far cut, then chews its end to chips.
local function chewer2(t)
  if t >= CHEW0 and t < CHIPPED then return D.settle(chewPose(t, CUTS[1], CHEW_Y)) end
  return D.settle { bx = CUTS[1] - 4, by = CHEW_Y, face = "+x", head = "up", blink = (t % 40) < 2 }
end

-- Swimmer: laps in the river below the bench, 60 frames per lap.
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

-- Snowball fight: two beavers take turns to scoop, pack and throw, 20
-- frames a throw. The target winces when hit; on the fourth throw it ducks
-- and the ball sails past into the snow.
local FIGHT_A, FIGHT_B = { 38, 44, "+x" }, { 50, 46, "-x" }
local THROW, HIT_AT = 8, 17 -- within each 20-frame throw
local function fightRound(t)
  local n = t // 20
  local p = t % 20
  local thrower = (n % 2 == 0) and FIGHT_A or FIGHT_B
  local target = (n % 2 == 0) and FIGHT_B or FIGHT_A
  return thrower, target, p, n == 3
end
local function fighter(me)
  return function(t)
    local thrower, target, p, dodge = fightRound(t)
    local st = { bx = me[1], by = me[2], face = me[3], head = "up", blink = (t % 43) < 2 }
    if thrower == me then
      if p < 4 then st.head = "down"
      elseif p < THROW then st.hold = "snowball"
      elseif p < THROW + 3 then st.arms = "up"; st.lift = (p == THROW) and 1 or 0 end
    elseif target == me then
      if dodge and p >= HIT_AT - 4 and p < HIT_AT + 1 then
        st.lift = ({ 4, 7, 8, 7, 4 })[p - HIT_AT + 5]; st.tail = "up"
      elseif not dodge and p >= HIT_AT and p < HIT_AT + 3 then
        st.head = "down"; st.blink = true; st.lift = (p == HIT_AT) and 2 or 0
      end
    end
    return D.settle(st)
  end
end

-- Skater: glides round the frozen pond, two laps a loop, arms up for a spin
-- on the far side of the second lap.
local function skater(t)
  local a = 2 * math.pi * (t % 60) / 60
  local rx, ry = POND_RX - 3.5, POND_RY - 2
  local x = POND_X + rx * math.cos(a)
  local y = POND_Y + ry * math.sin(a)
  local vx, vy = -math.sin(a) * rx, math.cos(a) * ry
  local face = (math.abs(vx) > math.abs(vy)) and (vx > 0 and "+x" or "-x") or (vy > 0 and "+y" or "-y")
  local spin = t >= 60 and (t % 60) >= 24 and (t % 60) < 36
  if spin then face = ({ "+x", "+y", "-x", "-y" })[(t // 2) % 4 + 1] end
  return { bx = math.floor(x + 0.5), by = math.floor(y + 0.5), bz = LEVEL, face = face,
    arms = spin and "up" or nil, tail = (t % 8 < 4) and "up" or nil, blink = (t % 51) < 2 }
end

-- Ice fisher: sits by the hole with a rod; every 40 frames a bite, and it
-- pulls a fish out, holds it up, and lets it go again.
local BITE, CATCH, RELEASE = 24, 28, 36
local function fisher(t)
  local p = t % 40
  local st = { bx = FISHER[1], by = FISHER[2], face = "+x", head = "down", blink = (t % 31) < 2 }
  if p >= BITE and p < CATCH then st.head = "up"; st.lift = (p % 2 == 0) and 1 or 0 end
  if p >= CATCH + 2 and p < RELEASE then st.head = "up"; st.hold = "fish"; st.arms = (p % 4 < 2) and "up" or nil; st.tail = "up" end
  return D.settle(st)
end

local function sledder(t)
  local p = t % 40
  local y, riding = sledPos(t)
  if riding then
    return { bx = SLED_X, by = y, bz = groundTop(SLED_X, y) + 1, face = "+y", arms = (p >= 6 and p < 14) and "up" or nil, tail = "up" }
  end
  if p < 20 then return D.settle { bx = SLED_X, by = y - 1, face = "+y", arms = (p >= 15) and "up" or nil, lift = (p >= 15 and p % 2 == 0) and 2 or 0 } end
  if p < 29 then return D.settle { bx = SLED_X, by = y - 1, face = "-y", legs = p % 2 + 1, stick = true } end
  return D.settle { bx = SLED_X, by = SLED_Y0 - 1, face = "+y", blink = p == 34 }
end

local ACTORS = {
  DRAG.at, chewer2, swimmer, fighter(FIGHT_A), fighter(FIGHT_B), skater, fisher, BUILD.at, sledder,
  D.watcher(86, 22, "+x", 5),
}

-- Effects --------------------------------------------------------------------

local FIREFLIES = { { 10, 12 }, { 24, 22 }, { 44, 10 }, { 60, 14 }, { 74, 18 }, { 88, 18 }, { 30, 44 }, { 50, 46 },
  { 66, 52 }, { 82, 46 }, { 12, 40 }, { 40, 2 }, { 62, 36 } }

local function burst(img, x, y, z, age)
  local sx, sy = proj(x, y, z)
  for i = 1, 12 do
    local a = (i / 12) * 2 * math.pi
    local r = 3 + age * 2
    D.fx(img, sx + math.floor(math.cos(a) * r + 0.5), sy - 2 + math.floor(math.sin(a) * r / 2 + 0.5), i % 3 == 0 and C.mud[1] or C.chip)
  end
end

local HIT
for tt = PUSH, FLOAT - 1 do if not HIT and slipZ(slipY(tt)) == LEVEL then HIT = tt end end

local function sceneFx(img, t)
  -- Dust as the next log is pulled off the heap, as it thumps onto the
  -- bench, as the cuts go through, and as the ends are chewed away.
  if t < 3 then burst(img, BX - DRAG1 + N // 2, LANE, G0, t) end
  if t >= HEAVE1 - 1 and t < HEAVE1 + 2 then burst(img, BX + N // 2, BY, ON_BENCH, t - HEAVE1 + 1) end
  if t >= CUT and t < CUT + 3 then
    for _, c in ipairs(CUTS) do burst(img, c, BY, ON_BENCH, t - CUT) end
  end
  if t >= CHIPPED - 1 and t < CHIPPED + 3 then
    burst(img, CUTS[1] - 1, BY + 1, G0, t - CHIPPED + 1)
    burst(img, CUTS[2] + 2, BY + 1, G0, t - CHIPPED + 1)
  end
  if HIT and t >= HIT and t < HIT + 3 then
    local sx, sy = proj(MID0 + MID_N // 2, slipY(HIT), LEVEL)
    D.splash(img, sx - 3, sy); D.splash(img, sx + 3, sy + 1)
  end
  -- The snowman's coal eyes and buttons, carrot nose and twig arms.
  do
    local sx, sy = proj(SNOWMAN[1] + 1, SNOWMAN[2] + 1, SNOWMAN[3] + 8)
    local coal, carrot, twig = C.coal, C.carrot, C.trunk[1]
    D.fx(img, sx - 2, sy + 2, coal); D.fx(img, sx + 1, sy + 2, coal)
    D.fx(img, sx, sy + 4, carrot); D.fx(img, sx + 1, sy + 4, carrot); D.fx(img, sx + 2, sy + 5, carrot)
    D.fx(img, sx, sy + 9, coal); D.fx(img, sx, sy + 12, coal)
    for i = 1, 4 do D.fx(img, sx - 4 - i, sy + 9 - i // 2, twig); D.fx(img, sx + 3 + i, sy + 9 - i // 2, twig) end
    D.fx(img, sx - 8, sy + 6, twig); D.fx(img, sx + 7, sy + 6, twig)
  end
  -- The snowball in flight: a white ball with a dark rim, on an arc.
  local thrower, target, p, dodge = fightRound(t)
  local flight = p - (THROW + 1)
  local span = HIT_AT - (THROW + 1)
  local tx, ty = proj(thrower[1], thrower[2], groundTop(thrower[1], thrower[2]))
  local gx, gy = proj(target[1], target[2], groundTop(target[1], target[2]))
  if dodge then gx, gy = gx + (gx - tx) // 2, gy + 6 end
  if flight >= 0 and flight < span then
    local k = flight / span
    local bx = math.floor(tx + (gx - tx) * k + 0.5)
    local by = math.floor((ty - 15) + ((gy - (dodge and 2 or 9)) - (ty - 15)) * k - 12 * math.sin(math.pi * k) + 0.5)
    for _, d in ipairs({ { 0, -1 }, { 1, -1 }, { -1, 0 }, { 2, 0 }, { -1, 1 }, { 2, 1 }, { 0, 2 }, { 1, 2 } }) do
      D.fx(img, bx + d[1], by + d[2], C.outline)
    end
    D.fx(img, bx, by, C.snow[1]); D.fx(img, bx + 1, by, C.snow[1]); D.fx(img, bx, by + 1, C.snow[1]); D.fx(img, bx + 1, by + 1, C.snow[3])
  end
  -- Snow bursts where it lands.
  local age = p - HIT_AT
  if age >= 0 and age < 4 then
    local hx, hy = gx, gy - (dodge and 2 or 9)
    for i = 1, 10 do
      local a = (i / 10) * 2 * math.pi
      local r = 2 + age * 2
      D.fx(img, hx + math.floor(math.cos(a) * r + 0.5), hy + math.floor(math.sin(a) * r * 0.6 + 0.5), (i % 2 == 0) and C.snow[1] or C.snow[3])
    end
  end
  -- The fishing line, its float bobbing, and the catch.
  do
    local p = t % 40
    local fx0, fy0 = proj(FISHER[1], FISHER[2], groundTop(FISHER[1], FISHER[2]))
    local hx, hy = proj(HOLE[1], HOLE[2], LEVEL)
    if p < CATCH then
      local tipX, tipY = fx0 - 12, fy0 - 16
      for i = 0, 8 do D.fx(img, math.floor(fx0 - 4 + (tipX - fx0 + 4) * i / 8 + 0.5), math.floor(fy0 - 9 + (tipY - fy0 + 9) * i / 8 + 0.5), C.trunk[1]) end
      local dip = (p >= BITE) and ((p % 2 == 0) and 2 or 0) or ((t // 6) % 2)
      for y = tipY + 1, hy - 1 + dip do D.fx(img, tipX + math.floor((hx - tipX) * (y - tipY) / (hy - tipY) + 0.5), y, C.zz) end
      D.fx(img, hx, hy - 1 + dip, C.carrot); D.fx(img, hx + 1, hy - 1 + dip, C.carrot)
    end
    -- The fish leaps out of the hole, then back in.
    local function fishAt(k, x0, y0, x1, y1)
      local x = math.floor(x0 + (x1 - x0) * k + 0.5)
      local y = math.floor(y0 + (y1 - y0) * k - 8 * math.sin(math.pi * k) + 0.5)
      D.fx(img, x, y, C.fish); D.fx(img, x + 1, y, C.fish); D.fx(img, x - 1, y + 1, C.fish)
    end
    if p >= CATCH and p < CATCH + 2 then fishAt((p - CATCH + 1) / 2, hx, hy, fx0 - 6, fy0 - 10) end
    if p >= RELEASE and p < 40 then fishAt((p - RELEASE + 1) / 4, fx0 - 6, fy0 - 10, hx, hy) end
    if p == CATCH or p == 39 then D.splash(img, hx, hy) end
  end
  -- Snow sprays off the sled as it stops; the fort bursts as it falls.
  local sp = t % 40 - 14
  if sp >= 0 and sp < 4 then
    local sx, sy = proj(SLED_X, SLED_Y1 + 1, groundTop(SLED_X, SLED_Y1 + 1))
    for i = 1, 10 do
      local a = math.pi * (i / 10)
      D.fx(img, sx + math.floor(math.cos(a) * (3 + sp * 2) + 0.5), sy - math.floor(math.sin(a) * (2 + sp * 2) + 0.5), (i % 2 == 0) and C.snow[1] or C.snow[3])
    end
  end
  local fa = t - FORT_FALL
  if fa >= 0 and fa < 6 then
    for i = 0, 4 do
      local sx, sy = proj(FORT_X + i, FORT_Y, FORT_G + 3)
      for k = 1, 8 do
        local a = (k / 8) * 2 * math.pi
        D.fx(img, sx + math.floor(math.cos(a) * (2 + fa * 2) + 0.5), sy - 2 + math.floor(math.sin(a) * (1 + fa) + 0.5), (k % 2 == 0) and C.snow[1] or C.snow[3])
      end
    end
  end
  D.particles(img, t, "snow", 40)
  D.fishLeap(img, t, 58, 30, LEVEL, 60, 10)
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
