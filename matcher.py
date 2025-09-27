#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import ast
import csv
import os
import sys
import math
import re
import unicodedata
import pandas as pd
from datetime import datetime

# ----------------------------
# Utilidades básicas
# ----------------------------


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def to_str(x):
    if pd.isna(x):
        return ""
    return str(x).strip()


def to_float(x, default=None):
    try:
        if x is None or (isinstance(x, float) and math.isnan(x)):
            return default
        s = str(x).strip().replace(",", ".")
        return float(s)
    except:
        return default


def to_int(x, default=None):
    try:
        if x is None or (isinstance(x, float) and math.isnan(x)):
            return default
        return int(float(str(x).strip()))
    except:
        return default


def format_number(val, decimals=0):
    num = to_float(val)
    if num is None:
        return "-"
    if decimals <= 0:
        return str(int(round(num)))
    return f"{num:.{decimals}f}"


def format_range(min_val, max_val, suffix=""):
    fmin = to_float(min_val)
    fmax = to_float(max_val)
    has_min = fmin is not None
    has_max = fmax is not None
    if not has_min and not has_max:
        return "-"
    if has_min and has_max:
        if abs(fmin - fmax) < 1e-6:
            return f"{format_number(fmin)}{suffix}"
        return f"{format_number(fmin)}{suffix} - {format_number(fmax)}{suffix}"
    if has_min:
        return f">= {format_number(fmin)}{suffix}"
    return f"<= {format_number(fmax)}{suffix}"


def format_token_list(tokens):
    if not tokens:
        return "-"
    uniq = []
    seen = set()
    for tok in tokens:
        if not tok:
            continue
        if tok in seen:
            continue
        seen.add(tok)
        uniq.append(tok)
    if not uniq:
        return "-"
    return ", ".join(uniq)


def normalize_text(s):
    s = to_str(s).lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    for sep in [";", "|", "/", "\\", ">", "<"]:
        s = s.replace(sep, ",")
    s = s.replace(" ,", ",").replace(", ", ",")
    s = " ".join(s.split())
    return s


def parse_list_field(s):
    s = normalize_text(s)
    if not s:
        return []
    parts = [p.strip() for p in s.split(",") if p.strip()]
    return list(dict.fromkeys(parts))


def clamp01(x):
    if x is None or math.isnan(x):
        return 0.0
    return max(0.0, min(1.0, float(x)))


def safe_literal_eval(value):
    if isinstance(value, (list, tuple, dict, set)):
        return value
    s = to_str(value)
    if not s:
        return None
    try:
        return ast.literal_eval(s)
    except Exception:
        return None


