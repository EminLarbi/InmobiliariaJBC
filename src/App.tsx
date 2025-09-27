import React, { useState, useMemo, useEffect } from "react";
import { PropertyFilters } from "./components/PropertyFilters";
import { PropertyTable, Property } from "./components/PropertyTable";
import { MarketAnalytics } from "./components/MarketAnalytics";
import { ClientMatchesPanel, ClientMatch } from "./components/ClientMatchesPanel";
import { HomePage } from "./components/HomePage";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import {
	mockProperties,
	getUniqueZonas,
	getUniqueAnunciantes,
	getUniqueTiposOperacion,
} from "./components/mockData";
import { Database, LayoutGrid, List, ChartBar as BarChart3, Users } from "lucide-react";
import { Button } from "./components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";

export interface ClientMatch {
  client_id: string;
  client_name: string;
  property_id: string;
  link_inmueble: string;
  web: string;
  anunciante: string;
  zona: string;
  operacion: string;
  tipo: string;
  habitaciones: number;
  banos: number;
  m2: number;
  precio: number;
  score: number;
  s_price: number;
  s_area: number;
  s_rooms: number;
  s_baths: number;
  s_operation: number;
  zone_match: string;
  type_match: string;
  rank_client: number;
}

interface FilterState {
	habitaciones: string;
	baños: string;
	precioMin: string;
	precioMax: string;
	metrosMin: string;
	metrosMax: string;
	zonas: string[];
	anunciantes: string[];
	tipos_de_operacion: string[];
	dateFilter:
		| "all"
		| "today"
		| "yesterday"
		| "last7days"
		| "last30days"
		| "custom";
	fechaDesde: string;
	fechaHasta: string;
}

type ViewMode = "cards" | "list";

// CONFIGURACIÓN: URL del CSV por defecto
// Para entorno Vite, coloca el CSV en `public/` y usa ruta absoluta
// Ejemplo: `public/inmuebles_unificado.csv` -> "/inmuebles_unificado.csv"
const DEFAULT_CSV_URL = "/inmuebles_unificado.csv";
const DEFAULT_MATCHES_CSV_URL = "/matches.csv";

// Para habilitar la carga automática del CSV, descomenta las líneas del useEffect más abajo

