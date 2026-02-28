from concurrent.futures import ProcessPoolExecutor, as_completed
from pdf2image import convert_from_path
import io
from pathlib import Path
import base64
import pickle

DATA_DIR = Path("data")


def pil_to_data_url(img, fmt="PNG"):
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    mime = "image/png" if fmt.upper() == "PNG" else "image/jpeg"
    return f"data:{mime};base64,{b64}"


def process_pdf(pdf_path: Path, out_dir: Path, dpi: int = 150) -> Path:
    pages = convert_from_path(str(pdf_path), dpi=dpi)
    page_urls = [pil_to_data_url(p, "PNG") for p in pages]

    out_path = out_dir / f"{pdf_path.name}.pkl"
    with open(out_path, "wb") as f:
        pickle.dump(page_urls, f, protocol=pickle.HIGHEST_PROTOCOL)

    return out_path


def main():
    pdfs = list(DATA_DIR.glob("*.pdf"))
    out_dir = Path("preprocessed")

    import os

    max_workers = min(4, os.cpu_count() or 1)

    with ProcessPoolExecutor(max_workers=max_workers) as ex:
        futures = [ex.submit(process_pdf, pdf, out_dir, 150) for pdf in pdfs]
        for fut in as_completed(futures):
            out_path = fut.result()
            print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
