-- Squik merge scene, shown while clips are being merged: two streams join
-- into one river in spring. A beaver rides a log down each stream; where they
-- meet the riders high-five and dive off, and a third beaver on a stepping
-- stone ties the two logs into one raft. It rides the raft down the river,
-- waving, leaps for the bank just before the edge fall and walks back. Up
-- the meadow a beaver picks blossoms and another plants a flower bed. One
-- raft per loop, under blossom trees and drifting petals.
--   aseprite -b --script-param lib=diorama.lua --script-param out=<dir> \
--     --script-param variant=day|night --script squik_merge.lua

local LEVEL = 3
local MEET = 46 -- x where the two streams become one river
local function smooth(t) t = math.max(0, math.min(1, t)); return t * t * (3 - 2 * t) end
-- Stream centres: the far stream comes from the back, the near one from the
-- right; past MEET the river winds on to the edge.
local function farY(x) return 9 + 16 * smooth(x / MEET) + 1.2 * math.sin(x * 0.2) end
local function nearY(x) return 50 - 25 * smooth(x / MEET) + 1.2 * math.sin(x * 0.17 + 1) end
local function mainY(x) return 25.5 + 3 * math.sin((x - MEET) * 0.07) end
local function streamDist(cyf, x, y, w)
  local slope = (cyf(x + 1) - cyf(x - 1)) / 2
  return math.abs(y - cyf(x)) / math.sqrt(1 + slope * slope) - w
end
local function farDist(x, y) return (x <= MEET + 2) and streamDist(farY, x, y, 4) or 99 end
local function nearDist(x, y) return (x <= MEET + 2) and streamDist(nearY, x, y, 4) or 99 end
local function mainDist(x, y) return (x >= MEET - 4) and (math.abs(y - mainY(x)) - (4.5 + 1.5 * smooth((x - 70) / 25))) or 99 end
local function riverDist(x, y) return math.min(farDist(x, y), nearDist(x, y), mainDist(x, y)) end

local D = dofile(app.params.lib)({
  variant = app.params.variant,
  season = "spring",
  -- Water drifts along each stream toward the confluence, then down the river.
  flow = function(x, y)
    if x >= MEET or mainDist(x, y) <= 0 then return { 1, 0 } end
    if nearDist(x, y) < farDist(x, y) then return { 1, -1 } end
    return { 1, 0 }
  end,
  waterLevel = function(x, y) return riverDist(x, y) <= 0 and LEVEL or 0 end,
})
local GX, GY, L, C, hash = D.GX, D.GY, D.L, D.C, D.hash
local setS, groundTop, proj = D.setS, D.groundTop, D.proj
local NAME = app.params.name or (D.NIGHT and "squik_merge_night" or "squik_merge_day")

-- World ------------------------------------------------------------------------

local ground = D.valley(riverDist, LEVEL)

-- Lodge on the point between the two streams.
local LODGE_X, LODGE_Y, LODGE_R = 20, 31, 4
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

-- A stepping stone at the confluence for the binder to stand on.
local STONE = { MEET + 2, 28 }
for dx = 0, 1 do
  for dy = 0, 1 do
    for z = groundTop(STONE[1] + dx, STONE[2] + dy), LEVEL do setS(STONE[1] + dx, STONE[2] + dy, z, "stone") end
    D.setTop(STONE[1] + dx, STONE[2] + dy, LEVEL + 1)
  end
end

local TREE_A, TREE_B = { 34, 2 }, { 72, 44 }
D.chewedTree(TREE_A)
D.chewedTree(TREE_B)
D.leafyTree(6, 2, 4, 3.0, "blossom")
D.pineTree(16, 3)
D.leafyTree(48, 6, 4, 3.3)
D.pineTree(58, 10)
D.leafyTree(66, 4, 4, 3.4, "blossom")
D.pineTree(78, 12)
D.leafyTree(88, 6, 4, 3.2)
D.pineTree(92, 18, 5)
D.pineTree(84, 40, 6)
D.leafyTree(90, 50, 3, 3.0, "blossom")
D.pineTree(62, 46, 5)
D.leafyTree(4, 18, 3, 2.8, "blossom")
D.pineTree(3, 57, 5)
local LANTERN = D.lantern(54, 34)