function AppContent() {
	const [filters, setFilters] = useState<FilterState>({
		habitaciones: "",
		baños: "",
		precioMin: "",
		precioMax: "",
		metrosMin: "",
		metrosMax: "",
		zonas: [],
		anunciantes: [],
		tipos_de_operacion: [],
		dateFilter: "all",
		fechaDesde: "",
		fechaHasta: "",
	});

	const [loadedProperties, setLoadedProperties] = useState<Property[]>([]);
	const [loadedMatches, setLoadedMatches] = useState<ClientMatch[]>([]);
	const [dataSource, setDataSource] = useState<"mock" | "csv">("mock");
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [activeTab, setActiveTab] = useState<string>("home");
	const [csvLoading, setCsvLoading] = useState(false);

	const handleNavigation = (tab: string) => {
		setActiveTab(tab);
	};

	const handleFilterChange = (
		key: keyof FilterState,
		value: string | string[]
	) => {
		setFilters((prev) => ({
			...prev,
			[key]: value,
		}));
	};

	const handleClearFilters = () => {
		setFilters({
			habitaciones: "",
			baños: "",
			precioMin: "",
			precioMax: "",
			metrosMin: "",
			metrosMax: "",
			zonas: [],
			anunciantes: [],
			tipos_de_operacion: [],
			dateFilter: "all",
			fechaDesde: "",
			fechaHasta: "",
		});
	};

	// Función para cargar CSV desde el servidor
	const loadCSVFromServer = async () => {
		try {
			setCsvLoading(true);
			const response = await fetch(DEFAULT_CSV_URL);
			if (!response.ok) {
				throw new Error(`Error al cargar el archivo: ${response.status}`);
			}

			const csvText = await response.text();
			const properties = parseCSV(csvText);

			setLoadedProperties(properties);
			setDataSource("csv");
			handleClearFilters();
		} catch (error) {
			// En caso de error, usar datos mock silenciosamente
			setDataSource("mock");
		} finally {
			setCsvLoading(false);
		}
	};

	// Función simple para parsear CSV
	const parseCSV = (csvText: string): Property[] => {
		const lines = csvText.trim().split("\n");
		// Eliminar BOM si existe y preparar headers
		const headerLine = lines[0].replace(/^\uFEFF/, "");
		const headers = headerLine
			.split(",")
			.map((h) => h.trim().replace(/"/g, ""));

		const toInt = (v: string) => {
			const cleaned = (v || "").replace(/[^0-9-]/g, "");
			return parseInt(cleaned) || 0;
		};

		// Convierte strings numéricos con separadores locales a float seguro
		const toFloat = (v: string) => {
			if (!v) return 0;
			let s = String(v).trim();
			// quitar moneda y espacios
			s = s.replace(/[€$]/g, "").replace(/\s+/g, "");
			const hasComma = s.includes(",");
			const hasDot = s.includes(".");
			if (hasComma && hasDot) {
				// Asumir formato ES: miles con '.' y decimales con ','
				// Mantener solo el último separador decimal
				s = s.replace(/\./g, "");
				s = s.replace(/,/g, ".");
			} else if (hasComma && !hasDot) {
				// Solo coma: tratar como decimal
				s = s.replace(/,/g, ".");
			}
			// Eliminar cualquier resto no numérico excepto signo y punto
			s = s.replace(/[^0-9.-]/g, "");
			const num = parseFloat(s);
			return isNaN(num) ? 0 : num;
		};

		return lines.slice(1).map((line, index) => {
			const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
			const property: any = {};

			headers.forEach((header, i) => {
				const value = values[i] || "";

				// Mapear headers comunes a nuestro formato
				switch (header.toLowerCase()) {
					case "habitaciones":
					case "rooms":
					case "bedrooms":
						property.habitaciones = toInt(value);
						break;
					case "baños":
					case "bathrooms":
					case "banos":
						property.baños = toInt(value);
						break;
					case "precio":
					case "price":
						property.precio = toFloat(value);
						break;
					case "link_inmueble":
					case "url":
					case "link":
						property.link_inmueble = value;
						break;
					case "metros_cuadrados":
					case "size":
					case "m2":
						property.metros_cuadrados = toFloat(value);
						break;
					case "anunciante":
					case "advertiser":
					case "agent":
						property.anunciante = value;
						break;
					case "zona":
					case "location":
					case "area":
						property.zona = value;
						break;
					case "web":
					case "website":
						property.web = value;
						break;
					case "fecha_inclusion":
					case "date":
					case "fecha":
						property.fecha_inclusion = value;
						break;
					case "tipo_de_operacion":
					case "operation_type":
					case "type":
						property.tipo_de_operacion = value;
						break;
					default:
						property[header] = value;
				}
			});

			// Valores por defecto
			return {
				id: index + 1,
				habitaciones: property.habitaciones || 0,
				baños: property.baños || 0,
				precio: property.precio || 0,
				link_inmueble: property.link_inmueble || "",
				metros_cuadrados: property.metros_cuadrados || 0,
				anunciante: property.anunciante || "Desconocido",
				zona: property.zona || "Desconocido",
				web: property.web || "",
				fecha_inclusion:
					property.fecha_inclusion || new Date().toISOString().split("T")[0],
				tipo_de_operacion: property.tipo_de_operacion || "Venta",
			} as Property;
		});
	};

	const handleUseMockData = () => {
		setDataSource("mock");
		handleClearFilters();
	};

	// Cargar CSV automáticamente al iniciar la aplicación
	useEffect(() => {
		loadCSVFromServer();
	}, []);

	// Seleccionar la fuente de datos activa
	const currentProperties =
		dataSource === "csv" ? loadedProperties : mockProperties;

	// Función para comparar fechas
	const isDateInRange = (propertyDate: string, filter: FilterState) => {
		if (filter.dateFilter === "all") return true;

		const propDate = new Date(propertyDate);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		const last7Days = new Date(today);
		last7Days.setDate(last7Days.getDate() - 7);

		const last30Days = new Date(today);
		last30Days.setDate(last30Days.getDate() - 30);

		propDate.setHours(0, 0, 0, 0);

		switch (filter.dateFilter) {
			case "today":
				return propDate.getTime() === today.getTime();
			case "yesterday":
				return propDate.getTime() === yesterday.getTime();
			case "last7days":
				return propDate >= last7Days;
			case "last30days":
				return propDate >= last30Days;
			case "custom":
				if (filter.fechaDesde && filter.fechaHasta) {
					const fromDate = new Date(filter.fechaDesde);
					const toDate = new Date(filter.fechaHasta);
					fromDate.setHours(0, 0, 0, 0);
					toDate.setHours(23, 59, 59, 999);
					return propDate >= fromDate && propDate <= toDate;
				} else if (filter.fechaDesde) {
					const fromDate = new Date(filter.fechaDesde);
					fromDate.setHours(0, 0, 0, 0);
					return propDate >= fromDate;
				} else if (filter.fechaHasta) {
					const toDate = new Date(filter.fechaHasta);
					toDate.setHours(23, 59, 59, 999);
					return propDate <= toDate;
				}
				return true;
			default:
				return true;
		}
	};

	const filteredProperties = useMemo(() => {
		return currentProperties.filter((property: Property) => {
			// Filtro por tipos de operación (múltiple selección)
			if (
				filters.tipos_de_operacion.length > 0 &&
				!filters.tipos_de_operacion.includes(property.tipo_de_operacion)
			) {
				return false;
			}

			// Filtro por habitaciones (valor exacto o vacío)
			if (
				filters.habitaciones &&
				property.habitaciones !== parseInt(filters.habitaciones)
			) {
				return false;
			}

			// Filtro por baños (valor exacto o vacío)
			if (filters.baños && property.baños !== parseInt(filters.baños)) {
				return false;
			}

			// Filtro por precio mínimo
			if (filters.precioMin && property.precio < parseInt(filters.precioMin)) {
				return false;
			}

			// Filtro por precio máximo
			if (filters.precioMax && property.precio > parseInt(filters.precioMax)) {
				return false;
			}

			// Filtro por metros cuadrados mínimos
			if (
				filters.metrosMin &&
				property.metros_cuadrados < parseInt(filters.metrosMin)
			) {
				return false;
			}

			// Filtro por metros cuadrados máximos
			if (
				filters.metrosMax &&
				property.metros_cuadrados > parseInt(filters.metrosMax)
			) {
				return false;
			}

			// Filtro por zonas (múltiple selección)
			if (filters.zonas.length > 0 && !filters.zonas.includes(property.zona)) {
				return false;
			}

			// Filtro por anunciantes (múltiple selección)
			if (
				filters.anunciantes.length > 0 &&
				!filters.anunciantes.includes(property.anunciante)
			) {
				return false;
			}

			// Filtro por fecha
			if (!isDateInRange(property.fecha_inclusion, filters)) {
				return false;
			}

			return true;
		});
	}, [filters, currentProperties]);

	const zonas = getUniqueZonas(currentProperties);
	const anunciantes = getUniqueAnunciantes(currentProperties);

	// Ordenar tipos de operación en el orden específico: Venta, Alquiler, Otro
	const allTipos = getUniqueTiposOperacion(currentProperties);
	const tiposOperacion = ["Venta", "Alquiler", "Otro"].filter((tipo) =>
		allTipos.includes(tipo)
	);

	return (
		<div className='min-h-screen bg-background'>
			<div className='container mx-auto p-6 space-y-6'>
				{/* Header */}
				<div className='flex justify-end py-4'>
					<ThemeToggle />
				</div>

				{/* Main Navigation */}
				<Tabs
					defaultValue='search'
					className='w-full'
					value={activeTab}
					onValueChange={setActiveTab}
				>
					<TabsList className='grid w-full grid-cols-4'>
						<TabsTrigger
							value='home'
							className='flex items-center gap-2'
						>
							<Database className='h-4 w-4' />
							Inicio
						</TabsTrigger>
						<TabsTrigger
							value='search'
							className='flex items-center gap-2'
						>
							<Database className='h-4 w-4' />
							Buscar Propiedades
						</TabsTrigger>
						<TabsTrigger
							value='analytics'
							className='flex items-center gap-2'
						>
							<BarChart3 className='h-4 w-4' />
							Análisis de Mercado
						</TabsTrigger>
						<TabsTrigger
							value='matches'
							className='flex items-center gap-2'
						>
							<Users className='h-4 w-4' />
							Matches de Clientes
						</TabsTrigger>
					</TabsList>

					<TabsContent
						value='home'
						className='space-y-6'
					>
						<HomePage 
							onNavigate={handleNavigation}
							propertiesCount={currentProperties.length}
							matchesCount={loadedMatches.length}
						/>
					</TabsContent>

					<TabsContent
						value='analytics'
						className='space-y-6'
					>
						<MarketAnalytics properties={currentProperties} />
					</TabsContent>

					<TabsContent
						value='matches'
						className='space-y-6'
					>
						<ClientMatchesPanel 
							properties={currentProperties} 
							matches={loadedMatches} 
						/>
					</TabsContent>

					<TabsContent
						value='search'
						className='space-y-6'
					>
						{/* Filters */}
						<PropertyFilters
							filters={filters}
							onFilterChange={handleFilterChange}
							onClearFilters={handleClearFilters}
							zonas={zonas}
							anunciantes={anunciantes}
							tiposOperacion={tiposOperacion}
						/>

						{/* View Mode Toggle and Results */}
						<div className='space-y-4'>
							{filteredProperties.length > 0 && (
								<div className='flex items-center justify-between'>
									<div>
										<h3 className='text-lg font-medium'>
											Propiedades encontradas
										</h3>
										<p className='text-sm text-muted-foreground'>
											{filteredProperties.length} resultado
											{filteredProperties.length !== 1 ? "s" : ""} disponible
											{filteredProperties.length !== 1 ? "s" : ""}
										</p>
									</div>

									<div className='flex items-center gap-2'>
										<span className='text-sm text-muted-foreground'>
											Vista:
										</span>
										<div className='flex border rounded-lg overflow-hidden'>
											<Button
												variant={viewMode === "cards" ? "default" : "ghost"}
												size='sm'
												onClick={() => setViewMode("cards")}
												className='rounded-none border-0'
											>
												<LayoutGrid className='h-4 w-4' />
												<span className='sr-only'>Vista de tarjetas</span>
											</Button>
											<Button
												variant={viewMode === "list" ? "default" : "ghost"}
												size='sm'
												onClick={() => setViewMode("list")}
												className='rounded-none border-0'
											>
												<List className='h-4 w-4' />
												<span className='sr-only'>Vista de lista</span>
											</Button>
										</div>
									</div>
								</div>
							)}

							{/* Results */}
							<PropertyTable
								properties={filteredProperties}
								viewMode={viewMode}
							/>
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

export default function App() {
	return (
		<ThemeProvider
			defaultTheme='system'
			storageKey='property-finder-theme'
		>
			<AppContent />
		</ThemeProvider>
	);
}
