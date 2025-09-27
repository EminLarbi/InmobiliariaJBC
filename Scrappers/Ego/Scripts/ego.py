import os
import logging
from logging.handlers import RotatingFileHandler
import csv
import time
import shutil
import pandas as pd
from bs4 import BeautifulSoup as bs
import re
import time
from bs4 import BeautifulSoup as bs
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import StaleElementReferenceException
from selenium.common.exceptions import (
    WebDriverException,
    JavascriptException,
    TimeoutException,
)
import time
from urllib.parse import urljoin
from pathlib import Path
from datetime import datetime
import concurrent.futures
import requests


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
BASE_DIR = str((PROJECT_ROOT / "Ego" / "Data").resolve())

# -------- Logging profesional --------
EGO_LOG_LEVEL = (os.getenv("EGO_LOG_LEVEL") or "WARNING").upper()
EGO_LOG_FILE = os.getenv("EGO_LOG_FILE") or os.path.join(BASE_DIR, "ego_scraper.log")
EGO_LOG_MAX_BYTES = int(os.getenv("EGO_LOG_MAX_BYTES") or "1048576")  # 1MB
EGO_LOG_BACKUP_COUNT = int(os.getenv("EGO_LOG_BACKUP_COUNT") or "3")


def setup_logging():
    os.makedirs(BASE_DIR, exist_ok=True)
    logger = logging.getLogger("ego")
    level = getattr(logging, EGO_LOG_LEVEL, logging.INFO)
    logger.setLevel(level)

    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s - %(message)s")

    if not logger.handlers:
        try:
            fh = RotatingFileHandler(
                EGO_LOG_FILE,
                maxBytes=EGO_LOG_MAX_BYTES,
                backupCount=EGO_LOG_BACKUP_COUNT,
            )
            fh.setFormatter(fmt)
            logger.addHandler(fh)
        except Exception:
            pass
        ch = logging.StreamHandler()
        ch.setFormatter(fmt)
        logger.addHandler(ch)
    return logger


logger = setup_logging()

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


def build_browser(headless=False):
    """
    Chrome optimizado para scraping en modo *headed* por defecto.
    Objetivo: máxima velocidad visible sin perder estabilidad.
      - pageLoadStrategy 'eager' para cortar recursos tardíos
      - Headed por defecto (headless sólo si se solicita)
      - Imágenes y fuentes desactivadas para reducir I/O
      - Mantener GPU habilitada en headed para render rápido
      - Desactivar ruido de fondo del navegador
      - Timeouts afinados
      - Ventana pequeña para minimizar coste de render
    """
    opts = uc.ChromeOptions()
    opts.page_load_strategy = "eager"

    # Headed por defecto. Si se pide headless, usar el modo moderno.
    if headless:
        opts.add_argument("--headless=new")
        # En headless sí conviene desactivar GPU.
        opts.add_argument("--disable-gpu")
    else:
        # Headed: mantener GPU para acelerar composición/render del DOM.
        # Reducir trabajo de render con una ventana pequeña.
        opts.add_argument("--window-size=1200,800")
        if not EGO_FAST:
            # En modo normal, permitir maximizado si mejora visibilidad manual
            opts.add_argument("--start-maximized")

    # Hardening y reducción de ruido de fondo
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-features=NetworkService,NetworkServiceInProcess")
    opts.add_argument("--no-first-run")
    opts.add_argument("--disable-background-networking")
    opts.add_argument("--disable-background-timer-throttling")
    opts.add_argument("--disable-renderer-backgrounding")
    opts.add_argument("--disable-extensions")
    opts.add_argument("--disable-sync")
    opts.add_argument("--disable-notifications")
    opts.add_argument("--mute-audio")
    opts.add_argument("--disable-translate")
    opts.add_argument("--disable-logging")
    opts.add_argument("--log-level=3")
    opts.add_argument("--disable-infobars")
    # Evitar autoplay y reducir tareas de medios
    opts.add_argument("--autoplay-policy=document-user-activation-required")
    # Desactivar imágenes también por blink-settings como refuerzo
    opts.add_argument("--blink-settings=imagesEnabled=false")

    # Desactivar imágenes, fuentes y hojas de estilo pesadas para ahorrar RAM/CPU
    prefs = {
        "profile.managed_default_content_settings.images": 2,
        "profile.default_content_setting_values.images": 2,
        "profile.managed_default_content_settings.fonts": 2,
        # Mantener stylesheets visibles pero minimizar costes
        "profile.managed_default_content_settings.stylesheets": 1,
    }
    opts.add_experimental_option("prefs", prefs)

    browser = uc.Chrome(options=opts)
    # Bloquear recursos pesados vía CDP para acelerar
    try:
        browser.execute_cdp_cmd("Network.enable", {})
        browser.execute_cdp_cmd(
            "Network.setBlockedURLs",
            {
                "urls": [
                    "*.png",
                    "*.jpg",
                    "*.jpeg",
                    "*.gif",
                    "*.webp",
                    "*.svg",
                    "*.ico",
                    "*.woff",
                    "*.woff2",
                    "*.ttf",
                    "*.otf",
                    "*.eot",
                    "*.mp4",
                    "*.webm",
                    "*.mp3",
                    "*.avi",
                    "*.mov",
                    "*.m4a",
                    "*.mkv",
                    "*.flac",
                ]
            },
        )
    except Exception:
        pass

    # Timeouts más agresivos en modo FAST
    try:
        browser.set_page_load_timeout(12 if EGO_FAST else 18)
        browser.set_script_timeout(8 if EGO_FAST else 12)
    except Exception:
        pass
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
        # Limitar timeout si estamos en modo rápido
        if EGO_FAST:
            timeout = min(timeout, 15)
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


# --- Helpers para escrituras atómicas e incrementales ---
def atomic_write_csv(path, df):
    """Escritura atómica: escribe a un .tmp y renombra. Minimiza riesgo de corrupción."""
    try:
        tmp_path = f"{path}.tmp"
        df.to_csv(tmp_path, index=False)
        os.replace(tmp_path, path)
    except Exception:
        pass


