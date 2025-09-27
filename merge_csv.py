#!/usr/bin/env python
# coding: utf-8

# In[366]:


import pandas as pd
import numpy as np


# In[367]:


pd.set_option("display.max_rows", None)
pd.set_option("display.max_columns", None)
pd.set_option("display.max_colwidth", None)
# Rutas a los CSV
csv1 = "Scrappers/Fotocasa/Data/inmuebles_today.csv"
csv2 = "Scrappers/Idealista/Data/inmuebles_today.csv"
csv3 = "Scrappers/Pico_Blanes/Data/inmuebles_today.csv"
csv4 = "Scrappers/Ego/Data/contacts_today_parsed.csv"
# Cargar cada CSV en un DataFrame
df1 = pd.read_csv(csv1)
df2 = pd.read_csv(csv2)
df3 = pd.read_csv(csv3)
df4 = pd.read_csv(csv4)
# Mostrar las primeras filas de cada uno
print("Primeras filas de archivo1.csv:")
print(df1.columns, "\n")

print("Primeras filas de archivo2.csv:")
print(df2.columns, "\n")

print("Primeras filas de archivo3.csv:")
print(df3.columns, "\n")

print("Primeras filas de archivo4.csv:")
print(df4.columns, "\n")


# In[368]:


import numpy as np

# df1 a partir del link
df1["tipo_de_operacion"] = np.where(
    df1["link_inmueble"].str.contains("/comprar/"),
    "Venta",
    np.where(df1["link_inmueble"].str.contains("/alquiler/"), "Alquiler", "Otro"),
)

# df3 corrigiendo alquiler opción a compra
df3["tipo_de_operacion"] = df3["tipo_de_operacion"].replace(
    {"Alquiler opción a compra": "Alquiler"}
)
df3["tipo_de_operacion"] = df3["tipo_de_operacion"].fillna("Otro")

# df2 a partir del título
df2["tipo_de_operacion"] = np.where(
    df2["titulo"].str.contains("venta", case=False, na=False),
    "Venta",
    np.where(
        df2["titulo"].str.contains("alquiler", case=False, na=False), "Alquiler", "Otro"
    ),
)



# In[369]:


# Diccionario de traducción de anunciantes
mapa_anunciantes = {
    "Remax Concorde": "TEAM CONCORDE",
    "Núcleo Alcoy": "Núcleo Gestiones Inmobiliarias Alcoy",
    "Hipoges": "Hipoges",
    "CLIKALIA": "Clikalia España",
    "Fincas Valencia Consultores Inmobiliarios": "FINCAS VALENCIA CONSULTORES INMOBILIARIOS",
    "Gestores inmobiliarios": "GESTORES INMOBILIARIOS",
    "PERCENT SERVICIOS": "Percent Servicios Inmobiliarios",
    "NEXT HOME INMOBILIARIA": "NEXT HOME INMOBILIARIA",
    "Inmobiliaria Norte": "INMOBILIARIA NORTE",
    "INMOBILIARIA ARACIL": "inmobiliaria aracil",
    "OLCINA INMOBILIARIA": "INMOBILIARIA OLCINA",
    "ABARCA SERVICIOS INMOBILIARIOS S.L.": "Abarca servicios inmobiliarios",
    "Grupo ARAI": "Arai",
    "ROQUETA INVESTMENT": "SA ROQUETA INVESTMENT",
    "Aliseda Inmobiliaria": "Aliseda inmobiliaria",
    "Inmobiliaria Aspelx": "ASPELX GESTIÓN INMOBILIARIA",
    "TXCASAS": "TX CASAS INMOBILIARIA",
    "Solvia Inmobiliaria": "Solvia inmobiliaria",  # Ojo: tienes 3 variantes, podemos unificarlas después
    "GTI INMOFREELANCE": "GTI INMOFREELANCE",
    "Remax Blue": "Remax Blue",
    "REMAX INMOMAS": "Grupo RE/MAX Inmomás",
    "Gestimar Inmobiliaria": "GESTIMAR INMOBILIARIA",
    "Inmobiliaria Hache": "Inmobiliaria Hache",
    "Next Steps Spain": "NEXT STEP PROPERTIES",
    "REDTOONE INVESTMENTS": "redtoone inmobiliaria",
    "Servicios Inmobiliarios Interworld": "SERVICIOS INMOBILIARIOS INTERWORLD",
    "Invest MSS": "INVEST MSS REAL ESTATE",
    "Buve": "BUVE",
    "Tarrazó Inmobiliaria": "Inmobiiaria Tarrazó",
    "INMOBROKERS": "INMOBROKERS.ES",
    "Te Compro La Casa": "TE COMPRO LA CASA",
    "Altages Inmobiliaria": "ALTAGES INMOBILIARIA",
    "Century 21 Plaza": "Century 21 Plaza",
    "Mocadi Real Estate Calpe": "Mocadi Calpe",
    "Mar de Casas": "Mar de Casas",
    "Gestor De Propiedades Andreas": "GESTOR DE PROPIEDADES ANDREAS",
    "Kapitalia Inmobiliaria": "Kapitalia Inmobiliaria",
    "HogarAbitat": "HOGARABITAT SERVICIOS INMOBILIARIOS",
    "Maravillas International Realty Group": "International Realty",
}

