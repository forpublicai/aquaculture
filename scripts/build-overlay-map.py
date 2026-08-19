"""
Works out where every answer goes on DMR's LPA application form.

The form is flat: 28 pages, no fillable fields, so an answer can only be drawn at
a coordinate. Measuring eighty coordinates by hand would be slow, wrong, and dead
the moment DMR revises the form. This finds them instead, and the output is
committed, so the app itself needs none of this.

Three things make it possible.

  * The form's tables are drawn as thin rectangles, so the grid can be rebuilt
    from them and "the cell to the right of this label" becomes a computation.
  * Every checkbox is a real character in the text layer, so which box is which
    can be read off the wording beside it.
  * Where that character's *ink* lands is another matter, and is measured off a
    render rather than trusted, because the symbol fonts' reported boxes are
    nowhere near their squares.

An anchor is a piece of the form's own wording. If DMR moves a row, re-running
this finds it in its new place. If DMR rewords it, this fails loudly naming the
anchor, which is the right outcome: wording that changed needs a person to look.

Usage:
    pip install pdfplumber pillow numpy scipy
    brew install poppler          # for pdftoppm, used to measure the checkboxes
    python3 scripts/build-overlay-map.py
"""
import glob, json, os, pathlib, statistics, subprocess, warnings
from collections import defaultdict

import numpy as np
import pdfplumber
from PIL import Image

warnings.filterwarnings("ignore")

from scipy import ndimage

"""Reconstructs each form page's table grid and resolves 'the cell right of a label'."""
import pdfplumber, warnings
warnings.filterwarnings('ignore')

def rules(page):
    horiz, vert = [], []
    for r in page.rects:
        w, h = r['x1'] - r['x0'], r['bottom'] - r['top']
        if h < 3 and w > 5: horiz.append(r)
        elif w < 3 and h > 5: vert.append(r)
    return horiz, vert

def cluster(values, tol=1.5):
    out = []
    for v in sorted(values):
        if not out or v - out[-1] > tol: out.append(v)
    return out

def cell_right_of(page, x1, top, bottom):
    """The next cell to the right of x1, within the row band."""
    horiz, vert = rules(page)
    mid = (top + bottom) / 2
    # Vertical rules crossing this row band.
    xs = cluster([v['x0'] for v in vert if v['top'] - 2 <= mid <= v['bottom'] + 2])
    left = next((x for x in xs if x > x1 - 1), None)
    if left is None: return None
    right = next((x for x in xs if x > left + 8), None)
    if right is None: return None
    # Horizontal rules bounding the band, restricted to this column.
    ys = cluster([h['top'] for h in horiz if h['x0'] < right - 2 and h['x1'] > left + 2])
    above = max([y for y in ys if y <= top + 2], default=None)
    below = min([y for y in ys if y >= bottom - 2], default=None)
    if above is None or below is None: return None
    return (round(left, 1), round(above, 1), round(right, 1), round(below, 1))

def find_label(page, text, nth=0):
    """Bounding box of the nth run of words matching `text`."""
    words = page.extract_words()
    target = text.split()
    seen = 0
    for i in range(len(words) - len(target) + 1):
        run = words[i:i + len(target)]
        if [w['text'] for w in run] != target: continue
        if max(w['top'] for w in run) - min(w['top'] for w in run) > 6: continue
        if seen < nth:
            seen += 1
            continue
        return (min(w['x0'] for w in run), min(w['top'] for w in run),
                max(w['x1'] for w in run), max(w['bottom'] for w in run))
    return None

def cell_below(page, x0, x1, bottom):
    """The next open box under a question line, spanning the given x range."""
    horiz, vert = rules(page)
    mid = (x0 + x1) / 2
    ys = cluster([h['top'] for h in horiz if h['x0'] <= mid <= h['x1']])
    top = next((y for y in ys if y > bottom - 1), None)
    if top is None: return None
    below = next((y for y in ys if y > top + 8), None)
    if below is None: return None
    xs = cluster([v['x0'] for v in vert if v['top'] - 2 <= (top + below) / 2 <= v['bottom'] + 2])
    left = max([x for x in xs if x <= mid], default=None)
    right = min([x for x in xs if x > mid], default=None)
    if left is None or right is None: return None
    return (round(left, 1), round(top, 1), round(right, 1), round(below, 1))

