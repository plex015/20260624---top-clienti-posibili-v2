from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "data"
OUTPUT_FILE = OUTPUT_DIR / "leads.js"
INCLUDED_WORKBOOKS = [
    "Lista_Fabrici_Armament_Romania.xlsx",
]


CATEGORY_LABELS = {
    "Lista_Clorosodice_Chimicale_Industriale_Romania.xlsx": "Clorosodice / Chimicale industriale",
    "Lista_Combustibili_Alternativi_Romania.xlsx": "Combustibili alternativi",
    "Lista_Depozite_GPL_Romania_v2.xlsx": "Depozite GPL",
    "Lista_Depozite_Petroliere_Romania_v2.xlsx": "Depozite petroliere",
    "Lista_Producatori_Ape_Minerale_Sucuri_Romania.xlsx": "Ape minerale / Sucuri",
    "Lista_Producatori_Bauturi_Alcoolice_Romania.xlsx": "Bauturi alcoolice",
    "Lista_Statii_Uscare_Masurare_Gaze.xlsx": "Statii uscare / masurare gaze",
    "Lista_Unitati_Militare_Romania.xlsx": "Unitati militare",
    "Lista_Fabrici_Armament_Romania.xlsx": "Fabrici de armament",
}


def clean(value) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return " ".join(text.split())


def first_existing(row, names: list[str]) -> str:
    for name in names:
        if name in row and clean(row[name]):
            return clean(row[name])
    return ""


def lead_id(source: str, row_number: int, name: str, operator: str, address: str) -> str:
    raw = f"{source}|{row_number}|{name}|{operator}|{address}".encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:12]


def read_leads() -> list[dict]:
    leads: list[dict] = []
    for workbook_name in INCLUDED_WORKBOOKS:
        workbook = BASE_DIR / workbook_name
        if not workbook.exists():
            raise FileNotFoundError(f"Missing workbook: {workbook}")

        category = CATEGORY_LABELS.get(workbook.name, workbook.stem.replace("_", " "))
        df = pd.read_excel(workbook).fillna("")
        for index, row in df.iterrows():
            name = first_existing(row, ["Nume"])
            operator = first_existing(row, ["Operator"])
            if not name and not operator:
                continue

            city = first_existing(row, ["Oras", "Oraș"])
            county = first_existing(row, ["Judet", "Județ"])
            address = first_existing(row, ["Adresa", "Adresă"])
            product = first_existing(row, ["Tip produs", "Tip statie", "Tip stație"])
            capacity = first_existing(row, ["Capacitate", "Capacitate (tone)", "Capacitate (m³)", "Capacitate (mc)"])
            cui = first_existing(row, ["CUI/CIF (Reg. Com.)", "CUI", "CIF"])

            searchable = " ".join(
                [name, operator, city, county, address, product, capacity, cui, category]
            ).lower()

            leads.append(
                {
                    "id": lead_id(workbook.name, index + 2, name, operator, address),
                    "source": workbook.name,
                    "category": category,
                    "row": int(index + 2),
                    "name": name,
                    "operator": operator,
                    "city": city,
                    "county": county,
                    "address": address,
                    "product": product,
                    "capacity": capacity,
                    "cui": cui,
                    "searchable": searchable,
                }
            )
    return leads


def main() -> None:
    leads = read_leads()
    payload = {
        "generatedAt": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total": len(leads),
        "sources": sorted({lead["source"] for lead in leads}),
        "categories": sorted({lead["category"] for lead in leads}),
        "counties": sorted({lead["county"] for lead in leads if lead["county"]}),
        "leads": leads,
    }

    OUTPUT_DIR.mkdir(exist_ok=True)
    content = "window.LEADS_DATA = "
    content += json.dumps(payload, ensure_ascii=False, indent=2)
    content += ";\n"
    OUTPUT_FILE.write_text(content, encoding="utf-8")
    print(f"Wrote {len(leads)} leads to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