def append_df_csv(path, df, *, create_headers_if_missing=True):
    """Append rápido a CSV. Crea cabecera si el fichero no existe o está vacío."""
    try:
        exists = os.path.exists(path)
        mode = "a" if exists else "w"
        header = not exists if create_headers_if_missing else False
        df.to_csv(path, index=False, mode=mode, header=header)
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
        try:
            logger.debug(" ".join(str(x) for x in a))
        except Exception:
            pass


LOGIN_URL = "https://admin.egorealestate.com/egocore"
CONTACTS_URL = "https://admin.egorealestate.com/egocore/contacts"

EGO_EMAIL = os.getenv("EGO_EMAIL") or "info@inmobiliariajbc.com"
EGO_PASS = os.getenv("EGO_PASS") or "Curroyaltea2292."  # mejor via env var
EGO_HEADLESS = (os.getenv("EGO_HEADLESS") or "false").lower() in ("1", "true", "yes")
# Modo rápido: reduce esperas y aumenta optimizaciones de red.
# Por defecto activado para acelerar en modo headed.
EGO_FAST = (os.getenv("EGO_FAST") or "true").lower() in ("1", "true", "yes")
# Para máxima velocidad en headed, no visitar fichas tras el listado salvo que se fuerce por ENV
_visit_after_env = os.getenv("EGO_VISIT_AFTER_LIST")
if _visit_after_env is None:
    EGO_VISIT_AFTER_LIST = False
else:
    EGO_VISIT_AFTER_LIST = _visit_after_env.lower() in ("1", "true", "yes")
EGO_CSV_SPANS = (os.getenv("EGO_CSV_SPANS") or "false").lower() in ("1", "true", "yes")
# Modo de actualización de preferencias: 'new' (por defecto), 'missing' o 'all'
EGO_UPDATE_MODE = (os.getenv("EGO_UPDATE_MODE") or "new").strip().lower()
if EGO_UPDATE_MODE not in ("new", "missing", "all"):
    EGO_UPDATE_MODE = "new"
try:
    _workers_env = int(os.getenv("EGO_HTTP_WORKERS") or "0")
except Exception:
    _workers_env = 0


def ego_login(browser):
    logger.info("Login: navegando a %s", LOGIN_URL)
    safe_get(browser, LOGIN_URL, timeout=25)
    # Espera inputs típicos
    try:
        WebDriverWait(browser, 12 if EGO_FAST else 20).until(
            EC.any_of(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "input[type='email'], input[name*='email' i]")
                ),
                EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='text']")),
            )
        )
    except TimeoutException:
        pass

    # Heurísticas de selectores (el login varía por tenant)
    def q(sel):
        els = browser.find_elements(By.CSS_SELECTOR, sel)
        return els[0] if els else None

    email = q("input[type='email'], input[name*='email' i], input#Email")
    if not email:
        email = q("input[type='text']")
    pwd = q("input[type='password'], input#Password")
    btn = q("button[type='submit'], input[type='submit'], .login button")

    if email:
        email.clear()
        email.send_keys(EGO_EMAIL)
    if pwd:
        pwd.clear()
        pwd.send_keys(EGO_PASS)
    if btn:
        btn.click()
    else:
        # fallback: enter
        pwd.send_keys("\n")

    # Espera a que estemos dentro (menú EgoCore cargado)
    WebDriverWait(browser, 18 if EGO_FAST else 25).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "body"))
    )
    logger.info("Login: sesión iniciada correctamente")


def goto_contacts(browser):
    logger.info("Navegación: abriendo listado de contactos %s", CONTACTS_URL)
    safe_get(browser, CONTACTS_URL, timeout=25)
    # Cierra cookies si salen
    for xp in (
        '//*[@id="didomi-notice-agree-button"]',
        '//button[contains(@id,"didomi")][contains(translate(.,"ACEPTAR","aceptar"),"aceptar")]',
    ):
        try:
            el = browser.find_element(By.XPATH, xp)
            el.click()
            break
        except Exception:
            pass
    WebDriverWait(browser, 12 if EGO_FAST else 20).until(
        EC.presence_of_element_located(
            (By.CSS_SELECTOR, "div.list.PageContext[data-search-url*='entitysearch']")
        )
    )
    logger.debug("Navegación: listado cargado")


def _get_visible_ids_value(browser):
    try:
        return browser.find_element(By.CSS_SELECTOR, "#hVisibleObjIDs").get_attribute(
            "value"
        )
    except Exception:
        return ""


def apply_entity_type_filters(browser, values=(6,)):
    """
    En el sidebar, asegura que los filtros de Tipo (EntityType) indicados
    estén seleccionados: Cliente Potencial (1), Cliente (6), Informador (1103).
    Espera a que se refresque la lista tras cada selección.
    """
    # Asegura que el bloque de filtros rápidos existe
    try:
        WebDriverWait(browser, 10 if EGO_FAST else 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "#QuickSearch"))
        )
    except TimeoutException:
        return

    # Mapa de etiquetas por ID para fallback por texto
    label_by_value = {
        1: "Cliente potencial",
        6: "Cliente",
        1103: "Informador",
    }

    logger.info("Filtros: asegurando EntityType=%s", ",".join(map(str, values)))
    for v in values:
        try:
            # Prioridad: localizar por data-attrs estables
            sel = f"#QuickSearch .sidebarTagGroup .sideTag a[data-name='EntityType'][data-value='{v}']"
            elems = browser.find_elements(By.CSS_SELECTOR, sel)

            # Fallback: localizar por texto visible de la etiqueta (p.ej. "Cliente")
            if not elems:
                try:
                    label_txt = (label_by_value.get(v) or "").strip().lower()
                    cand_anchors = browser.find_elements(
                        By.CSS_SELECTOR,
                        "#QuickSearch .sidebarTagGroup .sideTag a",
                    )
                    for a_ in cand_anchors:
                        try:
                            t = (
                                (a_.text or a_.get_attribute("innerText") or "")
                                .strip()
                                .lower()
                            )
                        except Exception:
                            t = ""
                        if t and label_txt and label_txt in t:
                            elems = [a_]
                            break
                except Exception:
                    elems = []

            if not elems:
                continue
            a = elems[0]

            # Si ya está seleccionado, no pulsar (evitar deselección)
            is_selected = browser.execute_script(
                "return arguments[0] && arguments[0].parentElement && arguments[0].parentElement.classList && arguments[0].parentElement.classList.contains('selected');",
                a,
            )
            if is_selected:
                logger.debug("Filtros: valor %s ya seleccionado", v)
                continue

            browser.execute_script("arguments[0].scrollIntoView({block: 'center'});", a)
            before_ids = _get_visible_ids_value(browser)
            try:
                a.click()
            except WebDriverException:
                try:
                    browser.execute_script("arguments[0].click();", a)
                except Exception:
                    pass

            # Espera a que se seleccione o cambie el set de visibles
            def _changed(drv):
                try:
                    now_sel = drv.execute_script(
                        "return arguments[0].parentElement.classList.contains('selected');",
                        a,
                    )
                except Exception:
                    now_sel = False
                return now_sel or _get_visible_ids_value(drv) != before_ids

            try:
                WebDriverWait(browser, 10 if EGO_FAST else 15).until(_changed)
            except TimeoutException:
                # Último intento: pequeño retraso y comprobar de nuevo visibles
                time.sleep(0.8)
                if _get_visible_ids_value(browser) == before_ids:
                    logger.warning(
                        "Filtros: sin cambios visibles tras seleccionar %s", v
                    )
                    continue
            logger.debug("Filtros: seleccionado valor %s", v)
        except Exception:
            logger.exception("Filtros: error seleccionando valor %s", v)
            continue