def checkbox(page, right_text=None, row_label=None, option=None):
    """A checkbox glyph, found by the text beside it and optionally its row."""
    words = page.extract_words()
    boxes = [c for c in page.chars if c['text'] == '☐']
    if row_label:
        anchor = find_label(page, row_label)
        if not anchor: return None
        boxes = [c for c in boxes if anchor[1] - 14 <= c['top'] <= anchor[3] + 14]
    def right_of(c):
        same = [w for w in words if abs(w['top'] - c['top']) < 6 and w['x0'] >= c['x1'] - 1]
        return ' '.join(w['text'] for w in sorted(same, key=lambda w: w['x0']))
    wanted = option or right_text
    if wanted:
        boxes = [c for c in boxes if right_of(c).startswith(wanted)]
    if len(boxes) != 1: return None
    c = boxes[0]
    # The glyph's own cell, which is NOT where the square is drawn. `measure.py`
    # supplies the drawn square; this is only the handle for looking it up.
    return (round(c['x0'], 1), round(c['top'], 1), round(c['x1'], 1), round(c['bottom'], 1))

def box_containing(page, label):
    """The smallest drawn box the label sits inside, if any."""
    x0, top, x1, bottom = label
    best = None
    for r in page.rects:
        if r['x1'] - r['x0'] < 40 or r['bottom'] - r['top'] < 12: continue
        if r['x0'] <= x0 + 1 and r['x1'] >= x1 - 1 and r['top'] <= top + 1 and r['bottom'] >= bottom - 1:
            area = (r['x1'] - r['x0']) * (r['bottom'] - r['top'])
            if best is None or area < best[0]: best = (area, r)
    return best[1] if best else None

def answer_area_under(page, label_text):
    """Room to write under a question, inside the box the question sits in."""
    label = find_label(page, label_text)
    if not label: return None
    box = box_containing(page, label)
    if box is None: return cell_below(page, label[0], label[2], label[3])
    if box['bottom'] - label[3] < 12: return None
    return (round(box['x0'] + 4, 1), round(label[3] + 3, 1),
            round(box['x1'] - 4, 1), round(box['bottom'] - 3, 1))


"""Measures where each checkbox square is actually drawn, from a render of the blank form."""

DPI = 200

def render(pdf_path, page_no, out_prefix):
    subprocess.run(["pdftoppm", "-png", "-r", str(DPI), "-f", str(page_no), "-l", str(page_no),
                    pdf_path, out_prefix], check=True)
    return glob.glob(f"{out_prefix}-*.png")[0]

def square_for(char, image, scale, window=None):
    """The drawn square's rectangle, found as the box-shaped blob nearest the glyph.

    The outline is a hairline and the render anti-aliases it, so a stroke-finding
    approach misses most of them. A closed square is one connected component, so
    labelling the neighbourhood and picking the squarest blob of about the right
    size is both simpler and far more reliable.
    """
    if window is None:
        y0 = int((char['top'] - 1.3 * char['size']) * scale)
        y1 = int((char['bottom'] + 1.3 * char['size']) * scale)
    else:
        expected, slack = window
        y0 = int((expected - slack) * scale)
        y1 = int((expected + char['size'] + slack) * scale)
    x0 = int((char['x0'] - 0.4 * char['size']) * scale)
    x1 = int((char['x1'] + 0.4 * char['size']) * scale)
    sub = np.array(image)[max(y0, 0):y1, max(x0, 0):x1] < 205
    if sub.size == 0: return None

    labelled, count = ndimage.label(sub)
    centre_y = (char['top'] + char['bottom']) / 2
    best = None
    for index in range(1, count + 1):
        ys, xs = np.where(labelled == index)
        height = (ys.max() - ys.min() + 1) / scale
        width = (xs.max() - xs.min() + 1) / scale
        if not (0.35 * char['size'] <= height <= 1.05 * char['size']): continue
        if abs(width - height) > max(2.0, height * 0.3): continue
        # A filled blob is a letter, not a box: a square outline is mostly hollow.
        if len(ys) > 0.62 * height * width * scale * scale: continue
        top = (y0 + ys.min()) / scale
        bottom = (y0 + ys.max()) / scale
        distance = abs(top - (window[0] if window else centre_y))
        if best is None or distance < best[0]:
            best = (distance, (x0 + xs.min()) / scale, top, (x0 + xs.max()) / scale, bottom)
    if best is None: return None
    return (round(best[1], 1), round(best[2], 1), round(best[3], 1), round(best[4], 1))

