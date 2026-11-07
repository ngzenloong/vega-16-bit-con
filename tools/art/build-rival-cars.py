#!/usr/bin/env python3
"""Original pixel rival cars. Draw on a native grid, then export opaque SVG runs.

Run from any directory. No dependencies, raster tracing, fonts, or external SVG
resources. Vehicle names describe silhouette references, not endorsements.
"""
from pathlib import Path
import argparse
import json
from html import escape
from math import ceil, floor

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/vega"
NOTES = ROOT / "tools/art/metadata"
W = H = 96
INK = "#0F3301"
BLACK = "#182218"
TIRE = "#293127"
RUBBER = "#41493C"
DAISY = "#FFFAEB"
CREAM = "#DFDEC4"
METAL = "#A5AC96"
GLASS = "#293F31"
GLASS_L = "#59705B"
GLASS_H = "#8A9C7D"
LEAF = "#0D5500"
LEAF_L = "#49832C"
LEAF_D = "#173D12"
YELLOW = "#FFD11B"
YELLOW_L = "#FFE577"
YELLOW_D = "#B98B18"
LIME = "#D5FB19"
LIME_D = "#8CA522"
ORANGE = "#FF9823"
ORANGE_D = "#B85D18"
RED = "#CA4E2C"
RED_H = "#FF8250"


class Pixels:
    def __init__(self):
        self.rows = [[None] * W for _ in range(H)]
        self.tags = [[None] * W for _ in range(H)]
        self.tag = "body"

    def dot(self, x, y, color):
        x, y = int(x), int(y)
        if 0 <= x < W and 0 <= y < H:
            self.rows[y][x] = color
            self.tags[y][x] = self.tag

    def rect(self, x, y, w, h, color):
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                self.dot(xx, yy, color)

    def line(self, a, b, color=INK, thickness=1):
        x0, y0 = map(int, a)
        x1, y1 = map(int, b)
        dx, sx = abs(x1-x0), 1 if x0 < x1 else -1
        dy, sy = -abs(y1-y0), 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.rect(x0, y0, thickness, thickness, color)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def poly(self, points, color, outline=None):
        # Scanline fill sampled at pixel centers. All exported coordinates are integers.
        pts = [(int(x), int(y)) for x, y in points]
        for y in range(min(p[1] for p in pts), max(p[1] for p in pts)+1):
            scan_y, xs = y + .5, []
            for a, b in zip(pts, pts[1:] + pts[:1]):
                if (a[1] <= scan_y < b[1]) or (b[1] <= scan_y < a[1]):
                    xs.append(a[0] + (scan_y-a[1])*(b[0]-a[0])/(b[1]-a[1]))
            xs.sort()
            for lo, hi in zip(xs[::2], xs[1::2]):
                self.rect(ceil(lo-.5), y, ceil(hi-.5)-ceil(lo-.5), 1, color)
        if outline:
            for a, b in zip(pts, pts[1:] + pts[:1]):
                self.line(a, b, outline)

    def mirror(self):
        p = Pixels()
        p.rows = [list(reversed(row)) for row in self.rows]
        p.tags = [list(reversed(row)) for row in self.tags]
        return p

    def bounds(self, tags=None):
        pts = [(x, y) for y in range(H) for x in range(W)
               if self.rows[y][x] and (tags is None or self.tags[y][x] in tags)]
        if not pts:
            return [0, 0, 0, 0]
        x0, y0 = min(p[0] for p in pts), min(p[1] for p in pts)
        x1, y1 = max(p[0] for p in pts), max(p[1] for p in pts)
        return [x0, y0, x1-x0+1, y1-y0+1]

    def runs(self):
        active, done = {}, []
        for y, row in enumerate(self.rows + [[None]*W]):
            runs, x = {}, 0
            while x < W:
                color = row[x]
                if color is None:
                    x += 1
                    continue
                x0 = x
                while x < W and row[x] == color:
                    x += 1
                key = (x0, x-x0, color)
                runs[key] = active[key] if key in active else [x0, y, x-x0, 0, color]
                runs[key][3] += 1
            done.extend(v for k, v in active.items() if k not in runs)
            active = runs
        return done