def parse_contact_card(card):
    soup = bs(card.get_attribute("outerHTML"), "lxml")

    def txt(sel):
        el = soup.select_one(sel)
        return el.get_text(" ", strip=True) if el else ""

    # ID desde href o checkbox
    href = soup.select_one("a[href*='/egocore/person/']")
    cid = None
    if href and href.has_attr("href"):
        m = re.search(r"/person/(\d+)", href["href"])
        if m:
            cid = m.group(1)
    if not cid:
        cb = soup.select_one("input.ObjectChecker")
        if cb and cb.has_attr("data-object-id"):
            cid = cb["data-object-id"]

    name = txt(".ListItemTitle a") or txt(
        "a.listItemBroker ~ .contactCard ~ .ListItemTitle a"
    )
    role = txt(".contactCardRole")
    phone = txt(".contactCardPhone a[href^='tel:']")
    email = txt(".contactCardMail a[href^='mailto:']")
    responsible = txt(".contactCardResponsible span")
    # --- created_at y fecha_creacion ---
    created_at = ""
    cr = soup.select_one(".contactCardResponsible[title]")
    if cr and cr.has_attr("title"):
        created_at = cr["title"]  # e.g. 'Creado por ... 12/09/2025'
    # Extrae solo la fecha si aparece en el texto
    fecha_creacion = ""
    try:
        m = re.search(r"(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})", created_at)
        if m:
            fecha_creacion = m.group(1)
    except Exception:
        fecha_creacion = ""
    profile_pct = (
        txt("#ProfilePercentage_Entity_{} .listItemPercentVal".format(cid))
        if cid
        else txt(".listItemPercentVal")
    )
    labels = ";".join(
        [
            x.get_text(" ", strip=True)
            for x in soup.select(".listItemTags a:not(.blueLink)")
        ]
    )

    return {
        "contact_id": cid,
        "nombre": name,
        "rol": role,
        "telefono": phone,
        "email": email,
        "responsable": responsible,
        "creado_info": created_at,
        "fecha_creacion": fecha_creacion,
        "perfil_pct": profile_pct.replace("%", "").strip(),
        "labels": labels,
    }


def collect_contacts_on_page(browser):
    # Espera flexible a que el listado aparezca: tarjetas o contenedor genérico
    try:
        WebDriverWait(browser, 10 if EGO_FAST else 15).until(
            EC.any_of(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "div.listItem.contactItem")
                ),
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.listItem")),
            )
        )
    except TimeoutException:
        # Reintento breve por si acaba de refrescar tras aplicar filtros
        try:
            WebDriverWait(browser, 5 if EGO_FAST else 8).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "div.listItem.contactItem, div.listItem")
                )
            )
        except TimeoutException:
            # No hay elementos visibles
            logger.warning("Listado: sin tarjetas visibles tras espera")
            return [], 1, ""

    cards = browser.find_elements(By.CSS_SELECTOR, "div.listItem.contactItem")
    if not cards:
        # Fallback a listItem genérico si cambió la clase
        cards = browser.find_elements(By.CSS_SELECTOR, "div.listItem")
    rows = []
    for c in cards:
        try:
            rows.append(parse_contact_card(c))
        except Exception:
            continue
    # info de página
    curr = 1
    try:
        curr = int(
            browser.find_element(
                By.CSS_SELECTOR, ".listPagination[data-current-page]"
            ).get_attribute("data-current-page")
        )
    except Exception:
        pass
    vis = ""
    try:
        vis = browser.find_element(By.CSS_SELECTOR, "#hVisibleObjIDs").get_attribute(
            "value"
        )
    except Exception:
        pass
    logger.info(
        "Listado: tarjetas=%s pagina=%s visibles_len=%s",
        len(rows),
        curr,
        len(vis) if isinstance(vis, str) else 0,
    )
    return rows, curr, vis