def _candidates(char, image, scale, window=None):
    return square_for(char, image, scale, window)

def measure(pdf_path, pages):
    """Where every checkbox square is actually drawn.

    The gap between a glyph's reported cell and its drawn ink is a property of
    the font, not of the individual box, so this measures many boxes and takes
    the median. Per-box measurement was tried first and is worse: a hairline
    outline anti-aliases into pieces and the detector occasionally locks onto a
    neighbouring letter, whereas a median over dozens of boxes cannot.

    Self-calibrating, so a future revision of the form set in a different symbol
    font needs no new constants here.
    """
    samples = defaultdict(list)
    chars_by_page = {}
    with pdfplumber.open(pdf_path) as pdf:
        for page_no in pages:
            image = Image.open(render(pdf_path, page_no, f"/tmp/measure-p{page_no}")).convert('L')
            scale = image.size[0] / 612.0
            chars = [c for c in pdf.pages[page_no - 1].chars if c['text'] == '☐']
            chars_by_page[page_no] = chars
            for char in chars:
                rect = square_for(char, image, scale)
                if not rect: continue
                samples[(char['fontname'], round(char['size'], 1))].append(
                    (rect[1] - char['top'], rect[3] - rect[1], rect[0] - char['x0'], rect[2] - rect[0])
                )

    shape = {}
    for key, values in samples.items():
        if len(values) < 3: continue
        # The modal cluster, not the median. A hairline outline anti-aliases into
        # pieces and the detector sometimes locks onto the next box down or onto a
        # neighbouring letter, and on some pages those false readings outnumber
        # the true ones. The true offset is a font constant, so it recurs to
        # within a fraction of a point while the false ones scatter: the tightest
        # crowd of readings is the answer, however many strays surround it.
        offsets = [v[0] for v in values]
        centre = max(offsets, key=lambda o: sum(1 for other in offsets if abs(other - o) < 0.6))
        agreeing = [v for v in values if abs(v[0] - centre) < 0.6]
        if len(agreeing) < 3: continue
        shape[key] = tuple(statistics.median(v[i] for v in agreeing) for i in range(4))

    found, missed = {}, []
    for page_no, chars in chars_by_page.items():
        for char in chars:
            key = (page_no - 1, round(char['x0'], 1), round(char['top'], 1))
            metrics = shape.get((char['fontname'], round(char['size'], 1)))
            if not metrics:
                missed.append(key)
                continue
            dy, height, dx, width = metrics
            found[key] = (round(char['x0'] + dx, 1), round(char['top'] + dy, 1),
                          round(char['x0'] + dx + width, 1), round(char['top'] + dy + height, 1))
    return found, missed


"""Resolves every anchor to a rectangle on DMR's LPA form."""

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, '..', 'data', 'forms', 'LPA_Application.pdf')
OUT = os.path.join(HERE, '..', 'data', 'lpa-overlay-map.json')