# Normalizar los anunciantes en df1 y df2
df1["anunciante"] = df1["anunciante"].replace(mapa_anunciantes)
df2["anunciante"] = df2["anunciante"].replace(mapa_anunciantes)


# In[ ]:


import re
import unicodedata
from difflib import SequenceMatcher


def normalize_location(name):
    """
    Devuelve SIEMPRE:
      - out_str: "Municipio / Barrio / Subzona" con extras no redundantes.
      - out_dict: SOLO finales {municipio, barrio, subzona, extras}.
    Regla específica: si el input contiene "Alicante (Spain)", out_str será EXACTAMENTE "Alicante (España)".
    """
    original = name if isinstance(name, str) else ""
    s_raw = original.strip()

    def strip_accents(x):
        return "".join(
            c
            for c in unicodedata.normalize("NFD", x)
            if unicodedata.category(c) != "Mn"
        )

    def match_from_dict(token, mapping):
        for canon, variants in mapping.items():
            if token == canon or token in variants:
                return canon
        return None

    def norm_low(x):
        return re.sub(r"\s+", " ", strip_accents(x).lower().strip())

    # Flag especial: "Alicante (Spain)" en el texto original
    special_alicante_spain = bool(
        re.search(r"\balicante\s*\(\s*spain\s*\)", strip_accents(s_raw), flags=re.I)
    )

    # 0) Pistas en paréntesis
    paren_hints = re.findall(r"\(([^)]*)\)", s_raw)
    paren_tokens = []
    for ph in paren_hints:
        for t in re.split(r"[\/\-|,]", ph):
            t = norm_low(t)
            if t:
                paren_tokens.append(t)

    # 1) Limpieza
    s = norm_low(s_raw)
    s = re.sub(r"\s*/\s*", " / ", s)
    s = re.sub(r"[-_]+", " - ", s)
    s = re.sub(r"\s*\([^)]*\)", "", s)
    s = re.sub(r"\s+", " ", s).strip()

    # 2) Reglas
    repl = {
        "alcoy - alcoi": "alcoi",
        "alcoy / alcoi": "alcoi",
        "alcoy": "alcoi",
        "san vicente del raspeig / sant vicent del raspeig": "san vicente del raspeig",
        "sant vicent del raspeig": "san vicente del raspeig",
        "muro de alcoy": "muro d alcoi",
        "muro": "muro d alcoi",
        "l alqueria d asnar": "l'alqueria d'asnar",
        "zona norte": "zona nord",
        "centro": "centre",
        "ensanche": "eixample",
        "batoy": "batoi",
        "camí": "el cami",
        "el camí": "el cami",
        "cami": "el cami",
    }
    for k, v in repl.items():
        s = re.sub(rf"\b{k}\b", v, s)

    # 3) Diccionarios
    ALC = "Alcoi"
    barrios_alcoi = {
        "eixample": ["eixample", "barri eixample", "ensanche"],
        "centre - zona alta": [
            "centre - zona alta",
            "centre zona alta",
            "centro - zona alta",
            "centro zona alta",
            "centro-zona alta",
            "centre",
        ],
        "santa rosa": ["santa rosa", "barri santa rosa"],
        "zona nord": [
            "zona nord",
            "nord",
            "norte",
            "zona norte",
            "zona nord alcoi",
            "zona nord (alcoi)",
        ],
        "batoi": ["batoi", "barri batoi", "batoy (alcoi)", "batoy"],
        "el cami": ["el cami", "cami"],
        "viaducto": ["viaducto", "zona viaducto"],
    }
    subzonas_alcoi = {
        "beniata": ["beniata"],
        "gormaig": ["gormaig"],
        "cotes baixes": ["cotes baixes"],
        "els algars": ["els algars", "algars"],
        "montesol": ["montesol"],
        "sargento": ["sargento"],
        "baradello": ["baradello"],
    }
    municipios = {
        "alcoi": "Alcoi",
        "cocentaina": "Cocentaina",
        "muro d alcoi": "Muro d'Alcoi",
        "muro de alcoy": "Muro d'Alcoi",
        "muro": "Muro d'Alcoi",
        "banyeres de mariola": "Banyeres de Mariola",
        "planes": "Planes",
        "penaguila": "Penàguila",
        "penàguila": "Penàguila",
        "agres": "Agres",
        "gaianes": "Gaianes",
        "benimarfull": "Benimarfull",
        "benilloba": "Benilloba",
        "benillup": "Benillup",
        "gorga": "Gorga",
        "quatretondeta": "Quatretondeta",
        "alcoleja": "Alcoleja",
        "almudaina": "Almudaina",
        "benifallim": "Benifallim",
        "benimassot": "Benimassot",
        "facheca": "Fageca",
        "famorca": "Famorca",
        "tollos": "Tollos",
        "beniarres": "Beniarrés",
        "alfafara": "Alfafara",
        "benasau": "Benasau",
        "benimantell": "Benimantell",
        "l'alqueria d'asnar": "L'Alqueria d'Asnar",
        "alcocer de planes": "Alcocer de Planes",
        "banyeres": "Banyeres de Mariola",
        "cabanes y las fuentes": "Villena",
        "villena": "Villena",
        "san vicente del raspeig": "San Vicente del Raspeig",
        "alacant": "Alicante",
        "alicante": "Alicante",
    }
    barrios_otro = {
        "Villena": {
            "el rabal": ["el rabal"],
            "el mercado - plaza de toros": [
                "el mercado - plaza de toros",
                "mercado plaza de toros",
            ],
            "maestro carrascosa - banda de musica": [
                "maestro carrascosa - banda de musica"
            ],
            "la paz": ["la paz"],
            "las cruces": ["las cruces"],
            "las tiesas": ["las tiesas"],
            "las virtudes": ["las virtudes"],
            "el carril - paseo de chapi": ["el carril - paseo de chapi"],
            "partidas norte": ["partidas norte"],
            "cabanes y las fuentes": ["cabanes y las fuentes"],
        },
        "San Vicente del Raspeig": {
            "los girasoles": ["los girasoles"],
            "sol y luz": ["sol y luz"],
            "haygon - universidad": [
                "haygon - universidad",
                "haygon universidad",
                "haygon",
            ],
            "el tubo": ["el tubo"],
            "centro": ["centro"],
            "norte": ["norte"],
        },
    }

    # 4) Generalidades en castellano
    general_groups = {
        "españa": ["espana", "españa", "spain"],
        "alicante provincia": ["alicante provincia", "provincia de alicante"],
        "qatar": ["qatar"],
        "pueblos de la montaña": ["pueblos de la montana", "pueblos de la montaña"],
        "alicante": ["alicante", "alicante (spain)", "alicante spain"],
    }
    too_general_variants = set()
    for canon, variants in general_groups.items():
        too_general_variants.add(norm_low(canon))
        for v in variants:
            too_general_variants.add(norm_low(v))

    # 5) Índice global barrios
    global_barrio_index = {}
    for muni, m in [("Alcoi", barrios_alcoi)] + list(barrios_otro.items()):
        for canon, variants in m.items():
            for v in [canon] + variants:
                global_barrio_index[v] = (muni, canon)

    # 6) Detecta municipio
    municipio = None
    for key, val in municipios.items():
        if re.search(rf"\b{re.escape(key)}\b", s):
            municipio = val
            break
    if municipio is None:
        for t in paren_tokens:
            if t in municipios:
                municipio = municipios[t]
                break
        if municipio is None and any(tt in ("alcoi",) for tt in paren_tokens):
            municipio = ALC

    # 7) Tokens
    tokens = [t.strip() for t in re.split(r"[,/]| - ", s) if t.strip()]

    barrio = None
    subzona = None
    match_type = None

    # 7a) Barrio global
    if municipio is None:
        for t in tokens:
            if t in global_barrio_index:
                muni_guess, canon_guess = global_barrio_index[t]
                municipio = muni_guess
                barrio = (
                    canon_guess
                    if muni_guess != ALC or canon_guess in barrios_alcoi
                    else None
                )
                match_type = "dict"
                break

    # 8) Diccionarios por municipio
    if municipio == ALC:
        for t in tokens:
            m = match_from_dict(t, barrios_alcoi)
            if m:
                barrio = m
                match_type = "dict"
                break
        for t in tokens:
            m = match_from_dict(t, subzonas_alcoi)
            if m:
                subzona = m
                match_type = match_type or "dict"
                break
    elif municipio in barrios_otro:
        for t in tokens:
            m = match_from_dict(t, barrios_otro[municipio])
            if m:
                barrio = m
                match_type = "dict"
                break

    # 9) Heurística Alcoi
    if match_type is None and (municipio == ALC or municipio is None):
        for t in tokens:
            if any(w in t for w in ["eixample", "ensanche"]):
                municipio = municipio or ALC
                barrio = "eixample"
                match_type = "heuristic"
                break
            if "zona nord" in t or re.search(r"\bnorte\b", t):
                municipio = municipio or ALC
                barrio = "zona nord"
                match_type = "heuristic"
                break
            if "santa rosa" in t:
                municipio = municipio or ALC
                barrio = "santa rosa"
                match_type = "heuristic"
                break
            if "batoi" in t or "batoy" in t:
                municipio = municipio or ALC
                barrio = "batoi"
                match_type = "heuristic"
                break
            if "centre" in t or "centro" in t:
                municipio = municipio or ALC
                barrio = "centre - zona alta"
                match_type = "heuristic"
                break

    # 10) Fuzzy
    def fuzzy_match(token, mapping, thresh=0.9):
        best, best_score = None, 0.0
        for canon, variants in mapping.items():
            for v in [canon] + variants:
                score = SequenceMatcher(None, token, v).ratio()
                if score > best_score:
                    best, best_score = canon, score
        return (best if best_score >= thresh else None), best_score

    if match_type is None:
        if municipio == ALC or municipio is None:
            fb = None
            for t in tokens:
                fb, _ = fuzzy_match(t, barrios_alcoi, 0.9)
                if fb:
                    break
            if fb:
                municipio = municipio or ALC
                barrio = fb
                match_type = "fuzzy"
            if match_type is None:
                fs = None
                for t in tokens:
                    fs, _ = fuzzy_match(t, subzonas_alcoi, 0.9)
                    if fs:
                        break
                if fs:
                    municipio = municipio or ALC
                    subzona = fs
                    match_type = "fuzzy"
        if match_type is None and municipio in barrios_otro:
            fo = None
            for t in tokens:
                fo, _ = fuzzy_match(t, barrios_otro[municipio], 0.9)
                if fo:
                    break
            if fo:
                barrio = fo
                match_type = "fuzzy"

    # 11) Solo municipio exacto
    if municipio is None and barrio is None and subzona is None:
        if s in municipios:
            municipio = municipios[s]

    # 12) Helpers formato
    def titlecase(s_):
        lower_words = {"de", "del", "la", "las", "los", "y", "el", "i", "d'", "d"}
        parts = s_.split()
        out = []
        for i, w in enumerate(parts):
            ww = w.lower()
            out.append(ww if (i > 0 and ww in lower_words) else ww.capitalize())
        return " ".join(out)

    def cap_barrio(b):
        if not b:
            return None
        caps = {
            "eixample": "Eixample",
            "centre - zona alta": "Centre - Zona Alta",
            "santa rosa": "Santa Rosa",
            "zona nord": "Zona Nord",
            "batoi": "Batoi",
            "el cami": "El Camí",
            "viaducto": "Viaducto",
        }
        return caps.get(b, titlecase(b))

    def cap_subzona(z):
        if not z:
            return None
        caps = {
            "beniata": "Beniata",
            "gormaig": "Gormaig",
            "cotes baixes": "Cotes Baixes",
            "els algars": "Els Algars",
            "montesol": "Montesol",
            "sargento": "Sargento",
            "baradello": "Baradello",
        }
        return caps.get(z, titlecase(z))

    # 13) Base "Municipio / Barrio / Subzona"
    parts = []
    if municipio:
        parts.append(municipio)
    if barrio:
        parts.append(cap_barrio(barrio))
    if subzona:
        parts.append(cap_subzona(subzona))
    base_out = " / ".join(parts).strip()

    # 14) Extras
    def is_redundant_hint(htok):
        if not htok:
            return True
        if municipio and htok == norm_low(municipio):
            return True
        if barrio and (htok == barrio or htok in barrios_alcoi.get(barrio, [])):
            return True
        if subzona and (htok == subzona or htok in subzonas_alcoi.get(subzona, [])):
            return True
        if htok in too_general_variants:
            return True
        return False

    extra_hints = []
    for ht in paren_tokens:
        if not is_redundant_hint(ht):
            extra_hints.append(ht)

    unmapped_tokens = []
    known_set = set()
    if municipio:
        known_set.add(norm_low(municipio))
    if barrio:
        known_set.add(barrio)
        known_set.update(barrios_alcoi.get(barrio, []))
    if subzona:
        known_set.add(subzona)
        known_set.update(subzonas_alcoi.get(subzona, []))
    for t in tokens:
        if t not in known_set and t not in too_general_variants:
            unmapped_tokens.append(t)

    def pretty_hint(h):
        if h in barrios_alcoi:
            return cap_barrio(h)
        if h in subzonas_alcoi:
            return cap_subzona(h)
        if h in municipios:
            return municipios[h]
        if h in {"espana", "españa", "spain"}:
            return "España"
        return titlecase(h)

    extras = []
    seen = set()
    for seq in extra_hints + unmapped_tokens:
        if seq not in seen:
            seen.add(seq)
            extras.append(pretty_hint(seq))

    # 15) Fallbacks
    too_general_flag = s in too_general_variants or any(
        t in too_general_variants for t in paren_tokens
    )
    if not base_out:
        if too_general_flag:
            general_title = (
                titlecase(s) if s else titlecase(original) if original else ""
            )
            out_str = (
                f"{general_title} ({'; '.join(extras)})"
                if extras
                else (general_title or "")
            )
        else:
            cleaned = titlecase(s) if s else titlecase(original)
            out_str = f"{cleaned} ({'; '.join(extras)})" if extras else (cleaned or "")
    else:
        out_str = f"{base_out} ({'; '.join(extras)})" if extras else base_out

    # 16) Regla específica: si el input tenía "Alicante (Spain)", forzar "Alicante (España)"
    if special_alicante_spain:
        out_str = "Alicante (España)"

    # 17) Dict finales
    out_dict = {
        "municipio": municipio,
        "barrio": cap_barrio(barrio) if barrio else None,
        "subzona": cap_subzona(subzona) if subzona else None,
        "extras": extras,
    }

    return out_str, out_dict


