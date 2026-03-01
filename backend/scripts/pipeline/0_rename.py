import re
from pathlib import Path

folder = Path("data")

pattern = re.compile(r"^(.*?)_+CO\s*(\d+:\d+:\d+)\.pdf$", re.IGNORECASE)

for file in folder.iterdir():
    if file.is_file() and file.suffix.lower() == ".pdf":
        m = pattern.match(file.name)
        if not m:
            continue

        title = m.group(1).rstrip("_ ")
        code = m.group(2)

        new_name = f"{title}__CO{code}.pdf"
        new_path = file.with_name(new_name)

        if new_name != file.name:
            file.rename(new_path)
            print(f"Renamed: {file.name} → {new_name}")
