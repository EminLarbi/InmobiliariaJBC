import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { MultiSelect } from './MultiSelect';
import { Calendar } from './ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { ListFilter as FilterX, Chrome as Home, Bath, Square, MapPin, User, ShoppingCart, Euro, Info, TrendingUp, ListFilter as Filter, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from './ui/utils';

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
  dateFilter: 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom';
  fechaDesde: string;
  fechaHasta: string;
}

interface PropertyFiltersProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string | string[]) => void;
  onClearFilters: () => void;
  zonas: string[];
  anunciantes: string[];
  tiposOperacion: string[];
}

const dateFilterOptions = [
  { value: 'all', label: 'Todas las fechas', icon: CalendarIcon },
  { value: 'today', label: 'Hoy', icon: Clock },
  { value: 'yesterday', label: 'Ayer', icon: Clock },
  { value: 'last7days', label: 'Últimos 7 días', icon: CalendarIcon },
  { value: 'last30days', label: 'Últimos 30 días', icon: CalendarIcon },
  { value: 'custom', label: 'Rango personalizado', icon: CalendarIcon },
];

export function PropertyFilters({ 
  filters, 
  onFilterChange, 
  onClearFilters, 
  zonas, 
  anunciantes, 
  tiposOperacion 
}: PropertyFiltersProps) {
  const [priceRange, setPriceRange] = useState<number[]>([
    parseInt(filters.precioMin) || 0,
    parseInt(filters.precioMax) || 1000000
  ]);
  
  const [sizeRange, setSizeRange] = useState<number[]>([
    parseInt(filters.metrosMin) || 20,
    parseInt(filters.metrosMax) || 300
  ]);

  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const handlePriceRangeChange = (values: number[]) => {
    setPriceRange(values);
    onFilterChange('precioMin', values[0] > 0 ? values[0].toString() : '');
    onFilterChange('precioMax', values[1] < 1000000 ? values[1].toString() : '');
  };

  const handleSizeRangeChange = (values: number[]) => {
    setSizeRange(values);
    onFilterChange('metrosMin', values[0] > 20 ? values[0].toString() : '');
    onFilterChange('metrosMax', values[1] < 300 ? values[1].toString() : '');
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M€`;
    if (price >= 1000) return `${(price / 1000).toFixed(0)}K€`;
    return `${price}€`;
  };

  const handleTipoOperacionToggle = (tipo: string) => {
    const currentValues = filters.tipos_de_operacion;
    let newValues: string[];
    
    if (currentValues.includes(tipo)) {
      newValues = currentValues.filter(v => v !== tipo);
    } else {
      newValues = [...currentValues, tipo];
    }
    
    onFilterChange('tipos_de_operacion', newValues);
  };

  const handleDateFilterChange = (value: FilterState['dateFilter']) => {
    onFilterChange('dateFilter', value);
    if (value !== 'custom') {
      onFilterChange('fechaDesde', '');
      onFilterChange('fechaHasta', '');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  const getDateRangeText = () => {
    switch (filters.dateFilter) {
      case 'today':
        return 'Inmuebles añadidos hoy';
      case 'yesterday':
        return 'Inmuebles añadidos ayer';
      case 'last7days':
        return 'Inmuebles de los últimos 7 días';
      case 'last30days':
        return 'Inmuebles de los últimos 30 días';
      case 'custom':
        if (filters.fechaDesde && filters.fechaHasta) {
          return `Del ${formatDate(filters.fechaDesde)} al ${formatDate(filters.fechaHasta)}`;
        } else if (filters.fechaDesde) {
          return `Desde ${formatDate(filters.fechaDesde)}`;
        } else if (filters.fechaHasta) {
          return `Hasta ${formatDate(filters.fechaHasta)}`;
        }
        return 'Selecciona un rango de fechas';
      default:
        return '';
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.habitaciones) count++;
    if (filters.baños) count++;
    if (filters.precioMin || filters.precioMax) count++;
    if (filters.metrosMin || filters.metrosMax) count++;
    if (filters.tipos_de_operacion.length > 0) count++;
    if (filters.zonas.length > 0) count++;
    if (filters.anunciantes.length > 0) count++;
    if (filters.dateFilter !== 'all') count++;
    return count;
  };

  const getActiveFiltersList = () => {
    const active = [];
    if (filters.habitaciones) active.push(`${filters.habitaciones} habitaciones`);
    if (filters.baños) active.push(`${filters.baños} baños`);
    if (filters.precioMin || filters.precioMax) {
      const min = filters.precioMin ? formatPrice(parseInt(filters.precioMin)) : '';
      const max = filters.precioMax ? formatPrice(parseInt(filters.precioMax)) : '';
      if (min && max) active.push(`${min} - ${max}`);
      else if (min) active.push(`Desde ${min}`);
      else if (max) active.push(`Hasta ${max}`);
    }
    if (filters.metrosMin || filters.metrosMax) {
      const min = filters.metrosMin || '';
      const max = filters.metrosMax || '';
      if (min && max) active.push(`${min}-${max} m²`);
      else if (min) active.push(`Desde ${min} m²`);
      else if (max) active.push(`Hasta ${max} m²`);
    }
    if (filters.tipos_de_operacion.length > 0) {
      active.push(`Tipos: ${filters.tipos_de_operacion.join(', ')}`);
    }
    if (filters.zonas.length > 0) {
      active.push(`Zonas: ${filters.zonas.length > 2 ? `${filters.zonas.slice(0, 2).join(', ')} y ${filters.zonas.length - 2} más` : filters.zonas.join(', ')}`);
    }
    if (filters.anunciantes.length > 0) {
      active.push(`Anunciantes: ${filters.anunciantes.length > 2 ? `${filters.anunciantes.slice(0, 2).join(', ')} y ${filters.anunciantes.length - 2} más` : filters.anunciantes.join(', ')}`);
    }
    if (filters.dateFilter !== 'all') {
      const dateOption = dateFilterOptions.find(opt => opt.value === filters.dateFilter);
      active.push(`Fecha: ${dateOption?.label || filters.dateFilter}`);
    }
    return active;
  };

  const getFilterStats = () => {
    return {
      zonasCount: filters.zonas.length,
      anunciantesCount: filters.anunciantes.length,
      tiposCount: filters.tipos_de_operacion.length,
      totalZonas: zonas.length,
      totalAnunciantes: anunciantes.length
    };
  };

  const stats = getFilterStats();

  const handleDateSelect = (date: Date | undefined, field: 'fechaDesde' | 'fechaHasta') => {
    if (date) {
      const isoString = date.toISOString().split('T')[0];
      onFilterChange(field, isoString);
    } else {
      onFilterChange(field, '');
    }
  };

  const parseDate = (dateString: string): Date | undefined => {
    if (!dateString) return undefined;
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filtros de búsqueda
            </CardTitle>
            <CardDescription>
              Personaliza tu búsqueda con los filtros que necesites. Puedes seleccionar múltiples opciones.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary">
                {getActiveFiltersCount()} filtro{getActiveFiltersCount() !== 1 ? 's' : ''}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              <FilterX className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Filtros activos */}
        {getActiveFiltersCount() > 0 && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Filtros activos:</Label>
            <div className="flex flex-wrap gap-2">
              {getActiveFiltersList().map((filter, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {filter}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Filtros de fecha - Nueva sección */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <Label>Fecha de inclusión</Label>
            <span className="text-xs text-muted-foreground ml-auto">Filtra por cuándo se añadió el inmueble</span>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {dateFilterOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <Button
                  key={option.value}
                  variant={filters.dateFilter === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleDateFilterChange(option.value as FilterState['dateFilter'])}
                  className="text-xs h-auto py-2 flex flex-col gap-1"
                >
                  <IconComponent className="h-3 w-3" />
                  <span>{option.label}</span>
                </Button>
              );
            })}
          </div>

          {/* Mostrar descripción del filtro activo */}
          {filters.dateFilter !== 'all' && (
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{getDateRangeText()}</span>
              </div>
            </div>
          )}

          {/* Controles de fecha personalizada */}
          {filters.dateFilter === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/10">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Fecha desde</Label>
                <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.fechaDesde && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fechaDesde ? formatDate(filters.fechaDesde) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseDate(filters.fechaDesde)}
                      onSelect={(date) => {
                        handleDateSelect(date, 'fechaDesde');
                        setDateFromOpen(false);
                      }}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Fecha hasta</Label>
                <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.fechaHasta && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fechaHasta ? formatDate(filters.fechaHasta) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseDate(filters.fechaHasta)}
                      onSelect={(date) => {
                        handleDateSelect(date, 'fechaHasta');
                        setDateToOpen(false);
                      }}
                      disabled={(date) => {
                        const today = new Date();
                        const fromDate = parseDate(filters.fechaDesde);
                        return date > today || (fromDate && date < fromDate);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Tipo de operación - 3 botones en fila */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <Label>Tipo de operación</Label>
            <span className="text-xs text-muted-foreground ml-auto">Selecciona uno o varios tipos</span>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {tiposOperacion.map((tipo) => (
              <Button
                key={tipo}
                variant={filters.tipos_de_operacion.includes(tipo) ? "default" : "outline"}
                size="sm"
                onClick={() => handleTipoOperacionToggle(tipo)}
                className="text-sm"
              >
                {tipo}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Layout optimizado: habitaciones/baños compactos + ubicación/anunciantes balanceados */}
        <div className="space-y-6">
          {/* Habitaciones y baños - en fila compacta */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <Label>Características de la propiedad</Label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Habitaciones</Label>
                <Input
                  type="number"
                  placeholder="Ej: 3"
                  value={filters.habitaciones}
                  onChange={(e) => onFilterChange('habitaciones', e.target.value)}
                  min="0"
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Baños</Label>
                <Input
                  type="number"
                  placeholder="Ej: 2"
                  value={filters.baños}
                  onChange={(e) => onFilterChange('baños', e.target.value)}
                  min="0"
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Ubicación y anunciantes - layout mejorado con estadísticas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <Label>Ubicación y anunciantes</Label>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>{zonas.length} zonas disponibles</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{anunciantes.length} anunciantes</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ubicación con estadísticas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Zonas</Label>
                  {stats.zonasCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {stats.zonasCount} de {stats.totalZonas}
                    </Badge>
                  )}
                </div>
                <MultiSelect
                  options={zonas}
                  selected={filters.zonas}
                  onSelectionChange={(selected) => onFilterChange('zonas', selected)}
                  placeholder="Seleccionar zonas..."
                  searchPlaceholder="Buscar zona..."
                  emptyText="No se encontraron zonas"
                />
              </div>

              {/* Anunciantes con estadísticas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Anunciantes</Label>
                  {stats.anunciantesCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {stats.anunciantesCount} de {stats.totalAnunciantes}
                    </Badge>
                  )}
                </div>
                <MultiSelect
                  options={anunciantes}
                  selected={filters.anunciantes}
                  onSelectionChange={(selected) => onFilterChange('anunciantes', selected)}
                  placeholder="Seleccionar anunciantes..."
                  searchPlaceholder="Buscar anunciante..."
                  emptyText="No se encontraron anunciantes"
                />
              </div>
            </div>

            {/* Panel de estadísticas de selección */}
            {(stats.zonasCount > 0 || stats.anunciantesCount > 0) && (
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Resumen de selección</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Zonas seleccionadas:</span>
                    <span className="font-medium">{stats.zonasCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Anunciantes seleccionados:</span>
                    <span className="font-medium">{stats.anunciantesCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Rangos con sliders - layout optimizado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Precio */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-primary" />
              <Label>Rango de precio</Label>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{formatPrice(priceRange[0])}</span>
                <span>{formatPrice(priceRange[1])}</span>
              </div>
              <Slider
                value={priceRange}
                onValueChange={handlePriceRangeChange}
                max={1000000}
                min={0}
                step={10000}
                className="w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mínimo</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.precioMin}
                    onChange={(e) => onFilterChange('precioMin', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Máximo</Label>
                  <Input
                    type="number"
                    placeholder="Sin límite"
                    value={filters.precioMax}
                    onChange={(e) => onFilterChange('precioMax', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Superficie */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Square className="h-4 w-4 text-primary" />
              <Label>Superficie en m²</Label>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{sizeRange[0]} m²</span>
                <span>{sizeRange[1]} m²</span>
              </div>
              <Slider
                value={sizeRange}
                onValueChange={handleSizeRangeChange}
                max={300}
                min={20}
                step={5}
                className="w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mínimo</Label>
                  <Input
                    type="number"
                    placeholder="20"
                    value={filters.metrosMin}
                    onChange={(e) => onFilterChange('metrosMin', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Máximo</Label>
                  <Input
                    type="number"
                    placeholder="Sin límite"
                    value={filters.metrosMax}
                    onChange={(e) => onFilterChange('metrosMax', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}