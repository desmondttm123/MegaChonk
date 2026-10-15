from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "assets" / "sprites" / "source"
OUT_DIR = ROOT / "assets" / "sprites" / "cat"
REMOVE_CHROMA = Path.home() / ".codex" / "skills" / ".system" / "imagegen" / "scripts" / "remove_chroma_key.py"
PYTHON = Path(r"C:\Users\Desmond\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe")


SHEETS = {
    "walk-phase-0": SRC_DIR / "turkish-van-walk-sheet-0.png",
    "walk-phase-1": SRC_DIR / "turkish-van-walk-sheet-1.png",
    "walk-phase-2": SRC_DIR / "turkish-van-walk-sheet-2.png",
    "groom": SRC_DIR / "turkish-van-groom-sheet.png",
}


def slice_sheet(name: str, path: Path, cols: int = 4, rows: int = 2) -> None:
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    x_bounds = [round(i * width / cols) for i in range(cols + 1)]
    y_bounds = [round(i * height / rows) for i in range(rows + 1)]
    inset = 2

    target_dir = OUT_DIR / name
    target_dir.mkdir(parents=True, exist_ok=True)

    frame = 0
    for row in range(rows):
        for col in range(cols):
            left, right = x_bounds[col] + inset, x_bounds[col + 1] - inset
            top, bottom = y_bounds[row] + inset, y_bounds[row + 1] - inset
            tile = image.crop((left, top, right, bottom))
            tile.save(target_dir / f"{frame}.png")
            frame += 1


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, path in SHEETS.items():
        if not path.exists():
            raise FileNotFoundError(path)
        slice_sheet(name, path)
    print(f"Prepared sprites in {OUT_DIR}")


if __name__ == "__main__":
    main()
