import pandas as pd
import numpy as np
from pathlib import Path
pd.set_option("display.max_rows", None)
pd.set_option("display.max_columns", None)
pd.set_option("display.max_colwidth", None)

SCRIPT_DIR = Path(__file__).parent.resolve()



# Rutas a los CSV (ajustadas a la estructura real del repo)
csv1 = str((SCRIPT_DIR / "Scrappers" / "Fotocasa" / "Data" / "inmuebles_today.csv").resolve())
csv2 = str((SCRIPT_DIR / "Scrappers" / "Idealista" / "Data" / "inmuebles_today.csv").resolve())
csv3 = str((SCRIPT_DIR / "Scrappers" / "Pico_Blanes" / "Data" / "inmuebles_today.csv").resolve())

# Cargar cada CSV en un DataFrame
df1 = pd.read_csv(csv1)
df2 = pd.read_csv(csv2)
df3 = pd.read_csv(csv3)

# Mostrar las primeras filas de cada uno
print("Primeras filas de archivo1.csv:")
print(df1.columns, "\n")

print("Primeras filas de archivo2.csv:")
print(df2.columns, "\n")

print("Primeras filas de archivo3.csv:")
print(df3.columns, "\n")
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
import re
import pandas as pd
from unidecode import unidecode


# -----------------------------
# 1) Helpers de limpieza
# -----------------------------
def _basic_clean(s: pd.Series) -> pd.Series:
    if s is None:
        return pd.Series(dtype="object")
    s = s.astype(str)

    # Normalizaciones generales
    s = s.str.replace(r"\(.*?\)", "", regex=True)  # quita paréntesis y su contenido
    s = s.str.replace(
        r"^\s*[/\-]\s*alcoi\s*-\s*", "", flags=re.I, regex=True
    )  # "/ Alcoi - "
    s = s.str.replace(r"^\s*[/\-]\s*alcoi\s*$", "", flags=re.I, regex=True)  # "/ Alcoi"
    s = s.str.replace(
        r"\b(alcoi|alcoy)\b", "", flags=re.I, regex=True
    )  # "Alcoi"/"Alcoy" sueltos
    s = s.str.replace(r"\s*[/\-]\s*", " - ", regex=True)  # normaliza separadores
    s = s.str.replace(r"\s+", " ", regex=True).str.strip()  # espacios
    s = s.replace({"": pd.NA, "nan": pd.NA})
    return s


def _ascii_lower(s: pd.Series) -> pd.Series:
    # Baja a ASCII y minúsculas para facilitar el mapeo por regex
    return (
        s.fillna("")
        .map(lambda x: unidecode(x).lower().strip() if isinstance(x, str) else x)
        .replace({"": pd.NA})
    )


# -----------------------------
# 2) Reglas de mapeo -> zona estándar (canónica)
#    Usamos regex "anchas" para cubrir variantes vistas en tus uniques
# -----------------------------
REGEX_TO_STD = [
    # Centro / Zona Alta
    (r"^(cent(ro|re))(.*zona\s*alta)?$", "Centro - Zona Alta"),
    (r"^centro\s*-\s*zona\s*alta$", "Centro - Zona Alta"),
    (r"^centre\s*-\s*zona\s*alta$", "Centro - Zona Alta"),
    (r"^centro[- ]?zona[- ]?alta$", "Centro - Zona Alta"),
    # Ensanche / Eixample
    (r"^(ensanche|eixample)$", "Barrio Eixample"),
    (r"^barri\s*eixample$", "Barrio Eixample"),
    # Zona Norte / Nord
    (r"^(zona\s*nor(te|d)|norte|zona\s*nord|barri\s*zona\s*nord)$", "Barrio Zona Nord"),
    # Santa Rosa
    (r"^(santa\s*rosa|barri\s*santa\s*rosa)$", "Barrio Santa Rosa"),
    # Batoi / Batoy / Baradello / Sargento -> grupo oficial
    (
        r"^(batoi|batoy|baradello|sargento|barri\s*batoi.*baradello.*sargento|barri\s*batoi.*|barri\s*sargento.*|barri\s*baradello.*)$",
        "Barrio Batoi - Sargento - Baradello",
    ),
    # Viaducto
    (r"^(viaducto|zona\s*viaducto)$", "Viaducto"),
    # El Cami (Camí / Cami / El Cami / El Camí / El CAMI)
    (r"^(el\s*cami|cami|cami)$", "El Cami"),
    # La Foia
    (r"^la\s*foia$", "La Foia"),
    # Pueblos y zonas industriales / barrios sueltos (dejamos canónicos simples)
    (r"^muro$", "Muro"),
    (r"^cocentaina$", "Cocentaina"),
    (r"^banyeres$", "Banyeres"),
    (r"^gormaig$", "Gormaig"),
    (r"^beniata$", "Beniata"),
    (r"^els?\s*algars$", "Els Algars"),
    (r"^cotes\s*baixes$", "Cotes Baixes"),
    (r"^montesol$", "Montesol"),
    (r"^viaducto$", "Viaducto"),
]


