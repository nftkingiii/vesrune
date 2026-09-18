from PIL import Image, ImageDraw

size = 1024
scale = size / 64
image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)

def p(points):
    return [(round(x * scale), round(y * scale)) for x, y in points]

draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=round(20 * scale), fill="#252032")
draw.polygon(p([(14, 18), (24, 18), (33, 42), (26, 51)]), fill="#c7afff")
draw.polygon(p([(34, 18), (50, 18), (37, 51), (27, 51)]), fill="#c7afff")
draw.polygon(p([(34, 18), (29, 31), (34, 44), (44, 18)]), fill="#ece2ff")

image.save(r"C:\Users\HP\Downloads\vesrune-logo.png", "PNG", optimize=True)