# key: (page index, kind, args)
TEXT = [
    ("applicantName",            7, "right", "Name of A pplicant"),
    ("applicantAddress",         7, "right", "Address"),
    ("applicantCity",            7, "right", "City"),
    ("applicantStateZip",        7, "right", "State, Zip"),
    ("applicantTelephone",       7, "right", "Telephone"),
    ("applicantEmail",           7, "right", "Email*"),
    ("applicantDateOfBirth",     7, "right", "Date of Birth"),
    ("isAssistantOnOtherLpas",   7, "right", "on any existing LPA licenses?"),
    ("holdsOtherLpaLicenses",    7, "right", "LPA licenses?"),
    ("primaryAssistantName",     8, "right", "Primary Assistant", 1),
    ("primaryAssistantEmail",    8, "right", "Primary Assistant Email"),
    ("town",                     9, "right", "Town"),
    ("county",                   9, "right", "County"),
    ("waterbody",                9, "right", "Waterbody"),
    ("siteDescription",          9, "right", "of Hog Island)"),
    ("latitude",                 9, "right", "Latitude"),
    ("longitude",                9, "right", "Longitude"),
    ("lpaHealthZone",            9, "right", "website)"),
    ("growingAreaDesignation",   9, "right", "(e.g. WA(A) or WA(P1))"),
    ("uplandsDescription",      12, "under", "D escribe the surrounding uplands (i.e. forested, residential, farmland, commercial):"),
    ("bottomCharacteristics",   12, "under", "D escribe the bottom characteristics (description of substrate including flora and fauna):"),
]

CHECKS = [
    ("hasPreviouslyAppliedForSite.true",  7, {"row_label": "Prior Submissions", "option": "Yes"}),
    ("hasPreviouslyAppliedForSite.false", 7, {"row_label": "Prior Submissions", "option": "No"}),
    ("paymentType.check",                 7, {"row_label": "Payment Type", "option": "Check"}),
    ("paymentType.credit_card",           7, {"row_label": "Payment Type", "option": "Credit"}),
    ("ownerOperatorExemption.lease_in_own_name",                  8, {"right_text": "I have an experimental or standard lease in my"}),
    ("ownerOperatorExemption.ownership_interest_50_plus",         8, {"right_text": "I have a 50% or greater ownership interest in"}),
    ("ownerOperatorExemption.applied_for_lease_own_name",         8, {"right_text": "I have applied for an experimental or standard lease"}),
    ("ownerOperatorExemption.ownership_interest_in_applicant_company", 8, {"right_text": "I have an ownership interest in a company that"}),
    ("ownerOperatorExemption.upweller_only",                      8, {"right_text": "This is an upweller only site"}),
    ("isAboveMeanLowWater.true",   9, {"row_label": "(is the site intertidal)?", "option": "Yes"}),
    ("isAboveMeanLowWater.false",  9, {"row_label": "(is the site intertidal)?", "option": "No"}),
    ("purpose.commercial",   9, {"right_text": "Commercial (product is ultimately sold)"}),
    ("purpose.recreational", 9, {"right_text": "Recreational (product kept for personal use, not sold)"}),
    ("purpose.scientific",   9, {"right_text": "Scientific"}),
    ("purpose.educational",  9, {"right_text": "Educational"}),
    ("restrictedAreaRequirementsAcknowledged.true", 9, {"row_label": "and compliance:"}),
    ("isInEssentialHabitat.true",      12, {"row_label": "and Wildlife (MDIFW) Essential Habitat?", "option": "Yes"}),
    ("isInEssentialHabitat.false",     12, {"row_label": "and Wildlife (MDIFW) Essential Habitat?", "option": "No"}),
    ("hasEagleNestWithin660Ft.true",   12, {"row_label": "Is there an eagle’s nest within 660 feet of the proposed LPA?", "option": "Yes"}),
    ("hasEagleNestWithin660Ft.false",  12, {"row_label": "Is there an eagle’s nest within 660 feet of the proposed LPA?", "option": "No"}),
]

HATCHERY = {"blue_mussel":"Blue mussel","eastern_oyster":"American/eastern oyster","hard_clam_quahog":"Hard clam/quahog",
  "soft_shelled_clam":"Soft-shelled clam","atlantic_surf_clam":"Atlantic surf clam","arctic_surf_clam":"Arctic surf clam",
  "razor_clam":"Razor clam","green_sea_urchin":"Green sea urchin","bay_scallop":"Bay scallop","sugar_kelp":"Sugar kelp",
  "skinny_kelp":"Skinny kelp","horsetail_kelp":"Horesetail kelp","winged_kelp":"Winged kelp","dulse":"Dulse",
  "european_oyster":"European oyster","other":"Other:"}
