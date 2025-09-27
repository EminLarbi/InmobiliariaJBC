import os
import csv
import time
import random
import shutil
import pandas as pd
from bs4 import BeautifulSoup as bs
import re
import unicodedata
import json
from pathlib import Path
from datetime import datetime


# Selenium / undetected-chromedriver
import undetected_chromedriver as uc
from selenium.common.exceptions import WebDriverException

# -------- Configuración --------
busqueda = "alcoy-alcoi-alicante"
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = (
    SCRIPT_DIR.parent.parent
)  # .../Scrappers/Idealista/Scripts -> sube dos niveles
BASE_DIR = str((PROJECT_ROOT / "Idealista" / "Data").resolve())

min_wait = 10
max_wait = 12
max_page = 999_999_999


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


# -------- Scraper de Idealista (IDs) --------
def scrape_idealista_ids(busqueda, browser, tipo="venta", max_page=10000000):
    """
    Scrapea IDs de listados de Idealista para 'venta' o 'alquiler'.

    Parámetros
    ----------
    busqueda : str
        Slug de búsqueda de Idealista, ej: "alcoy-alcoi-alicante"
    browser : selenium webdriver
        Instancia de navegador ya abierta.
    tipo : str
        "venta" o "alquiler"
    max_page : int
        Límite superior de páginas a recorrer.

    Retorna
    -------
    list[str]
        Lista de IDs encontradas en orden de aparición.
    """
    # Mapear tipo -> segmento URL
    tipo_segmento = (
        "venta-viviendas" if str(tipo).lower() == "venta" else "alquiler-viviendas"
    )

    ids = []
    vistos = set()
    x = 1
    first_run = True
    max_retries = 5

    try:
        while x <= max_page:
            url = f"https://www.idealista.com/{tipo_segmento}/{busqueda}/pagina-{x}.htm"
            try:
                browser.get(url)
            except WebDriverException:
                break

            time.sleep(random.randint(min_wait, max_wait))

            if first_run:
                try:
                    browser.find_element(
                        "xpath", '//*[@id="didomi-notice-agree-button"]'
                    ).click()
                except Exception:
                    pass
                finally:
                    first_run = False

            intentos = 0
            nuevos_total_pagina = 0
            while intentos < max_retries:
                intentos += 1

                html = browser.page_source
                soup = bs(html, "lxml")

                main = soup.find("main", {"class": "listing-items"})
                if not main:
                    # No hay resultados o cambió el DOM
                    return ids

                try:
                    pag = main.find("div", {"class": "pagination"})
                    selected = pag.find("li", {"class": "selected"})
                    pagina_actual = int(selected.text.strip())
                except Exception:
                    pagina_actual = x

                if x != pagina_actual:
                    # Fin de navegación coherente
                    return ids

                articles = main.find_all("article")
                if not articles:
                    return ids

                antes = len(ids)
                for article in articles:
                    ad_id = article.get("data-element-id")
                    if not ad_id:
                        continue
                    if ad_id in vistos:
                        continue
                    ids.append(ad_id)
                    vistos.add(ad_id)

                nuevos_en_intento = len(ids) - antes
                nuevos_total_pagina += nuevos_en_intento

                # Heurística: 30 tarjetas por página cargadas por completo
                if nuevos_total_pagina == 30:
                    break

                try:
                    browser.refresh()
                except WebDriverException:
                    try:
                        browser.get(url)
                    except WebDriverException:
                        break

                time.sleep(random.randint(min_wait, max_wait))

            if nuevos_total_pagina == 0:
                break
            print(
                f"[{tipo.upper()}] Página {x}: {len(ids)} IDs acumuladas (+{nuevos_total_pagina})."
            )
            x += 1

    except Exception as e:
        print(f"Error al scrapeo de IDs ({tipo}): {e}")

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


