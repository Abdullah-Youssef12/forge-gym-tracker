from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / "public"
font_path = Path("C:/Windows/Fonts/impact.ttf")

for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    image = Image.new("RGB", (size, size), "#c7f36b")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(font_path), int(size * 0.68))
    box = draw.textbbox((0, 0), "F", font=font)
    x = (size - (box[2] - box[0])) / 2 - box[0] - size * 0.025
    y = (size - (box[3] - box[1])) / 2 - box[1] - size * 0.025
    draw.text((x, y), "F", fill="#0b0e11", font=font)
    image.save(root / name)