WILD = {"blue_mussel":"Blue mussel","eastern_oyster":"American/eastern oyster","sea_scallop":"Sea scallop",
  "green_sea_urchin":"Green sea urchin","marine_algae":"Marine Algae:"}
GEAR = {"no_gear_bottom_culture":"No Gear (bottom culture only)","upweller":"Upweller",
  "shellfish_rafts":"Shellfish rafts, associated predator nets and spat collector",
  "tray_racks_and_overwintering_cages":"Shellfish tray racks and over wintering cages",
  "soft_or_semi_rigid_bags_or_floating_trays":"Soft bags, semi rigid bags, and/or floating trays",
  "lantern_or_pearl_nets":"Lantern nets and/or pearl nets","scallop_spat_collector_bags":"Scallop spat collector bags",
  "scallop_ear_hangers":"Scallop ear hangers","marine_algae_gear":"Marine algae",
  "bottom_anti_predator_netting":"Bottom anti-predator netting"}
FEATURES = {"federal_navigation_project_or_anchorage":(14,"Federal navigation projects or anchorages"),
  "navigational_channel":(14,"Navigational channels"),"structures":(14,"Structures"),
  "aquaculture_leases_or_lpas":(14,"Aquaculture leases or licenses (LPAs)"),
  "anchorages_or_moorings":(15,"Anchorages or moorings"),"state_or_federal_beach":(15,"State or federal beaches"),
  "docking_facility":(15,"Docking Facilities")}

for key, text in HATCHERY.items():   CHECKS.append((f"hatcherySpecies.{key}", 10, {"right_text": text}))
for key, text in WILD.items():       CHECKS.append((f"wildSpecies.{key}",     11, {"right_text": text}))
for key, text in GEAR.items():       CHECKS.append((f"gearCategories.{key}",  16, {"right_text": text}))
for key, (pg, text) in FEATURES.items(): CHECKS.append((f"nearbyFeatures.{key}", pg, {"right_text": text}))
CHECKS.append(("hasNoNearbyFeatures.true", 15, {"right_text": "None of the above"}))

def main():
    fields, checks, failed = {}, {}, []
    squares, _missed = measure(PDF, sorted({pi + 1 for _, pi, _ in CHECKS}))
    with pdfplumber.open(PDF) as pdf:
        for entry in TEXT:
            key, pi, kind, label = entry[:4]
            nth = entry[4] if len(entry) > 4 else 0
            page = pdf.pages[pi]
            if kind == "right":
                box = find_label(page, label, nth)
                rect = cell_right_of(page, box[2], box[1], box[3]) if box else None
            else:
                rect = answer_area_under(page, label)
            if rect: fields[key] = {"page": pi, "rect": list(rect)}
            else: failed.append(f"text {key} (p{pi+1}, {label[:40]!r})")
        for key, pi, args in CHECKS:
            rect = checkbox(pdf.pages[pi], **args)
            if rect:
                # Prefer the square as actually drawn; the glyph's reported cell
                # is the font's nominal box and does not match its ink.
                measured = squares.get((pi, rect[0], rect[1]))
                if not measured:
                    failed.append(f"check {key} (p{pi+1}) square not measured")
                    continue
                checks[key] = {"page": pi, "rect": list(measured)}
            else: failed.append(f"check {key} (p{pi+1})")
    out = {"form": "LPA_Application.pdf", "revision": "03/17/2026",
           "page": {"width": 612, "height": 792}, "fields": fields, "checkboxes": checks}
    print(f"resolved {len(fields)} text fields, {len(checks)} checkboxes")
    if failed:
        print(f"\nUNRESOLVED ({len(failed)}):")
        for f in failed: print("  " + f)
    return out

if __name__ == "__main__":
    out = main()
    import pathlib
    pathlib.Path(OUT).write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {os.path.relpath(OUT)}")
