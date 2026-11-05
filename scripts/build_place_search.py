"""Build the owner pages' place search from a data release.

    python3 scripts/build_place_search.py places.ndjson.gz owners/search

Reads a release's places.ndjson.gz and writes one JSON file per word prefix
into the output folder, plus index.json with the counts. A name word of
3 letters or more is filed under its first 3 letters, and a shorter word
under itself, so "Lake Sambell Caravan Park" is in lak.json, sam.json,
car.json and par.json. Each file is a list of
[id, name, kind, state, postcode, lat, lon]. The state comes from
scripts/au_states.json, outlines of the states and territories simplified
from OpenStreetMap (admin_level 4), and is "" for a place outside them all.
The postcode is "" when the place has no address. Places without a name are
left out: owners search by name.
"""

import gzip
import json
import math
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
PREFIX = 3
NEAR = 0.03  # degrees, about 3 km: a place on the coast just outside an outline
KEY = re.compile(r"^[a-z0-9]{1,3}$")


def words(name):
    """The searchable words of a name: ASCII, lower case, letters and digits."""
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return [w for w in re.split(r"[^a-z0-9]+", plain) if w]


def keys(name):
    """The prefix files a name is filed under."""
    return {w[:PREFIX] for w in words(name) if len(w) >= 2 or w.isdigit()}


def load_states(path=HERE / "au_states.json"):
    """[(state, ring, bbox, area)] for each outline ring, smallest first."""
    out = []
    for state, rings in json.loads(Path(path).read_text(encoding="utf-8")).items():
        for ring in rings:
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            area = abs(sum(ring[i][0] * ring[i - 1][1] - ring[i - 1][0] * ring[i][1] for i in range(len(ring)))) / 2
            out.append((state, ring, (min(xs), min(ys), max(xs), max(ys)), area))
    out.sort(key=lambda r: r[3])
    return out


def inside(lon, lat, ring):
    hit = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            hit = not hit
        j = i
    return hit


def gap(lon, lat, ring):
    """Distance in degrees from a point to a ring's edge."""
    best = float("inf")
    for i in range(len(ring)):
        (x1, y1), (x2, y2) = ring[i - 1], ring[i]
        dx, dy = x2 - x1, y2 - y1
        t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((lon - x1) * dx + (lat - y1) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(lon - (x1 + t * dx), lat - (y1 + t * dy)))
    return best


def state_of(lon, lat, states):
    """The state or territory a point is in. The smallest outline wins, so the ACT beats NSW around it."""
    near = [s for s in states if s[2][0] - NEAR <= lon <= s[2][2] + NEAR and s[2][1] - NEAR <= lat <= s[2][3] + NEAR]
    for state, ring, _, _ in near:
        if inside(lon, lat, ring):
            return state
    best, best_gap = "", NEAR
    for state, ring, _, _ in near:
        d = gap(lon, lat, ring)
        if d < best_gap:
            best, best_gap = state, d
    return best


def build(places_path, out_dir):
    states = load_states()
    shards = {}
    count = 0
    newest = None
    with gzip.open(places_path, "rt", encoding="utf-8") as lines:
        for line in lines:
            place = json.loads(line)
            name = (place.get("name") or "").strip()
            if not name:
                continue
            address = (place.get("facts") or {}).get("address") or {}
            loc = place["location"]
            state = state_of(loc["lon"], loc["lat"], states)
            entry = [place["id"], name, place["kind"], state, address.get("postcode", ""), round(loc["lat"], 5), round(loc["lon"], 5)]
            for key in keys(name):
                shards.setdefault(key, []).append(entry)
            count += 1
            updated = place.get("updated")
            if updated and (newest is None or updated > newest):
                newest = updated

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.json"):
        old.unlink()
    for key, entries in shards.items():
        if not KEY.match(key):
            continue
        entries.sort(key=lambda e: (e[1].lower(), e[0]))
        (out / f"{key}.json").write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (out / "index.json").write_text(json.dumps({"places": count, "files": len(shards), "newest_update": newest}), encoding="utf-8")
    return count, len(shards)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    places, files = build(sys.argv[1], sys.argv[2])
    print(f"{places} named places in {files} files")
