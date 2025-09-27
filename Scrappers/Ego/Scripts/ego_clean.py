#!/usr/bin/env python
# coding: utf-8

# In[1]:


import pandas as pd
import re
import os


def clean_and_split(file_path):
    """
    Lee un CSV/Excel, limpia 'pref_text', detecta cadenas intercaladas '... en o en o en ...'
    con más de 3 'o', y MUESTRA los textos originales (no los arrays) únicos tras filtrar.

    Reglas de limpieza:
      - Elimina bloques <span>...</span>
      - Elimina comas
      - Elimina ítems que contengan '<' o '>'
      - Split por espacios

    Devuelve:
      - df: DataFrame con columna 'pref_text_cleaned' (listas)
      - filtered_texts: lista de textos originales únicos que superan el filtro
    """

    # Detectar extensión
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()

    if ext == ".csv":
        df = pd.read_csv(file_path)
    elif ext in [".xls", ".xlsx"]:
        df = pd.read_excel(file_path)
    else:
        raise ValueError("Unsupported file format. Use CSV or Excel.")

    if "pref_text" not in df.columns:
        raise ValueError("Column 'pref_text' not found in file.")

    def remove_span_and_split(text):
        if pd.isna(text):
            return []
        s = str(text)
        # Quitar contenido entre <span>...</span>
        s = re.sub(r"<span.*?>.*?</span>", "", s, flags=re.DOTALL)
        # Eliminar comas
        s = s.replace(",", "")
        # Tokenizar por espacios
        items = s.strip().split()
        # Eliminar tokens que contengan < o >
        items = [w for w in items if "<" not in w and ">" not in w]
        return items

    def has_interleaved_o_chain(arr, o_word="o", en_word="en", max_o_allowed=3):
        """
        Detecta patrones intercalados ... en o en o en ...
        Cuenta solo las 'o' dentro de una misma cadena intercalada.
        True si hay más de max_o_allowed 'o'.
        """
        expect = "o"
        o_count = 0
        for token in (t.lower() for t in arr):
            if expect == "o":
                if token == o_word:
                    o_count += 1
                    if o_count > max_o_allowed:
                        return True
                    expect = "en"
                elif token == en_word:
                    expect = "o"
                    o_count = 0
                else:
                    expect = "o"
                    o_count = 0
            else:  # expect == "en"
                if token == en_word:
                    expect = "o"
                elif token == o_word:
                    # Ruptura, esta 'o' puede iniciar nueva cadena
                    o_count = 1
                    if o_count > max_o_allowed:
                        return True
                    expect = "en"
                else:
                    expect = "o"
                    o_count = 0
        return False

    # Limpieza
    df["pref_text_cleaned"] = df["pref_text"].apply(remove_span_and_split)

    # Para poder hacer drop_duplicates sin error, usar una versión hashable del array
    df["pref_text_cleaned_tuple"] = df["pref_text_cleaned"].apply(tuple)

    # Mantener una fila por ARRAY limpio único (primer texto original visto)
    df_unique = df.drop_duplicates(subset=["pref_text_cleaned_tuple"]).copy()

    # Filtrar por la regla de cadenas intercaladas
    mask_ok = ~df_unique["pref_text_cleaned"].apply(has_interleaved_o_chain)
    filtered_texts = df_unique.loc[mask_ok, "pref_text"].tolist()

    # Mostrar textos originales únicos filtrados
    print("Unique original texts filtered:")
    for txt in filtered_texts:
        print(txt)

    # Limpieza de columnas auxiliares si no se quieren en df final
    df.drop(columns=["pref_text_cleaned_tuple"], inplace=True)

    return df, filtered_texts


# Ejemplo de uso:
# df, filtered_texts = clean_and_split("/ruta/al/archivo.csv")


# Ejemplo de uso:

df, unique_arrays = clean_and_split(
    "/Users/emin/InmobiliariaJBC/Scrappers/Ego/Data/contacts_today.csv"
)


# In[ ]:


import re
import os
import unicodedata
import pandas as pd
from bs4 import BeautifulSoup


def _norm_spaces(s):
    return re.sub(r"\s+", " ", s).strip()


def _strip_accents(s):
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def _normalize_term(t):
    if t is None:
        return None
    x = _norm_spaces(str(t)).lower()
    x = _strip_accents(x)
    x = re.sub(r"\s*/\s*", "/", x)
    x = re.sub(r"\s+", " ", x).strip()
    return x


def _strip_html_keep_spans(raw):
    if pd.isna(raw):
        return "", []
    s = str(raw)
    soup = BeautifulSoup(s, "html.parser")
    spans = [t.get_text(" ", strip=True) for t in soup.find_all("span")]
    text = soup.get_text(" ", strip=True)
    return text, spans


def _looks_like_operation(term_norm):
    return bool(re.search(r"\b(venta|alquiler)\b", term_norm))


def _looks_like_numeric_or_unit(term_norm):
    return bool(re.search(r"\d|m2|m²|€|eur", term_norm))


def _looks_like_quantity_label(term_norm):
    return bool(
        re.search(
            r"\b(habitaci(?:o|ó)n(?:es)?|ba(?:n|ñ)o(?:s)?|sal[oó]n(?:es)?)\b", term_norm
        )
    )


