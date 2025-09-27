#!/usr/bin/env python3
"""
Extrae todas las URLs de inmuebles ('pisos') tanto de venta (id_tipo_operacion = 1)
como de alquiler (id_tipo_operacion = 2) de todas las páginas de resultados de
https://www.picoblanes.com/results/.

Uso:
    python scrape_pisos.py           # genera pico_blanes_links.csv por defecto
    python scrape_pisos.py --csv salidas.csv
"""

import csv
import sys
import time
from urllib.parse import urljoin
from typing import Optional, List, Set

import requests
from bs4 import BeautifulSoup

# ――― Configuración ―――────────────────────────────────────────────────────────
LISTING_URL_TEMPLATE = "https://www.picoblanes.com/results/?id_tipo_operacion={op}&type=&dt=&dormitorios_min=&precio_max="
OPERATION_TYPES: tuple[int, ...] = (
    1,
    2,
    4,
)  # 1 = venta, 2 = alquiler, 4 = Alquiler opciónn a compra

SLEEP_BETWEEN_REQUESTS = 1.5  # s: juega limpio
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    )
}


# ――― Utilidades HTTP / parseo ―――─────────────────────────────────────────────
def fetch_html(url: str) -> BeautifulSoup:
    """Devuelve el árbol DOM (BeautifulSoup) de la página indicada."""
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def extract_property_urls(soup: BeautifulSoup, base_url: str) -> List[str]:
    """
    Extrae las URLs absolutas de los inmuebles de la página.
    El enlace está en el atributo data-url del <div class="venta">.
    """
    result: list[str] = []
    for div in soup.select("div[data-url]"):
        relative = div["data-url"].strip()
        result.append(urljoin(base_url, relative))
    return result
    return result


def find_next_page(soup: BeautifulSoup, current_url: str) -> Optional[str]:
    """
    Devuelve la URL de la siguiente página, o None si no existe.
    Se basa en <a class="next"> que no esté 'disabled'.
    """
    next_link = soup.select_one("a.next:not(.disabled)")
    if not next_link:
        return None

    href = next_link.get("href")
    if not href:
        return None
    return urljoin(current_url, href)


# ――― Scraping ―――─────────────────────────────────────────────────────────────
def scrape_all_pages(start_url: str, seen_props: Set[str]) -> List[str]:
    """
    Recorre todas las páginas de resultados empezando por start_url y
    devuelve las URLs nuevas encontradas (sin duplicados respecto a seen_props).
    """
    seen_pages: set[str] = set()
    new_props: list[str] = []

    url = start_url
    while url and url not in seen_pages:
        print(f"[+] Descargando {url}", file=sys.stderr)
        seen_pages.add(url)

        soup = fetch_html(url)
        props = extract_property_urls(soup, url)

        for u in props:
            if u not in seen_props:
                seen_props.add(u)
                new_props.append(u)

        print(
            f"    · {len(new_props)} nuevas — total acumulado: {len(seen_props)}",
            file=sys.stderr,
        )

        url = find_next_page(soup, url)
        time.sleep(SLEEP_BETWEEN_REQUESTS)

    return new_props


# ――― Salida ―――───────────────────────────────────────────────────────────────
def write_csv(filename: str, urls: list[str]) -> None:
    """Guarda las URLs en un CSV, una por línea."""
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["url"])
        for u in urls:
            writer.writerow([u])


# ――― Programa principal ―――───────────────────────────────────────────────────
def main() -> None:
    args = sys.argv[1:]
    csv_out: str | None = None

    if "--csv" in args:
        try:
            csv_out = args[args.index("--csv") + 1]
        except IndexError:
            print("ERROR: --csv requiere un nombre de fichero", file=sys.stderr)
            sys.exit(1)
    else:
        csv_out = "Scrappers/Pico_Blanes/Data/pico_blanes_links.csv"

    all_property_urls: set[str] = set()
    for op in OPERATION_TYPES:
        start_url = LISTING_URL_TEMPLATE.format(op=op)
        scrape_all_pages(start_url, all_property_urls)

    urls_ordered = list(all_property_urls)  # conversión final

    if csv_out:
        write_csv(csv_out, urls_ordered)
    else:
        for u in urls_ordered:
            print(u)


if __name__ == "__main__":
    main()
