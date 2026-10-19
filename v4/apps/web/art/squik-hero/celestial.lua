-- Sun and moon sprites for the Squik hero, 32x32 with transparent ground.
-- The site layers them behind the scene and swaps them on theme change: the
-- sun sets behind the diorama while the moon rises, and back.
-- Run: aseprite -b --script-param out=<dir> --script celestial.lua

local OUT = app.params.out or "."
local SIZE, C = 32, 16
local pc = app.pixelColor

local function hex(s)
  return pc.rgba(tonumber(s:sub(2, 3), 16), tonumber(s:sub(4, 5), 16), tonumber(s:sub(6, 7), 16), 255)
end

local COLORS = {
  sun = hex("#fff1b0"), sunEdge = hex("#ffd166"), ray = hex("#ffc94d"),
  moon = hex("#f4f0d6"), moonShade = hex("#d9d2b0"), halo = hex("#22304f"),
}

local function sprite(name, draw)
  local spr = Sprite(SIZE, SIZE, ColorMode.RGB)
  local img = Image(SIZE, SIZE, ColorMode.RGB)
  local function px(x, y, c)
    if x >= 0 and y >= 0 and x < SIZE and y < SIZE then img:drawPixel(x, y, c) end
  end
  draw(px)
  spr:newCel(spr.layers[1], 1, img, Point(0, 0))
  spr:saveCopyAs(OUT .. "/" .. name .. ".png")
  spr:close()
end

local function disc(px, r, c)
  for y = -r, r do
    for x = -r, r do
      if x * x + y * y <= r * r + r then px(C + x, C + y, c) end
    end
  end
end

sprite("squik-sun", function(px)
  disc(px, 9, COLORS.sunEdge)
  disc(px, 7, COLORS.sun)
  for k = 0, 7 do
    local a = k * math.pi / 4
    for rr = 12, 14 do
      px(C + math.floor(math.cos(a) * rr + 0.5), C + math.floor(math.sin(a) * rr + 0.5), COLORS.ray)
    end
  end
end)

sprite("squik-moon", function(px)
  for y = -13, 13 do
    for x = -13, 13 do
      local d = x * x + y * y
      if d > 90 and d <= 160 and (x + y) % 2 == 0 then px(C + x, C + y, COLORS.halo) end
    end
  end
  for y = -8, 8 do
    for x = -8, 8 do
      if x * x + y * y <= 72 and (x - 4) ^ 2 + (y + 2) ^ 2 > 50 then
        px(C + x, C + y, (x + y > 4) and COLORS.moonShade or COLORS.moon)
      end
    end
  end
end)