def _looks_like_condition(term_norm):
    if term_norm.startswith("a ") or term_norm.startswith("en "):
        return True
    return " " not in term_norm and bool(
        re.search(r"(ado|ada|ados|adas|ido|ida|idos|idas)\b", term_norm)
    )


def _to_singular_es(term):
    t = term.strip()
    if " " in t:  # no tocar compuestos
        return t
    n = _normalize_term(t)
    if n.endswith("ses"):  # p.ej. “clases”->“clase”
        return t[:-2]
    if n.endswith("es"):
        return t[:-2]
    if n.endswith("s"):
        return t[:-1]
    return t


def _split_locations_fragment(frag: str) -> list:
    """
    'Santa Rosa , Alcoy / Alcoi' -> ['Santa Rosa','Alcoy / Alcoi']
    'Centre - Zona Alta Alcoy / Alcoi' -> ['Centre - Zona Alta','Alcoy / Alcoi']
    Tolera comas raras y espacios.
    """
    s = str(frag)

    # 1) dividir primero por comas (ASCII o CJK)
    parts = re.split(r"\s*[,，]\s*", s)
    out = []
    for p in parts:
        t = _clean_loc_token(p)
        if t:
            out.append(t)

    # 2) fallback: si quedó solo un token y contiene un bloque con "/", separa por el ÚLTIMO bloque "Provincia / Provincia"
    if len(out) == 1:
        tok = out[0]
        # buscar el último bloque con "/"
        slash_pat = re.compile(
            r"[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ\s\-]*\/\s*[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ\s\-]*$"
        )
        m = slash_pat.search(tok)
        if m:
            # derecha = el bloque con "/"; izquierda = todo lo anterior, limpiado
            right = _clean_loc_token(m.group(0))
            left = _clean_loc_token(tok[: m.start()])
            out = [left, right] if left else [right]

    return out


import re


import re, unicodedata

# --- helpers nuevos/ajustados ---


def _is_todos(x):
    return _normalize_term(x) == "todos los inmuebles"


def _strip_todos_parenthetical(s):
    """
    Elimina una cola '(Todos los inmuebles)' si existe.
    """
    s = str(s)
    m = re.search(r"\(([^)]*)\)\s*$", s)
    if m and _normalize_term(m.group(1)) == "todos los inmuebles":
        return s[: m.start()].rstrip()
    return s


_SLASH_TAIL_RE = re.compile(
    r"[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ\s\-]*\/\s*[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ\s\-]*\s*$"
)


def _clean_loc_token(tok):
    t = unicodedata.normalize("NFKC", str(tok))
    t = re.sub(r"\b(o|y)\s*$", "", t, flags=re.I)
    t = t.strip(" ,")
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _split_locations_fragment(frag):
    """
    Divide un fragmento en posibles ['Barrio','Ciudad / Prov'].
    - Con coma: ['Barrio , Ciudad / Prov'] -> ['Barrio','Ciudad / Prov']
    - Sin coma: 'Barrio Ciudad / Prov'     -> ['Barrio','Ciudad / Prov'] si detecta cola X / Y
    """
    s = unicodedata.normalize("NFKC", str(frag))
    s = _strip_todos_parenthetical(_clean_loc_token(s))
    if not s:
        return []

    parts = [
        _clean_loc_token(p) for p in re.split(r"\s*[,，]\s*", s) if _clean_loc_token(p)
    ]
    if len(parts) >= 2:
        left = _clean_loc_token(" ".join(parts[:-1]))
        right = _clean_loc_token(parts[-1])
        out = []
        if left:
            out.append(left)
        if right:
            out.append(right)
        return out

    tok = parts[0] if parts else s
    m = _SLASH_TAIL_RE.search(tok)
    if m and m.start() > 0:
        left = _clean_loc_token(tok[: m.start()])
        right = _clean_loc_token(m.group(0))
        out = []
        if left:
            out.append(left)
        if right:
            out.append(right)
        return out

    return [tok]


def _explode_tail_city_pair(tokens):
    """
    Para tokens residuales 'Barrio Ciudad / Prov' sin coma, separa en dos.
    """
    out = []
    for tok in tokens:
        m = _SLASH_TAIL_RE.search(tok)
        if m and m.start() > 0:
            left = _clean_loc_token(tok[: m.start()])
            right = _clean_loc_token(m.group(0))
            if left:
                out.append(left)
            if right:
                out.append(right)
        else:
            out.append(tok)
    return out