# -------- Parser: Oportunidades del detalle de contacto Ego --------
def _parse_opportunities_from_html(html: str, person_id: str):
    """
    Parsea la sección de Oportunidades del detalle de un contacto.
    Busca el wrapper `AssociatedSectionWrapper_header_4_{person_id}` y el contenido
    `AssociatedSection_header_4_{person_id}`. Devuelve lista de dicts con campos normalizados.
    """
    from bs4 import BeautifulSoup as bs
    import re

    def _to_int(s):
        try:
            if s is None:
                return None
            t = str(s)
            t = t.replace("\xa0", " ").replace(".", "").replace(",", "")
            m = re.search(r"(\d+)", t)
            return int(m.group(1)) if m else None
        except Exception:
            return None

    soup = bs(html, "lxml")
    sec_wrap_id = f"AssociatedSectionWrapper_header_4_{person_id}"
    sec_content_id = f"AssociatedSection_header_4_{person_id}"
    sec_wrap = soup.find(id=sec_wrap_id)
    sec_content = soup.find(id=sec_content_id)
    # Fallback: algunos endpoints AJAX devuelven solo el contenido
    container = sec_content if (sec_wrap and sec_content) else soup

    out = []
    for item in container.select(".detailLeadList .listItemTaskContent"):
        # Título y referencia
        title_a = item.select_one(".ListItemTitle a[href*='/egocore/lead/']")
        title_txt = title_a.get_text(" ", strip=True) if title_a else ""
        ref_span = item.select_one(".ListItemTitle .ListItemTitleRef")
        ref_code = ref_span.get_text(strip=True) if ref_span else ""
        # Tipo de lead al inicio del texto de título
        lead_type = title_txt.replace(ref_code, "").strip() if ref_code else title_txt
        lead_type = re.sub(r"\s+", " ", lead_type)
        # Fecha
        dt_txt = ""
        dt_div = item.select_one(".ListItemSubTitle")
        if dt_div:
            dt_txt = dt_div.get_text(" ", strip=True)
        # Responsable
        resp_name = ""
        resp_role = ""
        cn = item.select_one(".contactCard .contactCardName")
        if cn:
            strong = cn.find("strong")
            resp_name = strong.get_text(strip=True) if strong else ""
            role = cn.select_one(".contactCardRole")
            resp_role = role.get_text(strip=True) if role else ""
        # Estado
        lead_state = ""
        tag = item.select_one(".listItemTaskActions .tag")
        if tag:
            lead_state = tag.get_text(" ", strip=True)
        # Preferencias
        pref_block = item.select_one(".contactCardPreference")
        pref_txt = pref_block.get_text(" ", strip=True) if pref_block else ""
        # Intenta extraer algunos campos estructurados
        pref_tipo = None
        pref_oper = None
        pref_min_habs = None
        pref_precio_min = None
        pref_precio_max = None
        pref_zona = None
        pref_ciudad = None
        if pref_txt:
            # Busca palabras clave típicas
            m = re.search(r"Busca\s+(.*?),\s+para\s+(\w+)", pref_txt, flags=re.I)
            if m:
                pref_tipo = m.group(1).strip()
                pref_oper = m.group(2).strip()
            m = re.search(r"desde\s*(\d+)\s*Habitaciones", pref_txt, flags=re.I)
            if m:
                pref_min_habs = _to_int(m.group(1))
            m = re.search(
                r"de\s*([\d\.\,]+)\s*€\s*a\s*([\d\.\,]+)\s*€", pref_txt, flags=re.I
            )
            if m:
                pref_precio_min = _to_int(m.group(1))
                pref_precio_max = _to_int(m.group(2))
            # Zona y ciudad al final separados por comas
            m = re.search(r"en\s+(.*)$", pref_txt, flags=re.I)
            if m:
                tail = m.group(1)
                parts = [p.strip() for p in re.split(r",", tail) if p.strip()]
                if parts:
                    pref_ciudad = parts[-1]
                    if len(parts) >= 2:
                        pref_zona = parts[-2]
        out.append(
            {
                "lead_type": lead_type,
                "lead_ref": ref_code,
                "lead_date": dt_txt,
                "lead_responsable": resp_name,
                "lead_responsable_role": resp_role,
                "lead_state": lead_state,
                "pref_tipo": pref_tipo,
                "pref_operacion": pref_oper,
                "pref_min_habs": pref_min_habs,
                "pref_precio_min": pref_precio_min,
                "pref_precio_max": pref_precio_max,
                "pref_zona": pref_zona,
                "pref_ciudad": pref_ciudad,
            }
        )
    return out


# -------- Navegador: extraer oportunidades de un contacto --------
def fetch_contact_opportunities(browser, person_id: str):
    """Navega al detalle del contacto y devuelve lista de oportunidades parseadas."""
    from selenium.common.exceptions import TimeoutException

    detail_url = f"https://admin.egorealestate.com/egocore/person/{person_id}"
    try:
        safe_get(browser, detail_url, timeout=20)
    except Exception:
        return []

    # Intentar activar la pestaña Oportunidades si está colapsada
    try:
        # Click por data-tabname o wrapper
        a = None
        try:
            a = browser.find_element(
                By.CSS_SELECTOR, "a.detailSectionTitleTxt[data-tabname='t_L_RIS']"
            )
        except Exception:
            a = None
        if a:
            browser.execute_script("arguments[0].scrollIntoView({block:'center'});", a)
            try:
                a.click()
            except WebDriverException:
                try:
                    browser.execute_script("arguments[0].click();", a)
                except Exception:
                    pass
        # Espera breve a que cargue 'Activas'
        WebDriverWait(browser, 5 if EGO_FAST else 8).until(
            EC.presence_of_element_located(
                (
                    By.CSS_SELECTOR,
                    ".detailLeadList .listItemTaskContent, .detailNotesContentHeader a.active",
                )
            )
        )
    except TimeoutException:
        pass
    except Exception:
        pass

    # Intentar cambiar a la pestaña "Activas" explícitamente si existe
    try:
        tabs = browser.find_elements(By.CSS_SELECTOR, ".detailNotesContentHeader a")
        for t in tabs:
            if "activa" in t.text.lower():
                try:
                    t.click()
                    break
                except Exception:
                    try:
                        browser.execute_script("arguments[0].click();", t)
                        break
                    except Exception:
                        pass
    except Exception:
        pass

    html = browser.page_source
    return _parse_opportunities_from_html(html, str(person_id))


# -------- Preferencias de contacto (texto del bloque contactCardPreference) --------
def _extract_preference_text_from_html(html: str) -> str:
    """
    Extrae el HTML del bloque .contactCardPreference completo (outer HTML).
    Devuelve una cadena HTML, o "" si no existe.
    """
    try:
        soup = bs(html, "lxml")
        pref = soup.select_one(".contactCardPreference")
        if pref:
            # Devolver el HTML del bloque (incluyendo sus spans internos)
            return str(pref)
    except Exception:
        pass
    return ""