class View:
    """Rear plane plus independently projected depth planes for a slight yaw.

    Front corners shift left in the left-steering pose, exposing the right side.
    Roof, glass, bed, mirrors, wheel faces and rear panel are redrawn in this pose.
    The right pose is its geometric mirror; lettering is applied afterwards.
    """
    def __init__(self, yaw=0):
        self.c = Pixels()
        self.yaw = yaw
        self.window_bounds = None

    def point(self, x, y, z=0):
        return (round(48+(x-48)*(0.96 if self.yaw else 1)+self.yaw*(2-z*.62)), round(y))

    def poly(self, pts, color, outline=INK):
        self.c.poly([self.point(*p) for p in pts], color, outline)

    def rect(self, x, y, w, h, color, z=0, outline=None):
        pts = [(x, y, z), (x+w-1, y, z), (x+w-1, y+h-1, z), (x, y+h-1, z)]
        if outline is not None:
            self.poly(pts, color, outline)
        else:
            a, b = self.point(x,y,z), self.point(x+w,y+h,z)
            self.c.rect(a[0], a[1], max(1,b[0]-a[0]), b[1]-a[1], color)

    def line(self, a, b, color=INK, thickness=1):
        self.c.line(self.point(*a), self.point(*b), color, thickness)

    def wheel(self, x, y, w=9, h=15, z=0):
        self.c.tag = "wheel"
        self.poly([(x+2,y,z),(x+w-2,y,z),(x+w,y+2,z),(x+w,y+h-2,z),
                   (x+w-2,y+h,z),(x+1,y+h,z),(x,y+h-2,z),(x,y+2,z)], BLACK)
        self.rect(x+2,y+3,w-3,h-6,TIRE,z)
        self.line((x+2,y+4,z),(x+2,y+h-4,z),RUBBER)
        if self.yaw and z:
            self.rect(x+3,y+5,2,h-9,METAL,z)
        self.c.tag = "body"

    def glass(self, pts, bottom=None):
        projected = [self.point(*p) for p in pts]
        px = [p[0] for p in projected]; py = [p[1] for p in projected]
        self.window_bounds = [min(px), min(py), max(px)-min(px)+1, max(py)-min(py)+1]
        self.poly(pts, BLACK)
        inner = pts
        self.poly(inner, GLASS, BLACK)
        # Discrete reflected bands, never opacity or a blue window tint.
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        y0, y1 = min(ys), max(ys)
        x0, x1 = min(xs), max(xs)
        z = pts[0][2] if len(pts[0]) > 2 else 0
        self.line((x0+3,y0+3,z),(x1-4,y0+3,z),GLASS_L)
        self.line((x0+4,y0+4,z),(x0+7,y0+4,z),GLASS_H)
        if bottom:
            self.line(*bottom,GLASS_L)

    def lamp(self, x, y, w=5, h=9, z=0):
        self.rect(x,y,w,h,BLACK,z,INK)
        self.rect(x+1,y+1,w-2,max(2,h//3),ORANGE,z)
        self.rect(x+1,y+1+h//3,w-2,h-h//3-2,RED,z)
        self.rect(x+1,y+1,1,2,YELLOW_L,z)

    def roundlamp(self,x,y,r=3,z=0,color=RED):
        self.poly([(x-r+1,y-r,z),(x+r-1,y-r,z),(x+r,y-r+1,z),
                   (x+r,y+r-1,z),(x+r-1,y+r,z),(x-r+1,y+r,z),
                   (x-r,y+r-1,z),(x-r,y-r+1,z)],color,BLACK)
        self.rect(x-r+1,y-r+1,2,1,RED_H if color==RED else YELLOW_L,z)

    def badge(self, cx, y):
        x,_ = self.point(cx, y)
        return [x-10, y, 21, 9]


FONT = {
    'S': ['111','100','111','001','111'],
    'I': ['111','010','010','010','111'],
    'E': ['111','100','110','100','111'],
    'M': ['10001','11011','10101','10001','10001'],
}

# The user's explicit Chinese plate exception: grass radical, person roof,
# then the lower tree strokes and leftward center hook. This is a hand-drawn
# 11x11 bitmap, not a font resource or a rasterized text element.
TEA_GLYPH = [
    '00010001000',
    '01111111110',
    '00010001000',
    '00000100000',
    '00011011000',
    '01100100110',
    '00000100000',
    '00111111100',
    '00010101000',
    '00100100100',
    '01001100010',
]


def stamp_word(c, text, x, y, color):
    c.tag="body"
    xx=x
    for char in text:
        glyph=FONT[char]
        for yy,row in enumerate(glyph):
            for dx,bit in enumerate(row):
                if bit=='1':c.dot(xx+dx,y+yy,color)
        xx+=len(glyph[0])+1


def stamp_siem(c, box):
    x,y,w,h=box
    c.tag="body"
    c.rect(x,y,w,h,METAL)
    c.rect(x+1,y+1,w-2,h-2,INK)
    stamp_word(c,"SIEM",x+2,y+2,DAISY)


def stamp_tea_plate(c, box):
    x,y,w,h=box
    c.tag="body"
    c.rect(x,y,w,h,METAL)
    c.rect(x+1,y+1,w-2,h-2,INK)
    for yy,row in enumerate(TEA_GLYPH):
        for xx,bit in enumerate(row):
            if bit=='1':c.dot(x+5+xx,y+2+yy,DAISY)


def mini(v):
    # Classic saloon: narrow pillars, separate upright boot, chrome bumper.
    v.wheel(18,73,10,17);v.wheel(68,73,10,17)
    if v.yaw:v.wheel(70,64,7,17,9)
    v.poly([(21,40,10),(28,22,9),(66,22,9),(75,42,8),(77,80),(72,84),(22,84),(19,77)],LEAF_D)
    v.poly([(26,23,9),(31,18,10),(64,18,10),(69,23,9),(70,30),(27,30)],DAISY)
    v.line((32,20,10),(63,20,10),CREAM)
    v.poly([(27,28),(69,28),(74,47),(77,58),(76,79),(70,83),(24,83),(19,78),(19,58),(22,47)],LEAF)
    v.poly([(29,30),(67,30),(70,46),(25,46)],CREAM)
    v.glass([(31,32),(65,32),(68,44),(27,44)])
    v.line((25,49),(71,49),LEAF_L)
    v.poly([(27,52),(69,52),(70,70),(26,70)],LEAF,LEAF_D)
    v.rect(43,52,10,2,CREAM)
    v.rect(44,54,8,1,METAL)
    v.lamp(21,54,5,13);v.lamp(70,54,5,13)
    v.rect(20,73,56,5,BLACK)
    v.rect(21,74,54,2,DAISY)
    v.rect(25,76,46,1,METAL)
    v.rect(29,70,2,3,CREAM);v.rect(65,70,2,3,CREAM)
    v.line((23,80),(72,80),LEAF_D)
    return v.badge(48,72), [27,32,41,13]


def az1(v):
    # A low, mid-engined coupe with four circular rear lamps and louvered deck.
    v.wheel(17,73,11,17);v.wheel(68,73,11,17)
    v.poly([(20,51,11),(29,36,12),(65,36,12),(76,53,10),(79,81),(16,81)],ORANGE_D)
    v.poly([(30,37,12),(34,33,13),(62,33,13),(66,38,12),(68,45),(28,45)],ORANGE)
    v.poly([(28,43),(68,43),(75,59),(22,59)],BLACK)
    v.glass([(32,44),(64,44),(68,53),(28,53)])
    v.line((37,45),(37,52),GLASS_L);v.line((59,45),(59,52),GLASS_L)
    v.poly([(22,55),(74,55),(79,64),(78,79),(73,83),(22,83),(17,78),(17,64)],ORANGE)
    v.poly([(26,55),(70,55),(73,62),(23,62)],BLACK)
    for y in [56,58,60]:v.line((28,y),(68,y),METAL)
    v.line((20,64),(76,64),YELLOW_L)
    v.rect(18,65,60,10,ORANGE_D)
    for x in [24,33,63,72]:v.roundlamp(x,69,3)
    v.rect(19,77,58,8,BLACK)
    v.rect(23,78,50,1,RUBBER)
    for y in [79,82]:
        v.rect(23,y,12,1,RUBBER);v.rect(62,y,12,1,RUBBER)
    v.rect(22,83,5,3,METAL);v.rect(23,84,3,2,BLACK)
    v.line((29,40,12),(31,44),ORANGE_D)
    v.line((67,40,12),(66,44),ORANGE_D)
    return v.badge(48,74), [28,44,40,10]


def isetta(v):
    # Standard four-wheel Isetta: close-set rear pair, not the UK three-wheeler.
    v.wheel(37,77,8,13);v.wheel(51,77,8,13)
    if v.yaw:v.wheel(67,61,7,16,10)
    v.poly([(29,41,8),(32,24,10),(40,17,10),(57,17,10),(65,27,9),(70,47,7),(70,75),(64,82),(31,82),(25,73),(25,51)],YELLOW_D)
    v.poly([(30,35),(35,24),(42,20),(55,20),(62,25),(67,36),(70,52),(69,72),(63,80),(33,80),(27,72),(26,52)],YELLOW)
    v.poly([(30,35),(36,26),(42,22),(55,22),(61,27),(66,37),(67,44),(29,44)],DAISY)
    v.poly([(34,30),(39,27),(57,27),(62,31),(65,41),(31,41)],CREAM)
    v.glass([(36,31),(40,29),(56,29),(60,32),(62,39),(33,39)])
    v.line((31,46),(65,46),YELLOW_L)
    v.poly([(34,50),(61,50),(64,66),(31,66)],YELLOW,YELLOW_D)
    v.rect(44,51,8,2,INK)
    v.line((34,64),(61,64),YELLOW_D)
    v.roundlamp(30,64,3);v.roundlamp(66,64,3)
    v.rect(29,73,38,4,CREAM);v.rect(31,76,34,2,METAL)
    v.rect(32,70,2,9,DAISY);v.rect(62,70,2,9,DAISY)
    return v.badge(48,68), [33,29,29,11]


def p50(v):
    # One central rear tire and a separate small reversing handle are essential.
    v.wheel(44,73,8,17)
    if v.yaw:v.wheel(66,64,6,14,11)
    v.poly([(34,35,8),(38,23,10),(57,23,10),(64,34,8),(66,72),(61,79),(34,79),(29,71),(29,44)],DAISY)
    v.poly([(34,29),(39,26),(56,26),(62,30),(66,46),(66,70),(61,77),(35,77),(30,70),(30,47)],DAISY)
    v.line((34,47),(34,66),CREAM)
    v.poly([(38,32),(58,32),(61,35),(61,47),(35,47),(35,35)],CREAM)
    v.glass([(38,34),(57,34),(59,36),(59,45),(37,45),(37,36)])
    v.line((35,50),(61,50),CREAM)
    v.roundlamp(34,62,2);v.roundlamp(62,62,2)
    # Handle, not a front grille. White perimeter bumper sits below the plate.
    v.rect(43,53,10,2,INK);v.rect(42,54,2,3,METAL);v.rect(52,54,2,3,METAL)
    v.rect(30,73,36,3,INK);v.rect(32,73,32,1,DAISY)
    v.rect(36,79,4,2,RUBBER)
    return v.badge(48,63), [37,34,22,12]


def sambar_van(v):
    # Fifth-generation high-roof van, broad upright hatch and low narrow lamps.
    v.wheel(19,76,9,14);v.wheel(68,76,9,14)
    v.poly([(23,23,12),(27,11,12),(66,11,12),(74,23,10),(77,81),(18,81),(18,27)],LEAF_D)
    v.poly([(25,14,12),(28,9,12),(65,9,12),(70,15,12),(72,23),(24,23)],LIME)
    v.line((29,12,12),(63,12,12),YELLOW_L)
    v.poly([(24,20),(71,20),(76,27),(76,79),(71,84),(23,84),(19,80),(19,28)],LEAF)
    v.rect(23,24,49,31,DAISY,outline=INK)
    v.glass([(25,26),(69,26),(70,52),(24,52)])
    v.line((27,50),(67,50),GLASS_L)
    v.line((48,48),(61,46),BLACK,2)
    v.rect(22,56,51,22,LEAF,outline=LEAF_D)
    v.rect(44,57,10,3,BLACK);v.rect(45,57,8,1,METAL)
    v.line((24,63),(70,63),LEAF_L)
    v.lamp(20,65,5,14);v.lamp(71,65,5,14)
    v.rect(20,79,56,7,METAL)
    v.rect(21,79,54,1,CREAM);v.rect(23,83,50,1,RUBBER)
    v.line((27,73),(68,73),LEAF_D)
    return v.badge(48,76), [24,26,46,27]


def sambar_truck(v):
    # Wide two-seat cab behind a long empty ribbed bed; a full-width tailgate.
    v.wheel(18,75,10,15);v.wheel(68,75,10,15)
    v.poly([(25,21,15),(29,17,16),(66,17,16),(71,22,15),(72,48,11),(24,48,11)],DAISY)
    v.poly([(27,23,13),(68,23,13),(70,47,10),(25,47,10)],CREAM)
    v.glass([(30,25,13),(65,25,13),(66,39,11),(29,39,11)])
    v.rect(47,27,2,11,CREAM,12)
    v.line((30,42,11),(65,42,11),METAL)
    v.poly([(24,44,11),(72,44,11),(77,66),(75,81),(20,81),(18,66)],DAISY)
    v.poly([(28,47,10),(67,47,10),(71,65),(24,65)],RUBBER)
    v.poly([(30,49,9),(65,49,9),(68,64),(27,64)],METAL)
    for x in [32,39,47,55,63]:v.line((x,50,9),(x,64),CREAM)
    v.poly([(19,63),(76,63),(76,78),(19,78)],DAISY)
    v.line((22,66),(73,66),METAL)
    v.rect(24,68,48,1,CREAM);v.rect(24,72,48,1,CREAM)
    v.rect(21,64,3,4,METAL);v.rect(71,64,3,4,METAL)
    v.rect(27,76,5,3,INK);v.rect(64,76,5,3,INK)
    v.rect(18,79,60,8,BLACK)
    v.lamp(21,80,10,5);v.lamp(65,80,10,5)
    v.rect(70,87,4,2,METAL)
    return v.badge(48,77), [29,25,37,15]


def midget(v):
    # Midget II pickup: a pinched single-seat cab, exposed bed rails, tiny tailgate.
    v.wheel(24,74,9,16);v.wheel(63,74,9,16)
    v.poly([(33,24,14),(38,18,14),(57,18,14),(63,25,13),(62,46,10),(34,46,10)],ORANGE)
    v.poly([(36,25,12),(59,25,12),(60,45,10),(35,45,10)],ORANGE_D)
    v.glass([(39,27,12),(56,27,12),(57,40,10),(38,40,10)])
    v.rect(46,31,4,9,BLACK,11)
    v.poly([(30,45,10),(65,45,10),(70,67),(68,80),(27,80),(25,66)],LEAF_D)
    v.poly([(33,48,9),(62,48,9),(65,64),(30,64)],LEAF)
    for x in [35,43,51,59]:v.line((x,49,9),(x,64),LEAF_L)
    v.poly([(27,65),(68,65),(68,77),(27,77)],ORANGE)
    v.line((29,68),(66,68),YELLOW_L)
    v.rect(29,70,37,1,ORANGE_D)
    v.rect(29,64,3,5,CREAM);v.rect(63,64,3,5,CREAM)
    v.line((28,63),(32,43,10),LEAF_D,2)
    v.line((67,63),(64,43,10),LEAF_D,2)
    v.line((32,43,10),(64,43,10),LEAF_D,2)
    v.rect(25,79,45,8,BLACK)
    v.rect(27,80,9,4,RED);v.rect(60,80,9,4,RED)
    v.rect(27,80,2,4,ORANGE);v.rect(67,80,2,4,ORANGE)
    v.rect(29,80,5,1,RED_H);v.rect(61,80,5,1,RED_H)
    return v.badge(48,77), [38,27,19,14]



def be1(v):
    # Be-1: soft compact hatch, broad round-corner rear glass, black rub-strip.
    v.wheel(16,75,11,15);v.wheel(69,75,11,15)
    v.poly([(22,36,10),(29,23,11),(64,23,11),(73,37,9),(79,78),(72,84),(22,84),(16,77)],YELLOW_D)
    v.poly([(28,27,10),(33,21,11),(61,21,11),(68,27,10),(69,32),(27,32)],YELLOW)
    v.poly([(27,30),(68,30),(75,40),(79,59),(78,78),(72,83),(23,83),(17,78),(17,57),(21,40)],YELLOW)
    v.poly([(29,33),(66,33),(70,37),(72,49),(68,54),(27,54),(23,49),(25,38)],BLACK)
    v.glass([(30,35),(64,35),(68,38),(70,48),(67,51),(29,51),(26,48),(27,39)])
    v.line((45,49),(58,46),BLACK,2)
    v.poly([(26,57),(69,57),(71,72),(24,72)],YELLOW,YELLOW_D)
    v.rect(43,57,10,2,BLACK)
    # Three horizontal lenses in each rounded corner cluster.
    for x in [19,69]:
        for y,col in [(58,RED),(64,ORANGE),(70,RED)]:
            v.poly([(x+1,y),(x+6,y),(x+7,y+1),(x+7,y+3),(x+6,y+4),(x+1,y+4),(x,y+3),(x,y+1)],col,BLACK)
        v.rect(x+1,65,2,2,CREAM)
    v.rect(19,74,58,8,BLACK);v.rect(22,75,52,1,RUBBER)
    v.line((26,72),(69,72),YELLOW_L)
    return v.badge(48,74), [26,35,44,17]


def pao(v):
    # Pao: canvas roof, external hinges, upright two-part hatch and triple lamps.
    v.wheel(16,75,10,15);v.wheel(70,75,10,15)
    v.poly([(22,31,12),(28,17,12),(66,17,12),(74,32,10),(79,80),(17,80)],LEAF_D)
    v.poly([(29,18,12),(65,18,12),(69,22,11),(68,28),(27,28),(26,22,11)],CREAM)
    v.rect(34,18,27,6,RUBBER,11)
    v.line((35,19,11),(59,19,11),METAL)
    v.poly([(25,26),(70,26),(76,34),(78,78),(73,83),(23,83),(18,78),(20,35)],LEAF_L)
    v.poly([(26,31),(69,31),(72,34),(72,54),(24,54),(24,34)],CREAM)
    v.glass([(28,33),(67,33),(70,35),(70,51),(26,51),(26,35)])
    v.line((48,46),(58,44),BLACK,2)
    v.rect(25,57,47,19,LEAF_L,outline=LEAF_D)
    v.line((25,57),(71,57),DAISY)
    v.line((29,72),(67,72),LEAF_D)
    v.rect(29,29,4,6,CREAM);v.rect(63,29,4,6,CREAM)
    v.rect(26,75,6,3,CREAM);v.rect(64,75,6,3,CREAM)
    v.rect(44,55,8,3,INK)
    for x in [21,74]:
        v.roundlamp(x,60,3,color=ORANGE)
        v.roundlamp(x,67,3)
        v.roundlamp(x,74,3,color=CREAM)
    v.rect(18,79,60,5,CREAM);v.rect(22,82,52,2,METAL)
    return v.badge(48,76), [26,33,44,19]


def figaro(v):
    # Figaro's folded-looking ivory roof, narrow rear glass and small tail fins.
    v.wheel(14,75,11,15);v.wheel(71,75,11,15)
    v.poly([(25,38,12),(32,26,13),(63,26,13),(70,38,11),(81,67),(81,79),(74,84),(21,84),(15,78),(15,65)],LEAF_D)
    v.poly([(31,28,12),(36,23,13),(59,23,13),(65,29,12),(66,35),(30,35)],DAISY)
    v.poly([(30,32),(65,32),(70,45),(69,53),(26,53),(25,45)],DAISY)
    v.poly([(35,35),(60,35),(65,43),(63,49),(32,49),(29,44)],CREAM)
    v.glass([(36,37),(59,37),(62,43),(60,46),(34,46),(32,43)])
    v.poly([(22,49),(27,51),(31,54),(65,54),(71,49),(76,49),(81,64),(81,77),(76,82),(20,82),(15,77),(15,65),(18,53)],LEAF_L)
    v.line((28,56),(68,56),CREAM)
    v.poly([(28,58),(68,58),(71,73),(24,73)],LEAF_L,LEAF_D)
    v.rect(44,58,8,2,CREAM)
    v.poly([(17,57),(22,55),(25,69),(23,75),(18,75)],CREAM)
    v.poly([(74,55),(79,57),(78,75),(73,75),(71,69)],CREAM)
    for x in [21,75]:
        v.roundlamp(x,61,3,color=ORANGE)
        v.roundlamp(x,70,3)
    v.rect(16,77,64,5,CREAM);v.rect(20,80,56,2,METAL)
    v.rect(24,75,2,9,DAISY);v.rect(70,75,2,9,DAISY)
    return v.badge(48,75), [32,37,30,10]


def scargo(v):
    # S-Cargo: full-height snail-like van shell, large rear hatch and low oval lamps.
    # User-supplied Yokohama Version poster. These are printed-photo approximations,
    # not a manufacturer paint-code conversion. Text on the poster is not copied.
    blue, light, dark = "#4384D6", "#7BADE1", "#2166C3"
    roof, roof_light = "#2D4560", "#435E78"
    v.wheel(14,75,11,15);v.wheel(71,75,11,15)
    v.poly([(20,21,14),(26,9,14),(66,9,14),(75,21,12),(81,79),(75,85),(19,85),(14,79)],dark)
    v.poly([(26,12,13),(32,7,14),(61,7,14),(69,13,13),(73,23),(23,23)],roof)
    v.line((32,9,14),(60,9,14),roof_light)
    v.poly([(24,19),(70,19),(76,26),(79,47),(79,76),(75,82),(20,82),(16,76),(16,48),(19,28)],blue)
    v.line((25,20),(69,20),light)
    # The two white strips are on the REAR plane (z=0), not the exposed side.
    # Both are drawn for every pose. All depth-bearing side panels remain blue.
    v.poly([(24,20),(26,20),(21,29),(19,48),(19,78),(17,78),(17,48),(20,28)],DAISY,None)
    v.poly([(69,20),(71,20),(76,27),(79,47),(79,78),(76,78),(76,48),(73,28)],DAISY,None)
    v.poly([(25,24),(69,24),(72,28),(73,55),(69,59),(25,59),(21,55),(22,29)],BLACK)
    v.glass([(26,26),(68,26),(70,29),(71,54),(68,56),(26,56),(24,54),(25,30)])
    # The second supplied poster shows two front headrests through the rear glass.
    v.poly([(29,32),(66,32),(67,50),(28,50)],GLASS_L,None)
    v.rect(28,49,40,4,GLASS)
    for x in [32,56]:
        v.poly([(x+1,43),(x+6,43),(x+7,44),(x+7,49),(x,49),(x,44)],BLACK,None)
        v.rect(x-2,49,12,4,BLACK)
    v.line((48,52),(61,49),BLACK,2)
    v.poly([(25,62),(70,62),(73,75),(22,75)],blue,dark)
    v.line((27,64),(68,64),light)
    v.rect(43,60,10,3,BLACK)
    v.poly([(20,65),(22,65),(25,67),(26,70),(25,73),(22,75),(20,75)],RED,BLACK)
    v.poly([(73,65),(75,65),(75,75),(73,75),(70,73),(69,70),(70,67)],RED,BLACK)
    v.rect(21,66,2,2,RED_H);v.rect(72,66,2,2,RED_H)
    # White arches and bumper match the poster livery without painting the tires.
    v.poly([(16,73),(20,71),(24,73),(25,77),(22,79),(19,77),(17,81),(15,80)],DAISY,INK)
    v.poly([(72,73),(76,71),(80,73),(81,80),(79,81),(77,77),(74,79),(71,77)],DAISY,INK)
    v.rect(16,78,63,7,DAISY)
    v.rect(17,83,61,2,CREAM)
    v.rect(17,85,61,1,BLACK)
    if v.yaw:
        v.c.tag = "wheel"
        v.rect(16,81,2,6,DAISY)
        v.rect(17,83,1,2,METAL)
        v.c.tag = "body"
    v.rect(22,86,4,2,METAL)
    return [v.point(48,70)[0]-10,70,21,15], [24,28,47,26]


MODELS = [
    ("mini", "Classic Mini Cooper", mini, ["https://www.press.bmwgroup.com/united-kingdom/photo/compilation/T0330170EN_GB/classic-mini-timeline:-1959-2000?language=en_GB"], "Upright compact saloon, contrasting roof, separate boot, small vertical lamps and chrome bumper."),
    ("az1", "Autozam AZ-1", az1, ["https://www2.mazda.com/en/100th/cars/detail_030_az1.html"], "Low mid-engined micro-coupe; short rear glass, louvered engine deck, four circular lamps."),
    ("isetta", "BMW Isetta 300 Export", isetta, ["https://www.bmwgroup-classic.com/en/models/bmw-classics/product-description-page.ad-223-1.bmw-isetta-300-export.html"], "Egg-shaped body with a small rear window, rear access panel and close-set twin rear wheels; standard four-wheel layout."),
    ("p50", "Peel P50", p50, ["https://www.peelengineering.com/about"], "Smallest, narrow single-seat shell, centered single rear wheel and reversing handle."),
    ("sambar-van", "Subaru Sambar van", sambar_van, ["https://www.subaru.co.jp/news/archives/01_1_3/01_02_26_1.htm/"], "1990-series high-roof van: upright body, tall cargo hatch, rectangular rear glass and low vertical lamps."),
    ("sambar-truck", "Subaru Sambar kei truck", sambar_truck, ["https://www.subaru.co.jp/news/archives/01_1_3/01_02_26_1.htm/"], "Wide two-seat cab over a long open bed, ribbed floor, full-width tailgate and low horizontal lamps."),
    ("midget", "Daihatsu Midget II pickup", midget, ["https://u-catch.daihatsu.co.jp/history/midget2/midget2/"], "1996 narrow-cab pickup, pinched one-seat rear window and exposed bed rails. Front spare wheel is not incorrectly drawn at the rear."),
    ("be1", "Nissan Be-1", be1, ["https://www.nissan-global.com/EN/HERITAGE_COLLECTION/Be_1_standardroof.html"], "Soft compact hatch, broad round-corner rear glass and full-width dark bumper."),
    ("pao", "Nissan Pao", pao, ["https://www.nissan-global.com/EN/HERITAGE_COLLECTION/Pao.html"], "Canvas roof, separate upper glass and smooth lower tailgate, exposed hinges and three stacked circular lamps."),
    ("figaro", "Nissan Figaro", figaro, ["https://www.nissan-global.com/EN/HERITAGE_COLLECTION/397_figaro.html", "https://global.nissannews.com/en/heritage_model_figaro"], "Ivory roof over green body, small rear window, separate sculpted boot and vertically paired circular lamps."),
    ("scargo", "Nissan S-Cargo", scargo, ["https://www.nissan-global.com/EN/HERITAGE_COLLECTION/s_cargo_129.html"], "Tall cargo shell, large rear glass and low oval lamps. Marine-blue body, white arches/bumper and dark roof follow the user-supplied Yokohama Version poster."),
]


def render_model(key, name, draw, sources, identity):
    views = []
    boxes = []
    window_boxes = []
    for yaw in [0, 1]:
        view = View(yaw)
        badge, window = draw(view)
        views.append(view.c)
        boxes.append(badge)
        window_boxes.append(view.window_bounds)
    views.append(views[1].mirror())
    b=boxes[1]
    boxes.append([96-b[0]-b[2], b[1], b[2], b[3]])
    b=window_boxes[1]
    window_boxes.append([96-b[0]-b[2], b[1], b[2], b[3]])
    for canvas, box in zip(views, boxes):
        if key=="scargo":
            stamp_tea_plate(canvas,box)
        else:
            stamp_siem(canvas, box)
    bounds=[c.bounds() for c in views]
    body_bounds=[c.bounds({"body"}) for c in views]
    meta={
        "id":key,"model":name,"frameWidth":96,"frameHeight":96,
        "frames":["straight","steering-left","steering-right"],"fps":0,
        "groundAnchor":[48,90],"rearLettering":"SIEM",
        "frameBounds":bounds,"bodyBounds":body_bounds,
        "bodyWidth":body_bounds[0][2],"maxBodyWidth":max(b[2] for b in body_bounds),
        "rearWindowBoxes":window_boxes,"rearLabelBoxes":boxes,
        "identity":identity,"sources":sources,
        "art":"Original code-native pixel illustration; no traced source pixels, manufacturer logo, external image, or font.",
        "rendering":"Draw one 96x96 frame at square aspect. The three state poses are not an autoplay animation. Ground anchor is shared with the player.",
        "driver":"Enclosed car or cab; no separate exposed driver sprite.",
    }
    if key=="scargo":meta.update({"requestedColor":"Yokohama Version marine blue","bodyColor":"#4384D6","bodyHighlight":"#7BADE1","bodyShade":"#2166C3","roofColor":"#2D4560","sourcePhotos":["91DE6246-D45D-4898-9559-780AA18A3652/1-Photo-1.jpg supplied by user","2B6ABA25-A49F-4774-AF84-823F7772D107/1-Photo-1.jpg supplied by user"],"colorNote":"Approximation of the first user-supplied printed Yokohama Version poster. Clean side-panel sample medians #4384D6 and #4684D4; shaded hood #2166C3. These are photo samples, not a verified factory paint-code conversion. Explicit blue-body exception applies only to S-Cargo.","liveryDetails":"White left/right REAR-edge strips stay visible in every pose on the rear plane (z=0). Exposed side panels remain marine blue. White rear bumper and wheel-arch trims; dark canvas roof. Second poster supplies the two visible headrests and outward red rear lamps. Side porthole motif omitted at this mild rear camera angle to preserve 96px readability. No promotional poster text or quantity claims copied."})
    if key=="scargo":
        meta["rearLettering"]="茶"
        meta["rearLabelGlyphOffset"]=[5,2]
        meta["rearLabelGlyphSize"]=[11,11]
        meta["plateNote"]="User-requested single Chinese plate glyph, hand-drawn as integer pixels. The central plate is the car's only lettering; the white bumper has no additional badge. The glyph is stamped after pose mirroring."
        meta["rearWhiteStripPlane"]="rear plane z=0; both strips present in every pose; no white side-plane wrap"
        meta["rearWhiteStripSamples"]=[
            {"left":[[19,35],[18,40],[18,50],[18,58],[18,64],[18,70]],"right":[[75,35],[76,40],[77,50],[77,58],[77,64],[77,70]]},
            {"left":[[22,35],[21,40],[21,50],[21,58],[21,64],[21,70]],"right":[[76,35],[77,40],[78,50],[78,58],[78,64],[78,70]]},
            {"left":[[19,35],[18,40],[17,50],[17,58],[17,64],[17,70]],"right":[[73,35],[74,40],[74,50],[74,58],[74,64],[74,70]]},
        ]
        meta["sideBlueSamples"]=[[],[[16,35],[16,40],[17,50],[17,58],[18,64]],[[79,35],[79,40],[78,50],[78,58],[77,64]]]
        meta["sideBlueSampleColor"]="#2166C3"
    title_suffix="tea-plate rival sprite sheet" if key=="scargo" else "SIEM rival sprite sheet"
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="288" height="96" viewBox="0 0 288 96" shape-rendering="crispEdges" role="img" aria-label="Original pixel {escape(name)} rear-view rival, straight and two steering poses" data-frame-width="96" data-frame-height="96" data-frame-count="3">',
         f'  <title>{escape(name)} — {title_suffix}</title>',
         '  <metadata>'+escape(json.dumps(meta,separators=(',',':')))+ '</metadata>']
    for i,canvas in enumerate(views):
        svg.append(f'  <g id="{meta["frames"][i]}" data-frame="{i}" transform="translate({i*96} 0)">')
        for x,y,w,h,color in canvas.runs():svg.append(f'    <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{color}"/>')
        svg.append('  </g>')
    svg.append('</svg>')
    filename=f"car-{key}.svg"
    (OUT/filename).write_text('\n'.join(svg)+'\n')
    return {"file":filename, **meta}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only",choices=[m[0] for m in MODELS],help="Regenerate one sheet and replace only its audit metadata record.")
    args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    NOTES.mkdir(parents=True,exist_ok=True)
    selected=[m for m in MODELS if not args.only or m[0]==args.only]
    rendered=[render_model(*m) for m in selected]
    if args.only:
        existing=json.loads((NOTES/"rival-car-metadata.json").read_text())
        result=[rendered[0] if m['id']==args.only else m for m in existing]
    else:
        result=rendered
    (NOTES/"rival-car-metadata.json").write_text(json.dumps(result,indent=2)+'\n')
    for m in rendered:print(m['file'], 'body',m['bodyWidth'],'max',m['maxBodyWidth'],'bounds',m['frameBounds'])


if __name__ == '__main__':
    main()