def _suppress_subterms(types_list):
    """
    Elimina tipos que son subcadenas de otros tipos MÁS largos, con comparación
    insensible a mayúsculas/acentos y en singular.
    Ejemplos deseados:
      - ['Bloque de apartamentos','Apartamento'] -> drop 'Apartamento'
      - ['Casa de montaña','Casa'] -> drop 'Casa'
    No divide etiquetas con '/', y NO elimina el largo.
    """
    if not types_list:
        return types_list

    def _norm_noacc_spaces(s: str) -> str:
        # normaliza espacios y acentos, lower
        s2 = _normalize_term(s)  # ya quita espacios extra y acentos
        # singularizar por palabra para robustez
        tokens = [_to_singular_es(tok) for tok in s2.split()]
        return " ".join(tokens)

    keep = list(types_list)
    keep_sorted = sorted(
        keep, key=lambda x: len(_norm_noacc_spaces(x)), reverse=True
    )  # largos primero
    drop = set()

    for i, t_long in enumerate(keep_sorted):
        if t_long in drop:
            continue
        nlong = _norm_noacc_spaces(t_long)

        # construir patrón de palabras completas
        for t_short in keep_sorted[i + 1 :]:
            if t_short in drop:
                continue
            nshort = _norm_noacc_spaces(t_short)
            if not nshort or nshort == nlong:
                continue
            # si el corto aparece como palabra completa dentro del largo -> descartar corto
            # ejemplo: 'bloque de apartamento' contiene \bapartamento\b
            if re.search(rf"\b{re.escape(nshort)}\b", nlong):
                drop.add(t_short)

    return [t for t in keep if t not in drop]


def _has_numeric_quantity_context(text):
    """
    Devuelve True si el texto contiene cantidades explícitas para
    habitaciones/baños/salones (con, desde, entre, de...a, hasta).
    """
    t = _norm_spaces(str(text))
    pats = [
        r"\b(\d+)\s*habitaci(?:o|ó)n(?:es)?\b",
        r"\bentre\s*\d+\s*habitaci(?:o|ó)n(?:es)?\s*a\s*\d+\b",
        r"\bde\s*\d+\s*habitaci(?:o|ó)n(?:es)?\s*a\s*\d+\b",
        r"\bhasta\s*\d+\s*habitaci(?:o|ó)n(?:es)?\b",
        r"\bdesde\s*\d+\s*habitaci(?:o|ó)n(?:es)?\b",
        r"\b(\d+)\s*ba(?:n|ñ)o(?:s)?\b",
        r"\bentre\s*\d+\s*ba(?:n|ñ)o(?:s)?\s*a\s*\d+\b",
        r"\bde\s*\d+\s*ba(?:n|ñ)o(?:s)?\s*a\s*\d+\b",
        r"\b(\d+)\s*sal[oó]n(?:es)?\b",
        r"\bentre\s*\d+\s*sal[oó]n(?:es)?\s*a\s*\d+\b",
        r"\bde\s*\d+\s*sal[oó]n(?:es)?\s*a\s*\d+\b",
    ]
    return any(re.search(p, t, flags=re.I) for p in pats)


def build_vocab_from_file(file_path, col="pref_text"):
    """
    Decide TYPE vs LOCATION por contexto:
      - TYPE si aparece más en 'Busca ... para' que en fragmentos 'en ...'
      - CONDITION por regla de _looks_like_condition
    Normaliza y singulariza tipos. No divide por '/'.
    Regla: capitaliza cualquier type cuyo primer carácter sea minúscula.

    Cambio: permite 'Habitación/Habitaciones' como TYPE cuando aparece en 'Busca ...'
    sin contexto numérico; si hay números, se trata como cantidad y se descarta del vocab.
    """
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()
    if ext == ".csv":
        df = pd.read_csv(file_path)
    elif ext in [".xls", ".xlsx"]:
        df = pd.read_excel(file_path)
    else:
        raise ValueError("Unsupported file format. Use CSV or Excel.")
    if col not in df.columns:
        raise ValueError(f"Column '{col}' not found.")

    cnt_busca = {}
    cnt_loc = {}
    raw_map = {}
    conds = {}

    for raw in df[col].dropna():
        full_text, spans = _strip_html_keep_spans(raw)
        full_text_n = _norm_spaces(full_text)

        # segmento "Busca ... para"
        seg_busca = None
        m = re.search(r"\bBusca\b(.*?)(?:\bpara\b|$)", full_text_n, re.I)
        if m:
            seg_busca = _norm_spaces(m.group(1))

        # fragmentos "en ..."
        segs_en = []
        for seg in re.split(r"\ben\b", full_text_n, flags=re.I)[1:]:
            frag = re.split(
                r"\bo\s+en\b|,|\.|\bpara\b|\bcon\b|\bhasta\b|\bentre\b|\bdesde\b",
                seg,
                maxsplit=1,
                flags=re.I,
            )[0]
            frag = _norm_spaces(frag)
            if frag:
                segs_en.append(frag)

        numeric_qty_ctx = _has_numeric_quantity_context(full_text_n)

        for sp in spans:
            # NO dividir por '/', tratar el span completo como una etiqueta
            part = _norm_spaces((sp or "").replace(",", " "))
            p_norm = _normalize_term(part)
            if not p_norm:
                continue

            # ¿aparece este token en 'Busca ...' o en 'en ...'?
            in_busca = bool(
                seg_busca and re.search(rf"\b{re.escape(part)}\b", seg_busca, re.I)
            )
            in_loc = any(
                re.search(rf"\b{re.escape(part)}\b", se, re.I) for se in segs_en
            )

            # descartar operaciones, números/unidades
            if _looks_like_operation(p_norm) or _looks_like_numeric_or_unit(p_norm):
                continue

            # cantidad: SOLO descartar si hay contexto numérico; si está en 'Busca ...' sin números, dejarlo pasar
            if _looks_like_quantity_label(p_norm):
                if numeric_qty_ctx:
                    continue
                # si no hay contexto numérico, tratar como tipo solo si está en la sección de tipos
                if not in_busca:
                    continue

            # condición
            if _looks_like_condition(p_norm):
                conds[p_norm] = part
                continue

            # conteo por contexto para el resto
            if in_busca:
                cnt_busca[p_norm] = cnt_busca.get(p_norm, 0) + 1
            if in_loc:
                cnt_loc[p_norm] = cnt_loc.get(p_norm, 0) + 1
            raw_map.setdefault(p_norm, part)

    # decisión de tipo + singularización
    types = []
    for k, v in raw_map.items():
        cb = cnt_busca.get(k, 0)
        cl = cnt_loc.get(k, 0)
        if cb > 0 and cb >= cl:
            types.append(_to_singular_es(v))

    # capitalizar cualquier type cuyo primer carácter sea minúscula
    def _cap_first(s):
        s2 = str(s).lstrip()
        if not s2:
            return s
        return (s2[0].upper() + s2[1:]) if s2[0].islower() else s

    types = [_cap_first(t) for t in types]

    # condiciones finales depuradas
    conditions = []
    for k in sorted(conds.keys()):
        txt = conds[k]
        kn = _normalize_term(txt)
        if kn.startswith("a ") or kn.startswith("en ") or (" " not in kn):
            conditions.append(txt)

    # dedupe y orden estable
    types_sorted = sorted(set(types), key=lambda x: _normalize_term(x))
    conditions_sorted = sorted(set(conditions), key=lambda x: _normalize_term(x))
    return types_sorted, conditions_sorted