def fetch_contact_preferences_http(
    session: requests.Session, person_id: str, timeout: float = 12.0
) -> str:
    """Descarga la página del contacto por HTTP y extrae el texto de preferencias."""
    url = f"https://admin.egorealestate.com/egocore/person/{person_id}"
    try:
        r = session.get(url, timeout=timeout, allow_redirects=True)
        if r.status_code == 200 and (r.text or "").strip():
            # Detectar HTML de login/redirección (ReturnURL) y evitar tratarlo como ficha
            try:
                if ("ReturnURL=" in r.url) or ("ReturnURL=" in (r.text or "")):
                    return ""
                if re.search(r"<input[^>]+type=\"password\"", r.text or "", flags=re.I):
                    return ""
            except Exception:
                pass
            return _extract_preference_text_from_html(r.text)
        else:
            logger.debug(
                "HTTP: preferencias vacías o status %s para contacto %s",
                r.status_code,
                person_id,
            )
    except Exception:
        logger.exception("HTTP: error obteniendo preferencias para %s", person_id)
    return ""


def fetch_contact_preferences_browser(browser, person_id: str) -> str:
    """Fallback con Selenium para asegurar la preferencia si no se obtuvo por HTTP."""
    try:
        detail_url = f"https://admin.egorealestate.com/egocore/person/{person_id}"
        safe_get(browser, detail_url, timeout=20)
        # Si nos ha redirigido a login (ReturnURL) o hay formulario de login, reloguear y reintentar una vez
        try:
            curr_url = browser.current_url
        except Exception:
            curr_url = ""
        need_login = False
        if "ReturnURL=" in (curr_url or ""):
            need_login = True
        else:
            try:
                need_login = bool(
                    browser.find_elements(By.CSS_SELECTOR, "input[type='password']")
                )
            except Exception:
                need_login = False
        if need_login:
            try:
                logger.info("Sesion expirada al abrir %s; relogueando...", detail_url)
                ego_login(browser)
                safe_get(browser, detail_url, timeout=20)
            except Exception:
                pass
        try:
            WebDriverWait(browser, 4 if EGO_FAST else 6).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, ".contactCardPreference")
                )
            )
        except TimeoutException:
            pass
        html = browser.page_source
        return _extract_preference_text_from_html(html)
    except Exception:
        return ""


def make_http_session_from_browser(browser) -> requests.Session:
    """Crea una sesión HTTP con cookies de Selenium para llamadas AJAX rápidas."""
    sess = requests.Session()
    # User-Agent del navegador para mantener coherencia
    try:
        ua = browser.execute_script("return navigator.userAgent") or None
    except Exception:
        ua = None
    if ua:
        sess.headers.update({"User-Agent": ua})
    sess.headers.update(
        {
            "Referer": CONTACTS_URL,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "X-Requested-With": "XMLHttpRequest",
        }
    )
    # Copiar cookies del dominio admin.egorealestate.com
    try:
        for c in browser.get_cookies():
            try:
                if ".egorealestate.com" in (
                    c.get("domain") or ""
                ) or "egorealestate.com" in (c.get("domain") or ""):
                    sess.cookies.set(
                        c.get("name"),
                        c.get("value"),
                        domain=c.get("domain"),
                        path=c.get("path", "/"),
                    )
            except Exception:
                continue
    except Exception:
        pass
    logger.debug("HTTP: sesión preparada con %s cookies", len(sess.cookies))
    return sess


def fetch_contact_opportunities_http(
    session: requests.Session, person_id: str, timeout: float = 10.0
):
    """Usa la API interna del listado para cargar las oportunidades vía HTTP."""
    url = "https://admin.egorealestate.com/egocore/entity/loadleadextrainfo"
    try:
        r = session.get(url, params={"entID": str(person_id)}, timeout=timeout)
        if r.status_code == 200 and (r.text or "").strip():
            return _parse_opportunities_from_html(r.text, str(person_id))
        else:
            logger.debug(
                "HTTP: oportunidades vacías o status %s para contacto %s",
                r.status_code,
                person_id,
            )
    except Exception:
        logger.exception("HTTP: error obteniendo oportunidades para %s", person_id)
    return []


