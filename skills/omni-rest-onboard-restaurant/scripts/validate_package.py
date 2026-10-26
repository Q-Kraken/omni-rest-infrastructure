#!/usr/bin/env python3
"""Read-only partial preflight for Omni REST content packages.

Python 3.9+, standard library only. Does not decode images, access the network,
write files, or invoke the importer. Application validation remains authoritative.
"""

import argparse
import hashlib
import json
import re
import struct
from decimal import Decimal
from pathlib import Path, PureWindowsPath


FIELDS = {
    "restaurant": set("slug name description phone phoneDisplay email websiteUrl restaurantType priceRange timeZone locale currency taxDisplayMode designId address hours socialLinks mainImage logo coverImage gallery menu".split()),
    "address": set("line1 line2 city region postalCode countryCode latitude longitude".split()),
    "menu": {"name", "categories"},
    "category": {"name", "description", "dishes"},
    "dish": {"name", "description", "price", "image", "badges", "available"},
    "image": {"file", "alt"},
    "gallery": {"file", "alt", "caption"},
}


def strict_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key: " + key)
        result[key] = value
    return result


def reject_constant(_value):
    raise ValueError("JSON contains a non-finite number")


def normalize_json(source):
    """Allow the importer's comments/trailing commas without altering strings."""
    output, pos, quoted = [], 0, False
    while pos < len(source):
        char = source[pos]
        if quoted:
            output.append(char)
            if char == "\\" and pos + 1 < len(source):
                pos += 1
                output.append(source[pos])
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
            output.append(char)
        elif source.startswith("//", pos) or source.startswith("/*", pos):
            if source.startswith("//", pos):
                end = source.find("\n", pos)
                end = len(source) if end < 0 else end
            else:
                end = source.find("*/", pos + 2)
                if end < 0:
                    raise ValueError("unterminated JSON block comment")
                end += 2
            output.extend("\n" if c == "\n" else " " for c in source[pos:end])
            pos = end
            continue
        else:
            output.append(char)
        pos += 1
    cleaned = "".join(output)
    output, pos, quoted = [], 0, False
    while pos < len(cleaned):
        char = cleaned[pos]
        if quoted:
            output.append(char)
            if char == "\\" and pos + 1 < len(cleaned):
                pos += 1
                output.append(cleaned[pos])
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
            output.append(char)
        elif char == ",":
            ahead, behind = pos + 1, pos - 1
            while ahead < len(cleaned) and cleaned[ahead].isspace():
                ahead += 1
            while behind >= 0 and cleaned[behind].isspace():
                behind -= 1
            trailing = (ahead < len(cleaned) and cleaned[ahead] in "]}" and
                        behind >= 0 and cleaned[behind] not in "[{,:")
            output.append(" " if trailing else char)
        else:
            output.append(char)
        pos += 1
    return "".join(output)