# -------- Parser de ficha --------
def parsear_inmueble(id_inmueble, browser, first_run):
    """
    Devuelve (df_casa: DataFrame con una fila, dict_casa: dict)
    - Ahora también parsea las secciones 'Características básicas' y 'Edificio'
      del bloque .details-property-feature-one / .details-property_features
    """
    try:
        url = f"https://www.idealista.com/inmueble/{id_inmueble}/"
        browser.get(url)
        time.sleep(random.randint(4, 8))

        if first_run:
            time.sleep(random.randint(3, 5))
            try:
                browser.find_element(
                    "xpath", '//*[@id="didomi-notice-agree-button"]'
                ).click()
            except Exception:
                pass

        html = browser.page_source
        soup = bs(html, "lxml")

        adv_el = soup.find("a", {"class": "about-advertiser-name"})
        anunciante = adv_el.text.strip() if adv_el else ""
        anunciante_link = (
            "https://www.idealista.com" + adv_el.get("href").strip()
            if adv_el and adv_el.get("href")
            else ""
        )
        if any(bloq in anunciante.upper() for bloq in ["PICÓ BLANES", "JBC", "J.B.C"]):
            return pd.DataFrame(), {}

        titulo_el = soup.find("span", {"class": "main-info__title-main"})
        titulo = titulo_el.text.strip() if titulo_el else ""

        loc_el = soup.find("span", {"class": "main-info__title-minor"})
        localizacion = loc_el.text.split(",")[0].strip() if loc_el else ""

        # --- helpers robustos ---
        num_regex = re.compile(r"(\d+(?:[\.,]\d+)?)")

        def strip_accents(s):
            if not s:
                return ""
            return "".join(
                c
                for c in unicodedata.normalize("NFD", s)
                if unicodedata.category(c) != "Mn"
            )

        def to_int_any(texto):
            if not texto:
                return None
            m = num_regex.search(texto.replace("\xa0", " "))
            if not m:
                return None
            n = m.group(1).replace(".", "").replace(",", ".")
            try:
                return int(float(n))
            except Exception:
                return None

        def find_first(patterns, text_norm):
            for pat in patterns:
                m = re.search(pat, text_norm)
                if m:
                    try:
                        return int(m.group(1))
                    except Exception:
                        continue
            return None

        def limpiar_precio(txt):
            if not txt:
                return None
            m = num_regex.search(txt.replace("\xa0", " "))
            if not m:
                return None
            return to_int_any(m.group(1))

        def parse_from_ldjson(soup):
            rooms = baths = area = None
            for sc in soup.find_all("script", {"type": "application/ld+json"}):
                try:
                    data = json.loads(sc.string or "")
                except Exception:
                    continue
                candidates = data if isinstance(data, list) else [data]
                for d in candidates:
                    if not isinstance(d, dict):
                        continue
                    if rooms is None:
                        r = d.get("numberOfRooms") or d.get("numberOfRooms", None)
                        if isinstance(r, (int, float, str)):
                            try:
                                rooms = int(float(r))
                            except:
                                pass
                    if baths is None:
                        b = (
                            d.get("numberOfBathroomsTotal")
                            or d.get("numberOfBathrooms")
                            or d.get("bathroomCount")
                        )
                        if isinstance(b, (int, float, str)):
                            try:
                                baths = int(float(b))
                            except:
                                pass
                    if area is None:
                        fs = d.get("floorSize") or {}
                        if isinstance(fs, dict):
                            v = fs.get("value") or fs.get("valueReference")
                            if isinstance(v, (int, float, str)):
                                try:
                                    area = int(float(str(v).replace(",", ".")))
                                except:
                                    pass
                if rooms is not None and baths is not None and area is not None:
                    break
            return rooms, baths, area

        def parse_m2_from_any(text_norm):
            m = re.search(r"(\d+(?:[\.,]\d+)?)\s*m(?:²|2)\b", text_norm)
            if not m:
                m = re.search(r"(\d+(?:[\.,]\d+)?)\s*(?:metros|mtrs|mtr)\b", text_norm)
            if m:
                try:
                    return int(float(m.group(1).replace(".", "").replace(",", ".")))
                except:
                    return None
            return None

        precio_el = soup.find("span", {"class": "txt-bold"})
        precio = limpiar_precio(precio_el.text) if precio_el else None

        # ========= NUEVO: parseo específico del contenedor de características =========
        # Mapeamos cada <h2> de la sección a su lista <ul> inmediatamente siguiente.
        secciones_raw = {}
        for h2 in soup.find_all("h2", {"class": "details-property-h2"}):
            titulo_sec = (h2.get_text() or "").strip()
            # El contenedor con la lista está en el siguiente hermano con class 'details-property_features'
            cont = h2.find_next_sibling("div", {"class": "details-property_features"})
            if cont:
                items = [li.get_text(" ").strip() for li in cont.find_all("li")]
                secciones_raw[titulo_sec.lower()] = items

        caracteristicas = [
            *secciones_raw.get("características básicas", []),
            *secciones_raw.get("caracteristicas basicas", []),
        ]
        edificio = secciones_raw.get("edificio", [])

        # Normalización para regex
        def norm_list(lst):
            return [strip_accents(x.lower()) for x in lst]

        car_norm = norm_list(caracteristicas)
        edi_norm = norm_list(edificio)

        m2_construidos = None
        m2_utiles = None
        habitaciones_list = None
        banos_list = None
        terraza = None
        estado = None

        # Reglas sobre 'Características básicas'
        for raw, norm in zip(caracteristicas, car_norm):
            # 180 m² construidos, 170 m² útiles
            m = re.search(r"(\d+(?:[\.,]\d+)?)\s*m(?:²|2)\s*constru", norm)
            if m:
                try:
                    m2_construidos = int(
                        float(m.group(1).replace(".", "").replace(",", "."))
                    )
                except:
                    pass
            m = re.search(r"(\d+(?:[\.,]\d+)?)\s*m(?:²|2)\s*u(?:tiles|tiles)", norm)
            if m:
                try:
                    m2_utiles = int(
                        float(m.group(1).replace(".", "").replace(",", "."))
                    )
                except:
                    pass

            # habitaciones
            if "sin habitacion" in norm or "sin habitaciones" in norm:
                habitaciones_list = 0
            else:
                m = re.search(
                    r"(\d+)\s*(?:hab(?:\.|itaciones?)|dorm(?:\.|itorios?))", norm
                )
                if m:
                    habitaciones_list = int(m.group(1))

            # baños
            m = re.search(r"(\d+)\s*bano?s?", norm)
            if m:
                banos_list = int(m.group(1))

            # terraza
            if "terraza" in norm:
                terraza = True

            # estado
            if "segunda mano" in norm or "buen estado" in norm or "reformado" in norm:
                # Guarda el texto completo tal cual aparece
                estado = raw

        # Reglas sobre 'Edificio'
        planta = None
        exterior = None
        ascensor = None
        for raw, norm in zip(edificio, edi_norm):
            # planta / entreplanta / bajo / etc.
            # guardamos el literal original para mayor fidelidad
            if any(
                k in norm
                for k in ["planta", "entreplanta", "bajo", "atico", "principal"]
            ):
                planta = raw

            # exterior / interior
            if "exterior" in norm:
                exterior = True
            if "interior" in norm:
                exterior = False

            # ascensor
            if "sin ascensor" in norm:
                ascensor = False
            elif "ascensor" in norm:
                ascensor = True

        # ===========================================================================
        # Texto completo normalizado (para fallbacks ya existentes)
        full_text_norm = strip_accents(soup.get_text(" ").lower())

        # 1) JSON-LD
        habitaciones, banos, metros_cuadrados = parse_from_ldjson(soup)

        # 2) Fallback regex global
        if habitaciones is None:
            habitaciones = find_first(
                [r"(\d+)\s*hab(?:\.|itaciones?)\b", r"(\d+)\s*dorm(?:\.|itorios?)\b"],
                full_text_norm,
            )
        if banos is None:
            cand = []
            for pat in [
                r"(\d+)\s*bano?s?\b",
                r"(\d+)\s*bano?s?\.",
                r"(\d+)\s*aseos?\b",
                r"(\d+)\s*wc\b",
            ]:
                v = find_first([pat], full_text_norm)
                if v is not None:
                    cand.append(v)
            banos = max(cand) if cand else None
        if metros_cuadrados is None:
            metros_cuadrados = parse_m2_from_any(full_text_norm)

        # 3) Si el contenedor específico aportó datos, los priorizamos
        if m2_construidos is not None:
            # opcionalmente puedes guardar ambos (construidos y útiles)
            metros_cuadrados = m2_construidos
        if m2_utiles is not None:
            # añadimos campo separado para útiles
            pass
        if habitaciones_list is not None:
            habitaciones = habitaciones_list
        if banos_list is not None:
            banos = banos_list
        if terraza is None:
            # si no se mencionó, dejamos None; si prefieres False por defecto, cambia aquí
            pass

        # Construye dict final
        casas = {
            "id_inmueble": str(id_inmueble),
            "titulo": titulo,
            "localizacion": localizacion,
            "precio": precio,
            "metros_cuadrados": metros_cuadrados,  # por defecto: construidos si están disponibles
            "m2_construidos": m2_construidos,
            "m2_utiles": m2_utiles,
            "habitaciones": habitaciones,
            "baños": banos,
            "terraza": bool(terraza) if terraza is not None else None,
            "estado": estado,  # p.ej. "Segunda mano/buen estado"
            "planta": planta,  # p.ej. "Entreplanta exterior"
            "exterior": exterior,  # True / False / None
            "ascensor": ascensor,  # True / False / None
            "anunciante": anunciante,
            "anunciante_link": anunciante_link,
            "link_inmueble": url,
            "fecha_inclusion": datetime.today().strftime("%Y-%m-%d"),
        }

        df_casas = pd.DataFrame([casas])
        return df_casas, casas

    except Exception:
        return pd.DataFrame(), {}


