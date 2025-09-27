import subprocess
from pathlib import Path

# Ruta base del proyecto
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = (
    SCRIPT_DIR  # carpeta que contiene Idealista, Fotocasa, Pico_Blanes y merge_csv.py
)

# Diccionario con los scrapers y sus rutas
scrapers = {
    "Idealista": "idealista_scrapper.py",
    "Fotocasa": "fotocasa_scrapper.py",
    "Pico_Blanes": "pico_blanes_scrapper.py",
    "Ego": "ego.py",
    "Ego": "ego_clean.py",
}


# Ejecutar scrapers
for project, script_name in scrapers.items():
    script_path = PROJECT_ROOT / "Scrappers" / project / "Scripts" / script_name
    print(f"\n🚀 Ejecutando {project} -> {script_name}...")

    result = subprocess.run(
        ["python", str(script_path)], capture_output=True, text=True
    )

    # Mostrar salida estándar
    print(result.stdout)

    # Mostrar error si lo hubiera y detener la ejecución
    if result.returncode != 0:
        print(f"❌ Error al ejecutar {script_name}:\n{result.stderr}")
        break
else:
    # Si todos los scrapers terminan bien, ejecutar merge_csv.py
    merge_path = PROJECT_ROOT / "merge_csv.py"
    print(f"\n📊 Ejecutando merge_csv.py...")

    result = subprocess.run(["python", str(merge_path)], capture_output=True, text=True)

    print(result.stdout)

    if result.returncode != 0:
        print(f"❌ Error al ejecutar merge_csv.py:\n{result.stderr}")