def _is_todos(x):
    return _normalize_term(x) == "todos los inmuebles"


def _strip_todos_parenthetical(s):
    """
    Elimina una cola '(Todos los inmuebles)' si existe.
    """
    s = str(s)
    m = re.search(r"\(([^)]*)\)\s*$", s)
    if m and _normalize_term(m.group(1)) == "todos los inmuebles":
        return s[: m.start()].rstrip()
    return s


# --- extractor de ubicaciones corregido ---


def _extract_locations(text, spans, types_norm_set, conds_norm_set):
    """
    Regla:
      - Con coma: 'X , Ciudad / Prov' -> 'X (Ciudad / Prov)' en un solo token.
      - Sin coma: 'X Ciudad / Prov'   -> ['X', 'Ciudad / Prov'] en dos tokens.
    Siempre ignora 'Todos los inmuebles' y 'polígono definido'.
    """
    candidates = []

    for seg in re.split(r"\ben\b", text, flags=re.I)[1:]:
        head = re.split(r"\bo\s+en\b", seg, maxsplit=1, flags=re.I)[0].strip()
        if not head:
            continue

        raw_parts = [p.strip() for p in re.split(r"\s*[,，]\s*", head) if p is not None]

        # purgar ruido de cola
        while raw_parts and re.search(r"pol[ií]gono definido", raw_parts[-1], re.I):
            raw_parts.pop()
        while raw_parts and _is_todos(raw_parts[-1]):
            raw_parts.pop()

        if not raw_parts:
            continue

        if len(raw_parts) >= 2:
            # Con coma: fusionar
            left = _strip_todos_parenthetical(
                _clean_loc_token(" ".join(raw_parts[:-1]))
            )
            right = _strip_todos_parenthetical(_clean_loc_token(raw_parts[-1]))
            if left and right and not _is_todos(right):
                candidates.append(f"{left} ({right})")
            elif left and not _is_todos(left):
                candidates.append(left)
            elif right and not _is_todos(right):
                candidates.append(right)
        else:
            # Sin coma: separar en dos si hay cola X / Y
            parts = _split_locations_fragment(raw_parts[0])
            parts = [p for p in parts if p and not _is_todos(p)]
            candidates.extend(parts)

    # filtrar ruido general
    filtered = []
    for c in candidates:
        if not c:
            continue
        if re.search(r"pol[ií]gono definido", c, re.I):
            continue
        if _is_todos(c):
            continue
        lc = c.lower()
        if any(
            k in lc
            for k in [
                "habitacion",
                "baño",
                "salon",
                "m²",
                "€",
                "venta",
                "alquiler",
                "busca",
            ]
        ):
            continue
        filtered.append(c)

    # dividir residuales 'Barrio Ciudad / Prov' sin coma
    exploded = _explode_tail_city_pair(filtered)

    # dedupe normalizado
    seen, res = set(), []
    for c in exploded:
        k = _normalize_term(c)
        if k and k not in seen:
            seen.add(k)
            res.append(c)
    return res or None


