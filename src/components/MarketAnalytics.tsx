import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Property } from './PropertyTable';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Chrome as Home, MapPin, Users, Calendar, CircleAlert as AlertCircle, ChartBar as BarChart3, ChartPie as PieChartIcon, Activity, Award } from 'lucide-react';
import { Star, Building, Zap, Eye, Target } from 'lucide-react';

interface MarketAnalyticsProps {
  properties: Property[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

export function MarketAnalytics({ properties }: MarketAnalyticsProps) {
  const analytics = useMemo(() => {
    if (!properties.length) return null;

    // Filtrar propiedades por tipo para análisis específicos
    const ventaProperties = properties.filter(p => p.tipo_de_operacion === 'Venta');
    const alquilerProperties = properties.filter(p => p.tipo_de_operacion === 'Alquiler');
    
    // Función para identificar zonas estratégicas
    const isStrategicZone = (zona: string) => {
      const lowerZona = zona.toLowerCase();
      return lowerZona.includes('barr') || 
             lowerZona.includes('centro') || 
             lowerZona.includes('desconocido');
    };

    // Separar propiedades por zonas estratégicas
    const strategicZoneProperties = properties.filter(p => isStrategicZone(p.zona));
    const strategicZoneVentas = ventaProperties.filter(p => isStrategicZone(p.zona));
    const otherZoneProperties = properties.filter(p => !isStrategicZone(p.zona));

    // Análisis básico (solo ventas para promedios de precios)
    const totalProperties = properties.length;
    const totalVentas = ventaProperties.length;
    const totalAlquileres = alquilerProperties.length;
    
    // Promedios basados solo en ventas
    const avgPriceVenta = totalVentas > 0 ? ventaProperties.reduce((sum, p) => sum + p.precio, 0) / totalVentas : 0;
    const validPm2Ventas = ventaProperties
      .map(p => (p.metros_cuadrados && p.metros_cuadrados > 0 ? p.precio / p.metros_cuadrados : null))
      .filter((v): v is number => typeof v === 'number' && isFinite(v));
    const avgPricePerM2Venta = validPm2Ventas.length > 0
      ? validPm2Ventas.reduce((sum, v) => sum + v, 0) / validPm2Ventas.length
      : 0;
    const avgSizeVenta = totalVentas > 0 ? ventaProperties.reduce((sum, p) => sum + p.metros_cuadrados, 0) / totalVentas : 0;

    // Promedios para alquileres
    const avgPriceAlquiler = totalAlquileres > 0 ? alquilerProperties.reduce((sum, p) => sum + p.precio, 0) / totalAlquileres : 0;
    const validPm2Alquiler = alquilerProperties
      .map(p => (p.metros_cuadrados && p.metros_cuadrados > 0 ? p.precio / p.metros_cuadrados : null))
      .filter((v): v is number => typeof v === 'number' && isFinite(v));
    const avgPricePerM2Alquiler = validPm2Alquiler.length > 0
      ? validPm2Alquiler.reduce((sum, v) => sum + v, 0) / validPm2Alquiler.length
      : 0;

    // Análisis por zona con énfasis en zonas estratégicas
    const zoneAnalysis = properties.reduce((acc, property) => {
      if (!acc[property.zona]) {
        acc[property.zona] = {
          count: 0,
          ventaCount: 0,
          alquilerCount: 0,
          totalPriceVenta: 0,
          totalPriceAlquiler: 0,
          totalSize: 0,
          ventaPrices: [],
          alquilerPrices: [],
          pricesPerM2Venta: [],
          pricesPerM2Alquiler: [],
          isStrategic: isStrategicZone(property.zona)
        };
      }
      acc[property.zona].count++;
      acc[property.zona].totalSize += property.metros_cuadrados;
      
      if (property.tipo_de_operacion === 'Venta') {
        acc[property.zona].ventaCount++;
        acc[property.zona].totalPriceVenta += property.precio;
        acc[property.zona].ventaPrices.push(property.precio);
        if (property.metros_cuadrados && property.metros_cuadrados > 0) {
          const v = property.precio / property.metros_cuadrados;
          if (isFinite(v)) acc[property.zona].pricesPerM2Venta.push(v);
        }
      } else if (property.tipo_de_operacion === 'Alquiler') {
        acc[property.zona].alquilerCount++;
        acc[property.zona].totalPriceAlquiler += property.precio;
        acc[property.zona].alquilerPrices.push(property.precio);
        if (property.metros_cuadrados && property.metros_cuadrados > 0) {
          const v = property.precio / property.metros_cuadrados;
          if (isFinite(v)) acc[property.zona].pricesPerM2Alquiler.push(v);
        }
      }
      
      return acc;
    }, {} as Record<string, any>);

    const zoneStats = Object.entries(zoneAnalysis).map(([zona, data]) => ({
      zona,
      count: data.count,
      ventaCount: data.ventaCount,
      alquilerCount: data.alquilerCount,
      avgPriceVenta: data.ventaCount > 0 ? data.totalPriceVenta / data.ventaCount : 0,
      avgPriceAlquiler: data.alquilerCount > 0 ? data.totalPriceAlquiler / data.alquilerCount : 0,
      avgPricePerM2Venta: data.pricesPerM2Venta.length > 0 ? data.pricesPerM2Venta.reduce((sum: number, p: number) => sum + p, 0) / data.pricesPerM2Venta.length : 0,
      avgPricePerM2Alquiler: data.pricesPerM2Alquiler.length > 0 ? data.pricesPerM2Alquiler.reduce((sum: number, p: number) => sum + p, 0) / data.pricesPerM2Alquiler.length : 0,
      avgSize: data.totalSize / data.count,
      marketShare: (data.count / totalProperties) * 100,
      ventaMarketShare: totalVentas > 0 ? (data.ventaCount / totalVentas) * 100 : 0,
      alquilerMarketShare: totalAlquileres > 0 ? (data.alquilerCount / totalAlquileres) * 100 : 0,
      minPriceVenta: data.ventaPrices.length > 0 ? Math.min(...data.ventaPrices) : 0,
      maxPriceVenta: data.ventaPrices.length > 0 ? Math.max(...data.ventaPrices) : 0,
      minPriceAlquiler: data.alquilerPrices.length > 0 ? Math.min(...data.alquilerPrices) : 0,
      maxPriceAlquiler: data.alquilerPrices.length > 0 ? Math.max(...data.alquilerPrices) : 0,
      isStrategic: data.isStrategic
    })).sort((a, b) => b.count - a.count);

    // Separar zonas estratégicas para análisis especial
    const strategicZones = zoneStats.filter(zone => zone.isStrategic);
    const otherZones = zoneStats.filter(zone => !zone.isStrategic);

    // Análisis por competidores
    const competitorAnalysis = properties.reduce((acc, property) => {
      if (!acc[property.anunciante]) {
        acc[property.anunciante] = {
          count: 0,
          ventaCount: 0,
          alquilerCount: 0,
          totalPriceVenta: 0,
          totalPriceAlquiler: 0,
          totalSize: 0,
          zones: new Set(),
          strategicZones: new Set(),
          types: new Set(),
          prices: []
        };
      }
      acc[property.anunciante].count++;
      acc[property.anunciante].totalSize += property.metros_cuadrados;
      acc[property.anunciante].zones.add(property.zona);
      acc[property.anunciante].types.add(property.tipo_de_operacion);
      acc[property.anunciante].prices.push(property.precio);
      
      if (isStrategicZone(property.zona)) {
        acc[property.anunciante].strategicZones.add(property.zona);
      }
      
      if (property.tipo_de_operacion === 'Venta') {
        acc[property.anunciante].ventaCount++;
        acc[property.anunciante].totalPriceVenta += property.precio;
      } else if (property.tipo_de_operacion === 'Alquiler') {
        acc[property.anunciante].alquilerCount++;
        acc[property.anunciante].totalPriceAlquiler += property.precio;
      }
      
      return acc;
    }, {} as Record<string, any>);

    const competitorStats = Object.entries(competitorAnalysis).map(([anunciante, data]) => ({
      anunciante,
      count: data.count,
      ventaCount: data.ventaCount,
      alquilerCount: data.alquilerCount,
      avgPriceVenta: data.ventaCount > 0 ? data.totalPriceVenta / data.ventaCount : 0,
      avgPriceAlquiler: data.alquilerCount > 0 ? data.totalPriceAlquiler / data.alquilerCount : 0,
      avgSize: data.totalSize / data.count,
      marketShare: (data.count / totalProperties) * 100,
      zonesCount: data.zones.size,
      strategicZonesCount: data.strategicZones.size,
      typesCount: data.types.size,
      strategicPresence: (data.strategicZones.size / strategicZones.length) * 100,
      minPrice: Math.min(...data.prices),
      maxPrice: Math.max(...data.prices)
    })).sort((a, b) => b.count - a.count);

    // Análisis temporal
    const dateAnalysis = properties.reduce((acc, property) => {
      const date = property.fecha_inclusion.split('T')[0];
      if (!acc[date]) {
        acc[date] = { 
          count: 0, 
          ventaCount: 0,
          alquilerCount: 0,
          totalPriceVenta: 0,
          totalPriceAlquiler: 0,
          properties: [] 
        };
      }
      acc[date].count++;
      acc[date].properties.push(property);
      
      if (property.tipo_de_operacion === 'Venta') {
        acc[date].ventaCount++;
        acc[date].totalPriceVenta += property.precio;
      } else if (property.tipo_de_operacion === 'Alquiler') {
        acc[date].alquilerCount++;
        acc[date].totalPriceAlquiler += property.precio;
      }
      
      return acc;
    }, {} as Record<string, any>);

    const timeSeriesData = Object.entries(dateAnalysis)
      .map(([date, data]) => ({
        date,
        count: data.count,
        ventaCount: data.ventaCount,
        alquilerCount: data.alquilerCount,
        avgPriceVenta: data.ventaCount > 0 ? data.totalPriceVenta / data.ventaCount : 0,
        avgPriceAlquiler: data.alquilerCount > 0 ? data.totalPriceAlquiler / data.alquilerCount : 0,
        totalValueVenta: data.totalPriceVenta,
        totalValueAlquiler: data.totalPriceAlquiler
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30); // Últimos 30 días

    // Análisis por características (solo ventas)
    const roomsAnalysis = ventaProperties.reduce((acc, property) => {
      const rooms = property.habitaciones;
      if (!acc[rooms]) acc[rooms] = { count: 0, totalPrice: 0, sizes: [] };
      acc[rooms].count++;
      acc[rooms].totalPrice += property.precio;
      acc[rooms].sizes.push(property.metros_cuadrados);
      return acc;
    }, {} as Record<number, any>);

    const roomsStats = Object.entries(roomsAnalysis).map(([rooms, data]) => ({
      habitaciones: parseInt(rooms),
      count: data.count,
      avgPrice: data.totalPrice / data.count,
      avgSize: data.sizes.reduce((sum: number, s: number) => sum + s, 0) / data.sizes.length,
      marketShare: totalVentas > 0 ? (data.count / totalVentas) * 100 : 0
    })).sort((a, b) => a.habitaciones - b.habitaciones);

    // Análisis por tipo de operación
    const operationStats = [
      {
        tipo: 'Venta',
        count: totalVentas,
        avgPrice: avgPriceVenta,
        avgSize: avgSizeVenta,
        marketShare: (totalVentas / totalProperties) * 100,
        totalValue: ventaProperties.reduce((sum, p) => sum + p.precio, 0)
      },
      {
        tipo: 'Alquiler',
        count: totalAlquileres,
        avgPrice: avgPriceAlquiler,
        avgSize: totalAlquileres > 0 ? alquilerProperties.reduce((sum, p) => sum + p.metros_cuadrados, 0) / totalAlquileres : 0,
        marketShare: (totalAlquileres / totalProperties) * 100,
        totalValue: alquilerProperties.reduce((sum, p) => sum + p.precio, 0)
      }
    ];

    // Detección de oportunidades en zonas estratégicas
    const strategicOpportunities = strategicZones.filter(zone => 
      zone.ventaCount > 0 && // Debe tener ventas
      zone.ventaCount < strategicZoneVentas.length * 0.15 && // Zona poco explotada
      zone.avgPricePerM2Venta > avgPricePerM2Venta * 1.05 // Precios por encima del promedio
    );

    // Análisis de penetración en zonas estratégicas
    const strategicZoneAnalysis = {
      totalStrategicZones: strategicZones.length,
      totalStrategicProperties: strategicZoneProperties.length,
      strategicMarketShare: (strategicZoneProperties.length / totalProperties) * 100,
      avgPriceStrategicVenta: strategicZoneVentas.length > 0 ? 
        strategicZoneVentas.reduce((sum, p) => sum + p.precio, 0) / strategicZoneVentas.length : 0,
      avgPricePerM2Strategic: (() => {
        const values = strategicZoneVentas
          .map(p => (p.metros_cuadrados && p.metros_cuadrados > 0 ? p.precio / p.metros_cuadrados : null))
          .filter((v): v is number => typeof v === 'number' && isFinite(v));
        return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
      })()
    };

    return {
      totalProperties,
      totalVentas,
      totalAlquileres,
      avgPriceVenta,
      avgPriceAlquiler,
      avgPricePerM2Venta,
      avgPricePerM2Alquiler,
      avgSizeVenta,
      zoneStats,
      strategicZones,
      otherZones,
      competitorStats,
      timeSeriesData,
      roomsStats,
      operationStats,
      strategicOpportunities,
      strategicZoneAnalysis
    };
  }, [properties]);

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No hay datos disponibles para el análisis</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-ES').format(Math.round(value));
  };

  return (
    <div className="space-y-6">
      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Propiedades</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(analytics.totalProperties)}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalVentas} ventas • {analytics.totalAlquileres} alquileres
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precio Promedio Venta</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.avgPriceVenta)}</div>
            <p className="text-xs text-muted-foreground">
              Alquiler: {formatCurrency(analytics.avgPriceAlquiler)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precio/m² Venta</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.avgPricePerM2Venta)}</div>
            <p className="text-xs text-muted-foreground">
              Alquiler: {formatCurrency(analytics.avgPricePerM2Alquiler)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zonas Estratégicas</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.strategicZones.length}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.strategicZoneAnalysis.strategicMarketShare.toFixed(1)}% del mercado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Análisis de Zonas Estratégicas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Zonas Estratégicas Prioritarias
          </CardTitle>
          <CardDescription>
            Análisis de zonas que contienen "Barr", "Centro" o "Desconocido" - Foco principal del negocio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <h4 className="font-medium mb-4">Rendimiento de Zonas Estratégicas</h4>
            <div className="space-y-4">
              {analytics.strategicZones.slice(0, 8).map((zone, index) => (
                <div key={zone.zona} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        <Star className="h-3 w-3 mr-1" />
                        {zone.zona}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{zone.count} propiedades</p>
                      <p className="text-xs text-muted-foreground">
                        {zone.ventaCount}V • {zone.alquilerCount}A
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Precio venta</p>
                      <p className="font-medium">
                        {zone.avgPriceVenta > 0 ? formatCurrency(zone.avgPriceVenta) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Precio/m² venta</p>
                      <p className="font-medium">
                        {zone.avgPricePerM2Venta > 0 ? formatCurrency(zone.avgPricePerM2Venta) : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <Progress value={zone.marketShare} className="h-2" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Análisis por Zonas Generales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Análisis por Zonas (Ventas)
            </CardTitle>
            <CardDescription>
              Distribución del mercado de ventas por ubicación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.zoneStats.slice(0, 8).filter(z => z.ventaCount > 0)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="zona" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={12}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value: any, name: string) => {
                      if (name === 'ventaCount') return [value, 'Ventas'];
                      if (name === 'avgPriceVenta') return [formatCurrency(value), 'Precio Promedio Venta'];
                      return [value, name];
                    }}
                  />
                  <Bar yAxisId="left" dataKey="ventaCount" fill="#8884d8" name="ventaCount" />
                  <Bar yAxisId="right" dataKey="avgPriceVenta" fill="#82ca9d" name="avgPriceVenta" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Competidores con presencia estratégica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Competidores y Presencia Estratégica
            </CardTitle>
            <CardDescription>
              Anunciantes principales y su penetración en zonas estratégicas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.competitorStats.slice(0, 6).map((competitor, index) => (
                <div key={competitor.anunciante} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={index < 3 ? "default" : "secondary"}>
                        #{index + 1}
                      </Badge>
                      <span className="font-medium text-sm">{competitor.anunciante}</span>
                      {competitor.strategicZonesCount > 0 && (
                        <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-foreground dark:text-black">
                          <Star className="h-3 w-3 mr-1" />
                          {competitor.strategicZonesCount} estratégicas
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {competitor.count} propiedades
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {competitor.ventaCount}V • {competitor.alquilerCount}A
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Precio venta</p>
                      <p className="font-medium">
                        {competitor.avgPriceVenta > 0 ? formatCurrency(competitor.avgPriceVenta) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Zonas totales</p>
                      <p className="font-medium">{competitor.zonesCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Penetración estratégica</p>
                      <p className="font-medium">{competitor.strategicPresence.toFixed(1)}%</p>
                    </div>
                  </div>
                  <Progress value={competitor.marketShare} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencia Temporal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Tendencias Temporales por Tipo
            </CardTitle>
            <CardDescription>
              Evolución de ventas vs alquileres (últimos 30 días)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(date) => new Date(date).toLocaleDateString('es-ES')}
                    formatter={(value: any, name: string) => {
                      if (name === 'ventaCount') return [value, 'Nuevas Ventas'];
                      if (name === 'alquilerCount') return [value, 'Nuevos Alquileres'];
                      return [value, name];
                    }}
                  />
                  <Area type="monotone" dataKey="ventaCount" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="alquilerCount" stackId="1" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribución por Habitaciones (solo ventas) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Distribución por Habitaciones (Ventas)
            </CardTitle>
            <CardDescription>
              Demanda del mercado de ventas según número de habitaciones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.roomsStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ habitaciones, marketShare }) => `${habitaciones}H (${marketShare.toFixed(1)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics.roomsStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [value, 'Ventas']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análisis de Segmentación por Tipo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Segmentación del Mercado
          </CardTitle>
          <CardDescription>
            Análisis comparativo entre ventas y alquileres
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analytics.operationStats.map((operation, index) => (
              <div key={operation.tipo} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-lg">{operation.tipo}</h4>
                  <Badge variant={operation.tipo === 'Venta' ? 'default' : 'secondary'}>
                    {operation.count} propiedades
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">Precio promedio</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(operation.avgPrice)}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">Superficie media</p>
                    <p className="text-lg font-bold text-primary">{Math.round(operation.avgSize)} m²</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Cuota de mercado</span>
                    <span className="font-medium">{operation.marketShare.toFixed(1)}%</span>
                  </div>
                  <Progress value={operation.marketShare} className="h-2" />
                </div>
                <div className="p-3 bg-muted/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Valor total del segmento</p>
                  <p className="text-xl font-bold">{formatCurrency(operation.totalValue)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