def iter_string_like(value):
    if value is None:
        return
    if isinstance(value, str):
        yield value
    elif isinstance(value, (list, tuple, set)):
        for item in value:
            yield from iter_string_like(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from iter_string_like(item)
    else:
        yield str(value)


def extract_municipios(value):
    municipios = set()
    if isinstance(value, dict):
        municipio = normalize_text(value.get("municipio", ""))
        if municipio:
            municipios.add(municipio)
        for val in value.values():
            municipios.update(extract_municipios(val))
    elif isinstance(value, (list, tuple, set)):
        for item in value:
            municipios.update(extract_municipios(item))
    return municipios


LOCATION_EQUIVALENTS = {
    "alcoi": {"alcoy"},
    "alcoy": {"alcoi"},
    "alacant": {"alicante"},
    "alicante": {"alacant"},
    "alicante provincia": {
        "provincia de alicante",
        "provincia alicante",
        "alicante (provincia)",
        "alicante province",
        "province of alicante",
    },
    "provincia de alicante": {
        "alicante provincia",
        "provincia alicante",
        "alicante (provincia)",
        "alicante province",
        "province of alicante",
    },
    "provincia alicante": {
        "alicante provincia",
        "provincia de alicante",
        "alicante (provincia)",
        "alicante province",
        "province of alicante",
    },
    "alicante (provincia)": {
        "alicante provincia",
        "provincia de alicante",
        "provincia alicante",
        "alicante province",
        "province of alicante",
    },
    "alicante province": {
        "alicante provincia",
        "provincia de alicante",
        "provincia alicante",
        "alicante (provincia)",
        "province of alicante",
    },
    "province of alicante": {
        "alicante provincia",
        "provincia de alicante",
        "provincia alicante",
        "alicante (provincia)",
        "alicante province",
    },
    "alicante (spain)": {"alicante", "espana"},
    "alicante spain": {"alicante", "espana"},
    "alicante españa": {"alicante", "espana"},
    "españa": {"espana", "spain"},
    "spain": {"espana"},
    "espana": {"españa", "spain"},
    "sant vicent del raspeig": {"san vicente del raspeig"},
    "san vicente del raspeig": {"sant vicent del raspeig"},
}


MUNICIPALITY_TO_PROVINCE = {
    "alicante": "alicante",
    "alcoy": "alicante",
    "alcoi": "alicante",
    "banyeres de mariola": "alicante",
    "benillup": "alicante",
    "cocentaina": "alicante",
    "penaguila": "alicante",
    "san vicente del raspeig": "alicante",
    "sant vicent del raspeig": "alicante",
}


PROVINCE_ALIASES = {
    "alicante": [
        "alicante provincia",
        "provincia de alicante",
        "provincia alicante",
        "alicante (provincia)",
        "alicante province",
        "province of alicante",
    ]
}


PROVINCE_CHILDREN = {
    "alicante": {
        "alcoy",
        "alcoi",
        "banyeres de mariola",
        "benillup",
        "cocentaina",
        "penaguila",
        "san vicente del raspeig",
        "sant vicent del raspeig",
        "alicante",
    }
}


LOCATION_WILDCARD_TOKENS = {normalize_text(t) for t in ["espana", "españa", "spain"]}


def _build_general_children():
    mapping = {}
    for prov, aliases in PROVINCE_ALIASES.items():
        # Hijos = todos los municipios que cuelgan de la provincia
        children = {
            normalize_text(child) for child in PROVINCE_CHILDREN.get(prov, set())
        }

        # Claves base: alias de provincia + nombre de provincia canónico
        keys = {normalize_text(prov)}
        keys.update({normalize_text(a) for a in aliases})

        # Añadir equivalentes transitivos para cada clave (p.ej. "alicante" <-> "alacant")
        seen = set()
        queue = list(keys)
        while queue:
            k = normalize_text(queue.pop())
            if not k or k in seen:
                continue
            seen.add(k)
            # Registrar la clave actual
            keys.add(k)
            # Expandir equivalentes definidos
            for eq in LOCATION_EQUIVALENTS.get(k, set()):
                ne = normalize_text(eq)
                if ne and ne not in seen:
                    queue.append(ne)

        # Mapear todas las claves recopiladas a los mismos hijos
        for k in keys:
            mapping[k] = children

    return mapping


LOCATION_GENERAL_CHILDREN = _build_general_children()


UNMATCHED_REASON_LABELS = {
    "operation_mismatch": "Operación distinta a la solicitada",
    "location_mismatch": "Sin inmuebles en las ubicaciones solicitadas",
    "price_above_max": "Precio por encima del máximo (con tolerancia)",
    "price_below_min": "Precio por debajo del mínimo (con tolerancia)",
    "rooms_below_min": "Menos habitaciones de las requeridas",
    "baths_below_min": "Menos baños de los requeridos",
    "sin_inventario": "Sin inmuebles disponibles tras filtros",
}


def expand_location_variant(token):
    token = normalize_text(token)
    if not token:
        return []
    token = " ".join(token.split())
    variants = {token}

    # Split on slashes and hyphenated separators
    for pattern in [r"/", r" - ", r" – ", r" — "]:
        parts = [p.strip() for p in re.split(pattern, token) if p.strip()]
        for part in parts:
            variants.add(part)

    queue = list(variants)
    while queue:
        item = queue.pop()
        equivalents = LOCATION_EQUIVALENTS.get(item, set())
        for eq in equivalents:
            if eq not in variants:
                variants.add(eq)
                queue.append(eq)

    return list(dict.fromkeys(variants))


def collect_location_tokens(value):
    parsed = safe_literal_eval(value)
    source = parsed if parsed is not None else value
    seen = set()
    tokens = []

    def add_token(tok):
        tok = normalize_text(tok)
        if tok and tok not in seen:
            seen.add(tok)
            tokens.append(tok)

    base_segments = []
    for raw in iter_string_like(source):
        base = normalize_text(raw)
        if not base:
            continue
        base_segments.append(base)
        cleaned = base.replace("(", ",").replace(")", ",")
        if cleaned != base:
            base_segments.append(cleaned)

    segments = []
    for text in base_segments:
        segments.extend([p.strip() for p in text.split(",") if p.strip()])

    for segment in segments:
        for variant in expand_location_variant(segment):
            add_token(variant)

    municipios = extract_municipios(parsed) if parsed is not None else set()
    for municipio in municipios:
        for variant in expand_location_variant(municipio):
            add_token(variant)

    provinces = set()
    for municipio in municipios:
        prov = MUNICIPALITY_TO_PROVINCE.get(municipio)
        if prov:
            provinces.add(prov)

    for prov in provinces:
        for alias in PROVINCE_ALIASES.get(prov, []):
            for variant in expand_location_variant(alias):
                add_token(variant)

    return tokens


def location_tokens_match(prop_tokens, client_tokens):
    if not client_tokens:
        return True

    prop_set = set()
    for t in prop_tokens or []:
        nt = normalize_text(t)
        if nt:
            prop_set.add(nt)
    if not prop_set:
        return False

    client_set = set()
    for t in client_tokens:
        nt = normalize_text(t)
        if nt:
            client_set.add(nt)
    if not client_set:
        return True

    non_wildcards = client_set - LOCATION_WILDCARD_TOKENS
    if not non_wildcards:
        return True

    if prop_set & non_wildcards:
        return True

    for token in non_wildcards:
        children = LOCATION_GENERAL_CHILDREN.get(token)
        if children and prop_set & children:
            return True

    return False


def evaluate_hard_filters(row_prop, row_cli, cfg):
    reasons = set()

    prop_op = to_str(row_prop.get("operacion"))
    cli_op_str = to_str(row_cli.get("operation"))
    cli_ops = row_cli.get("operation_tokens") or []

    # Operación: si el cliente especifica tokens, exigir pertenencia.
    if prop_op and cli_ops:
        if prop_op not in set(cli_ops):
            reasons.add("operation_mismatch")
    elif prop_op and cli_op_str:
        if prop_op != cli_op_str:
            reasons.add("operation_mismatch")

    if len(row_cli["location_tokens"]) > 0:
        zona_tokens = row_prop.get("zona_tokens") or []
        if not zona_tokens:
            zona_tokens = collect_location_tokens(row_prop.get("zona", ""))
        if not location_tokens_match(zona_tokens, row_cli["location_tokens"]):
            reasons.add("location_mismatch")

    price = row_prop.get("precio")
    pmax = row_cli.get("price_max_eur")
    if price is not None and pmax is not None:
        if price > pmax * cfg["hard_filters"]["price_max_factor"]:
            reasons.add("price_above_max")
    pmin = row_cli.get("price_min_eur")
    if price is not None and pmin is not None:
        if price < pmin * cfg["hard_filters"]["price_min_factor"]:
            reasons.add("price_below_min")

    rmin = row_cli.get("rooms_min")
    if rmin is not None and row_prop.get("habitaciones") is not None:
        if row_prop.get("habitaciones") < max(
            0, rmin - cfg["hard_filters"]["rooms_below_tolerance"]
        ):
            reasons.add("rooms_below_min")

    bmin = row_cli.get("bath_min")
    if bmin is not None and row_prop.get("banos") is not None:
        if row_prop.get("banos") < max(
            0, bmin - cfg["hard_filters"]["baths_below_tolerance"]
        ):
            reasons.add("baths_below_min")

    return len(reasons) == 0, reasons


def collect_preference_tokens(value):
    parsed = safe_literal_eval(value)
    if parsed is None:
        return parse_list_field(value)
    seen = set()
    tokens = []
    for raw in iter_string_like(parsed):
        token = normalize_text(raw)
        if token and token not in seen:
            seen.add(token)
            tokens.append(token)
    return tokens


# ----------------------------
# Normalización de datos
# ----------------------------


def normalize_inmuebles(df):
    rename_map = {
        "habitaciones": "habitaciones",
        "baños": "banos",
        "baños_": "banos",
        "banos": "banos",
        "precio": "precio",
        "link_inmueble": "link_inmueble",
        "metros_cuadrados": "m2",
        "anunciante": "anunciante",
        "zona": "zona",
        "tipo_de_operacion": "operacion",
        "web": "web",
        "tipo": "tipo",
        "tipo_inmueble": "tipo",
    }
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
    for col, default in [
        ("habitaciones", None),
        ("banos", None),
        ("precio", None),
        ("link_inmueble", ""),
        ("m2", None),
        ("anunciante", ""),
        ("zona", ""),
        ("operacion", ""),
        ("web", ""),
        ("tipo", ""),
    ]:
        if col not in df.columns:
            df[col] = default

    df["habitaciones"] = df["habitaciones"].apply(to_int)
    df["banos"] = df["banos"].apply(to_int)
    df["precio"] = df["precio"].apply(to_float)
    df["m2"] = df["m2"].apply(to_float)
    df["zona_norm"] = df["zona"].apply(normalize_text)
    df["zona_tokens"] = df["zona"].apply(collect_location_tokens)
    df["operacion"] = df["operacion"].apply(normalize_text)
    df["tipo"] = df["tipo"].apply(normalize_text)
    df["web"] = df["web"].apply(normalize_text)
    df["anunciante"] = df["anunciante"].apply(normalize_text)
    if "id_inmueble" not in df.columns:
        df["id_inmueble"] = df.apply(
            lambda r: hash((to_str(r.get("link_inmueble")), to_str(r.get("web")))),
            axis=1,
        )
    return df


def normalize_operation_tokens(value):
    tokens = collect_preference_tokens(value)  # admite lista, csv o string
    mapped = []
    for t in tokens:
        t2 = {
            "venta": "venta",
            "sell": "venta",
            "alquiler": "alquiler",
            "rent": "alquiler",
            "alquiler con opcion a compra": "alquiler",
        }.get(t, t)
        if t2:
            mapped.append(t2)
    # deduplicar preservando orden
    seen = set()
    out = []
    for t in mapped:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def normalize_clientes(df):
    rename_map = {
        "id": "id",
        "nombre": "nombre",
        "telefono": "telefono",
        "mail": "mail",
        "fecha_inclusion": "fecha_inclusion",
        "creado_info": "creado_info",
        "operation": "operation",
        "types": "types",
        "conditions": "conditions",
        "rooms_min": "rooms_min",
        "rooms_max": "rooms_max",
        "bath_min": "bath_min",
        "bath_max": "bath_max",
        "living_min": "living_min",
        "living_max": "living_max",
        "area_min_m2": "area_min_m2",
        "area_max_m2": "area_max_m2",
        "price_min_eur": "price_min_eur",
        "price_max_eur": "price_max_eur",
        "locations": "locations",
        "flags": "flags",
        "zona_std": "zona_std",
    }
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})

    for col in [
        "rooms_min",
        "rooms_max",
        "bath_min",
        "bath_max",
        "living_min",
        "living_max",
    ]:
        if col not in df.columns:
            df[col] = None
        df[col] = df[col].apply(to_int)

    for col in ["area_min_m2", "area_max_m2", "price_min_eur", "price_max_eur"]:
        if col not in df.columns:
            df[col] = None
        df[col] = df[col].apply(to_float)

    for col in [
        "operation",
        "types",
        "conditions",
        "locations",
        "flags",
        "zona_std",
        "nombre",
        "telefono",
        "mail",
        "creado_info",
    ]:
        if col not in df.columns:
            df[col] = ""
        df[col] = df[col].apply(normalize_text)

    # Tokens de gating binario
    df["location_tokens"] = df.apply(
        lambda r: (
            collect_location_tokens(r["locations"])
            if to_str(r["locations"])
            else collect_location_tokens(r["zona_std"])
        ),
        axis=1,
    )
    df["type_tokens"] = df["types"].apply(collect_preference_tokens)
    df["cond_tokens"] = df["conditions"].apply(collect_preference_tokens)
    df["flag_tokens"] = df["flags"].apply(collect_preference_tokens)

    # Mantener operation como string normalizada por compatibilidad
    df["operation"] = df["operation"].replace(
        {
            "venta": "venta",
            "sell": "venta",
            "alquiler": "alquiler",
            "rent": "alquiler",
            "alquiler con opcion a compra": "alquiler",
        }
    )
    # Y añadir tokens de operación para soportar múltiples valores
    df["operation_tokens"] = df["operation"].apply(normalize_operation_tokens)

    return df