def clean_locations_alcoy(tokens):
    """
    - Quita '(Todos los inmuebles)' y tokens vacíos.
    - Repara 'Barrio Ciudad / Prov' -> 'Barrio (Ciudad / Prov)' si viene en un solo token.
    - Si hay un token suelto 'Alcoy / Alcoi' junto a barrios sin paréntesis, lo funde como sufijo: 'Barrio (Alcoy / Alcoi)'.
    - Si hay varios tokens y todos los que tienen paréntesis usan 'Alcoy / Alcoi', se quita ese sufijo para dejar solo el barrio.
    - Mantiene 'Alcoy / Alcoi' solo si es el único token exacto.
    - Deduplica.
    """
    if not tokens:
        return None

    exact_pair_re = re.compile(r"^\s*(Alcoy\s*/\s*Alcoi|Alcoi\s*/\s*Alcoy)\s*$", re.I)
    parenthetical_city_re = re.compile(
        r"\s*\((Alcoy\s*/\s*Alcoi|Alcoi\s*/\s*Alcoy)\)\s*$", re.I
    )

    out = []
    for t in tokens:
        s = str(t).strip()
        if not s:
            continue
        s = _strip_todos_parenthetical(s)
        if not s or _is_todos(s):
            continue

        # normalizar barras y espacios
        s = re.sub(r"\s*/\s*", " / ", s)
        s = re.sub(r"\s+", " ", s).strip(" ,")

        # si no hay paréntesis y termina en 'Ciudad / Prov', convertir a 'X (Ciudad / Prov)'
        if "(" not in s:
            m = _SLASH_TAIL_RE.search(s)
            if m and m.start() > 0:
                left = _clean_loc_token(s[: m.start()])
                right = _clean_loc_token(m.group(0))
                if left and right:
                    s = f"{left} ({right})"

        out.append(s)

    # 1) Si coexiste un token exacto 'Alcoy / Alcoi' con barrios sin paréntesis, añadir la ciudad como sufijo
    if len(out) >= 2:
        city_idxs = [i for i, s in enumerate(out) if exact_pair_re.match(s)]
        if city_idxs:
            city_text = exact_pair_re.match(out[city_idxs[0]]).group(
                1
            )  # respeta orden escrito
            out = [
                (
                    f"{s} ({city_text})"
                    if ("(" not in s and not exact_pair_re.match(s))
                    else s
                )
                for s in out
            ]

    # 2) Si hay ≥2 tokens y todos los que llevan paréntesis usan 'Alcoy / Alcoi', retirar ese sufijo común
    if len(out) >= 2:
        paren_matches = [bool(parenthetical_city_re.search(s)) for s in out]
        if any(paren_matches):
            # Verificar que no hay paréntesis de otra ciudad distinta
            other_city_paren = False
            for s in out:
                m = re.search(r"\s*\(([^)]+)\)\s*$", s)
                if m and not exact_pair_re.match(m.group(1)):
                    other_city_paren = True
                    break
            if not other_city_paren:
                out = [parenthetical_city_re.sub("", s).strip() for s in out]

    # 3) Si hay >1 token, descartar el token exacto 'Alcoy / Alcoi'
    pruned = []
    for s in out:
        if len(out) > 1 and exact_pair_re.match(s):
            continue
        pruned.append(s)

    # 4) Dedup final
    seen, res = set(), []
    for s in pruned:
        k = re.sub(r"\s+", " ", s).strip().lower()
        if k and k not in seen:
            seen.add(k)
            res.append(s)

    return res or None


def _extract_flags(text):
    flags = []
    if re.search(r"pol[ií]gono definido", text, re.I):
        flags.append("polygon")
    if re.search(r"todos los inmuebles", text, re.I):
        flags.append("todos_los_inmuebles")
    if re.search(r"\bbusca inmueble\b", text, re.I):
        flags.append("busca_inmueble_generico")
    return flags or None


# ------------------ 1) vocab dinámicos por contexto ------------------
def parse_pref_text_dynamic(raw_text, types_vocab, conditions_vocab):
    """
    Parser de preferencias usando vocabulario dinámico.
    - No divide etiquetas por '/' para tipos.
    - Preserva 'X, Y' -> 'X (Y)' en ubicaciones.
    - Consolida 'X/Y' eliminando duplicados de sus componentes.
    - Si detecta 'Busca Inmueble' => fija types = ['Inmueble'].
    - REGLA: 'Habitación' SOLO aparece en types si está antes de la primera coma del original.
    - Suprime sub-términos frente a compuestos.
    - Normaliza alias: 'Piso' y 'Apartamento' -> 'Pisos/ Apartamentos'.
    - Expone flags; en particular, 'polígono definido' -> flags=['polygon'].
    - Operation: 'venta' o 'alquiler' si hay una sola; ['venta','alquiler'] si aparecen ambas en el orden de aparición.
    """
    text, spans = _strip_html_keep_spans(raw_text)
    text = _norm_spaces(text)

    def _is_generic_inmueble(txt):
        return bool(re.search(r"\bbusca\s+inmueble\b", txt, re.I))

    def _extract_operation(text_local):
        tn = _normalize_term(text_local or "")
        # capturar 'venta' y 'alquiler' en orden, incluyendo separadores "o", "/", comas
        ops_seq = []
        for m in re.finditer(r"\b(venta|alquiler)\b", tn, flags=re.I):
            op = m.group(1).lower()
            if op not in ops_seq:
                ops_seq.append(op)
        if ops_seq:
            return ops_seq if len(ops_seq) > 1 else ops_seq[0]
        # fallback conservador: presencia de € => venta
        if re.search(r"\d[\d\.\s,]*\s*€", tn, re.I):
            return "venta"
        return None

    def _extract_counts(text_local):
        def rng(label):
            m = re.search(
                rf"entre\s*(\d+)\s*{label}\s*a\s*(\d+)\s*{label}", text_local, re.I
            )
            if m:
                return int(m.group(1)), int(m.group(2))
            m = re.search(
                rf"de\s*(\d+)\s*{label}\s*a\s*(\d+)\s*{label}", text_local, re.I
            )
            if m:
                return int(m.group(1)), int(m.group(2))
            m = re.search(rf"desde\s*(\d+)\s*{label}", text_local, re.I)
            if m:
                v = int(m.group(1))
                return v, None
            m = re.search(rf"hasta\s*(\d+)\s*{label}", text_local, re.I)
            if m:
                v = int(m.group(1))
                return None, v
            m = re.search(rf"(?:con\s*)?(\d+)\s*{label}", text_local, re.I)
            if m:
                v = int(m.group(1))
                return v, v
            return None, None

        hmin, hmax = rng(r"Habitaci(?:o|ó)n(?:es)?")
        bmin, bmax = rng(r"Ba(?:n|ñ)os?")
        smin, smax = rng(r"Sal[oó]n(?:es)?")
        return {
            "rooms_min": hmin,
            "rooms_max": hmax,
            "bath_min": bmin,
            "bath_max": bmax,
            "living_min": smin,
            "living_max": smax,
        }

    def _to_number(txt):
        if txt is None:
            return None
        t = str(txt)
        t = (
            t.replace("€", "")
            .replace("EUR", "")
            .replace("eur", "")
            .replace("m²", "")
            .replace("m2", "")
        )
        t = unicodedata.normalize("NFKD", t)
        digits = "".join(ch for ch in t if ch.isdigit())
        return int(digits) if digits else None

    def _extract_area(text_local):
        m = re.search(
            r"entre\s*([\d\.\s,]+)\s*m[²2]\s*a\s*([\d\.\s,]+)\s*m[²2]", text_local, re.I
        )
        if m:
            return _to_number(m.group(1)), _to_number(m.group(2))
        m = re.search(
            r"de\s*([\d\.\s,]+)\s*m[²2]\s*a\s*([\d\.\s,]+)\s*m[²2]", text_local, re.I
        )
        if m:
            return _to_number(m.group(1)), _to_number(m.group(2))
        m = re.search(r"desde\s*([\d\.\s,]+)\s*m[²2]", text_local, re.I)
        if m:
            return _to_number(m.group(1)), None
        m = re.search(r"hasta\s*([\d\.\s,]+)\s*m[²2]", text_local, re.I)
        if m:
            return None, _to_number(m.group(1))
        return None, None

    def _extract_price(text_local):
        m = re.search(r"de\s*([\d\.\s,]+)\s*€\s*a\s*([\d\.\s,]+)\s*€", text_local, re.I)
        if m:
            return _to_number(m.group(1)), _to_number(m.group(2))
        m = re.search(
            r"entre\s*([\d\.\s,]+)\s*€\s*a\s*([\d\.\s,]+)\s*€", text_local, re.I
        )
        if m:
            return _to_number(m.group(1)), _to_number(m.group(2))
        m = re.search(r"desde\s*([\d\.\s,]+)\s*€", text_local, re.I)
        if m:
            return _to_number(m.group(1)), None
        m = re.search(r"hasta\s*([\d\.\s,]+)\s*€", text_local, re.I)
        if m:
            return None, _to_number(m.group(1))
        return None, None

    operation = _extract_operation(text)

    types_vocab_sing = sorted(
        {_to_singular_es(t) for t in types_vocab}, key=lambda x: _normalize_term(x)
    )

    def _plural_variants(term_norm):
        if " " in term_norm or "/" in term_norm:
            return [term_norm]
        variants = {term_norm}
        if not term_norm.endswith("s"):
            variants.add(term_norm + "s")
        if not term_norm.endswith("es"):
            variants.add(term_norm + "es")
        return sorted(variants, key=len, reverse=True)

    def match_vocab(vocab):
        found = set()
        src = {}
        tn = _normalize_term(text)
        span_tokens = [_normalize_term(sp) for sp in spans]

        for term in vocab:
            tnorm = _normalize_term(term)
            alts = _plural_variants(tnorm)
            pat = r"\b(" + "|".join(re.escape(a) for a in alts) + r")\b"

            if any(re.search(pat, st, flags=re.I) for st in span_tokens):
                found.add(term)
                src[term] = {"source": "span"}
                continue

            if re.search(pat, tn, flags=re.I):
                found.add(term)
                src.setdefault(term, {"source": "text"})

        found_sorted = sorted(found) or None
        return found_sorted, src

    def _consolidate_slash_types(types_list):
        if not types_list:
            return types_list
        keep = list(types_list)
        norms = {t: _normalize_term(t) for t in keep}
        slash_terms = [t for t in keep if "/" in t]
        to_drop = set()
        for st in slash_terms:
            parts = [_normalize_term(_to_singular_es(p)) for p in st.split("/")]
            for t in keep:
                tn = norms[t]
                if tn in parts or _normalize_term(_to_singular_es(t)) in parts:
                    if t != st:
                        to_drop.add(t)
        result = [t for t in keep if t not in to_drop]
        return sorted(set(result), key=lambda x: _normalize_term(x))

    # --- matching inicial ---
    types, types_src = match_vocab(types_vocab_sing)

    # si hay contexto numérico, filtra tokens de cantidad
    if types and _has_numeric_quantity_context(text):
        qty_norms = {
            "habitacion",
            "habitación",
            "habitaciones",
            "baño",
            "banio",
            "banos",
            "baños",
            "salon",
            "salones",
        }
        safe = []
        for t in types:
            tn = _normalize_term(t)
            src = types_src.get(t, {}).get("source", "text")
            if src == "text" and tn in qty_norms:
                continue
            safe.append(t)
        types = safe or None

    # 'Habitación' solo si viene antes de la primera coma
    tn_full = _normalize_term(text)
    forced_hab = bool(
        re.search(r"^[^,]*\bhabitaci(?:o|ó)n(?:es)?\b", tn_full, flags=re.I)
    )

    def _drop_habitacion(lista):
        return [
            t
            for t in (lista or [])
            if _normalize_term(t) not in {"habitacion", "habitaciones"}
        ] or None

    if forced_hab:
        if types is None:
            types = ["Habitación"]
        else:
            types = [
                t
                for t in types
                if _normalize_term(t) not in {"habitacion", "habitaciones"}
            ]
            if "Habitación" not in types:
                types.append("Habitación")
    else:
        types = _drop_habitacion(types)

    # 1) suprimir sub-términos
    if types:
        types = _suppress_subterms(types)

    # 2) canonicalizar alias y consolidar
    def _canonicalize_types(tlist):
        if not tlist:
            return tlist
        canon = []
        for t in tlist:
            tn = _normalize_term(_to_singular_es(t))
            if tn in {"piso", "apartamento", "pisos/ apartamentos"}:
                canon.append("Pisos/ Apartamentos")
            else:
                canon.append(t)
        # dedupe preservando orden
        seen = set()
        res = []
        for t in canon:
            k = _normalize_term(t)
            if k not in seen:
                seen.add(k)
                res.append(t)
        return res

    if types:
        types = _canonicalize_types(types)
        types = _consolidate_slash_types(types)
        types = _suppress_subterms(types)

    conditions, _ = match_vocab(conditions_vocab)

    counts = _extract_counts(text)
    area_min, area_max = _extract_area(text)
    price_min, price_max = _extract_price(text)

    types_norm_set = set(_normalize_term(t) for t in (types or []))
    conds_norm_set = set(_normalize_term(c) for c in (conditions or []))

    locations = _extract_locations(text, spans, types_norm_set, conds_norm_set)
    if locations:
        locations = clean_locations_alcoy(locations)

    flags = _extract_flags(text)

    if _is_generic_inmueble(text):
        types = ["Inmueble"]

    if types:

        def _cap_first(s):
            s2 = str(s).lstrip()
            if not s2:
                return s
            return (s2[0].upper() + s2[1:]) if s2[0].islower() else s

        types = sorted({_cap_first(t) for t in types}, key=lambda x: _normalize_term(x))

    return {
        "original": raw_text,
        "operation": operation,
        "types": types if types else None,
        "conditions": conditions,
        "rooms_min": counts["rooms_min"],
        "rooms_max": counts["rooms_max"],
        "bath_min": counts["bath_min"],
        "bath_max": counts["bath_max"],
        "living_min": counts["living_min"],
        "living_max": counts["living_max"],
        "area_min_m2": area_min,
        "area_max_m2": area_max,
        "price_min_eur": price_min,
        "price_max_eur": price_max,
        "locations": locations,
        "flags": flags,
    }