-- Two cut logs waiting upstream on each bank.
for x = 3, 6 do setS(x, 4, groundTop(x, 4), (x == 3 or x == 6) and "logEnd" or "log") end
for x = 4, 7 do setS(x, 42, groundTop(x, 42), (x == 4 or x == 7) and "logEnd" or "log") end

for _, r in ipairs({ { 28, 20 }, { 12, 24, true }, { 30, 36 }, { 60, 18, true }, { 76, 33 }, { 88, 28, true }, { 40, 44 } }) do
  D.rock(r[1], r[2], r[3])
end

-- Reeds along the sand, kept off the confluence.
for x = 1, GX - 2 do
  for y = 1, GY - 2 do
    local _, m = ground(x, y)
    local nearMeet = math.abs(x - MEET) < 6 and math.abs(y - 26) < 8
    if m == "sand" and not nearMeet and hash(x, y, 71) < 0.12 then D.reeds(x, y, 2 + math.floor(hash(x, y, 72) * 2)) end
  end
end

D.fillWater(LEVEL)
D.bake()
D.chips(TREE_A)
D.chips(TREE_B)

-- Logs and raft ----------------------------------------------------------------

local START, ARRIVE = 2, 38 -- each log drifts from x = START to x = ARRIVE
local JOIN = 44
local TIE, DEPART = JOIN + 16, JOIN + 20 -- the binder swims over once the riders are off
local LOG_N = 6
local LOG = D.logShape(LOG_N, "x")
local RAFT = {}
for dy = 0, 1 do
  for dx = 0, LOG_N - 1 do
    local m = (dx == 0 or dx == LOG_N - 1) and "logEnd" or "log"
    if dx == 1 or dx == LOG_N - 2 then m = "rope" end
    RAFT[#RAFT + 1] = { dx, dy, 0, m }
  end
end
local RAFT_Y = 25

-- Where a stream log is at frame t: drifting down, then easing in beside the
-- other log at the confluence.
local HIGH5
local function logAt(t, cyf, joinY)
  local x = math.min(START + t, ARRIVE)
  local y = math.floor(cyf(x + LOG_N / 2) + 0.5)
  local arrived = ARRIVE - START
  if t >= arrived then
    local k = math.min(1, (t - arrived) / (JOIN - arrived))
    y = math.floor(y + (joinY - y) * k + 0.5)
  end
  return x, y
end

local function route(x) return (x < MEET) and RAFT_Y or (mainY(x) - 0.5) end

-- Gardener: plants a row of flowers, digging at each spot; they bud and
-- open, and it walks back along the row picking them for a bouquet. 60 frames.
local BED_Y, BED_X = 47, { 70, 72, 74, 76 }
local GARDEN = D.path()
for k, x in ipairs(BED_X) do
  GARDEN.push { bx = x - 1, by = BED_Y - 1, face = "+x", legs = 1 }
  GARDEN.push { bx = x, by = BED_Y - 1, face = "+y", legs = 2 }
  for i = 1, 6 do GARDEN.push { bx = x, by = BED_Y - 1, face = "+y", head = "down", mud = i % 2 == 1 } end
  GARDEN.push { bx = x, by = BED_Y - 1, face = "+y", arms = "up", lift = 2 }
  GARDEN.push { bx = x, by = BED_Y - 1, face = "+y", arms = "up" }
end
local PICKED = #GARDEN.list -- the walk back starts here
GARDEN.walk("x", BED_X[#BED_X], BED_X[1], BED_Y - 1, "-x", { hold = "blossom" })
local GARDEN_PAD = 60 - #GARDEN.list
GARDEN.pad(60, function(n) return { bx = BED_X[1] - 1, by = BED_Y - 1, face = "+y", hold = "blossom", blink = n % 7 == 0 } end)

local function props(t)
  local list = {}
  -- The flower bed: a bud in every hole once it is dug, in bloom by the end.
  local g = t % 60 - GARDEN_PAD
  for k, x in ipairs(BED_X) do
    local picked = g >= PICKED + (BED_X[#BED_X] - x)
    if g >= (k - 1) * 10 + 8 and not picked then
      list[#list + 1] = { x, BED_Y, groundTop(x, BED_Y), (g - (k - 1) * 10 >= 14) and "blossom" or "leaf" }
    end
  end
  if t < JOIN then
    local ax, ay = logAt(t, farY, RAFT_Y)
    local bx, by = logAt(t, nearY, RAFT_Y + 1)
    D.place(list, LOG, ax, ay, LEVEL)
    D.place(list, LOG, bx, by, LEVEL)
  elseif t < DEPART then
    local shape = (t >= TIE) and RAFT or nil
    if shape then D.place(list, shape, ARRIVE, RAFT_Y, LEVEL)
    else
      D.place(list, LOG, ARRIVE, RAFT_Y, LEVEL)
      D.place(list, LOG, ARRIVE, RAFT_Y + 1, LEVEL)
    end
  end
  -- The raft outlives the loop: the previous one is still on its way.
  for _, age in ipairs({ t - DEPART, t - DEPART + L }) do
    if age >= 0 then D.float(list, RAFT, ARRIVE, route, age, LEVEL + 1) end
  end
  return list
end

-- Actors ---------------------------------------------------------------------

-- A rider on each log: surfs it down its stream, high-fives the other rider
-- where the logs meet, dives off and swims back upstream for the next one.
HIGH5 = JOIN - 2
-- For the high-five they step to opposite ends of the logs, face to face.
local function rider(cyf, joinY, side)
  local endX = (side < 0) and 0 or (LOG_N - 1)
  local function along(t) return 2 + math.max(-2, math.min(LOG_N - 3, (t - (HIGH5 - 4)) * ((side < 0) and -1 or 1))) * ((t >= HIGH5 - 4) and 1 or 0) end
  return function(t)
    if t < JOIN + 4 then
      local x, y = logAt(t, cyf, joinY)
      local five = t >= HIGH5 and t < JOIN + 2
      local step = t >= HIGH5 - 4 and t < HIGH5
      return { bx = x + along(t), by = y, bz = LEVEL + 1, face = (five or step) and ((side < 0) and "+x" or "-x") or "+x", legs = step and (t % 2 + 1) or nil,
        head = "up", arms = (five or (t % 24 >= 16 and t % 24 < 20)) and "up" or nil,
        lift = five and ((t - HIGH5) % 4 < 2 and 2 or 0) or ((t % 6 < 3) and 1 or 0),
        tail = (t % 4 < 2) and "up" or nil, blink = (t % 37) < 2 }
    end
    -- Dive: a short hop off the side of the raft into the stream.
    if t < JOIN + 8 then
      local k = t - (JOIN + 4)
      local x = ARRIVE + endX
      return { bx = x, by = joinY + side * (1 + k // 2), bz = LEVEL + 1, face = (side < 0) and "-y" or "+y",
        lift = ({ 4, 6, 4, 0 })[k + 1], arms = "up", splash = k == 3, splashZ = LEVEL }
    end
    -- Back upstream at two-thirds speed, then up onto the next log.
    local x = math.max(START + 2, ARRIVE + 2 - ((t - JOIN - 8) * 2) // 3)
    local wait = x == START + 2
    if t >= L - 2 then
      return { bx = START + 2, by = math.floor(cyf(START + LOG_N / 2) + 0.5), bz = LEVEL + 1, face = "+x", lift = (t == L - 2) and 3 or 1 }
    end
    return D.settle { bx = x, by = math.floor(cyf(x) + 0.5) + (wait and 0 or side), face = wait and "+x" or "-x",
      head = "up", wake = not wait, blink = wait and (t % 30) < 2 }
  end
end

-- Binder: waits on the stepping stone, ties the logs into a raft and rides it
-- off, waving; jumps for the near bank before the fall and walks back.
local BIND = {}
local RIDE_END, LAND = DEPART + 46, DEPART + 54
local BANK_Y = 35
do
  -- Ride, then jump.
  for t = DEPART - 2, RIDE_END - 1 do
    local age = math.max(0, t - DEPART)
    local x = ARRIVE + age + 2
    BIND[t] = { bx = x, by = math.floor(route(x) + 0.5) + 1, bz = LEVEL + 1, face = "+x",
      arms = (t >= DEPART + 4) and (((t // 4) % 2 == 0) and "wave" or "up") or nil,
      lift = (t < DEPART) and 3 or ((t % 6 < 3) and 1 or 0), tail = (t % 4 < 2) and "up" or nil }
  end
  local jx = ARRIVE + (RIDE_END - DEPART) + 2
  local y0 = math.floor(route(jx) + 0.5) + 1
  local ARC = { 3, 6, 8, 9, 9, 8, 6, 3 }
  for k = 0, LAND - RIDE_END - 1 do
    local y = y0 + math.floor((BANK_Y - y0) * (k + 1) / (LAND - RIDE_END) + 0.5)
    local g = math.max(LEVEL + 1, groundTop(jx, y))
    BIND[RIDE_END + k] = { bx = jx, by = y, bz = g, face = "+y", lift = ARC[k + 1], arms = "up", tail = "up" }
  end
  -- Walk back along the near bank and wade out to the stone.
  local back = D.path()
  back.push { bx = jx, by = BANK_Y, face = "+y", head = "down", puff = true }
  back.walk("x", jx - 1, STONE[1] + 2, BANK_Y, "-x")
  back.walk("y", BANK_Y, STONE[2] + 1, STONE[1] + 1, "-y")
  for k, st in ipairs(back.list) do BIND[(LAND + k - 1) % L] = st end
  local home = (LAND + #back.list) % L
  -- Waits on the stone (cheering the high-five), then swims to the raft's
  -- near side once the riders have dived off, and ties it.
  local SWIM0 = JOIN + 4
  assert(LAND + #back.list - L <= SWIM0, "binder must be home before the logs: " .. (LAND + #back.list - L))
  for t = home, SWIM0 - 1 do
    local five = t >= HIGH5 and t < JOIN + 2
    BIND[t] = { bx = STONE[1] + 1, by = STONE[2] + 1, face = "-x", arms = five and "up" or nil, blink = (t % 45) < 2 }
  end
  local swim = D.path()
  swim.walk("x", STONE[1], ARRIVE + 3, STONE[2] + 1, "-x")
  swim.walk("y", STONE[2], RAFT_Y + 2, ARRIVE + 3, "-y")
  for k, st in ipairs(swim.list) do BIND[SWIM0 + k - 1] = st end
  assert(SWIM0 + #swim.list <= TIE - 2, "binder swims too long: " .. (SWIM0 + #swim.list))
  for t = SWIM0 + #swim.list, DEPART - 3 do
    BIND[t] = { bx = ARRIVE + 3, by = RAFT_Y + 2, face = "-y", head = (t % 3 == 0) and "down" or "up", puff = (t % 4 == 1) }
  end
  for t = 0, L - 1 do assert(BIND[t], "binder has no state at " .. t) end
end
local function binder(t)
  local st = {}
  for k, v in pairs(BIND[t]) do st[k] = v end
  return D.settle(st)
end

-- The watcher across the river cheers the binder's leap.
local function watcher(t)
  if t >= RIDE_END - 4 and t < LAND + 6 then
    return D.settle { bx = 86, by = 20, face = "+y", arms = "up", lift = (t % 4 < 2) and 2 or 0, tail = "up" }
  end
  return D.watcher(86, 20, "+x", 11)(t)
end

-- Blossom picker: strolls under the blossom tree, picks one, sniffs it and
-- strolls back. 40 frames.
local PICK = D.path()
do
  local Y, X0, X1 = 8, 4, 12
  PICK.walk("x", X0, X1, Y, "+x")
  for i = 1, 4 do PICK.push { bx = X1, by = Y, face = "-y", head = (i < 3) and "down" or "up" } end
  for i = 1, 6 do PICK.push { bx = X1, by = Y, face = "+y", hold = "blossom", arms = (i >= 3 and i <= 4) and "up" or nil, blink = i >= 3 } end
  PICK.walk("x", X1 - 1, X0, Y, "-x", { hold = "blossom" })
  PICK.pad(40, function() return { bx = X0, by = Y, face = "+y", hold = "blossom", head = "up" } end)
end


local ACTORS = {
  rider(farY, RAFT_Y, -1), rider(nearY, RAFT_Y + 1, 1), binder,
  PICK.at, GARDEN.at, watcher,
}

-- Effects --------------------------------------------------------------------

local FIREFLIES = { { 10, 12 }, { 24, 22 }, { 44, 10 }, { 60, 14 }, { 74, 20 }, { 88, 22 }, { 30, 40 }, { 50, 40 },
  { 66, 50 }, { 82, 46 }, { 12, 44 }, { 40, 4 }, { 26, 28 } }

local function sceneFx(img, t)
  -- Ripples where the two streams meet.
  for m = 1, 6 do
    local mx, my = proj(MEET + 1 + math.floor(hash(m, t // 2, 31) * 4), 24 + math.floor(hash(m, t // 2, 32) * 4), LEVEL)
    D.fx(img, mx, my - 1, m % 2 == 0 and C.foam or C.waterHi)
  end
  -- A splash as the logs bump together.
  if t >= JOIN and t < JOIN + 3 then
    local sx, sy = proj(ARRIVE + LOG_N // 2, RAFT_Y + 1, LEVEL)
    D.splash(img, sx, sy)
  end
  -- Sparkles where the riders' paws meet.
  local h5 = t - (HIGH5 + 1)
  if h5 >= 0 and h5 < 4 then
    local sx, sy = proj(ARRIVE + (LOG_N - 1) / 2, RAFT_Y + 0.5, LEVEL + 1)
    for i = 0, 7 do
      local a = i * math.pi / 4
      local r = 3 + h5 * 2
      D.fx(img, sx + math.floor(math.cos(a) * r + 0.5), sy - 20 + math.floor(math.sin(a) * r + 0.5), (i % 2 == 0) and C.lilyFlower or C.foam)
    end
  end
  D.particles(img, t, "petals", 26)
  D.fishLeap(img, t, 64, 26, LEVEL, 60, 40)
  D.fallFoam(img, t)
  D.lanternHalo(img, t, LANTERN)
  D.fireflies(img, t, FIREFLIES)
end

local function run(cyf, xa, xb, w)
  return function(u)
    local wx = xa + u * (xb - xa)
    return wx, cyf(wx) + 0.35 * w * math.sin(2 * math.pi * u * 1.5)
  end
end

D.render {
  name = NAME,
  actors = ACTORS,
  props = props,
  fx = sceneFx,
  mist = {
    { run(farY, 2, MEET, 3), LEVEL + 1, 3, 1 },
    { run(nearY, 2, MEET, 3), LEVEL + 1, 3, 1 },
    { run(mainY, MEET, GX - 1, 5), LEVEL + 1, 4, 1 },
  },
}