def next_page(browser, expected_curr):
    """
    Avanza a la siguiente página del listado de contactos.
    Estrategia robusta:
      1) Detecta el número de página objetivo (expected_curr + 1)
      2) Intenta hacer click en el ancla con ese número
      3) Fallback: click en .paginationNext con JS
      4) Fallback: ejecuta el handler JS del atributo onclick
      5) Espera a que cambie data-current-page o el set de visibles (hVisibleObjIDs)
    """
    target = (expected_curr or 0) + 1
    logger.debug("Paginación: intentando avanzar a página %s", target)

    # Estado previo para detectar cambio
    try:
        before_ids = browser.find_element(
            By.CSS_SELECTOR, "#hVisibleObjIDs"
        ).get_attribute("value")
    except Exception:
        before_ids = ""
    try:
        before_curr_attr = browser.find_element(
            By.CSS_SELECTOR, ".EntityListPagination[data-current-page]"
        ).get_attribute("data-current-page")
    except Exception:
        before_curr_attr = ""

    # Asegurar que la paginación es visible
    try:
        holder = browser.find_element(
            By.CSS_SELECTOR, ".listPagination.EntityListPagination"
        )
        try:
            browser.execute_script(
                "arguments[0].scrollIntoView({block: 'end'});", holder
            )
        except Exception:
            pass
    except Exception:
        holder = None

    # 0) Si el botón siguiente está deshabilitado claramente, salir
    try:
        btn_next = browser.find_elements(
            By.CSS_SELECTOR, ".EntityListPagination .paginationNext"
        )
        if btn_next:
            disabled = False
            try:
                cl = (btn_next[0].get_attribute("class") or "").lower()
                disabled = disabled or ("disabled" in cl)
            except Exception:
                pass
            try:
                aria = (btn_next[0].get_attribute("aria-disabled") or "").lower()
                disabled = disabled or (aria in ("1", "true"))
            except Exception:
                pass
            if disabled:
                logger.info("Paginación: botón siguiente deshabilitado; fin de páginas")
                return False
    except Exception:
        pass

    # 1) Intentar click directo al número destino
    clicked = False
    try:
        number_links = browser.find_elements(
            By.CSS_SELECTOR, ".EntityListPagination .paginationPages a"
        )
        for a in number_links:
            try:
                txt = (a.text or "").strip()
            except Exception:
                txt = ""
            if txt == str(target):
                try:
                    browser.execute_script(
                        "arguments[0].scrollIntoView({block: 'center'});", a
                    )
                except Exception:
                    pass
                try:
                    a.click()
                except Exception:
                    try:
                        browser.execute_script("arguments[0].click();", a)
                    except Exception:
                        pass
                clicked = True
                logger.debug("Paginación: click directo en número %s", target)
                break
    except Exception:
        pass

    # 2) Fallback: botón siguiente
    if not clicked:
        try:
            btn = browser.find_elements(
                By.CSS_SELECTOR, ".EntityListPagination .paginationNext"
            )
            if btn:
                try:
                    browser.execute_script(
                        "arguments[0].scrollIntoView({block: 'center'});", btn[0]
                    )
                except Exception:
                    pass
                try:
                    btn[0].click()
                    clicked = True
                except Exception:
                    try:
                        browser.execute_script("arguments[0].click();", btn[0])
                        clicked = True
                    except Exception:
                        pass
                if clicked:
                    logger.debug("Paginación: click en botón siguiente")
        except Exception:
            pass

    # 3) Fallback: ejecutar handler onclick si existe
    if not clicked:
        try:
            btn = browser.find_elements(
                By.CSS_SELECTOR, ".EntityListPagination .paginationNext"
            )
            if btn:
                onclick = btn[0].get_attribute("onclick") or ""
                # Normalmente: Search.loadPage(this, '/egocore/search/entitysearch', '2');
                if "Search.loadPage" in onclick:
                    # Intentar ejecutar con el propio elemento como 'this'
                    try:
                        browser.execute_script(onclick, btn[0])
                        clicked = True
                    except Exception:
                        # Extraer parámetros y llamar explícitamente
                        import re

                        m = re.search(
                            r"loadPage\(.*?'([^']+)'\s*,\s*'([^']+)'\s*\)", onclick
                        )
                        if m:
                            # m.groups() ~ (url, page)
                            url, page = m.group(1), m.group(2)
                            try:
                                browser.execute_script(
                                    "return Search.loadPage(arguments[0], arguments[1], arguments[2]);",
                                    btn[0],
                                    url,
                                    page,
                                )
                                clicked = True
                            except Exception:
                                pass
                if clicked:
                    logger.debug("Paginación: ejecutado handler onclick")
        except Exception:
            pass

    if not clicked:
        return False

    # 4) Espera a que cambie current-page o visibles (no aceptar sólo presencia de tarjetas)
    try:
        def _changed(d):
            try:
                curr_attr, ids_val = d.execute_script(
                    "return [\n"
                    "  (document.querySelector('.EntityListPagination') && document.querySelector('.EntityListPagination').getAttribute('data-current-page')) || '',\n"
                    "  (document.querySelector('#hVisibleObjIDs') && document.querySelector('#hVisibleObjIDs').value) || ''\n"
                    "]"
                ) or ["", ""]
            except Exception:
                curr_attr, ids_val = "", ""
            return (curr_attr and curr_attr != before_curr_attr) or (ids_val and ids_val != before_ids)

        WebDriverWait(
            browser, 8 if EGO_FAST else 15, ignored_exceptions=(StaleElementReferenceException,)
        ).until(_changed)
    except TimeoutException:
        logger.info("Paginación: no hay más páginas o no se detectó avance")
        return False

    # Verificación final: re-lee valores y confirma cambio real
    try:
        after_curr_attr = (
            browser.find_element(
                By.CSS_SELECTOR, ".EntityListPagination"
            ).get_attribute("data-current-page")
            or ""
        )
    except Exception:
        after_curr_attr = ""
    try:
        after_ids = (
            browser.find_element(By.CSS_SELECTOR, "#hVisibleObjIDs").get_attribute(
                "value"
            )
            or ""
        )
    except Exception:
        after_ids = ""

    if (after_curr_attr and after_curr_attr != before_curr_attr) or (
        after_ids and after_ids != before_ids
    ):
        logger.debug(
            "Paginación: cambio detectado (curr %s -> %s)",
            before_curr_attr,
            after_curr_attr,
        )
        return True
    logger.info("Paginación: sin cambio tras intento de avance")
    return False


def visit_contact_detail(browser, person_id: str, *, wait_for_ready=True) -> bool:
    """
    Carga la ficha de contacto sí o sí para 'recorrer' todos los person/{id}.
    No extrae nada; sólo garantiza la navegación y un ready básico del DOM.
    Devuelve True/False según éxito.
    """
    try:
        detail_url = f"https://admin.egorealestate.com/egocore/person/{person_id}"
        safe_get(browser, detail_url, timeout=20)

        if not wait_for_ready:
            return True

        try:
            # Señales de que la ficha está mínimamente operativa
            WebDriverWait(browser, 7 if EGO_FAST else 10).until(
                EC.any_of(
                    EC.presence_of_element_located(
                        (By.CSS_SELECTOR, ".contactCard, #AssociatedSectionWrapper")
                    ),
                    EC.presence_of_element_located(
                        (By.CSS_SELECTOR, ".detailSectionTitleTxt")
                    ),
                    EC.presence_of_element_located((By.CSS_SELECTOR, "body")),
                )
            )
        except TimeoutException:
            # Aun así, consideramos que al menos se ha intentado la carga
            pass
        return True
    except WebDriverException:
        return False
    except Exception:
        return False