def image_header(data):
    """Return format/width/height from headers, without claiming decodability."""
    if len(data) >= 33 and data.startswith(b"\x89PNG\r\n\x1a\n") and data[12:16] == b"IHDR":
        return "PNG", *struct.unpack(">II", data[16:24])
    if data.startswith(b"\xff\xd8"):
        pos = 2
        frames = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
        while pos < len(data):
            if data[pos] != 0xFF:
                break
            while pos < len(data) and data[pos] == 0xFF:
                pos += 1
            if pos >= len(data):
                break
            marker = data[pos]
            pos += 1
            if marker in (0xDA, 0xD9):
                break
            if marker == 0x01 or 0xD0 <= marker <= 0xD8:
                continue
            if pos + 2 > len(data):
                break
            size = int.from_bytes(data[pos:pos + 2], "big")
            if size < 2 or pos + size > len(data):
                break
            if marker in frames and size >= 8:
                height, width = struct.unpack(">HH", data[pos + 3:pos + 7])
                return "JPEG", width, height
            pos += size
    if len(data) >= 20 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        end = int.from_bytes(data[4:8], "little") + 8
        if end > len(data):
            raise ValueError("truncated WebP container")
        pos = 12
        while pos + 8 <= end:
            kind = data[pos:pos + 4]
            size = int.from_bytes(data[pos + 4:pos + 8], "little")
            if pos + 8 + size > end:
                break
            payload = data[pos + 8:pos + 8 + size]
            if kind == b"VP8X" and len(payload) >= 10:
                return "WebP", int.from_bytes(payload[4:7], "little") + 1, int.from_bytes(payload[7:10], "little") + 1
            if kind == b"VP8L" and len(payload) >= 5 and payload[0] == 0x2F:
                bits = int.from_bytes(payload[1:5], "little")
                return "WebP", (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
            if kind == b"VP8 " and len(payload) >= 10 and payload[3:6] == b"\x9d\x01\x2a":
                return "WebP", int.from_bytes(payload[6:8], "little") & 0x3FFF, int.from_bytes(payload[8:10], "little") & 0x3FFF
            pos += 8 + size + size % 2
    raise ValueError("missing or unsupported JPEG/PNG/WebP dimension header")


def validate_package(package, max_bytes=5 * 1024 * 1024, max_dimension=8000,
                     max_pixels=40_000_000, minimum_main_width=704):
    path = Path(package).expanduser().resolve()
    if path.is_dir():
        path /= "restaurant.json"
    report = {
        "package": str(path), "preflightPassed": False,
        "scope": "Partial local checks; image headers only; not full importer validation or source verification.",
        "counts": {"categories": 0, "entries": 0, "entriesWithPhoto": 0, "entriesWithoutPhoto": 0, "uniqueReferencedAssets": 0},
        "assets": [], "errors": [], "warnings": [],
    }
    errors = report["errors"]
    try:
        content = json.loads(normalize_json(path.read_text(encoding="utf-8-sig")), parse_float=Decimal,
                             parse_constant=reject_constant, object_pairs_hook=strict_object)
    except (OSError, UnicodeError, ValueError) as exc:
        errors.append("Cannot read importer JSON: " + str(exc))
        return report
    root = path.parent

    def obj(value, kind, label):
        if not isinstance(value, dict):
            errors.append(label + ": expected an object")
            return {}
        unknown = set(value) - FIELDS[kind]
        if unknown:
            errors.append(label + ": unsupported fields: " + ", ".join(sorted(unknown)))
        return value

    def array(value, label):
        if value is None:
            return []
        if not isinstance(value, list):
            errors.append(label + ": expected an array")
            return []
        return value

    def text(value, label, limit, required=False):
        if value is None and not required:
            return
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= limit:
            errors.append(label + ": expected nonempty text up to " + str(limit) + " characters")

    refs = {}

    def image(value, label, gallery=False, main=False):
        if value is None:
            return
        value = obj(value, "gallery" if gallery else "image", label)
        name, alt = value.get("file"), value.get("alt")
        text(alt, label + ".alt", 200, required=True)
        if gallery:
            text(value.get("caption"), label + ".caption", 300)
        if not isinstance(name, str) or not name.strip():
            errors.append(label + ".file: expected a relative local file")
            return
        if Path(name).is_absolute() or PureWindowsPath(name).drive:
            errors.append(label + ".file: use a portable relative path")
            return
        try:
            target = (root / name).resolve()
            target.relative_to(root)
        except (ValueError, OSError, RuntimeError):
            errors.append(label + ".file: path escapes the package or cannot be resolved")
            return
        if not target.is_file():
            errors.append(label + ".file: referenced file is missing")
            return
        clean_alt = alt.strip() if isinstance(alt, str) else ""
        if target in refs and refs[target]["alt"] != clean_alt:
            errors.append(label + ".alt: reused file has different alt text")
        if target not in refs:
            refs[target] = {"file": name, "alt": clean_alt, "main": main}
        refs[target]["main"] |= main

    content = obj(content, "restaurant", "restaurant")
    slug = content.get("slug")
    if not isinstance(slug, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug) or len(slug) > 63:
        errors.append("slug: expected lowercase letters/digits separated by single hyphens, up to 63 characters")
    text(content.get("name"), "name", 120, required=True)
    text(content.get("description"), "description", 300)
    obj(content.get("address"), "address", "address")
    for key in ("mainImage", "coverImage", "logo"):
        image(content.get(key), key, main=key == "mainImage")
    gallery_files = set()
    for index, value in enumerate(array(content.get("gallery"), "gallery")):
        label = "gallery[" + str(index) + "]"
        image(value, label, gallery=True)
        if isinstance(value, dict) and isinstance(value.get("file"), str):
            if value["file"] in gallery_files:
                errors.append(label + ": duplicate gallery file reference")
            gallery_files.add(value["file"])
    menu_value = content.get("menu")
    menu = obj(menu_value if menu_value is not None else {}, "menu", "menu")
    text(menu.get("name"), "menu.name", 100)
    categories = array(menu.get("categories"), "menu.categories")
    report["counts"]["categories"] = len(categories)
    for ci, category in enumerate(categories):
        prefix = "menu.categories[" + str(ci) + "]"
        category = obj(category, "category", prefix)
        text(category.get("name"), prefix + ".name", 100, required=True)
        text(category.get("description"), prefix + ".description", 300)
        for di, dish in enumerate(array(category.get("dishes"), prefix + ".dishes")):
            label = prefix + ".dishes[" + str(di) + "]"
            dish = obj(dish, "dish", label)
            report["counts"]["entries"] += 1
            text(dish.get("name"), label + ".name", 160, required=True)
            text(dish.get("description"), label + ".description", 1000)
            price = dish.get("price")
            if isinstance(price, bool) or not isinstance(price, (int, Decimal)) or not Decimal(0) <= price <= Decimal("9999999999.99") or price != round(price, 2):
                errors.append(label + ".price: expected a numeric nonnegative amount with at most two decimals within storage precision")
            if "available" in dish and not isinstance(dish["available"], bool):
                errors.append(label + ".available: expected a boolean")
            if dish.get("image") is not None:
                report["counts"]["entriesWithPhoto"] += 1
            else:
                report["counts"]["entriesWithoutPhoto"] += 1
            image(dish.get("image"), label + ".image")
    hashes = {}
    for target, ref in refs.items():
        try:
            size = target.stat().st_size
            if not 0 < size <= max_bytes:
                raise ValueError("file size outside configured limit")
            data = target.read_bytes()
            if len(data) != size:
                raise ValueError("file changed while being read; retry after preparation finishes")
            fmt, width, height = image_header(data)
            if not (0 < width <= max_dimension and 0 < height <= max_dimension and width * height <= max_pixels):
                raise ValueError("image dimensions outside configured limits")
            if ref["main"] and width < minimum_main_width:
                raise ValueError("main image width below configured minimum")
            digest = hashlib.sha256(data).hexdigest()
            report["assets"].append({"file": ref["file"], "bytes": size, "format": fmt, "width": width, "height": height, "sha256": digest})
            if digest in hashes:
                report["warnings"].append("Same image bytes in " + hashes[digest] + " and " + ref["file"])
            hashes[digest] = ref["file"]
        except (OSError, ValueError, struct.error) as exc:
            errors.append(ref["file"] + ": " + str(exc))
    report["counts"]["uniqueReferencedAssets"] = len(refs)
    if not report["counts"]["entries"]:
        report["warnings"].append("No menu entries; confirm that an empty menu is intended.")
    report["preflightPassed"] = not errors
    return report


def positive(value):
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("limit must be positive")
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", help="restaurant.json or its containing folder")
    parser.add_argument("--max-bytes", type=positive, default=5 * 1024 * 1024)
    parser.add_argument("--max-dimension", type=positive, default=8000)
    parser.add_argument("--max-pixels", type=positive, default=40_000_000)
    parser.add_argument("--minimum-main-width", type=positive, default=704)
    args = parser.parse_args()
    report = validate_package(args.package, args.max_bytes, args.max_dimension, args.max_pixels, args.minimum_main_width)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["preflightPassed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