# In[371]:


import pandas as pd


import pandas as pd
import ast


def standardize_zona(df, colname):
    """
    Aplica normalize_location a una columna de un DataFrame.
    Crea nueva columna 'zona_std' con resultados.
    - Si la celda es string -> un dict con {municipio, barrio, subzona}.
    - Si la celda es lista/array de strings -> lista de dicts.
    """

    def apply_item(x):
        if isinstance(x, str):
            # intentar parsear strings que parezcan listas
            try:
                parsed = ast.literal_eval(x)
                if isinstance(parsed, (list, tuple)):
                    return [
                        normalize_location(xx) for xx in parsed if isinstance(xx, str)
                    ]
                # si no era lista, tratarlo como string normal
                return normalize_location(x)
            except (ValueError, SyntaxError):
                return normalize_location(x)

        if isinstance(x, (list, tuple)):
            return [normalize_location(xx) for xx in x if isinstance(xx, str)]

        return None

    df = df.copy()
    df["zona_std"] = df[colname].apply(apply_item)
    return df


df1 = standardize_zona(df1, "zona")
df2 = standardize_zona(df2, "localizacion")
df3 = standardize_zona(df3, "zona")
df4 = standardize_zona(df4, "locations")


# In[372]:


import pandas as pd
import ast

def count_column_values(df, column):
    try:
        col = df[column].dropna()

        # Convertir cadenas que representan listas en listas reales
        def parse(x):
            if (
                isinstance(x, str)
                and x.strip().startswith("[")
                and x.strip().endswith("]")
            ):
                try:
                    return ast.literal_eval(x)
                except Exception:
                    return x
            return x

        col = col.apply(parse)

        # Explode si hay listas
        if col.apply(lambda x: isinstance(x, (list, tuple))).any():
            values = col.explode()
        else:
            values = col

        # Normalizar texto (opcional: minúsculas y trim)
        values = values.astype(str).str.strip()

        counts = values.value_counts()
        print(counts)
        return counts
    except Exception as e:
        print(f"Error: {e}")
        return None


