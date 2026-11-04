#!/usr/bin/env python3
"""fidelity.py — compares each rewrite to its source: links, numbers, [PLACEHOLDERS],
diagram markers, table rows, Pearmill bullets. Prints misses; exit 1 if any."""
import re, sys, pathlib
D = pathlib.Path("content/marketing-101"); bad = 0
for src in sorted((D/"src").glob("*.md")):
    a = src.read_text(); b = (D/"rewrite"/src.name).read_text()
    miss = []
    for kind, rx in [("link", r"\]\(<?([^)>]+)>?\)"), ("num", r"\$?\d[\d,.]*%?"), ("ph", r"\\?\[([A-Z][A-Z0-9 ]+)\\?\]"), ("dia", r"embedded content: ([^\\\]]+)")]:
        for x in sorted(set(re.findall(rx, a))):
            if x not in b: miss.append(f"{kind}:{x}")
    ra, rb = a.count("\n|"), b.count("\n|")
    if ra != rb: miss.append(f"table-rows {ra}->{rb}")
    for line in a.splitlines():
        if line.startswith("- **") and "—" in line and line not in b: miss.append("pearmill:" + line[:40])
    if miss: bad += 1; print(src.name, "|", "; ".join(miss))
print("tabs with misses:", bad); sys.exit(1 if bad else 0)