def normalize_zona(series: pd.Series) -> pd.Series:
    base = _basic_clean(series)
    canon = _ascii_lower(base)

    out = pd.Series(pd.NA, index=series.index, dtype="object")

    # Recorremos reglas; primera coincidencia gana
    for pattern, std in REGEX_TO_STD:
        mask = canon.str.fullmatch(pattern, na=False)
        out = out.mask(mask, std)

    # Si no cayó en ninguna regla, probamos heurísticas extra:
    # - "centro" y "zona alta" en la misma cadena
    mask_centro_zona_alta = canon.str.contains(
        r"\bcent(ro|re)\b", na=False
    ) & canon.str.contains(r"zona\s*alta", na=False)
    out = out.mask(mask_centro_zona_alta, "Centro - Zona Alta")

    # - Ensanche/Eixample con ruido (e.g., "Ensanche ()")
    mask_eixample_ruido = canon.str.contains(r"(ensanche|eixample)", na=False)
    out = out.mask(mask_eixample_ruido & out.isna(), "Barri Eixample")

    # - Zona Norte/Nord con ruido
    mask_norte_ruido = canon.str.contains(
        r"(zona\s*nor(te|d)|\bnorte\b|\bnord\b)", na=False
    )
    out = out.mask(mask_norte_ruido & out.isna(), "Barri Zona Nord")

    # - Santa Rosa con ruido
    mask_santarosa = canon.str.contains(r"santa\s*rosa", na=False)
    out = out.mask(mask_santarosa & out.isna(), "Barri Santa Rosa")

    # - Batoi/Batoy/Baradello/Sargento con ruido
    mask_batoi = canon.str.contains(r"(batoi|batoy|baradello|sargento)", na=False)
    out = out.mask(mask_batoi & out.isna(), "Barri Batoi - Sargento - Baradello")

    # - Viaducto con ruido
    mask_viaducto = canon.str.contains(r"viaducto", na=False)
    out = out.mask(mask_viaducto & out.isna(), "Viaducto")

    # - Camí/Cami con ruido
    mask_cami = canon.str.contains(r"\bcam[ií]\b|el\s*cami", na=False)
    out = out.mask(mask_cami & out.isna(), "El Cami")

    # Si aún queda sin mapear, devuelve versión limpia "title case" como fallback
    fallback = base.str.title()
    out = out.fillna(fallback)

    return out


# -----------------------------
# 3) Aplicar a tus dataframes
# -----------------------------
# df1: ya tenías df1["zona_clean"]; lo volvemos a limpiar por si acaso
df1["zona_std"] = normalize_zona(
    df1["zona_clean"] if "zona_clean" in df1 else df1["zona"]
)

# df2: columna "localizacion"
df2["zona_std"] = normalize_zona(df2["localizacion"])

# df3: columna "zona"
df3["zona_std"] = normalize_zona(df3["zona"])

# -----------------------------
# 4) Unión "pro": outer join para no perder nada
#     - Cambia las claves de unión según convenga (ids, direcciones, etc.)
#     - Aquí unimos por la zona estándar y luego conservamos las columnas originales
# -----------------------------
# Sufijos claros para no pisar columnas:
df12 = df1.merge(df2, on="zona_std", how="outer", suffixes=("_df1", "_df2"))

merged = df12.merge(
    df3.add_suffix("_df3").rename(columns={"zona_std_df3": "zona_std"}),
    on="zona_std",
    how="outer",
)

# -----------------------------
# 5) Controles de calidad (opcionales pero recomendados)
# -----------------------------
# ¿Qué valores limpios distintos tenemos?
zonas_finales = merged["zona_std"].dropna().sort_values().unique()

# Revisión de originales que NO cayeron en mapeo "top" (por si añadimos reglas nuevas):
no_map_df1 = df1.loc[
    ~df1["zona_std"].isin(
        [
            "Centro - Zona Alta",
            "Barri Eixample",
            "Barri Zona Nord",
            "Barri Santa Rosa",
            "Barri Batoi - Sargento - Baradello",
            "Viaducto",
            "El Cami",
            "La Foia",
            "Muro",
            "Cocentaina",
            "Banyeres",
            "Gormaig",
            "Beniata",
            "Els Algars",
            "Cotes Baixes",
            "Montesol",
        ]
    )
]
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
        "fecha_inclusion",
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
        "fecha_inclusion",
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
        "fecha_inclusion",
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


df_final.to_csv("C:\Projects\InmobiliariaJBC\public\inmuebles_unificado.csv", index=False, encoding="utf-8-sig")

print("CSV guardado como inmuebles_unificado.csv")