count_column_values(df1, "zona")
count_column_values(df2, "localizacion")
count_column_values(df3, "zona")
count_column_values(df4, "locations")


# In[373]:


count_column_values(df1, "zona_std")
count_column_values(df2, "zona_std")
count_column_values(df3, "zona_std")
count_column_values(df4, "zona_std")


# In[374]:


# Reducidos / renombrados
df1_reduced = df1[
    [
        "habitaciones",
        "baños",
        "precio",
        "link_inmueble",
        "metros_cuadrados",
        "anunciante",
        "zona_std",
        "tipo_de_operacion",
    ]
].copy()

df2_reduced = df2[
    [
        "habitaciones",
        "baños",
        "precio",
        "link_inmueble",
        "metros_cuadrados",
        "anunciante",
        "zona_std",
        "tipo_de_operacion",
    ]
].copy()

df3_reduced = df3.rename(
    columns={
        "precio_eur": "precio",
        "url": "link_inmueble",
        "superficie_construida_m2": "metros_cuadrados",
    }
)[
    [
        "habitaciones",
        "baños",
        "precio",
        "link_inmueble",
        "metros_cuadrados",
        "zona_std",
        "tipo_de_operacion",
    ]
].copy()

# Columna anunciante fija para df3
df3_reduced["anunciante"] = "Picó Blanes"