# ----------------------------
# Scoring
# ----------------------------


def score_binary_equality(a, b):
    if not b:
        return 1.0
    if not a:
        return 0.0
    return 1.0 if a == b else 0.0


def score_range(value, vmin, vmax, softness=0.25):
    """
    Score en [0,1] con:
      - Decaimiento suave fuera del rango.
      - Penalización en bordes.
      - Penalización de “centro” para evitar techo plano en 1.0.
      - Techo < 1 incluso en el mejor caso para reducir saturación.
    """
    v = to_float(value, default=None)
    lo = to_float(vmin, default=None)
    hi = to_float(vmax, default=None)

    if lo is None and hi is None:
        return 1.0
    if v is None:
        return 0.0
    if lo is not None and hi is not None and hi < lo:
        lo, hi = hi, lo

    # Span y padding
    base_span = 1.0
    if lo is not None and hi is not None and hi > lo:
        base_span = hi - lo
    pad = max(to_float(softness, 0.25) * base_span, 1e-9)

    # Fuera del rango
    if lo is not None and v < lo:
        dist = lo - v
        return clamp01(1.0 - dist / pad)
    if hi is not None and v > hi:
        dist = v - hi
        return clamp01(1.0 - dist / pad)

    # Dentro del rango
    # 1) Penalización de borde
    edge_rel = 0.20
    edge_penalty = 0.22  # penaliza más que antes
    if lo is None and hi is not None:
        span = base_span
        dist_edge = hi - v
        band = max(edge_rel * span, 1e-9)
        edge_factor = clamp01(dist_edge / band)  # 0 en borde, 1 fuera del borde
        s_edge = 1.0 - edge_penalty * (1.0 - edge_factor)
    elif hi is None and lo is not None:
        span = base_span
        dist_edge = v - lo
        band = max(edge_rel * span, 1e-9)
        edge_factor = clamp01(dist_edge / band)
        s_edge = 1.0 - edge_penalty * (1.0 - edge_factor)
    else:
        span = max(hi - lo, 1e-9)
        dist_edge = min(v - lo, hi - v)
        band = max(edge_rel * span, 1e-9)
        edge_factor = clamp01(dist_edge / band)
        s_edge = 1.0 - edge_penalty * (1.0 - edge_factor)

    # 2) Penalización de “centro” suave para evitar muchos 1.0 exactos
    #   Si estás lejos del centro, restamos más; si estás cerca, casi nada.
    #   Aun en el mejor caso, techo < 1.
    center_penalty = 0.06  # penalización máxima si lejos del centro
    center_rel = 0.25  # define qué es “cerca” del centro
    if lo is not None and hi is not None:
        center = 0.5 * (lo + hi)
        span = max(hi - lo, 1e-9)
        dist_center = abs(v - center)
        band_center = max(center_rel * span, 1e-9)
        center_factor = clamp01(1.0 - dist_center / band_center)  # 1 en centro, 0 fuera
        s_center = 1.0 - center_penalty * (1.0 - center_factor)
    else:
        # Con una sola cota, medimos centro relativo a esa cota ± base_span
        # Así no se dispara a 1 exacto aunque estés “muy dentro”.
        s_center = 1.0 - 0.5 * center_penalty

    # Combinar penalizaciones multiplicativamente para mantener monotonicidad
    s = clamp01(s_edge * s_center)

    # Techo duro para evitar 1.0 exacto en masa
    s = min(s, 0.995)

    return s


def compute_match_score(row_prop, row_cli, cfg):
    """
    - Usa score_range existente.
    - Pesos efectivos por “informatividad” de la restricción (_constraint_multiplier).
    - Media geométrica ponderada.
    - Cobertura sublineal.
    - Estirado final (gamma) para separar el high end.
    - Caps por componente y tope global para evitar 1.0.
    - Desempate determinista leve.
    """
    weights = cfg["weights"]
    neutral_score = cfg.get("neutral_score", 0.65)
    soft = cfg.get(
        "softness", {"price": 0.15, "area": 0.15, "rooms": 0.35, "baths": 0.35}
    )
    caps = cfg.get(
        "caps",
        {
            "price": 0.975,
            "area": 0.975,
            "rooms": 0.975,
            "baths": 0.975,
            "operation": 0.985,
        },
    )
    hard_cap = float(cfg.get("hard_cap", 0.982))
    coverage_min = to_float(cfg.get("coverage_min", 0.6), 0.6)
    coverage_gamma = to_float(cfg.get("coverage_gamma", 0.7), 0.7)
    score_gamma = to_float(cfg.get("score_gamma", 1.25), 1.25)  # >1 aplana arriba

    # Componentes
    s_price = min(
        score_range(
            row_prop.get("precio"),
            row_cli.get("price_min_eur"),
            row_cli.get("price_max_eur"),
            softness=to_float(soft.get("price"), 0.15),
        ),
        to_float(caps.get("price"), 0.975),
    )
    s_area = min(
        score_range(
            row_prop.get("m2"),
            row_cli.get("area_min_m2"),
            row_cli.get("area_max_m2"),
            softness=to_float(soft.get("area"), 0.15),
        ),
        to_float(caps.get("area"), 0.975),
    )
    s_rooms = min(
        score_range(
            row_prop.get("habitaciones"),
            row_cli.get("rooms_min"),
            row_cli.get("rooms_max"),
            softness=to_float(soft.get("rooms"), 0.35),
        ),
        to_float(caps.get("rooms"), 0.975),
    )
    s_baths = min(
        score_range(
            row_prop.get("banos"),
            row_cli.get("bath_min"),
            row_cli.get("bath_max"),
            softness=to_float(soft.get("baths"), 0.35),
        ),
        to_float(caps.get("baths"), 0.975),
    )

    prop_op = to_str(row_prop.get("operacion"))
    cli_ops = row_cli.get("operation_tokens") or []
    if cli_ops and prop_op:
        s_op_raw = 1.0 if prop_op in set(cli_ops) else 0.0
    else:
        s_op_raw = (
            1.0
            if score_binary_equality(prop_op, row_cli.get("operation")) >= 1.0
            else 0.0
        )
    s_op = min(s_op_raw, to_float(caps.get("operation"), 0.985))

    detail = {
        "price": round(s_price, 4),
        "area": round(s_area, 4),
        "rooms": round(s_rooms, 4),
        "baths": round(s_baths, 4),
        "operation": round(s_op, 4),
    }

    # Pesos efectivos por informatividad de restricción
    w_eff = {
        "price": float(weights.get("price", 0.0))
        * _constraint_multiplier(
            row_cli.get("price_min_eur"), row_cli.get("price_max_eur")
        ),
        "area": float(weights.get("area", 0.0))
        * _constraint_multiplier(
            row_cli.get("area_min_m2"), row_cli.get("area_max_m2")
        ),
        "rooms": float(weights.get("rooms", 0.0))
        * _constraint_multiplier(row_cli.get("rooms_min"), row_cli.get("rooms_max")),
        "baths": float(weights.get("baths", 0.0))
        * _constraint_multiplier(row_cli.get("bath_min"), row_cli.get("bath_max")),
        # operation no depende de rango, mantener
        "operation": float(weights.get("operation", 0.0)),
    }

    components = []
    if (
        (
            row_cli.get("price_min_eur") is not None
            or row_cli.get("price_max_eur") is not None
        )
        and row_prop.get("precio") is not None
        and w_eff["price"] > 0
    ):
        components.append(("price", s_price, w_eff["price"]))
    if (
        (
            row_cli.get("area_min_m2") is not None
            or row_cli.get("area_max_m2") is not None
        )
        and row_prop.get("m2") is not None
        and w_eff["area"] > 0
    ):
        components.append(("area", s_area, w_eff["area"]))
    if (
        (row_cli.get("rooms_min") is not None or row_cli.get("rooms_max") is not None)
        and row_prop.get("habitaciones") is not None
        and w_eff["rooms"] > 0
    ):
        components.append(("rooms", s_rooms, w_eff["rooms"]))
    if (
        (row_cli.get("bath_min") is not None or row_cli.get("bath_max") is not None)
        and row_prop.get("banos") is not None
        and w_eff["baths"] > 0
    ):
        components.append(("baths", s_baths, w_eff["baths"]))
    if (
        prop_op
        and (cli_ops or to_str(row_cli.get("operation")))
        and w_eff["operation"] > 0
    ):
        components.append(("operation", s_op, w_eff["operation"]))

    if not components:
        return round(neutral_score, 6), detail

    wsum = sum(w for _, _, w in components)
    if wsum <= 0:
        return round(neutral_score, 6), detail

    import math as _math

    eps = 1e-6
    log_sum = 0.0
    for _, s, w in components:
        log_sum += (w / wsum) * _math.log(max(eps, clamp01(s)))
    base_score = _math.exp(log_sum)

    # Cobertura sublineal
    possible_keys = ["price", "area", "rooms", "baths", "operation"]
    active_keys = [n for (n, _, _) in components]
    coverage = len(active_keys) / max(
        1, len([k for k in possible_keys if weights.get(k, 0.0) > 0])
    )
    coverage = max(coverage_min, min(1.0, coverage))
    score = base_score * (coverage**coverage_gamma)

    # Estirado final para separar top-end y reducir “meseta”
    score = score**score_gamma

    # Tope global
    score = min(score, hard_cap)

    # Desempate determinista leve
    cid = row_cli.get("id", "")
    pid = row_prop.get("id_inmueble", "")
    try:
        h = hash((cid, pid)) % 1009
        jitter = (h / 1008.0) * 2.0 - 1.0  # [-1, 1]
    except Exception:
        jitter = 0.0
    score += 0.001 * jitter

    return round(clamp01(score), 6), detail


# ----------------------------
# Filtros duros
# ----------------------------


def passes_hard_filters(row_prop, row_cli, cfg):
    ok, _ = evaluate_hard_filters(row_prop, row_cli, cfg)
    return ok


# ----------------------------
# Matching principal
# ----------------------------


def print_scoring_diagnostics(matches, cfg):
    """
    Imprime checks rápidos para validar el sistema de scoring.
    - Resumen de distribución del score.
    - Correlaciones score vs componentes.
    - Verificación de orden por cliente.
    - Ejemplos top y bottom.
    """
    try:
        if matches.empty:
            log("Diagnostics: no matches to analyze.")
            return

        # 1) Pesos y recuentos de componentes disponibles
        comp_cols = ["s_price", "s_area", "s_rooms", "s_baths", "s_operation"]
        weights = cfg.get("weights", {})
        wsum = sum(float(weights.get(k.replace("s_", ""), 0.0)) for k in comp_cols)
        log(
            "Diagnostics | weights: {}".format(
                ", ".join(
                    f"{k}={weights.get(k, 0.0):.3f}"
                    for k in ["price", "area", "rooms", "baths", "operation"]
                )
            )
        )
        log(f"Diagnostics | weights_sum={wsum:.3f}")

        # 2) Resumen de score
        s = matches["score"].astype(float)
        q = s.quantile([0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0]).to_dict()
        log(
            "Diagnostics | score summary: n={} min={:.3f} p10={:.3f} p25={:.3f} p50={:.3f} p75={:.3f} p90={:.3f} max={:.3f}".format(
                s.shape[0], q[0.0], q[0.1], q[0.25], q[0.5], q[0.75], q[0.9], q[1.0]
            )
        )

        # 3) Correlaciones score vs componentes
        corr_lines = []
        for c in comp_cols:
            if c in matches.columns:
                try:
                    corr = matches[[c, "score"]].astype(float).corr().iloc[0, 1]
                except Exception:
                    corr = float("nan")
                corr_lines.append(f"{c}:{corr:.3f}")
        if corr_lines:
            log("Diagnostics | corr(score, components): " + " | ".join(corr_lines))

        # 4) Verificar orden estable por cliente: score desc, empate por s_price desc
        violations = 0
        checked = 0
        for _, g in matches.groupby("client_id", dropna=False):
            if g.shape[0] <= 1:
                continue
            checked += 1
            g2 = g.copy()
            # Esperado: por rank_client si existe, si no por score desc y s_price desc
            if "rank_client" in g2.columns:
                g2 = g2.sort_values("rank_client")
            else:
                g2 = g2.sort_values(["score", "s_price"], ascending=[False, False])
            # Chequeo: no-incremento del score y si empata, no-incremento de s_price
            prev_score = None
            prev_sprice = None
            for _, r in g2.iterrows():
                sc = float(r.get("score", 0.0) or 0.0)
                sp = float(r.get("s_price", 0.0) or 0.0)
                if prev_score is not None:
                    if sc > prev_score + 1e-12:
                        violations += 1
                        break
                    if abs(sc - prev_score) <= 1e-12 and sp > prev_sprice + 1e-12:
                        violations += 1
                        break
                prev_score = sc
                prev_sprice = sp
        log(f"Diagnostics | ordering checks: groups={checked} violations={violations}")

        # 5) Ejemplos top y bottom
        topk = matches.sort_values("score", ascending=False).head(3)
        botk = matches.sort_values("score", ascending=True).head(3)

        def _fmt_row(r):
            return (
                "score={:.3f} | op={} | tipo={} | zona={} | precio={} | area={} | "
                "s: price={:.2f}, area={:.2f}, rooms={:.2f}, baths={:.2f}, op={:.2f}"
            ).format(
                float(r.get("score", 0.0) or 0.0),
                to_str(r.get("operacion")) or "-",
                to_str(r.get("tipo")) or "-",
                to_str(r.get("zona")) or "-",
                format_number(r.get("precio")) if not pd.isna(r.get("precio")) else "-",
                format_number(r.get("m2")) if not pd.isna(r.get("m2")) else "-",
                to_float(r.get("s_price"), 0.0) or 0.0,
                to_float(r.get("s_area"), 0.0) or 0.0,
                to_float(r.get("s_rooms"), 0.0) or 0.0,
                to_float(r.get("s_baths"), 0.0) or 0.0,
                to_float(r.get("s_operation"), 0.0) or 0.0,
            )

        log("Diagnostics | TOP examples:")
        for _, r in topk.iterrows():
            log("  " + _fmt_row(r))
        log("Diagnostics | BOTTOM examples:")
        for _, r in botk.iterrows():
            log("  " + _fmt_row(r))

    except Exception as e:
        log(f"Diagnostics ERROR: {e}")


def rank_for_client(df_props, row_cli, cfg):
    rows = []
    for _, p in df_props.iterrows():
        if not passes_hard_filters(p, row_cli, cfg):
            continue
        score, detail = compute_match_score(p, row_cli, cfg)
        if score < cfg["min_score"]:
            continue

        # Para auditoría: indicadores binarios de match por zona y tipo
        zone_match = None
        type_match = None
        if len(row_cli["location_tokens"]) > 0:
            zone_match = int(
                location_tokens_match(
                    p.get("zona_tokens", []), row_cli["location_tokens"]
                )
            )
        if len(row_cli["type_tokens"]) > 0:
            type_match = int(to_str(p.get("tipo", "")) in set(row_cli["type_tokens"]))

        rows.append(
            {
                "client_id": row_cli.get("id", None),
                "client_name": row_cli.get("nombre", ""),
                "property_id": p.get("id_inmueble", ""),
                "link_inmueble": p.get("link_inmueble", ""),
                "web": p.get("web", ""),
                "anunciante": p.get("anunciante", ""),
                "zona": p.get("zona", ""),
                "operacion": p.get("operacion", ""),
                "tipo": p.get("tipo", ""),
                "habitaciones": p.get("habitaciones", None),
                "banos": p.get("banos", None),
                "m2": p.get("m2", None),
                "precio": p.get("precio", None),
                "score": score,
                "s_price": detail.get("price", 0.0),
                "s_area": detail.get("area", 0.0),
                "s_rooms": detail.get("rooms", 0.0),
                "s_baths": detail.get("baths", 0.0),
                "s_operation": detail.get("operation", 0.0),
                "zone_match": zone_match,
                "type_match": type_match,
            }
        )
    if not rows:
        return pd.DataFrame(
            columns=[
                "client_id",
                "client_name",
                "property_id",
                "link_inmueble",
                "web",
                "anunciante",
                "zona",
                "operacion",
                "tipo",
                "habitaciones",
                "banos",
                "m2",
                "precio",
                "score",
                "s_price",
                "s_area",
                "s_rooms",
                "s_baths",
                "s_operation",
                "zone_match",
                "type_match",
            ]
        )
    out = pd.DataFrame(rows)
    out = out.sort_values(["score", "s_price"], ascending=[False, False])
    if cfg["top_n_per_client"] is not None and cfg["top_n_per_client"] > 0:
        out = out.head(cfg["top_n_per_client"])
    return out


