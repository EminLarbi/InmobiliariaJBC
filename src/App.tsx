import React, { useState, useMemo, useEffect } from "react";
import { PropertyFilters } from "./components/PropertyFilters";
import { PropertyTable, Property } from "./components/PropertyTable";
import { MarketAnalytics } from "./components/MarketAnalytics";
import { ClientMatchesPanel, ClientMatch } from "./components/ClientMatchesPanel";
import { ClientSearchPanel } from "./components/ClientSearchPanel";
import { HomePage } from "./components/HomePage";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import {
	mockProperties,
	getUniqueZonas,
	getUniqueAnunciantes,
	getUniqueTiposOperacion,
} from "./components/mockData";
import { Database, LayoutGrid, List, ChartBar as BarChart3, Users, Chrome as Home, Building2 } from "lucide-react";
import { Target } from "lucide-react";
import { Home, Building2 } from "lucide-react";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "./components/ui/sidebar";

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
const DEFAULT_CSV_URL = "/inmuebles_unificado.csv";
const DEFAULT_MATCHES_CSV_URL = "/matches.csv";

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
	const [loadedClients, setLoadedClients] = useState<any[]>([]);
	const [dataSource, setDataSource] = useState<"mock" | "csv">("mock");
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [activeTab, setActiveTab] = useState<string>("home");
	const [csvLoading, setCsvLoading] = useState(false);
	const [matchesLoading, setMatchesLoading] = useState(false);
	const [clientsLoading, setClientsLoading] = useState(false);

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
			.split(";")
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
			const values = line.split(";").map((v) => v.trim().replace(/"/g, ""));
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

	// Función para cargar matches CSV desde el servidor
	const loadMatchesFromServer = async () => {
		try {
			setMatchesLoading(true);
			const response = await fetch(DEFAULT_MATCHES_CSV_URL);
			if (!response.ok) {
				throw new Error(`Error al cargar matches: ${response.status}`);
			}

			const csvText = await response.text();
			const matches = parseMatchesCSV(csvText);

			setLoadedMatches(matches);
		} catch (error) {
			console.warn('No se pudo cargar matches.csv, usando datos vacíos');
			setLoadedMatches([]);
		} finally {
			setMatchesLoading(false);
		}
	};

	// Función para cargar clientes CSV desde el servidor
	const loadClientsFromServer = async () => {
		try {
			setClientsLoading(true);
			const response = await fetch('/contacts_today_parsed.csv');
			if (!response.ok) {
				throw new Error(`Error al cargar clientes: ${response.status}`);
			}

			const csvText = await response.text();
			const clients = parseClientsCSV(csvText);

			setLoadedClients(clients);
		} catch (error) {
			console.warn('No se pudo cargar contacts_today_parsed.csv, usando datos vacíos');
			setLoadedClients([]);
		} finally {
			setClientsLoading(false);
		}
	};

	// Función para parsear CSV de clientes
	const parseClientsCSV = (csvText: string): any[] => {
		const lines = csvText.trim().split('\n');
		if (lines.length < 2) return [];

		const headerLine = lines[0].replace(/^\uFEFF/, '');
		
		// Parser CSV más robusto que maneja comas dentro de comillas
		const parseCSVLine = (line: string): string[] => {
			const result: string[] = [];
			let current = '';
			let inQuotes = false;
			
			for (let i = 0; i < line.length; i++) {
				const char = line[i];
				
				if (char === '"') {
					inQuotes = !inQuotes;
				} else if (char === ',' && !inQuotes) {
					result.push(current.trim());
					current = '';
				} else {
					current += char;
				}
			}
			
			result.push(current.trim());
			return result.map(v => v.replace(/^"|"$/g, ''));
		};

		const parseArray = (str: string): string[] => {
			if (!str || str === 'null' || str === '') return [];
			try {
				// Intentar parsear como array Python/JSON
				const parsed = JSON.parse(str.replace(/'/g, '"'));
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				// Si falla, intentar como string simple
				return [str];
			}
		};

		const parseNumber = (str: string): number | null => {
			if (!str || str === 'null' || str === '') return null;
			const num = parseFloat(str);
			return isNaN(num) ? null : num;
		};

		const headers = parseCSVLine(headerLine);
		const clients: any[] = [];

		for (let i = 1; i < lines.length; i++) {
			try {
				const values = parseCSVLine(lines[i]);
				if (values.length >= headers.length && values[0]) {
					const client: any = {
						id: values[0] || '',
						nombre: values[1] || '',
						telefono: values[2] || '',
						mail: values[3] || '',
						fecha_inclusion: values[4] || '',
						creado_info: values[5] || '',
						operation: values[6] || '',
						types: parseArray(values[7]),
						conditions: parseArray(values[8]),
						rooms_min: parseNumber(values[9]),
						rooms_max: parseNumber(values[10]),
						bath_min: parseNumber(values[11]),
						bath_max: parseNumber(values[12]),
						living_min: parseNumber(values[13]),
						living_max: parseNumber(values[14]),
						area_min_m2: parseNumber(values[15]),
						area_max_m2: parseNumber(values[16]),
						price_min_eur: parseNumber(values[17]),
						price_max_eur: parseNumber(values[18]),
						locations: parseArray(values[19]),
						flags: parseArray(values[20]),
						zona_std: values[21] || ''
					};
					clients.push(client);
				}
			} catch (err) {
				console.warn(`Error procesando fila de cliente ${i + 1}:`, err);
			}
		}

		console.log(`Clientes cargados: ${clients.length}`);
		return clients;
	};
	// Función para parsear CSV de matches
	const parseMatchesCSV = (csvText: string): ClientMatch[] => {
		const lines = csvText.trim().split("\n");
		if (lines.length < 2) return [];

		// Eliminar BOM si existe y preparar headers
		const headerLine = lines[0].replace(/^\uFEFF/, "");
		
		// Parser CSV más robusto que maneja comas dentro de comillas
		// Helper functions for parsing
		const parseNumber = (str: string): number => {
			if (!str || str === 'null' || str === '') return 0;
			const num = parseFloat(str);
			return isNaN(num) ? 0 : num;
		};

		const parseCSVLine = (line: string): string[] => {
			const result: string[] = [];
			let current = '';
			let inQuotes = false;
			
			for (let i = 0; i < line.length; i++) {
				const char = line[i];
				
				if (char === '"') {
					inQuotes = !inQuotes;
				} else if (char === ',' && !inQuotes) {
					result.push(current.trim());
					current = '';
				} else {
					current += char;
				}
			}
			
			result.push(current.trim());
			return result.map(v => v.replace(/^"|"$/g, ''));
		};

		const headers = parseCSVLine(headerLine);
		const matches: ClientMatch[] = [];

		for (let i = 1; i < lines.length; i++) {
			try {
				const values = parseCSVLine(lines[i]);
				
				if (values.length < headers.length) continue;

				const match: ClientMatch = {
					client_id: values[0] || '',
					client_name: values[1] || '',
					property_id: values[2] || '',
					link_inmueble: values[3] || '',
					web: values[4] || '',
					anunciante: values[5] || '',
					zona: values[6] || '',
					operacion: values[7] || '',
					tipo: values[8] || '',
					habitaciones: parseNumber(values[9]),
					banos: parseNumber(values[10]),
					m2: parseNumber(values[11]),
					precio: parseNumber(values[12]),
					score: parseNumber(values[13]),
					s_price: parseNumber(values[14]),
					s_area: parseNumber(values[15]),
					s_rooms: parseNumber(values[16]),
					s_baths: parseNumber(values[17]),
					s_operation: parseNumber(values[18]),
					zone_match: values[19] || '',
					type_match: values[20] || '',
					rank_client: parseNumber(values[21])
				};

				// Validar que los datos son válidos antes de añadir
				if (match.client_id && match.client_name && match.property_id) {
					matches.push(match);
				}
			} catch (err) {
				console.warn(`Error procesando fila de matches ${i + 1}:`, err);
			}
		}

		console.log(`Matches cargados: ${matches.length}`);

		return matches;
	};

	// Cargar CSV automáticamente al iniciar la aplicación
	useEffect(() => {
		loadCSVFromServer();
		loadMatchesFromServer();
		loadClientsFromServer();
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

	const menuItems = [
		{
			id: 'home',
			title: 'Inicio',
			icon: Home,
			description: 'Panel principal'
		},
		{
			id: 'search',
			title: 'Buscar Propiedades',
			icon: Database,
			description: 'Explorar inventario'
		},
		{
			id: 'clients',
			title: 'Buscar Clientes',
			icon: Users,
			description: 'Explorar clientes'
		},
		{
			id: 'analytics',
			title: 'Análisis de Mercado',
			icon: BarChart3,
			description: 'Insights y tendencias'
		},
		{
			id: 'matches',
			title: 'Matches de Clientes',
			icon: Target,
			description: 'Coincidencias'
		}
	];

	const renderContent = () => {
		switch (activeTab) {
			case 'home':
				return (
					<HomePage 
						onNavigate={handleNavigation}
						propertiesCount={currentProperties.length}
						matchesCount={loadedMatches.length}
					/>
				);
			case 'analytics':
				return <MarketAnalytics properties={currentProperties} />;
			case 'clients':
				return <ClientSearchPanel clients={loadedClients} />;
			case 'matches':
				return (
					<ClientMatchesPanel 
						properties={currentProperties} 
						matches={loadedMatches} 
						clients={loadedClients}
					/>
				);
			case 'search':
			default:
				return (
					<div className='space-y-6'>
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
					</div>
				);
		}
	};

	return (
		<SidebarProvider>
			<div className="flex min-h-screen w-full">
				<Sidebar>
					<SidebarHeader className="border-b">
						<div className="flex items-center gap-2 px-2 py-2">
							<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
								<img 
									src="/logo-inmo.png" 
									alt="Inmobiliaria JBC Logo" 
									className="w-6 h-6 object-contain"
								/>
							</div>
							<div>
								<h2 className="text-lg font-semibold">JBC</h2>
								<p className="text-xs text-muted-foreground">Inmobiliaria</p>
							</div>
							<div className="ml-auto">
								<SidebarTrigger className="h-7 w-7" />
							</div>
						</div>
					</SidebarHeader>

					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupLabel>Navegación</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{menuItems.map((item) => {
										const IconComponent = item.icon;
										return (
											<SidebarMenuItem key={item.id}>
												<SidebarMenuButton
													onClick={() => handleNavigation(item.id)}
													isActive={activeTab === item.id}
													className="w-full"
												>
													<IconComponent className="h-4 w-4" />
													<div className="flex flex-col items-start">
														<span className="font-medium">{item.title}</span>
														<span className="text-xs text-muted-foreground">
															{item.description}
														</span>
													</div>
												</SidebarMenuButton>
											</SidebarMenuItem>
										);
									})}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>

						{/* Stats Section */}
						<SidebarGroup>
							<SidebarGroupLabel>Estadísticas</SidebarGroupLabel>
							<SidebarGroupContent>
								<div className="px-2 space-y-2">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Propiedades:</span>
										<Badge variant="secondary">{currentProperties.length}</Badge>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Matches:</span>
										<Badge variant="secondary">{loadedMatches.length}</Badge>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Clientes:</span>
										<Badge variant="secondary">{loadedClients.length}</Badge>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Fuente:</span>
										<Badge variant={dataSource === 'csv' ? 'default' : 'outline'}>
											{dataSource === 'csv' ? 'CSV' : 'Mock'}
										</Badge>
									</div>
								</div>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>

					<SidebarFooter className="border-t">
						<div className="p-2">
							<ThemeToggle />
						</div>
					</SidebarFooter>
				</Sidebar>

				<SidebarInset>
					<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
						<div className="flex items-center gap-2">
							<h1 className="text-lg font-semibold">
								{menuItems.find(item => item.id === activeTab)?.title || 'Inmobiliaria JBC'}
							</h1>
						</div>
					</header>

					<main className="flex-1 p-6">
						{renderContent()}
					</main>
				</SidebarInset>
			</div>
		</SidebarProvider>
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