# Unificar
df_final = pd.concat([df1_reduced, df2_reduced, df3_reduced], ignore_index=True)

# Tipos y valores por defecto
df_final["habitaciones"] = df_final["habitaciones"].fillna(0).astype(int)
df_final["baños"] = df_final["baños"].fillna(0).astype(int)

# Precio: NaN -> "A consultar"
df_final["precio"] = df_final["precio"].apply(
    lambda x: "A consultar" if pd.isna(x) else x
)

# Metros cuadrados: NaN -> "Desconocido"
df_final["metros_cuadrados"] = df_final["metros_cuadrados"].where(
    ~pd.isna(df_final["metros_cuadrados"]), "Desconocido"
)

# Anunciante: NaN -> "Particular"
df_final["anunciante"] = df_final["anunciante"].fillna("Particular")

# (Opcional) limpiar links y deduplicar por link_inmueble
df_final["link_inmueble"] = df_final["link_inmueble"].astype(str).str.strip()
df_final = df_final.drop_duplicates(subset=["link_inmueble"]).reset_index(drop=True)

# Añadir columna web fija en cada df reducido
df1_reduced["web"] = "Fotocasa"
df2_reduced["web"] = "Idealista"
df3_reduced["web"] = "Picó Blanes"

# Unificar
df_final = pd.concat([df1_reduced, df2_reduced, df3_reduced], ignore_index=True)