def main_contacts():
    ids_today_file = os.path.join(BASE_DIR, "contacts_ids_today.csv")
    ids_yesterday_file = os.path.join(BASE_DIR, "contacts_ids_yesterday.csv")
    ids_new_file = os.path.join(BASE_DIR, "contacts_ids_new.csv")
    data_today_file = os.path.join(BASE_DIR, "contacts_today.csv")
    data_new_file = os.path.join(BASE_DIR, "contacts_new.csv")
    checkpoint_today_file = os.path.join(BASE_DIR, "contacts_today_checkpoint.csv")
    os.makedirs(BASE_DIR, exist_ok=True)

    # Respaldo de IDs para poder comparar delta
    backup_to_yesterday(ids_today_file, ids_yesterday_file)

    # Cargar estado previo si existe
    df_today_prev = safe_read_df_csv(data_today_file)
    if not df_today_prev.empty:
        id_col = (
            "id"
            if "id" in df_today_prev.columns
            else ("contact_id" if "contact_id" in df_today_prev.columns else None)
        )
    else:
        id_col = None
    # Normaliza a 'id' si viniera como 'contact_id'
    if id_col and id_col != "id":
        try:
            df_today_prev = df_today_prev.rename(columns={id_col: "id"})
        except Exception:
            pass
    existing_ids = (
        set(df_today_prev["id"].astype(str))
        if (not df_today_prev.empty and "id" in df_today_prev.columns)
        else set()
    )
    # IDs con pref_text vacío (para modo 'missing')
    try:
        if (not df_today_prev.empty) and ("pref_text" in df_today_prev.columns):
            missing_pref_ids = set(
                df_today_prev[df_today_prev["pref_text"].fillna("").astype(str).str.strip() == ""][
                    "id"
                ].astype(str)
            )
        else:
            missing_pref_ids = set()
    except Exception:
        missing_pref_ids = set()

    # Preparar salidas incrementales (append) con las columnas requeridas
    OUTPUT_COLS = [
        "id",
        "nombre",
        "telefono",
        "mail",
        "fecha_inclusion",
        "creado_info",
        "pref_text",
    ]
    if not os.path.exists(data_new_file):
        pd.DataFrame(columns=OUTPUT_COLS).to_csv(data_new_file, index=False)
    if not os.path.exists(data_today_file):
        pd.DataFrame(columns=OUTPUT_COLS).to_csv(data_today_file, index=False)

    # Migración de columnas si faltan (p.ej., agregar 'email' a ficheros existentes)
    # Normalización de columnas: reescribe con OUTPUT_COLS si existen otras
    try:
        for path in (data_new_file, data_today_file):
            if os.path.exists(path):
                df_tmp = safe_read_df_csv(path)
                if set(df_tmp.columns) != set(OUTPUT_COLS):
                    df_norm = pd.DataFrame(columns=OUTPUT_COLS)
                    atomic_write_csv(path, df_norm)
    except Exception:
        pass

    logger.info(
        "Inicio: HEADLESS=%s FAST=%s VISIT_AFTER_LIST=%s",
        EGO_HEADLESS,
        EGO_FAST,
        EGO_VISIT_AFTER_LIST,
    )
    browser = build_browser(headless=EGO_HEADLESS)
    try:
        ego_login(browser)
        goto_contacts(browser)
        # Selecciona tipos: Cliente Potencial (1), Cliente (6), Informador (1103)
        apply_entity_type_filters(browser, values=(1, 6, 1103))

        # PASO 1: Recorrer todas las páginas y recolectar IDs + datos básicos
        all_ids = set()
        base_by_id = {}
        page = 1
        pages_guard = 2000  # permite más páginas si fuera necesario

        total_rows = 0
        while pages_guard > 0:
            try:
                rows, curr, vis = collect_contacts_on_page(browser)
            except Exception:
                logger.exception("Listado: error colectando página, reintentando")
                goto_contacts(browser)
                rows, curr, vis = collect_contacts_on_page(browser)

            if rows:
                for r in rows:
                    cid = str(r.get("contact_id") or "").strip()
                    if not cid:
                        continue
                    all_ids.add(cid)
                    # Guardar última versión de datos básicos
                    r["fecha_inclusion"] = datetime.today().strftime("%Y-%m-%d")
                    base_by_id[cid] = r

            # Avanzar a la siguiente página; si no hay más, salir
            if not next_page(browser, curr):
                break
            page += 1
            pages_guard -= 1
            if page % 8 == 0:
                clear_browser_state(
                    browser,
                    clear_cache=False if EGO_FAST else True,
                    clear_cookies=False,
                )
            total_rows += len(rows or [])

        # Guardar ficheros de IDs (today y new)
        logger.info(
            "Listado: páginas=%s contactos=%s filas_vistas=%s",
            page,
            len(all_ids),
            total_rows,
        )
        safe_write_ids_csv(ids_today_file, sorted(all_ids))
        new_ids_only = [i for i in sorted(all_ids) if i not in existing_ids]
        safe_write_ids_csv(ids_new_file, new_ids_only)
        logger.info("IDs: hoy=%s nuevos=%s", len(all_ids), len(new_ids_only))

        # PASO 1.5 (opcional): Recorrer todas las fichas para asegurarse de visitarlas
        if EGO_VISIT_AFTER_LIST and all_ids:
            logger.info("Visitas: recorriendo %s fichas tras listado", len(all_ids))
            ok_visits = 0
            for k, cid in enumerate(sorted(all_ids)):
                try:
                    if visit_contact_detail(browser, cid, wait_for_ready=False):
                        ok_visits += 1
                except Exception:
                    pass
                if (k + 1) % 20 == 0:
                    clear_browser_state(
                        browser,
                        clear_cache=False if EGO_FAST else True,
                        clear_cookies=False,
                    )
            logger.info("Visitas: realizadas %s de %s", ok_visits, len(all_ids))

        # PASO 2: Decidir conjunto de IDs objetivo según modo
        if EGO_UPDATE_MODE == "all":
            target_ids = sorted(all_ids)
        elif EGO_UPDATE_MODE == "missing":
            target_ids = sorted(
                [cid for cid in all_ids if (cid not in existing_ids) or (cid in missing_pref_ids)]
            )
        else:  # new
            target_ids = sorted([cid for cid in all_ids if cid not in existing_ids])

        logger.info(
            "Preferencias: modo=%s contactos_objetivo=%s total_en_listado=%s",
            EGO_UPDATE_MODE,
            len(target_ids),
            len(all_ids),
        )
        sess = make_http_session_from_browser(browser)
        pref_text_by_id = {}

        # Concurrencia para velocidad
        if _workers_env and _workers_env > 0:
            max_workers = max(1, min(64, _workers_env))
        elif EGO_FAST:
            cpu = os.cpu_count() or 4
            max_workers = min(48, max(8, cpu * 2))
        else:
            max_workers = min(16, max(4, os.cpu_count() or 4))

        def _fetch_pref_http(cid: str):
            return cid, fetch_contact_preferences_http(sess, cid)

        logger.info("Preferencias HTTP: max_workers=%s", max_workers)
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
            future_map = {ex.submit(_fetch_pref_http, cid): cid for cid in target_ids}
            for i, fut in enumerate(concurrent.futures.as_completed(future_map)):
                cid = future_map[fut]
                try:
                    cid_r, pref_txt = fut.result()
                except Exception:
                    logger.exception("HTTP: error obteniendo pref. para %s", cid)
                    pref_txt = ""
                pref_text_by_id[cid] = pref_txt or ""
                # Imprime la fila completa para este contacto justo al terminarlo
                try:
                    base = base_by_id.get(
                        cid,
                        {
                            "contact_id": cid,
                            "nombre": None,
                            "telefono": None,
                            "email": None,
                            "creado_info": None,
                            "fecha_inclusion": datetime.today().strftime("%Y-%m-%d"),
                        },
                    )
                    print(
                        "[ROW]",
                        f"id={cid}",
                        f"nombre={base.get('nombre')}",
                        f"telefono={base.get('telefono')}",
                        f"mail={base.get('email')}",
                        f"pref_text={pref_text_by_id.get(cid,'')}",
                    )
                except Exception:
                    pass
                if (i + 1) % 50 == 0:
                    clear_browser_state(
                        browser,
                        clear_cache=False if EGO_FAST else True,
                        clear_cookies=False,
                    )

        # Fallback Selenium para las que quedaron vacías
        missing_prefs = [cid for cid in target_ids if not pref_text_by_id.get(cid)]
        if missing_prefs:
            logger.info(
                "Preferencias Selenium (fallback): pendientes=%s", len(missing_prefs)
            )
        for j, cid in enumerate(missing_prefs):
            try:
                pref_text_by_id[cid] = (
                    fetch_contact_preferences_browser(browser, cid) or ""
                )
                try:
                    base = base_by_id.get(
                        cid,
                        {
                            "contact_id": cid,
                            "nombre": None,
                            "telefono": None,
                            "email": None,
                            "creado_info": None,
                            "fecha_inclusion": datetime.today().strftime("%Y-%m-%d"),
                        },
                    )
                    print(
                        "[ROW]",
                        f"id={cid}",
                        f"nombre={base.get('nombre')}",
                        f"telefono={base.get('telefono')}",
                        f"mail={base.get('email')}",
                        f"pref_text={pref_text_by_id.get(cid,'')}",
                    )
                except Exception:
                    pass
            except Exception:
                pass
            if (j + 1) % 15 == 0:
                clear_browser_state(
                    browser,
                    clear_cache=False if EGO_FAST else True,
                    clear_cookies=False,
                )

        # Construir datasets finales (1 fila por contacto) con columnas requeridas
        def _build_contact_row(cid: str):
            base = base_by_id.get(
                cid,
                {
                    "contact_id": cid,
                    "nombre": None,
                    "telefono": None,
                    "email": None,
                    "creado_info": None,
                    "fecha_inclusion": datetime.today().strftime("%Y-%m-%d"),
                },
            )
            return {
                "id": cid,
                "nombre": base.get("nombre"),
                "telefono": base.get("telefono"),
                "mail": base.get("email"),
                "fecha_inclusion": base.get("fecha_inclusion")
                or datetime.today().strftime("%Y-%m-%d"),
                "creado_info": base.get("creado_info"),
                "pref_text": pref_text_by_id.get(str(cid), ""),
            }

        def _wrap_spans(df: pd.DataFrame) -> pd.DataFrame:
            # Sin envoltorio adicional: dejamos valores tal cual.
            # pref_text ya trae el HTML original con sus <span> internos.
            return df

        rows_all = [_build_contact_row(cid) for cid in sorted(all_ids)]
        rows_target = [_build_contact_row(cid) for cid in target_ids]
        rows_new = [_build_contact_row(cid) for cid in sorted(new_ids_only)]

        def _upsert_today(existing_df: pd.DataFrame, new_rows: list) -> pd.DataFrame:
            try:
                cols = OUTPUT_COLS
                df_exist = existing_df.copy() if existing_df is not None else pd.DataFrame(columns=cols)
                if df_exist.empty:
                    return pd.DataFrame(new_rows, columns=cols)
                if "id" not in df_exist.columns and "contact_id" in df_exist.columns:
                    df_exist = df_exist.rename(columns={"contact_id": "id"})
                for c in cols:
                    if c not in df_exist.columns:
                        df_exist[c] = None
                df_exist = df_exist[cols]
                df_exist = df_exist.set_index("id", drop=False)
                for r in new_rows:
                    rid = str(r.get("id"))
                    if not rid:
                        continue
                    row = {k: r.get(k) for k in cols}
                    df_exist.loc[rid] = row
                return df_exist.reset_index(drop=True)
            except Exception:
                try:
                    return (
                        pd.concat([existing_df, pd.DataFrame(new_rows)], ignore_index=True)
                        .drop_duplicates(subset=["id"], keep="last")
                    )
                except Exception:
                    return pd.DataFrame(new_rows, columns=OUTPUT_COLS)

        if rows_new:
            df_new = pd.DataFrame(rows_new)
            df_new = _wrap_spans(df_new)
            append_df_csv(data_new_file, df_new)

        # contacts_today.csv
        if EGO_UPDATE_MODE == "all":
            df_today = pd.DataFrame(rows_all)
            df_today = _wrap_spans(df_today)
            atomic_write_csv(data_today_file, df_today)
            atomic_write_csv(checkpoint_today_file, df_today)
        else:
            df_prev = safe_read_df_csv(data_today_file)
            df_upd = _upsert_today(df_prev, rows_target)
            df_upd = _wrap_spans(df_upd)
            atomic_write_csv(data_today_file, df_upd)
            atomic_write_csv(checkpoint_today_file, df_upd)

        # Mensaje final de resumen
        try:
            n_new = len(safe_read_df_csv(data_new_file))
            n_today = len(safe_read_df_csv(data_today_file))
        except Exception:
            n_new = n_today = 0
        logger.info(
            "CSV: escritos %s filas=%s y %s filas=%s",
            data_new_file,
            n_new,
            data_today_file,
            n_today,
        )

    finally:
        try:
            browser.quit()
        except Exception:
            pass


if __name__ == "__main__":
    main_contacts()