# ------------------ 3) pipeline completo ------------------

def extract_from_file_dynamic(file_path, col="pref_text"):
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()
    if ext == ".csv":
        df = pd.read_csv(file_path)
    elif ext in [".xls", ".xlsx"]:
        df = pd.read_excel(file_path)
    else:
        raise ValueError("Unsupported file format. Use CSV or Excel.")
    if col not in df.columns:
        raise ValueError(f"Column '{col}' not found.")

    types_vocab, conditions_vocab = build_vocab_from_file(file_path, col=col)
    parsed = (
        df[col]
        .apply(lambda x: parse_pref_text_dynamic(x, types_vocab, conditions_vocab))
        .tolist()
    )
    parsed_df = pd.DataFrame(parsed)
    vocab = {"types_vocab": types_vocab, "conditions_vocab": conditions_vocab}
    return vocab, parsed_df


# ------------------------- 4) ejemplo de uso -------------------------
vocab, out = extract_from_file_dynamic(    "/Users/emin/InmobiliariaJBC/Scrappers/Ego/Data/contacts_today.csv", col="pref_text")
print("TYPES:", vocab["types_vocab"])
print("CONDITIONS:", vocab["conditions_vocab"])
print(out.head().to_dict(orient="records"))


# In[3]:


import os
import pandas as pd
import textwrap