def build_matches_for_all(df_props, df_clients, cfg):
    all_rows = []
    for _, row_cli in df_clients.iterrows():
        ranked = rank_for_client(df_props, row_cli, cfg)
        if ranked.empty:
            continue
        ranked["rank_client"] = range(1, len(ranked) + 1)
        all_rows.append(ranked)
    if not all_rows:
        return pd.DataFrame(
            columns=[
                "client_id",
                "client_name",
                "rank_client",
                "property_id",
                "link_inmueble",
                "web",
                "anunciante",
                "zona",
                "operacion",
                "tipo",
                "habitaciones",
                "banos",
                "m2",
                "precio",
                "score",
                "s_price",
                "s_area",
                "s_rooms",
                "s_baths",
                "s_operation",
                "zone_match",
                "type_match",
            ]
        )
    res = pd.concat(all_rows, ignore_index=True)
    return res


def log_client_requirements(row_cli):
    if row_cli is None:
        log("  Requisitos: datos de cliente no disponibles.")
        return

    op = to_str(row_cli.get("operation")) or "-"
    price_txt = format_range(
        row_cli.get("price_min_eur"), row_cli.get("price_max_eur"), " EUR"
    )
    area_txt = format_range(
        row_cli.get("area_min_m2"), row_cli.get("area_max_m2"), " m2"
    )
    rooms_txt = format_range(row_cli.get("rooms_min"), row_cli.get("rooms_max"))
    baths_txt = format_range(row_cli.get("bath_min"), row_cli.get("bath_max"))

    log(
        "  Requisitos: op={} | precio={} | area={} | hab={} | banos={}".format(
            op or "-", price_txt, area_txt, rooms_txt, baths_txt
        )
    )

    loc_tokens = format_token_list(row_cli.get("location_tokens", []))
    type_tokens = format_token_list(row_cli.get("type_tokens", []))
    cond_tokens = format_token_list(row_cli.get("cond_tokens", []))

    log(
        "  Tokens: zonas={} | tipos={} | condiciones={}".format(
            loc_tokens, type_tokens, cond_tokens
        )
    )


def debug_print_matches(matches, df_clients, cfg):
    if matches.empty:
        log("No hay coincidencias para detallar.")
        return

    log("Detalle de mejores coincidencias por cliente:")

    clients_by_id = {}
    if "id" in df_clients.columns:
        clients_by_id = {row.get("id"): row for _, row in df_clients.iterrows()}

    limit = cfg.get("top_n_per_client") or None

    for client_id, group in matches.groupby("client_id", dropna=False):
        if pd.isna(client_id):
            continue
        name = to_str(group.iloc[0].get("client_name", "")) or "(sin nombre)"
        log(f"Cliente {client_id} - {name}")

        row_cli = clients_by_id.get(client_id)
        log_client_requirements(row_cli)

        ordered = group
        if "rank_client" in ordered.columns:
            ordered = ordered.sort_values("rank_client")
        else:
            ordered = ordered.sort_values("score", ascending=False)

        if limit is not None:
            ordered = ordered.head(limit)

        for _, row in ordered.iterrows():
            rank_val = row.get("rank_client")
            rank_txt = "-"
            if rank_val is not None and not (
                isinstance(rank_val, float) and math.isnan(rank_val)
            ):
                rank_txt = str(int(rank_val))

            score_val = to_float(row.get("score"), 0.0) or 0.0
            precio_txt = format_number(row.get("precio"))
            if precio_txt != "-":
                precio_txt += " EUR"
            area_txt = format_number(row.get("m2"))
            if area_txt != "-":
                area_txt += " m2"
            rooms_txt = row.get("habitaciones")
            rooms_txt = str(to_int(rooms_txt)) if to_int(rooms_txt) is not None else "-"
            baths_txt = row.get("banos")
            baths_txt = str(to_int(baths_txt)) if to_int(baths_txt) is not None else "-"
            zona_txt = to_str(row.get("zona")) or "-"
            tipo_txt = to_str(row.get("tipo")) or "-"
            op_txt = to_str(row.get("operacion")) or "-"
            web_txt = to_str(row.get("web")) or "-"

            log(
                "    #{} score={:.3f} | {} | {} | hab={} | banos={} | zona={} | web={}".format(
                    rank_txt,
                    score_val,
                    op_txt,
                    f"tipo={tipo_txt}",
                    rooms_txt,
                    baths_txt,
                    zona_txt,
                    web_txt,
                )
            )

            log(
                "        precio={} | area={} | componentes: price={:.2f}, area={:.2f}, rooms={:.2f}, baths={:.2f}, op={:.2f}".format(
                    precio_txt,
                    area_txt,
                    to_float(row.get("s_price"), 0.0) or 0.0,
                    to_float(row.get("s_area"), 0.0) or 0.0,
                    to_float(row.get("s_rooms"), 0.0) or 0.0,
                    to_float(row.get("s_baths"), 0.0) or 0.0,
                    to_float(row.get("s_operation"), 0.0) or 0.0,
                )
            )

            link = to_str(row.get("link_inmueble"))
            anunciante = to_str(row.get("anunciante")) or "-"
            if link or anunciante:
                log(f"        link={link or '-'} | anunciante={anunciante}")

        log("  ---")


def _constraint_multiplier(vmin, vmax):
    """
    Devuelve multiplicador en [0.4, 1.0] según cuánta información aporta la restricción:
      - Sin límites -> 0.4
      - Un solo límite -> 0.5
      - Dos límites: más estrecho => más cerca de 1.0; ancho => ~0.5
    Cálculo robusto con anchura relativa al centro para evitar efectos por escala.
    """
    lo = to_float(vmin, None)
    hi = to_float(vmax, None)

    if lo is None and hi is None:
        return 0.4
    if lo is None or hi is None:
        return 0.5
    if hi < lo:
        lo, hi = hi, lo

    span = max(hi - lo, 0.0)
    center = 0.5 * (hi + lo)
    # anchura relativa al centro; si centro≈0, usa 1.0 como escala
    denom = max(1.0, abs(center))
    rel = clamp01(span / denom)  # 0 muy estrecho, 1 muy ancho
    # 0.5 cuando rel=1 (muy ancho), 1.0 cuando rel=0 (muy estrecho)
    return 1.0 - 0.5 * rel


def summarize_unmatched_clients(df_props, df_clients, matches, cfg):
    matched_ids = set()
    if not matches.empty and "client_id" in matches.columns:
        matched_ids = set(matches["client_id"].dropna())

    total_clients = len(df_clients)
    unmatched_total = total_clients - len(matched_ids)
    if unmatched_total <= 0:
        log("Todos los clientes tienen al menos un match.")
        return {}

    reason_to_clients = {}
    best_candidates = {}

    for _, cli in df_clients.iterrows():
        cid = cli.get("id")
        if cid in matched_ids:
            continue

        reasons_accum = set()
        had_candidate = False
        hit_threshold = False

        best_ok = None
        best_ok_score = -1.0
        best_any = None
        best_any_score = -1.0

        for _, prop in df_props.iterrows():
            ok, reasons = evaluate_hard_filters(prop, cli, cfg)
            score, detail = compute_match_score(prop, cli, cfg)

            if isinstance(detail, dict):
                detail_copy = detail.copy()
            elif detail is None:
                detail_copy = {}
            else:
                detail_copy = dict(detail)
            candidate_info = {
                "prop": prop.to_dict(),
                "score": score,
                "detail": detail_copy,
                "passes_filters": ok,
                "reasons": set(reasons),
            }

            if ok and score > best_ok_score:
                best_ok = candidate_info
                best_ok_score = score

            if score > best_any_score:
                best_any = candidate_info
                best_any_score = score

            if ok:
                had_candidate = True
                if score >= cfg["min_score"]:
                    hit_threshold = True
                    break
            else:
                reasons_accum.update(reasons)

        if hit_threshold:
            continue

        if had_candidate:
            reasons_accum = {"score_below_threshold"}
        elif not reasons_accum:
            reasons_accum = {"sin_inventario"}

        chosen = None
        source = None
        if best_ok is not None:
            chosen = best_ok
            source = "passes_filters"
        elif best_any is not None:
            chosen = best_any
            source = "best_overall"
        if chosen is not None:
            best_candidates[cid] = {
                "client_name": cli.get("nombre", ""),
                "passes_filters": chosen.get("passes_filters", False),
                "score": chosen.get("score", 0.0),
                "detail": chosen.get("detail", {}),
                "reasons": chosen.get("reasons", set()),
                "prop": chosen.get("prop", {}),
                "client_row": cli.to_dict(),
                "candidate_source": source,
            }

        for reason in reasons_accum:
            reason_to_clients.setdefault(reason, set()).add(cid)

    if not reason_to_clients:
        log("No se encontraron razones para clientes sin match.")
    else:
        log("Clientes sin match - desglose:")
        for reason, clients_set in sorted(
            reason_to_clients.items(), key=lambda item: len(item[1]), reverse=True
        ):
            label = UNMATCHED_REASON_LABELS.get(reason, reason)
            if reason == "score_below_threshold":
                label = f"Coincidencias con score < {cfg['min_score']}"
            pct = len(clients_set) / unmatched_total * 100 if unmatched_total else 0.0
            log(f"  {label}: {len(clients_set)} clientes ({pct:.1f}%)")

    if best_candidates:
        log("Top candidato por cliente sin match (para debug):")
        for cid, info in sorted(
            best_candidates.items(), key=lambda item: item[1]["score"], reverse=True
        ):
            name = to_str(info.get("client_name", "")) or "(sin nombre)"
            score_val = to_float(info.get("score"), 0.0) or 0.0
            passes = info.get("passes_filters", False)
            prop = info.get("prop", {}) or {}
            source = info.get("candidate_source", "best_overall")

            precio_txt = format_number(prop.get("precio"))
            if precio_txt != "-":
                precio_txt += " EUR"
            area_txt = format_number(prop.get("m2"))
            if area_txt != "-":
                area_txt += " m2"
            rooms_txt = to_int(prop.get("habitaciones"))
            rooms_txt = str(rooms_txt) if rooms_txt is not None else "-"
            baths_txt = to_int(prop.get("banos"))
            baths_txt = str(baths_txt) if baths_txt is not None else "-"
            zona_txt = to_str(prop.get("zona")) or "-"
            tipo_txt = to_str(prop.get("tipo")) or "-"
            op_txt = to_str(prop.get("operacion")) or "-"
            prop_id = to_str(prop.get("id_inmueble")) or "-"
            web_txt = to_str(prop.get("web")) or "-"
            log("  ---")
            log(
                f"  Cliente {cid} - {name}: score={score_val:.3f} | pasa_filtros={'SI' if passes else 'NO'} | origen={source}"
            )
            log_client_requirements(info.get("client_row"))
            log(
                "    Inmueble {} | op={} | tipo={} | zona={} | precio={} | area={} | hab={} | banos={} | web={}".format(
                    prop_id,
                    op_txt,
                    tipo_txt,
                    zona_txt,
                    precio_txt,
                    area_txt,
                    rooms_txt,
                    baths_txt,
                    web_txt,
                )
            )

            detail = info.get("detail", {}) or {}
            log(
                "    Componentes: price={:.2f}, area={:.2f}, rooms={:.2f}, baths={:.2f}, op={:.2f}".format(
                    to_float(detail.get("price"), 0.0) or 0.0,
                    to_float(detail.get("area"), 0.0) or 0.0,
                    to_float(detail.get("rooms"), 0.0) or 0.0,
                    to_float(detail.get("baths"), 0.0) or 0.0,
                    to_float(detail.get("operation"), 0.0) or 0.0,
                )
            )

            if not passes:
                reasons = info.get("reasons", set()) or set()
                if reasons:
                    labels = [
                        UNMATCHED_REASON_LABELS.get(r, r) for r in sorted(reasons)
                    ]
                    log(f"    Filtrado por: {', '.join(labels)}")
                else:
                    log("    Filtrado por: -")

    # Devuelve el diccionario para que el caller pueda persistirlo
    return best_candidates


# ----------------------------
# Carga de CSV
# ----------------------------


def load_csv(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    try:
        for enc in ["utf-8-sig", "utf-8", "latin-1"]:
            try:
                return pd.read_csv(path, encoding=enc)
            except UnicodeDecodeError:
                continue
        return pd.read_csv(path)
    except Exception as e:
        raise RuntimeError(f"Failed to read CSV: {path}. Error: {e}")


# ----------------------------
# Main sin CLI. Config por variables.
# ----------------------------


def main():
    # ====== CONFIGURACIÓN EDITABLE ======
    inmuebles_csv = "inmuebles_unificado.csv"
    clientes_csv = "Scrappers/Ego/Data/contacts_today_parsed.csv"
    out_csv = "matches.csv"
    unmatched_top_csv = "matches_unmatched_top.csv"

    top_n = 50
    min_score = 0.55
    neutral_score = 0.7

    hard_filters = {
        "price_max_factor": 1.25,
        "price_min_factor": 0.25,
        "rooms_below_tolerance": 1,
        "baths_below_tolerance": 1,
    }

    weights = {
        "price": 0.35,
        "area": 0.30,
        "rooms": 0.20,
        "baths": 0.10,
        "operation": 0.05,
    }
    # ====== FIN CONFIG ======

    cfg = {
        "top_n_per_client": top_n,
        "min_score": min_score,
        "neutral_score": neutral_score,
        "weights": weights,
        "hard_filters": hard_filters,
    }

    try:
        log("Loading CSVs")
        df_props_raw = load_csv(inmuebles_csv)
        df_cli_raw = load_csv(clientes_csv)
        log(f"Inmuebles: {len(df_props_raw)} filas. Clientes: {len(df_cli_raw)} filas.")
    except Exception as e:
        log(f"ERROR: {e}")
        sys.exit(1)

    try:
        df_props = normalize_inmuebles(df_props_raw)
        df_cli = normalize_clientes(df_cli_raw)
        log("Normalized datasets")
    except Exception as e:
        log(f"ERROR normalizing data: {e}")
        sys.exit(1)

    try:
        matches = build_matches_for_all(df_props, df_cli, cfg)
        log(f"Matches found: {len(matches)}")
    except Exception as e:
        log(f"ERROR building matches: {e}")
        sys.exit(1)

    try:
        if not matches.empty:
            matches = matches.sort_values(
                ["client_id", "score"], ascending=[True, False]
            )
            debug_print_matches(matches, df_cli, cfg)
            matches.to_csv(
                out_csv, index=False, quoting=csv.QUOTE_MINIMAL, encoding="utf-8"
            )
            summary = (
                matches.groupby(["client_id", "client_name"])["property_id"]
                .count()
                .reset_index(name="candidates")
            )
            log("Summary:")
            for _, r in summary.iterrows():
                log(
                    f"Client {r['client_id']} - {r['client_name']}: {r['candidates']} candidates"
                )
            matched_clients = summary["client_id"].nunique()
            total_clients = len(df_cli)
            match_pct = (
                (matched_clients / total_clients * 100.0) if total_clients else 0.0
            )
            log(
                f"Clients with matches: {matched_clients}/{total_clients} ({match_pct:.1f}%)"
            )
            log(f"Saved: {out_csv}")
        else:
            log("No matches above threshold. No file written.")

        unmatched_best = summarize_unmatched_clients(df_props, df_cli, matches, cfg)

        if unmatched_best:
            rows = []
            for cid, info in unmatched_best.items():
                detail = info.get("detail", {}) or {}
                prop = info.get("prop", {}) or {}
                reasons = info.get("reasons", set()) or set()
                reason_codes = sorted(reasons)
                reason_labels = [
                    UNMATCHED_REASON_LABELS.get(r, r) for r in reason_codes
                ]

                client_row = info.get("client_row") or {}

                rows.append(
                    {
                        "client_id": cid,
                        "client_name": to_str(info.get("client_name", "")),
                        "candidate_source": info.get(
                            "candidate_source", "best_overall"
                        ),
                        "passes_filters": bool(info.get("passes_filters", False)),
                        "score": to_float(info.get("score"), 0.0) or 0.0,
                        "s_price": to_float(detail.get("price"), 0.0) or 0.0,
                        "s_area": to_float(detail.get("area"), 0.0) or 0.0,
                        "s_rooms": to_float(detail.get("rooms"), 0.0) or 0.0,
                        "s_baths": to_float(detail.get("baths"), 0.0) or 0.0,
                        "s_operation": to_float(detail.get("operation"), 0.0) or 0.0,
                        "prop_id": prop.get("id_inmueble"),
                        "prop_link": prop.get("link_inmueble"),
                        "prop_web": prop.get("web"),
                        "prop_anunciante": prop.get("anunciante"),
                        "prop_operacion": prop.get("operacion"),
                        "prop_tipo": prop.get("tipo"),
                        "prop_zona": prop.get("zona"),
                        "prop_precio": to_float(prop.get("precio")),
                        "prop_m2": to_float(prop.get("m2")),
                        "prop_habitaciones": to_int(prop.get("habitaciones")),
                        "prop_banos": to_int(prop.get("banos")),
                        "prop_zona_tokens": format_token_list(
                            prop.get("zona_tokens", [])
                        ),
                        "prop_flag_tokens": format_token_list(
                            prop.get("flag_tokens", [])
                        ),
                        "filter_reasons": ",".join(reason_codes),
                        "filter_reason_labels": "; ".join(reason_labels),
                        "client_operation": to_str(client_row.get("operation")),
                        "client_price_min_eur": to_float(
                            client_row.get("price_min_eur")
                        ),
                        "client_price_max_eur": to_float(
                            client_row.get("price_max_eur")
                        ),
                        "client_area_min_m2": to_float(client_row.get("area_min_m2")),
                        "client_area_max_m2": to_float(client_row.get("area_max_m2")),
                        "client_rooms_min": to_int(client_row.get("rooms_min")),
                        "client_rooms_max": to_int(client_row.get("rooms_max")),
                        "client_bath_min": to_int(client_row.get("bath_min")),
                        "client_bath_max": to_int(client_row.get("bath_max")),
                        "client_location_tokens": format_token_list(
                            client_row.get("location_tokens", [])
                        ),
                        "client_type_tokens": format_token_list(
                            client_row.get("type_tokens", [])
                        ),
                        "client_cond_tokens": format_token_list(
                            client_row.get("cond_tokens", [])
                        ),
                    }
                )

            df_unmatched = pd.DataFrame(rows)
            df_unmatched.to_csv(
                unmatched_top_csv,
                index=False,
                quoting=csv.QUOTE_MINIMAL,
                encoding="utf-8",
            )
            log(
                f"Saved unmatched top candidates: {unmatched_top_csv} ({len(df_unmatched)} filas)"
            )
        else:
            log("No unmatched candidates to save.")

        # ===== Diagnostics de scoring al final =====
        print_scoring_diagnostics(matches, cfg)

    except Exception as e:
        log(f"ERROR writing output: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
