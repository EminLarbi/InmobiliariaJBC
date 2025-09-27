import os
import csv
import time
import shutil
import pandas as pd
from bs4 import BeautifulSoup as bs
import time
from bs4 import BeautifulSoup as bs
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    WebDriverException,
    JavascriptException,
    TimeoutException,
)
import time
from urllib.parse import urljoin
from pathlib import Path
from datetime import datetime


# Selenium / undetected-chromedriver
import undetected_chromedriver as uc
from selenium.common.exceptions import WebDriverException
from urllib.parse import urlparse, urlunparse


# -------- Configuración --------
busqueda = "alcoy-alcoi"
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = (
    SCRIPT_DIR.parent.parent
)  # .../Scrappers/Idealista/Scripts -> sube dos niveles
BASE_DIR = str((PROJECT_ROOT / "Fotocasa" / "Data").resolve())

min_wait = 10
max_wait = 12
max_page = 999_999_999
max_scrolls = 200

# -------- Nuevo: construcción y utilidades del navegador --------
import undetected_chromedriver as uc
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import (
    TimeoutException,
    WebDriverException,
    JavascriptException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def build_browser():
    """
    Crea un Chrome endurecido para scraping:
      - pageLoadStrategy 'eager' para cortar carga de recursos tardíos
      - Imágenes y fuentes desactivadas
      - Memoria compartida y GPU desactivadas
      - Timeouts base configurados
    """
    opts = uc.ChromeOptions()
    opts.page_load_strategy = "eager"
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-features=NetworkService,NetworkServiceInProcess")
    opts.add_argument("--no-first-run")
    opts.add_argument("--disable-background-networking")
    opts.add_argument("--disable-background-timer-throttling")
    opts.add_argument("--disable-renderer-backgrounding")
    # Headless opcional si lo necesitas:
    # opts.add_argument("--headless=new")

    # Desactivar imágenes y fuentes para ahorrar RAM
    prefs = {
        "profile.managed_default_content_settings.images": 2,
        "profile.managed_default_content_settings.fonts": 2,
        "profile.default_content_setting_values.images": 2,
        "profile.managed_default_content_settings.stylesheets": 1,
    }
    opts.add_experimental_option("prefs", prefs)

    browser = uc.Chrome(options=opts)
    browser.set_page_load_timeout(25)
    browser.set_script_timeout(20)
    return browser


def safe_get(browser, url: str, timeout: int = 25):
    """
    Navega con timeout duro. Si expira, aborta la carga con window.stop()
    para evitar cuelgues del renderer.
    """
    prev_timeout = None
    try:
        prev_timeout = browser.timeouts.page_load
    except Exception:
        pass
    try:
        browser.set_page_load_timeout(timeout)
        browser.get(url)
    except TimeoutException:
        try:
            browser.execute_script("window.stop();")
        except JavascriptException:
            pass
    except WebDriverException:
        # Relevanta al llamador para que gestione un posible reciclado del driver
        raise
    finally:
        try:
            if prev_timeout is not None:
                browser.set_page_load_timeout(prev_timeout)
        except Exception:
            pass


def clear_browser_state(browser, *, clear_cache=True, clear_cookies=True):
    """
    Limpia caché y cookies vía CDP para cortar crecimiento de memoria.
    """
    try:
        if clear_cache:
            browser.execute_cdp_cmd("Network.clearBrowserCache", {})
        if clear_cookies:
            browser.delete_all_cookies()
    except Exception:
        pass


# -------- Helpers de rutas por 'busqueda' --------
def paths_for():
    ids_today = os.path.join(BASE_DIR, f"ids_today.csv")
    ids_yesterday = os.path.join(BASE_DIR, f"ids_yesterday.csv")
    ids_new = os.path.join(BASE_DIR, f"ids_new.csv")
    data_today = os.path.join(BASE_DIR, f"inmuebles_today.csv")
    data_new = os.path.join(BASE_DIR, f"inmuebles_new.csv")
    os.makedirs(BASE_DIR, exist_ok=True)
    return ids_today, ids_yesterday, ids_new, data_today, data_new


# -------- Utilidades de ficheros (IDs) --------
def safe_read_ids_csv(ruta):
    ids = []
    if os.path.exists(ruta):
        try:
            with open(ruta, "r", newline="", encoding="utf-8") as f:
                reader = csv.reader(f)
                for row in reader:
                    if row and row[0]:
                        ids.append(row[0].strip())
        except Exception:
            return []
    return ids


def safe_write_ids_csv(ruta, ids_list):
    try:
        with open(ruta, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            for _id in ids_list:
                writer.writerow([_id])
    except Exception:
        pass


def backup_to_yesterday(ids_today_path, ids_yesterday_path):
    """Copia el último today a yesterday como respaldo. No borra si no existe."""
    try:
        if os.path.exists(ids_today_path):
            shutil.copyfile(ids_today_path, ids_yesterday_path)
        else:
            # Asegura fichero vacío para coherencia
            safe_write_ids_csv(ids_yesterday_path, [])
    except Exception:
        pass


def canonicalize_fotocasa_url(url: str) -> str:
    """
    Devuelve la URL canónica sin query ni fragment.
    Normaliza el esquema/host a https://www.fotocasa.es
    """
    try:
        p = urlparse(url)
        if not p.netloc:
            # convertir ruta relativa a absoluta
            url = "https://www.fotocasa.es" + (
                url if url.startswith("/") else f"/{url}"
            )
            p = urlparse(url)
        clean = p._replace(
            scheme="https", netloc="www.fotocasa.es", params="", query="", fragment=""
        )
        return urlunparse(clean).rstrip("/")
    except Exception:
        return url.split("?")[0].split("#")[0].rstrip("/")


# -------- Utilidades de ficheros (Datos) --------
def safe_read_df_csv(ruta):
    if os.path.exists(ruta):
        try:
            return pd.read_csv(ruta)
        except Exception:
            return pd.DataFrame()
    return pd.DataFrame()


def safe_write_df_csv(ruta, df):
    try:
        df_out = df.copy()
        df_out = df_out.where(pd.notnull(df_out), None)
        df_out.to_csv(ruta, index=False)
    except Exception:
        pass


# -------- Scraper de Fotocasa (IDs como URLs) --------
import time
import random
from bs4 import BeautifulSoup as bs
from selenium.common.exceptions import (
    WebDriverException,
    JavascriptException,
    NoSuchElementException,
)


def scrape_fotocasa_ids(
    busqueda,
    browser,
    tipo="venta",
    *,
    max_scrolls=600,
    min_wait=0.01,
    max_wait=0.05,
    stability_rounds=4,
    bottom_rounds=2,
    step_px=150,
    exclude_agencies_exact=(),
    exclude_agencies_contains=(
        "JBC",
        "PICÓ BLANES",
        "J.B.C",
    ),
):
    """
    Recolecta URLs canónicas de Fotocasa para 'venta' o 'alquiler'.

    + Filtro: excluye tarjetas cuyo nombre de inmobiliaria coincida exactamente con
      alguno en exclude_agencies_exact o contenga alguna cadena en
      exclude_agencies_contains (comparación sin acentos y sin distinción de mayúsculas).
    """

    import re
    import time
    import random
    import unicodedata
    from urllib.parse import urljoin
    from bs4 import BeautifulSoup as bs
    from selenium.common.exceptions import JavascriptException, WebDriverException

    def _norm(s: str) -> str:
        # normaliza a mayúsculas y sin acentos/diacríticos, colapsa espacios
        s = (s or "").strip()
        s = " ".join(s.split())
        s = unicodedata.normalize("NFKD", s)
        s = "".join(ch for ch in s if not unicodedata.combining(ch))
        return s.upper()

    EXC_EQ = {_norm(x) for x in exclude_agencies_exact}
    EXC_HAS = [_norm(x) for x in exclude_agencies_contains]

    def _segmento(t):
        return (
            "comprar/viviendas" if str(t).lower() == "venta" else "alquiler/viviendas"
        )

    def _build_url(busq, t):
        return f"https://www.fotocasa.es/es/{_segmento(t)}/{busq}/todas-las-zonas/l"

    def _sleep():
        time.sleep(random.uniform(min_wait, max_wait))

    def _accept_cookies_if_any():

        for xpath in (
            '//*[@id="didomi-notice-agree-button"]',
            '//button[contains(@id,"didomi") and contains(translate(.,"ACEPTAR","aceptar"),"aceptar")]',
            '//button[contains(@data-testid,"accept-button")]',
        ):
            try:
                el = browser.find_element("xpath", xpath)
                el.click()
                break
            except Exception:
                continue

    def _vh():
        try:
            return int(browser.execute_script("return window.innerHeight || 0;") or 0)
        except JavascriptException:
            return 0

    def _scroll_y():
        try:
            return int(
                browser.execute_script(
                    "return window.scrollY || window.pageYOffset || 0;"
                )
                or 0
            )
        except JavascriptException:
            return 0

    def _page_height():
        try:
            return int(
                browser.execute_script("return document.body.scrollHeight || 0") or 0
            )
        except JavascriptException:
            return 0

    def _at_bottom(margin_px=64):
        h = _page_height()
        y = _scroll_y()
        vh = _vh()
        return (y + vh) >= max(0, h - margin_px)

    def _micro_scroll():
        try:
            browser.execute_script(f"window.scrollBy(0, {int(step_px)});")
        except JavascriptException:
            pass

    def _cards_count():
        try:
            js = """
              const isRealCard = (el) => (
                !el.closest('.re-RecommenderSearch') &&
                !el.closest('[class*="recommender-slider"]') &&
                !el.closest('.re-SearchResultAdjacents') &&
                !el.closest('[data-testid="recommender"]')
              );
              const sels = [
                'article.container.w-full',
                '[data-testid="re-Card"]',
                'article[id^="re-Card"]',
                'article[data-testid*="Card"]',
                'article'
              ];
              for (const s of sels) {
                const nodes = [...document.querySelectorAll(s)].filter(isRealCard);
                if (nodes.length > 0) return nodes.length;
              }
              return 0;
            """
            return int(browser.execute_script(js) or 0)
        except JavascriptException:
            return 0

    def _remove_non_listing_sections(soup) -> None:
        selectors = [
            "div.re-RecommenderSearch",
            '[class*="recommender-slider"]',
            '[data-testid="recommender"]',
            "div.re-SearchResultAdjacents",
            "section.re-SearchResultAdjacents",
        ]
        for sel in selectors:
            for el in soup.select(sel):
                el.decompose()
        h = soup.find(
            lambda tag: tag.name in ("h2", "h3")
            and tag.get_text(strip=True)
            .lower()
            .startswith("otros usuarios también han visto")
        )
        if h:
            p = h.find_parent()
            if p:
                p.decompose()

    # --- NUEVO: extraer inmobiliaria desde la tarjeta y filtrar ---
    def _collect_detail_links(html):
        soup = bs(html, "lxml")
        cutoff_div = soup.find("div", class_="re-SearchResultAdjacents-title")
        if cutoff_div:
            for el in list(cutoff_div.find_all_next()):
                el.decompose()
        _remove_non_listing_sections(soup)

        out = []
        # Intentamos iterar por tarjetas (articles). Si no, caemos al escaneo global de <a>.
        card_selectors = [
            "article.container.w-full",
            '[data-testid="re-Card"]',
            'article[id^="re-Card"]',
            'article[data-testid*="Card"]',
            "article",
        ]
        seen = set()

        def _canon(href: str) -> str:
            if "fotocasa.es" not in href and href.startswith("/"):
                href = urljoin("https://www.fotocasa.es", href)
            return canonicalize_fotocasa_url(href)

        # 1) Recorrido por tarjetas para poder leer la inmobiliaria de cada una
        for sel in card_selectors:
            for art in soup.select(sel):
                # link de detalle
                a_det = None
                for a in art.select("a[href]"):
                    href = a.get("href") or ""
                    if "/d" in href and (
                        "/es/comprar/" in href or "/es/alquiler/" in href
                    ):
                        try:
                            can = _canon(href)
                        except Exception:
                            continue
                        if not can.endswith("/d"):
                            continue
                        a_det = (a, can)
                        break
                if not a_det:
                    continue

                # nombre de inmobiliaria (buscamos un link a /inmobiliaria- o un texto cercano)
                agency = None
                a_inmo = art.select_one('a[href*="/inmobiliaria-"]')
                if a_inmo and a_inmo.get_text(strip=True):
                    agency = a_inmo.get_text(strip=True)
                else:
                    # fallback: mira spans/divs que suelen contener el nombre de la agencia
                    for cand in art.select("span, div"):
                        txt = cand.get_text(" ", strip=True)
                        if txt and any(
                            w in txt.lower()
                            for w in (
                                "inmobiliaria",
                                "real estate",
                                "gestores",
                                "agencia",
                            )
                        ):
                            agency = txt
                            break

                # normaliza y aplica filtro
                agency_norm = _norm(agency or "")
                if agency_norm in EXC_EQ:
                    continue
                if any(sub in agency_norm for sub in EXC_HAS):
                    continue

                can = a_det[1]
                if can not in seen:
                    seen.add(can)
                    out.append(can)

            if (
                out
            ):  # si ya encontramos tarjetas con este selector, no seguimos cambiando selector
                break

        # 2) Si no logramos tarjetas, usamos el método antiguo (sin agencia)
        if not out:
            for a in soup.select("a[href]"):
                href = a.get("href") or ""
                if "fotocasa.es" not in href and href.startswith("/"):
                    href = urljoin("https://www.fotocasa.es", href)
                if not href.startswith("https://www.fotocasa.es/"):
                    continue
                if "/es/comprar/" not in href and "/es/alquiler/" not in href:
                    continue
                if href.endswith("/l") or re.search(r"/l/\d+/?$", href):
                    continue
                if "/inmobiliaria-" in href or "/obra-nueva" in href:
                    continue
                skip_by_ancestor = False
                for anc in a.parents:
                    cls = " ".join(anc.get("class", [])) if hasattr(anc, "get") else ""
                    if any(
                        k in cls
                        for k in [
                            "re-RecommenderSearch",
                            "recommender-slider",
                            "re-SearchResultAdjacents",
                        ]
                    ):
                        skip_by_ancestor = True
                        break
                if skip_by_ancestor:
                    continue
                try:
                    can = canonicalize_fotocasa_url(href)
                except Exception:
                    continue
                if can.count("/") < 6 or not can.endswith("/d"):
                    continue
                # En este fallback no podemos filtrar por agencia (no la sabemos)
                out.append(can)

        return out

    def _current_page_num_from_url(u: str) -> int:
        m = re.search(r"[?&]paginacion=(\d+)", u)
        if m:
            return int(m.group(1))
        m = re.search(r"/l/(\d+)(?:/?$|\?)", u)
        return int(m.group(1)) if m else 1

    def _find_next_page_href(html, curr_url):
        curr = _current_page_num_from_url(curr_url)
        try:
            rel_next = browser.execute_script(
                "return (document.querySelector('link[rel=\"next\"]')||{}).href || null;"
            )
            if rel_next and _current_page_num_from_url(rel_next) > curr:
                return urljoin("https://www.fotocasa.es", rel_next)
        except JavascriptException:
            pass

        soup = bs(html, "lxml")
        seg = _segmento(tipo)
        base_pattern = (
            rf"^/es/{re.escape(seg)}/{re.escape(busqueda)}/.+?/l(?:/(\d+))?(?:/|$|\?)"
        )
        candidates = []
        for a in soup.select("a[href]"):
            href = a.get("href") or ""
            path = (
                href.replace("https://www.fotocasa.es", "")
                if href.startswith("https://www.fotocasa.es")
                else href
            )
            if not re.search(base_pattern, path):
                continue
            n = None
            m_q = re.search(r"[?&]paginacion=(\d+)", path)
            if m_q:
                n = int(m_q.group(1))
            else:
                m_l = re.search(r"/l/(\d+)(?:/|$|\?)", path)
                if m_l:
                    n = int(m_l.group(1))
            if n and n > curr:
                candidates.append((n, href))
        if not candidates:
            return None
        n_next, href_next = min(candidates, key=lambda x: x[0])
        return urljoin("https://www.fotocasa.es", href_next)

    ids, vistos = [], set()
    visited_pages = set()
    url = _build_url(busqueda, tipo)
    first_page = True

    while True:
        if url in visited_pages:
            break
        visited_pages.add(url)
        try:
            browser.get(url)
        except WebDriverException:
            break

        if first_page:
            time.sleep(random.uniform(4.0, 6.0))
            _accept_cookies_if_any()
            first_page = False

        stable = 0
        bottom_hits = 0
        last_count = 0
        last_height = 0
        for _ in range(max_scrolls):
            _micro_scroll()
            _sleep()
            cnt = _cards_count()
            h = _page_height()
            grew_cards = cnt > last_count
            grew_height = h > last_height
            stable = 0 if (grew_cards or grew_height) else (stable + 1)
            last_count = max(last_count, cnt)
            last_height = max(last_height, h)
            if _at_bottom():
                if stable >= stability_rounds:
                    bottom_hits += 1
                    try:
                        browser.execute_script("window.scrollBy(0, -50);")
                        _sleep()
                        browser.execute_script("window.scrollBy(0, 50);")
                    except JavascriptException:
                        pass
                if bottom_hits >= bottom_rounds and stable >= stability_rounds:
                    break

        html = browser.page_source
        for can in _collect_detail_links(html):
            if can in vistos:
                continue
            vistos.add(can)
            ids.append(can)

        next_href = _find_next_page_href(html, url)
        if not next_href:
            break
        url = next_href

    print(
        f"Scrapeado {len(ids)} IDs de Fotocasa ({tipo}) para '{busqueda}' (filtradas agencias)."
    )
    return ids


# -------- Helper nuevo: merge único preservando orden --------
def merge_unique_ordered(list_a, list_b):
    """
    Une dos listas preservando el orden de aparición, eliminando duplicados.
    Devuelve una lista de strings.
    """
    vistos = set()
    out = []
    for v in list_a + list_b:
        s = str(v)
        if s not in vistos:
            vistos.add(s)
            out.append(s)
    return out


# -------- Parser de ficha de Fotocasa --------
def parsear_inmueble(id_inmueble_url, browser, first_run):
    """
    id_inmueble_url es la URL canónica a la ficha. Devuelve (df_row, dict_row)
    Implementa:
      - Carga con timeout y abortado
      - Cierre de modales
      - Espera corta de contenido clave
      - SCROLL a fondo antes de parsear para forzar lazy-load
    """
    import re, json, time, random
    import pandas as pd
    from bs4 import BeautifulSoup as bs
    from selenium.common.exceptions import WebDriverException, TimeoutException

    def _to_int(txt):
        try:
            if txt is None:
                return None
            s = str(txt)
            s = s.replace("\xa0", " ").replace(".", "").replace(",", "")
            s = re.sub(r"[^\d\-]", "", s)
            if s.strip() == "":
                return None
            return int(s)
        except Exception:
            return None

    def _int_from_text(el):
        if not el:
            return None
        return _to_int(el.get_text(" ", strip=True))

    def _text(el):
        return el.get_text(" ", strip=True) if el else ""

    try:
        url = canonicalize_fotocasa_url(str(id_inmueble_url))
        safe_get(browser, url, timeout=20)

        # Primer run: cookies
        if first_run:
            try:
                time.sleep(1)
                for xpath in (
                    '//*[@id="didomi-notice-agree-button"]',
                    '//button[contains(@id,"didomi") and contains(translate(.,"ACEPTAR","aceptar"),"aceptar")]',
                    '//button[contains(@data-testid,"accept-button")]',
                ):
                    els = browser.find_elements("xpath", xpath)
                    if els:
                        els[0].click()
                        break
            except Exception:
                pass

        # Cerrar modal Braze si aparece
        try:
            WebDriverWait(browser, 3).until(
                EC.element_to_be_clickable((By.ID, "closeIcon"))
            ).click()
            time.sleep(random.uniform(0.1, 0.3))
        except Exception:
            pass

        # Espera breve de contenido útil
        try:
            WebDriverWait(browser, 5).until(
                EC.any_of(
                    EC.presence_of_element_located(
                        (By.CSS_SELECTOR, "h1[class*='re-DetailHeader-propertyTitle']")
                    ),
                    EC.presence_of_element_located(
                        (By.CSS_SELECTOR, "[data-testid='re-DetailHeader-address']")
                    ),
                )
            )
        except TimeoutException:
            pass

        # ---------- SCROLL A FONDO ANTES DE PARSEAR ----------
        def _vh():
            try:
                return int(browser.execute_script("return window.innerHeight||0") or 0)
            except Exception:
                return 0

        def _scroll_y():
            try:
                return int(browser.execute_script("return window.scrollY||0") or 0)
            except Exception:
                return 0

        def _page_height():
            try:
                return int(
                    browser.execute_script("return document.body.scrollHeight||0") or 0
                )
            except Exception:
                return 0

        def _at_bottom(margin_px=64):
            h = _page_height()
            y = _scroll_y()
            vh = _vh()
            return (y + vh) >= max(0, h - margin_px)

        step_px = 200
        stability_rounds = 3
        bottom_rounds = 1
        max_scrolls = 300  # límite duro de seguridad

        stable = 0
        bottom_hits = 0
        last_height = 0

        for _ in range(max_scrolls):
            try:
                browser.execute_script(f"window.scrollBy(0,{step_px});")
            except Exception:
                break
            time.sleep(random.uniform(0.03, 0.06))  # micro-espera para lazy-load
            h = _page_height()
            if h > last_height:
                stable = 0
                last_height = h
            else:
                stable += 1

            if _at_bottom():
                if stable >= stability_rounds:
                    bottom_hits += 1
                    # pequeño 'shake' para disparar últimos observers
                    try:
                        browser.execute_script("window.scrollBy(0,-40);")
                        time.sleep(0.03)
                        browser.execute_script("window.scrollBy(0,40);")
                    except Exception:
                        pass
                if bottom_hits >= bottom_rounds and stable >= stability_rounds:
                    break
        # (Opcional) subir un poco para que queden en viewport algunos bloques clave
        try:
            browser.execute_script("window.scrollBy(0,-200);")
        except Exception:
            pass
        # -----------------------------------------------------

        html = browser.page_source
        soup = bs(html, "lxml")

        # Inicialización de campos
        titulo = localizacion = municipio = zona = ""
        precio = precio_bajada = m2 = habs = banos = None
        descripcion = consumo_energia = emisiones_energia = ""
        breadcrumb = []
        fotos_total = None
        ref_catastral = ""
        edificabilidad = parcela_m2 = parcela_min_m2 = fachada_min_m = altura_max_m = (
            None
        )
        sector_urbanistico = ""
        link_inmueble_siguiente = ""

        # JSON-LD
        try:
            for s in soup.find_all("script", {"type": "application/ld+json"}):
                try:
                    data = json.loads(s.string or "{}")
                except Exception:
                    continue
                blocks = data if isinstance(data, list) else [data]
                for b in list(blocks):
                    if isinstance(b, dict) and "@graph" in b:
                        blocks.extend(
                            [g for g in b.get("@graph") if isinstance(g, dict)]
                        )
                for b in blocks:
                    if not isinstance(b, dict):
                        continue
                    typ = (b.get("@type") or "").lower()
                    if typ in (
                        "offer",
                        "product",
                        "residence",
                        "apartment",
                        "house",
                        "singlefamilyresidence",
                        "realestatelisting",
                        "place",
                    ):
                        titulo = titulo or b.get("name", "") or b.get("headline", "")
                        adr = b.get("address") or {}
                        if isinstance(adr, dict):
                            loc_parts = [
                                adr.get("addressLocality") or "",
                                adr.get("addressRegion") or "",
                            ]
                            loc = ", ".join([p for p in loc_parts if p]).strip(", ")
                            if loc:
                                localizacion = localizacion or loc
                                municipio = municipio or (
                                    adr.get("addressLocality") or ""
                                )
                        off = b.get("offers") or {}
                        if isinstance(off, dict):
                            precio = precio or _to_int(off.get("price"))
                        size = b.get("floorSize") or {}
                        if isinstance(size, dict):
                            m2 = m2 or _to_int(size.get("value"))
                        if habs is None:
                            habs = _to_int(
                                b.get("numberOfRooms")
                                or b.get("numberOfRoomsTotal")
                                or None
                            )
                        if banos is None:
                            banos = _to_int(
                                b.get("numberOfBathroomsTotal")
                                or b.get("numberOfBathrooms")
                                or None
                            )
        except Exception:
            pass

        # HTML
        if not titulo:
            h1 = soup.find("h1", class_=re.compile("re-DetailHeader-propertyTitle"))
            titulo = _text(h1)

        if not municipio:
            muni = soup.find(
                "p", class_=re.compile("re-DetailHeader-municipalityTitle")
            )
            municipio = _text(muni)
        if not localizacion:
            loc_el = soup.find(attrs={"data-testid": "re-DetailHeader-address"})
            localizacion = _text(loc_el) or municipio

        if precio is None:
            # 1) Exacto al <span> del precio
            price_el = soup.select_one("span.re-DetailHeader-price")

            # 2) Fallbacks por si cambian la estructura
            if not price_el:
                price_el = soup.find("span", class_="re-DetailHeader-price")
            if not price_el:
                # Evita capturar el *Container*
                price_el = soup.find(
                    lambda tag: tag.name == "span"
                    and tag.has_attr("class")
                    and "re-DetailHeader-price" in tag.get("class", [])
                )

            precio = _int_from_text(price_el)

        reduced = soup.select_one("div.re-DetailHeader-reducedPrice")
        if reduced:
            precio_bajada = _to_int(_text(reduced))  # "Ha bajado 9.100€" -> 9100
        if precio is None or precio_bajada is None:
            box = soup.select_one("div.re-DetailHeader-priceContainer")
            if box:
                nums = re.findall(r"\d[\d\.\,]*", box.get_text(" ", strip=True))
                if nums and precio is None:
                    posible_precio = _to_int(nums[0])
                    if posible_precio:
                        precio = posible_precio
                if len(nums) >= 2 and precio_bajada is None:
                    posible_bajada = _to_int(nums[1])
                    if posible_bajada:
                        precio_bajada = posible_bajada
        rooms_li = soup.find("li", class_=re.compile("re-DetailHeader-rooms"))
        baths_li = soup.find("li", class_=re.compile("re-DetailHeader-bathrooms"))
        surf_li = soup.find("li", class_=re.compile("re-DetailHeader-surface"))
        if habs is None:
            habs = _int_from_text(rooms_li)
        if banos is None:
            banos = _int_from_text(baths_li)
        if m2 is None:
            m2 = _int_from_text(surf_li)

        feats = soup.find(attrs={"data-testid": "featuresList"}) or soup.find(
            class_=re.compile("re-DetailFeaturesList")
        )
        if feats:
            for f in feats.find_all(class_=re.compile("re-DetailFeaturesList-feature")):
                label = _text(f.find(class_=re.compile("featureLabel"))).lower()
                value = _text(f.find(class_=re.compile("featureValue")))
                if "consumo energía" in label:
                    consumo_energia = value or consumo_energia
                if "emisiones" in label:
                    emisiones_energia = value or emisiones_energia

        desc_p = soup.find("p", class_=re.compile("re-DetailDescription"))
        if desc_p:
            for br in desc_p.find_all("br"):
                br.replace_with("\n")
            descripcion = _text(desc_p)

        if descripcion:
            m = re.search(r"Ref\.?\s*catastral:\s*([A-Z0-9]+)", descripcion, flags=re.I)
            if m:
                ref_catastral = m.group(1).strip()
            m = re.search(r"Edificabilidad:\s*([\d\.]+)\s*m2?", descripcion, flags=re.I)
            if m:
                edificabilidad = _to_int(m.group(1))
            m = re.search(
                r"Parcela\s+urbana\s+residencial\s+de\s*([\d\.,]+)\s*m2",
                descripcion,
                flags=re.I,
            )
            if m:
                parcela_m2 = _to_int(m.group(1))
            m = re.search(r"Parcela mínima\s*([\d\.,]+)\s*m2", descripcion, flags=re.I)
            if m:
                parcela_min_m2 = _to_int(m.group(1))
            m = re.search(r"Fachada mínima\s*([\d\.,]+)\s*m", descripcion, flags=re.I)
            if m:
                fachada_min_m = _to_int(m.group(1))
            m = re.search(r"Altura\s*Máx\.?\s*([\d\.,]+)\s*m", descripcion, flags=re.I)
            if m:
                altura_max_m = _to_int(m.group(1))
            m = re.search(r"dentro del\s+(Sector\s*[^\.\n]+)", descripcion, flags=re.I)
            if m:
                sector_urbanistico = m.group(1).strip()

        bc = soup.find("nav", attrs={"aria-label": "Ruta de navegación"})
        if bc:
            breadcrumb = [
                a.get_text(strip=True) for a in bc.select(".re-Breadcrumb-link")
            ] + [
                (
                    bc.select_one(".re-Breadcrumb-text").get_text(strip=True)
                    if bc.select_one(".re-Breadcrumb-text")
                    else ""
                )
            ]
            breadcrumb = [b for b in breadcrumb if b]

        extra_fotos = 0
        extra_badge = soup.find(class_=re.compile("re-DetailMosaicPhoto-moreText"))
        if extra_badge:
            extra_fotos = _to_int(extra_badge.text)
        visibles = soup.select(".re-DetailMosaicPhotoWrapper img")
        fotos_total = len(visibles) or None
        if fotos_total is not None and extra_fotos:
            fotos_total += extra_fotos

        next_a = soup.find("a", class_=re.compile("re-DetailPagination-action--next"))
        link_inmueble_siguiente = (
            canonicalize_fotocasa_url(next_a.get("href"))
            if next_a and next_a.get("href")
            else ""
        )

        anunciante = ""
        try:
            client_block = soup.select_one(".re-FormContactDetailDown-client h4")
            if client_block:
                anunciante = client_block.get_text(strip=True)
        except Exception:
            pass

        # --- Zona ---
        zone_el = soup.select_one("h2.re-DetailMap-address")
        zona = None
        if zone_el:
            full_zone = zone_el.get_text(" ", strip=True)
            partes = [p.strip() for p in full_zone.split(",")]
            # Buscar el índice de la parte que contiene 'Alcoy / Alcoi'
            for i, p in enumerate(partes):
                if "Alcoy" in p:
                    if i > 0:
                        zona = partes[i - 1]  # la parte inmediatamente a la izquierda
                    break
            if not zona and partes:
                zona = partes[0]  # fallback en caso de no encontrar "Alcoy"
        print("Zona:", zona)
        habs = _to_int(habs)
        banos = _to_int(banos)
        m2 = _to_int(m2)

        casas = {
            "id_inmueble": url,
            "link_inmueble": url,
            "link_inmueble_siguiente": link_inmueble_siguiente or "",
            "titulo": titulo,
            "localizacion": localizacion,
            "municipio": municipio,
            "precio": precio,
            "precio_bajada": precio_bajada,
            "metros_cuadrados": m2,
            "habitaciones": habs,
            "baños": banos,
            "consumo_energia": consumo_energia,
            "emisiones_energia": emisiones_energia,
            "descripcion": descripcion,
            "breadcrumb": " > ".join(breadcrumb) if breadcrumb else "",
            "fotos_total": fotos_total,
            "ref_catastral": ref_catastral,
            "edificabilidad_m2techo": edificabilidad,
            "parcela_m2": parcela_m2,
            "parcela_min_m2": parcela_min_m2,
            "fachada_min_m": fachada_min_m,
            "altura_max_m": altura_max_m,
            "sector_urbanistico": sector_urbanistico,
            "anunciante": anunciante,
            "zona": zona,
            "fecha_inclusion": datetime.today().strftime("%Y-%m-%d"),
        }
        df_casas = pd.DataFrame([casas])
        return df_casas, casas

    except WebDriverException:
        return pd.DataFrame(), {}
    except Exception:
        return pd.DataFrame(), {}


DEBUG = True


# -------- Flujo principal (versión Fotocasa) --------
# -------- Flujo principal (ACTUALIZADO) --------
def dprint(*a, **k):
    if DEBUG:
        print(*a, **k)


def main(busqueda):
    # Rutas
    ids_today_file, ids_yesterday_file, ids_new_file, data_today_file, data_new_file = (
        paths_for()
    )
    dprint(f"[INIT] BASE_DIR={BASE_DIR}")
    dprint(f"[FILES] ids_today={ids_today_file}")
    dprint(f"[FILES] ids_yesterday={ids_yesterday_file}")
    dprint(f"[FILES] data_today={data_today_file}")

    # 0) Ayer
    backup_to_yesterday(ids_today_file, ids_yesterday_file)

    # 1) Cargar data_today previa
    df_today_prev = safe_read_df_csv(data_today_file)
    if df_today_prev.empty:
        dprint("[DATA_TODAY] VACÍO o no legible.")
        existing_ids_in_data = set()
    else:
        if "id_inmueble" not in df_today_prev.columns:
            dprint(
                "[DATA_TODAY] ¡Falta columna 'id_inmueble'! Columns=",
                list(df_today_prev.columns),
            )
            existing_ids_in_data = set()
        else:
            existing_ids_in_data = set(
                df_today_prev["id_inmueble"].astype(str).tolist()
            )
            dprint(
                f"[DATA_TODAY] filas={len(df_today_prev)} ids_unicos={len(existing_ids_in_data)} sample={list(existing_ids_in_data)[:5]}"
            )

    # 2) Navegador y scrape
    browser = build_browser()
    ids_venta = scrape_fotocasa_ids(busqueda, browser, tipo="venta")
    ids_alquiler = scrape_fotocasa_ids(busqueda, browser, tipo="alquiler")
    dprint(f"[SCRAPE] venta={len(ids_venta)} alquiler={len(ids_alquiler)}")

    # 3) Unir
    ids_hoy = merge_unique_ordered(ids_venta, ids_alquiler)
    dprint(f"[HOY] ids_hoy={len(ids_hoy)} sample={ids_hoy[:10]}")

    # 4) Persistir ids_today
    safe_write_ids_csv(ids_today_file, ids_hoy)

    # 5) Calcular "nuevos": en ids_hoy y NO en el CSV de inmuebles (data_today)
    ids_nuevos = [str(i) for i in ids_hoy if str(i) not in existing_ids_in_data]
    safe_write_ids_csv(ids_new_file, ids_nuevos)

    # Nuevo navegador para parseo
    browser = build_browser()

    # Parsear solo nuevos con reintentos y reciclado del driver
    first_run = True
    df_new_list = []
    print(f"Parseando {len(ids_nuevos)} nuevos inmuebles Fotocasa...")

    RECYCLE_EVERY = 30  # recicla el driver cada N fichas
    CLEAR_STATE_EVERY = 5  # limpia cache/cookies cada N fichas
    MAX_RETRIES_PER_URL = 2  # reintentos por ficha

    for idx, url in enumerate(ids_nuevos, start=1):
        # Limpieza periódica de estado para frenar el crecimiento de memoria
        if idx % CLEAR_STATE_EVERY == 0:
            clear_browser_state(browser, clear_cache=True, clear_cookies=True)

        # Reciclado periódico del driver para cortar fugas
        if idx % RECYCLE_EVERY == 0:
            try:
                browser.quit()
            except Exception:
                pass
            browser = build_browser()
            first_run = True  # tras reciclar, volvemos a aceptar cookies si salen

        success = False
        for attempt in range(1, MAX_RETRIES_PER_URL + 1):
            try:
                df_i, _ = parsear_inmueble(url, browser, first_run)
                if not df_i.empty:
                    df_new_list.append(df_i)
                    success = True
                    break
            except WebDriverException:
                # Driver en estado malo: reciclar y reintentar
                try:
                    browser.quit()
                except Exception:
                    pass
                browser = build_browser()
                first_run = True
            except Exception:
                # Fallo blando; reintento
                pass
            # backoff simple
            time.sleep(0.8 * attempt)

        first_run = False

        if not success:
            # Registro mínimo en consola, no se escribe fila vacía
            print(f"[WARN] No se pudo parsear: {url}")

    # Cierre del navegador
    try:
        browser.quit()
    except Exception:
        pass

    # Consolidación y escritura segura
    df_new = (
        pd.concat(df_new_list, ignore_index=True)
        if df_new_list
        else pd.DataFrame(
            columns=[
                "id_inmueble",
                "titulo",
                "localizacion",
                "municipio",
                "precio",
                "precio_bajada",
                "metros_cuadrados",
                "habitaciones",
                "baños",
                "consumo_energia",
                "emisiones_energia",
                "descripcion",
                "breadcrumb",
                "fotos_total",
                "ref_catastral",
                "edificabilidad_m2techo",
                "parcela_m2",
                "parcela_min_m2",
                "fachada_min_m",
                "altura_max_m",
                "sector_urbanistico",
                "link_inmueble",
                "link_inmueble_siguiente",
                "anunciante",
                "zona",
            ]
        )
    )

    safe_write_df_csv(data_new_file, df_new)

    # today consistente
    if not df_today_prev.empty:
        df_today_kept = df_today_prev[
            df_today_prev["id_inmueble"].astype(str).isin(set(map(str, ids_hoy)))
        ].copy()
    else:
        df_today_kept = pd.DataFrame(columns=df_new.columns)

    df_today = pd.concat([df_today_kept, df_new], ignore_index=True)
    if not df_today.empty:
        df_today = df_today.drop_duplicates(subset=["id_inmueble"], keep="last")

    safe_write_df_csv(data_today_file, df_today)
    print(
        f"Escritos: {data_new_file} ({len(df_new)} filas) y {data_today_file} ({len(df_today)} filas)."
    )


if __name__ == "__main__":
    main(busqueda)