def quick_random_check(file_path, col="pref_text", n=8):
    """
    Muestra N filas aleatorias con el parseo estructurado.
    Requiere que existan: build_vocab_from_file, parse_pref_text_dynamic, _strip_html_keep_spans.
    """
    try:
        # 0) dependencias externas mínimas
        if not callable(globals().get("build_vocab_from_file")):
            raise RuntimeError("Missing dependency: build_vocab_from_file")
        if not callable(globals().get("parse_pref_text_dynamic")):
            raise RuntimeError("Missing dependency: parse_pref_text_dynamic")
        if not callable(globals().get("_strip_html_keep_spans")):
            raise RuntimeError("Missing dependency: _strip_html_keep_spans")

        # 1) vocab dinámico
        types_vocab, conditions_vocab = build_vocab_from_file(file_path, col=col)

        # 2) leer fuente
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        if ext == ".csv":
            # Lectura tolerante a BOM y sin convertir "NA" en NaN por defecto
            src = pd.read_csv(file_path, encoding="utf-8-sig", keep_default_na=True)
        elif ext in [".xls", ".xlsx"]:
            # engine auto; pandas elegirá openpyxl/xlrd según corresponda
            src = pd.read_excel(file_path)
        else:
            raise ValueError("Unsupported file format. Use CSV or Excel.")

        if col not in src.columns:
            raise ValueError(f"Column '{col}' not found.")

        # 3) muestreo
        pool = src[src[col].notna()]
        if pool.empty:
            print("No data with non-null texts.")
            return

        sample = pool.sample(n=min(int(n), len(pool)))

        # 4) parsear y mostrar
        for i, raw in enumerate(sample[col].tolist(), 1):
            try:
                parsed = (
                    parse_pref_text_dynamic(raw, types_vocab, conditions_vocab) or {}
                )
            except Exception as pe:
                parsed = {}
                print(f"\n--- #{i} --------------------------------------------")
                print("Original: [parse failed]")
                print(
                    {
                        "error": True,
                        "message": "Parsing failed for this row.",
                        "detail": str(pe),
                    }
                )
                continue

            # acortar texto original para inspección rápida
            try:
                plain, _ = _strip_html_keep_spans(raw)
            except Exception:
                plain = str(raw)
            plain_short = plain

            def g(key):
                return parsed.get(key)

            def rng(a, b):
                return f"{g(a)}–{g(b)}"

            print(f"\n--- #{i} --------------------------------------------")
            print(f"Original: {plain_short}")
            print(f"Operation: {g('operation')}")
            print(f"Types: {g('types')}")
            print(f"Conditions: {g('conditions')}")
            print(f"Rooms: {rng('rooms_min','rooms_max')}")
            print(f"Baths: {rng('bath_min','bath_max')}")
            print(f"Living rooms: {rng('living_min','living_max')}")
            print(f"Area m²: {rng('area_min_m2','area_max_m2')}")
            print(f"Price €: {rng('price_min_eur','price_max_eur')}")
            print(f"Locations: {g('locations')}")
            print(f"Flags: {g('flags')}")

    except Exception as e:
        print(
            {
                "error": True,
                "message": "Failed to run quick check. Verify file path and column.",
                "detail": str(e),
            }
        )


# Ejemplo:
quick_random_check("/Users/emin/InmobiliariaJBC/Scrappers/Ego/Data/contacts_today.csv", n=100)


# In[4]:


# TESTS (ejecuta esta función para validar los casos de 'Todos los inmuebles')
def run_tests_todos():
    # 1) Caso con comas: última pieza 'Todos los inmuebles' debe ignorarse
    txt = "Preferencias inmueble Busca Piso , para Venta , desde 120 m² , con 4 Habitaciones , hasta 130000 € , en Centre - Zona Alta , Alcoy / Alcoi , Todos los inmuebles"
    res = parse_pref_text_dynamic(txt, [], [])
    assert res["flags"] and "todos_los_inmuebles" in res["flags"], "Flag faltante"
    assert res["locations"] == [
        "Centre - Zona Alta (Alcoy / Alcoi)"
    ], f"Loc mal parseada: {res['locations']}"

    # 2) Cola parentética pegada debe limpiarse
    locs = ["Centre - Zona Alta (Alcoy / Alcoi)", "Eixample (Alcoy / Alcoi)"]
    cleaned = clean_locations_alcoy(locs)
    assert "Centre - Zona Alta" in cleaned and all(
        "Todos los inmuebles" not in x for x in cleaned
    ), f"Limpieza falló: {cleaned}"

    # 3) Texto sin comas pero con parentética
    txt2 = "Busca Piso para Venta en Centre - Zona Alta Alcoy / Alcoi , todos los inmuebles"
    res2 = parse_pref_text_dynamic(txt2, [], [])
    assert res2["locations"] == [
        "Centre - Zona Alta (Alcoy / Alcoi)",
    ], f"Fallback split falló: {res2['locations']}"

    # 4) Solo 'Alcoy / Alcoi' + marcador. Debe mantener la ciudad y la flag.
    txt3 = "Busca Inmueble para Venta en Alcoy / Alcoi, Todos los inmuebles"
    res3 = parse_pref_text_dynamic(txt3, ["Inmueble"], [])
    assert res3["locations"] == [
        "Alcoy / Alcoi"
    ], f"Ciudad perdida: {res3['locations']}"
    assert "todos_los_inmuebles" in (res3["flags"] or []), "Flag faltante en txt3"

    print("OK: tests 'Todos los inmuebles' superados.")

run_tests_todos()


# In[ ]:




