# Writes a 640 px wide copy of every photo into photos/sm/, used for lists, cards and
# map tooltips so they don't download the full-size image. Re-run after adding photos:
#   python3 tools/make-small-photos.py      (needs Pillow: pip install pillow)
import os
from PIL import Image

SRC, DST, WIDTH = "photos", "photos/sm", 640
os.makedirs(DST, exist_ok=True)
made = 0
for name in sorted(os.listdir(SRC)):
    if not name.endswith(".jpg"):
        continue
    src, dst = os.path.join(SRC, name), os.path.join(DST, name)
    # Only missing copies are made (file dates aren't reliable after a git checkout).
    # Replaced a photo under the same name? Delete its copy in photos/sm/ first.
    if os.path.exists(dst):
        continue
    im = Image.open(src).convert("RGB")
    im.thumbnail((WIDTH, WIDTH * 2))
    im.save(dst, quality=80, optimize=True, progressive=True)
    made += 1
print(f"{made} small photo(s) written to {DST}/")