# -------- Flujo principal --------
# -------- Flujo principal --------
DEBUG = True


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
    ids_ayer = safe_read_ids_csv(ids_today_file)
    backup_to_yesterday(ids_today_file, ids_yesterday_file)
    dprint(f"[AYER] ids_ayer={len(ids_ayer)} sample={ids_ayer[:5]}")

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
    browser = uc.Chrome()
    ids_venta = scrape_idealista_ids(busqueda, browser, tipo="venta", max_page=max_page)
    ids_alquiler = scrape_idealista_ids(
        busqueda, browser, tipo="alquiler", max_page=max_page
    )
    dprint(f"[SCRAPE] venta={len(ids_venta)} alquiler={len(ids_alquiler)}")

    # 3) Unir
    ids_hoy = merge_unique_ordered(ids_venta, ids_alquiler)
    dprint(f"[HOY] ids_hoy={len(ids_hoy)} sample={ids_hoy[:10]}")

    # 4) Persistir ids_today
    safe_write_ids_csv(ids_today_file, ids_hoy)

    # 5) Calcular "nuevos": en ids_hoy y NO en el CSV de inmuebles (data_today)
    ids_nuevos = [str(i) for i in ids_hoy if str(i) not in existing_ids_in_data]
    safe_write_ids_csv(ids_new_file, ids_nuevos)

    # 6) Parsear solo nuevos
    first_run = True  # primera ficha: aceptar cookies
    df_new_list = []
    print(
        f"Parseando {len(ids_nuevos)} nuevos inmuebles (venta+alquiler combinados)..."
    )
    for _id in ids_nuevos:
        df_i, _ = parsear_inmueble(_id, browser, first_run)
        first_run = False
        if not df_i.empty:
            df_new_list.append(df_i)

    try:
        browser.quit()
    except Exception:
        pass

    df_new = (
        pd.concat(df_new_list, ignore_index=True)
        if df_new_list
        else pd.DataFrame(
            columns=[
                "id_inmueble",
                "titulo",
                "localizacion",
                "precio",
                "metros_cuadrados",
                "habitaciones",
                "baños",
                "caracteristicas_basicas",
                "caracteristicas_extras",
                "anunciante",
                "link_anunciante",
                "link_inmueble",
            ]
        )
    )
    safe_write_df_csv(data_new_file, df_new)

    # 7) Construir today consistente con ids_hoy
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
