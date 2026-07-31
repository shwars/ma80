"""Build mobile-friendly album assets and a chronological browser manifest."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError


BIRTH_YEAR = 1946
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}

# Visual estimates for scans without useful capture metadata. Duplicate scans and
# restorations share stems, so one estimate covers every version of the image.
AGE_BY_STEM = {
    "618230703.069656": 22,
    "618230897.227466": 23,
    "9b7f6f80-b8af-4c82-b935-36a4a766319f": 25,
    "0069-0": 26,
    "619010362.232144": 28,
    "618239559.351086": 29,
    "619519598.735341": 30,
    "619010625.438734": 34,
    "dsh_mother": 35,
    "619010665.373428": 36,
    "619518186.748361": 37,
    "D1_IMG010-0": 40,
    "D1_IMG017-0": 41,
    "D1_IMG018-0": 41,
    "IMG036-0": 39,
    "IMG012-0": 43,
    "IMG004-0": 44,
    "IMG001-0": 46,
    "IMG008-0": 50,
    "IMG008-0__jpeg": 50,
    "IMG008-0__jpg": 50,
    "IMG021-0": 51,
    "IMG023-0": 51,
    "AUT_2963": 60,
    "altAjiPz5cKo-tXb0sGLgfDXW8xIpY44alSrlbyuN0boNhI": 63,
    "ma15_20": 65,
    "WP_001193": 67,
    "6tag_270315-155558": 69,
    "IMG-20160724-WA0002": 70,
    "IMG-20161123-WA0000": 70,
}

CHATGPT_AGES = {
    "05_04_53 PM": 44,
    "05_07_31 PM": 45,
    "05_11_26 PM": 27,
    "05_21_56 PM": 35,
    "05_23_26 PM": 34,
    "05_28_10 PM": 36,
    "05_33_21 PM": 38,
    "05_35_00 PM": 38,
    "06_44_00 AM": 34,
    "06_48_53 AM": 38,
    "06_50_50 AM": 32,
    "07_13_17 AM": 34,
}

KNOWN_DUPLICATE_EXPORTS = {
    "ChatGPT Image Jul 19, 2026, 05_04_53 PM.png",
}


@dataclass
class PhotoSource:
    path: Path
    relative: str
    captured: datetime | None
    age: int
    confidence: str
    family: str
    variant: str

    @property
    def sort_key(self) -> tuple:
        if self.captured:
            return (self.age, self.captured, self.family.lower(), self.variant_rank)
        return (
            self.age,
            datetime(self.age + BIRTH_YEAR, 1, 1),
            self.family.lower(),
            self.variant_rank,
        )

    @property
    def variant_rank(self) -> int:
        return {"Архивный оригинал": 0, "Скан": 1, "Восстановленная версия": 2}.get(
            self.variant, 1
        )


def capture_date(image: Image.Image, filename: str) -> datetime | None:
    exif = image.getexif()
    raw = exif.get(36867) or exif.get(306)
    if raw:
        try:
            return datetime.strptime(str(raw), "%Y:%m:%d %H:%M:%S")
        except ValueError:
            pass

    # AI restoration exports carry their export date in the filename, not the
    # date represented by the photograph.
    if filename.startswith("ChatGPT Image"):
        return None

    for pattern in (r"(20\d{2})(\d{2})(\d{2})", r"(?:^|\D)(20\d{2})(?:\D|$)"):
        match = re.search(pattern, filename)
        if match:
            groups = match.groups()
            year = int(groups[0])
            month = int(groups[1]) if len(groups) > 1 else 1
            day = int(groups[2]) if len(groups) > 2 else 1
            try:
                return datetime(year, month, day)
            except ValueError:
                return datetime(year, 1, 1)
    return None


def family_name(path: Path) -> str:
    stem = path.stem.replace("__jpeg", "").replace("__jpg", "")
    return stem


def estimate_age(path: Path, captured: datetime | None) -> tuple[int, str]:
    if captured:
        return max(0, captured.year - BIRTH_YEAR), "dated"
    family = family_name(path)
    if family in AGE_BY_STEM:
        return AGE_BY_STEM[family], "estimated"
    for marker, age in CHATGPT_AGES.items():
        if marker in path.name:
            return age, "estimated"
    return 60, "estimated"


def variant_label(path: Path, captured: datetime | None) -> str:
    if captured:
        return "Фото"
    if "_bw" in path.parts:
        return "Архивный оригинал"
    if path.suffix.lower() == ".png" or path.name.startswith("ChatGPT Image"):
        return "Восстановленная версия"
    return "Скан"


def load_sources(source_dir: Path) -> list[PhotoSource]:
    sources: list[PhotoSource] = []
    paths = sorted(
        (p for p in source_dir.rglob("*") if p.suffix.lower() in IMAGE_EXTENSIONS),
        key=lambda p: str(p).lower(),
    )
    for path in paths:
        with Image.open(path) as image:
            captured = capture_date(image, path.name)
        age, confidence = estimate_age(path, captured)
        sources.append(
            PhotoSource(
                path=path,
                relative=str(path.relative_to(source_dir)).replace("\\", "/"),
                captured=captured,
                age=age,
                confidence=confidence,
                family=family_name(path),
                variant=variant_label(path, captured),
            )
        )
    return sorted(sources, key=lambda source: source.sort_key)


def remove_duplicate_variants(
    sources: list[PhotoSource],
) -> tuple[list[PhotoSource], list[str]]:
    relatives = {source.relative for source in sources}
    kept: list[PhotoSource] = []
    removed: list[str] = []
    for source in sources:
        if source.relative in KNOWN_DUPLICATE_EXPORTS:
            removed.append(source.relative)
            continue
        if source.relative.startswith("_bw/"):
            suffix = source.path.suffix.lower().lstrip(".")
            restored_candidates = {
                f"{source.path.stem}.png",
                f"{source.path.stem}__{suffix}.png",
            }
            if relatives.intersection(restored_candidates):
                removed.append(source.relative)
                continue
        kept.append(source)
    return kept, removed


def flatten_to_rgb(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image)
    if image.mode in ("RGBA", "LA"):
        background = Image.new("RGB", image.size, (8, 8, 8))
        background.paste(image.convert("RGBA"), mask=image.convert("RGBA").getchannel("A"))
        return background
    return image.convert("RGB")


def resized(image: Image.Image, longest_edge: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((longest_edge, longest_edge), Image.Resampling.LANCZOS)
    return copy


def average_color(image: Image.Image) -> str:
    pixel = image.resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
    return f"rgb({pixel[0]} {pixel[1]} {pixel[2]})"


def russian_year_word(age: int) -> str:
    last_two = age % 100
    last = age % 10
    if 11 <= last_two <= 14:
        return "лет"
    if last == 1:
        return "год"
    if 2 <= last <= 4:
        return "года"
    return "лет"


def build(source_dir: Path, project_dir: Path) -> None:
    full_dir = project_dir / "assets" / "photos" / "full"
    thumb_dir = project_dir / "assets" / "photos" / "thumb"
    data_dir = project_dir / "data"
    full_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    sources, duplicate_sources = remove_duplicate_variants(load_sources(source_dir))
    existing_manifest = data_dir / "photos.json"
    existing_names: dict[str, str] = {}
    if existing_manifest.exists():
        previous = json.loads(existing_manifest.read_text(encoding="utf-8"))
        existing_names = {
            item["source"]: Path(item["full"]).name for item in previous.get("photos", [])
        }
    next_asset_number = max(
        (int(match.group(1)) for name in existing_names.values() if (match := re.search(r"(\d+)", name))),
        default=0,
    )
    manifest: list[dict] = []
    for number, source in enumerate(sources, start=1):
        filename = existing_names.get(source.relative)
        if not filename:
            next_asset_number += 1
            filename = f"photo-{next_asset_number:03d}.webp"
        full_path = full_dir / filename
        thumb_path = thumb_dir / filename
        reuse = False
        if full_path.exists() and thumb_path.exists():
            try:
                with Image.open(full_path) as opened_full:
                    full = opened_full.copy()
                with Image.open(thumb_path) as opened_thumb:
                    thumb = opened_thumb.copy()
                reuse = True
            except (OSError, UnidentifiedImageError):
                reuse = False
        if not reuse:
            with Image.open(source.path) as opened:
                image = flatten_to_rgb(opened)
            full = resized(image, 1920)
            thumb = resized(image, 640)
        if not reuse:
            full.save(full_path, "WEBP", quality=84, method=4)
            thumb.save(thumb_path, "WEBP", quality=72, method=4)

        year = source.captured.year if source.captured else source.age + BIRTH_YEAR
        manifest.append(
            {
                "id": number,
                "full": f"assets/photos/full/{filename}",
                "thumb": f"assets/photos/thumb/{filename}",
                "width": full.width,
                "height": full.height,
                "age": source.age,
                "year": year,
                "dateKnown": source.confidence == "dated",
                "variant": source.variant,
                "source": source.relative,
                "color": average_color(thumb),
                "alt": f"Мама, примерно в {source.age} {russian_year_word(source.age)}",
            }
        )
        print(f"[{number:03d}/{len(sources):03d}] {source.relative}")

    payload = {
        "birthYear": BIRTH_YEAR,
        "count": len(manifest),
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "photos": manifest,
    }
    json_text = json.dumps(payload, ensure_ascii=False, indent=2)
    (data_dir / "photos.json").write_text(json_text + "\n", encoding="utf-8")
    (data_dir / "photos.js").write_text(
        "window.MA80_ALBUM = " + json_text + ";\n", encoding="utf-8"
    )
    used_assets = {Path(item["full"]).name for item in manifest}
    for output_dir in (full_dir, thumb_dir):
        for asset in output_dir.glob("photo-*.webp"):
            if asset.name not in used_assets:
                asset.unlink()
    if duplicate_sources:
        print(f"Removed {len(duplicate_sources)} duplicate variants")
    print(f"Built {len(manifest)} photographs in {project_dir}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "source",
        nargs="?",
        default=r"D:\pictures\NEW\2026-MA80",
        type=Path,
    )
    parser.add_argument("--project", default=Path(__file__).resolve().parents[1], type=Path)
    args = parser.parse_args()
    build(args.source.resolve(), args.project.resolve())


if __name__ == "__main__":
    main()