# Tipos y valores por defecto
df_final["habitaciones"] = df_final["habitaciones"].fillna(0).astype(int)
df_final["baños"] = df_final["baños"].fillna(0).astype(int)

# Precio: NaN -> "A consultar"
df_final["precio"] = df_final["precio"].apply(
    lambda x: "A consultar" if pd.isna(x) else x
)

# Metros cuadrados: NaN -> "Desconocido"
df_final["metros_cuadrados"] = df_final["metros_cuadrados"].where(
    ~pd.isna(df_final["metros_cuadrados"]), "Desconocido"
)

# Anunciante: NaN -> "Particular"
df_final["anunciante"] = df_final["anunciante"].fillna("Particular")

# (Opcional) limpiar links y deduplicar por link_inmueble
df_final["link_inmueble"] = df_final["link_inmueble"].astype(str).str.strip()
df_final = df_final.drop_duplicates(subset=["link_inmueble"]).reset_index(drop=True)
# Renombrar columna zona_std -> zona
df_final = df_final.rename(columns={"zona_std": "zona"})

# Reemplazar NaN y "-" por "Desconocido"
df_final["zona"] = df_final["zona"].replace("-", "Desconocido").fillna("Desconocido")

display(df_final.columns)
df_final.to_csv("inmuebles_unificado.csv", index=False, encoding="utf-8-sig")

print("CSV guardado como inmuebles_unificado.csv")


# In[ ]:




