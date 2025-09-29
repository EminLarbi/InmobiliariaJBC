import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Database, ChartBar as BarChart3, Users, ArrowRight, Building2, Target, TrendingUp, Activity, Zap, Eye, Star } from 'lucide-react';

interface HomePageProps {
  onNavigate: (tabValue: string) => void;
  propertiesCount: number;
  matchesCount: number;
}

export function HomePage({ onNavigate, propertiesCount, matchesCount }: HomePageProps) {
  const sections = [
    {
      id: 'search',
      title: 'Buscar Propiedades',
      description: 'Explora y filtra el inventario completo de propiedades inmobiliarias con herramientas avanzadas de búsqueda',
      icon: Database,
      color: 'from-blue-500 to-blue-600',
      stats: `${propertiesCount.toLocaleString()} propiedades`,
      features: ['Filtros avanzados', 'Vista de tarjetas y lista', 'Ordenamiento múltiple']
    },
    {
      id: 'clients',
      title: 'Buscar Clientes',
      description: 'Gestiona y explora la base de datos completa de clientes registrados con sus preferencias',
      icon: Users,
      color: 'from-orange-500 to-orange-600',
      stats: 'Base de clientes activa',
      features: ['Perfiles detallados', 'Historial de búsquedas', 'Preferencias guardadas']
    },
    {
      id: 'analytics',
      title: 'Análisis de Mercado',
      description: 'Insights profundos y tendencias del mercado inmobiliario local con datos en tiempo real',
      icon: BarChart3,
      color: 'from-emerald-500 to-emerald-600',
      stats: 'Datos actualizados',
      features: ['Tendencias de precios', 'Análisis por zonas', 'Competencia']
    },
    {
      id: 'matches',
      title: 'Matches de Clientes',
      description: 'Sistema inteligente de coincidencias entre clientes y propiedades disponibles',
      icon: Target,
      color: 'from-purple-500 to-purple-600',
      stats: `${matchesCount.toLocaleString()} matches activos`,
      features: ['Algoritmo de matching', 'Scores de compatibilidad', 'Ranking automático']
    }
  ];

  const quickStats = [
    {
      label: 'Propiedades Totales',
      value: propertiesCount.toLocaleString(),
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
    {
      label: 'Matches Activos',
      value: matchesCount.toLocaleString(),
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30'
    },
    {
      label: 'Zonas Cubiertas',
      value: '15+',
      icon: Eye,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30'
    },
    {
      label: 'Análisis Diario',
      value: 'Activo',
      icon: Activity,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-6 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-6 py-12">
          <div className="relative">
            {/* Logo with glow effect */}
            <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-8 shadow-2xl shadow-primary/25 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <img 
                src="/logo-inmo.png" 
                alt="Inmobiliaria JBC Logo" 
                className="w-12 h-12 object-contain relative z-10"
              />
            </div>
            
            {/* Floating elements */}
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-primary/10 rounded-full animate-pulse"></div>
            <div className="absolute -bottom-2 -right-6 w-6 h-6 bg-primary/20 rounded-full animate-pulse delay-1000"></div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text">
              Inmobiliaria JBC
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Plataforma integral de gestión inmobiliaria con tecnología avanzada
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Sistema activo y actualizado</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {quickStats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="text-center space-y-2">
                <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center mx-auto`}>
                  <IconComponent className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Navigation Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {sections.map((section, index) => {
            const IconComponent = section.icon;
            return (
              <Card 
                key={section.id} 
                className="group relative overflow-hidden hover:shadow-2xl transition-all duration-500 cursor-pointer hover:scale-[1.02] border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm"
                onClick={() => onNavigate(section.id)}
              >
                {/* Background gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${section.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
                
                {/* Floating decoration */}
                <div className="absolute top-4 right-4 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                
                <CardHeader className="relative z-10 space-y-6 p-8">
                  <div className="flex items-start justify-between">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg`}>
                      <IconComponent className="h-8 w-8 text-white" />
                    </div>
                    
                    <Badge variant="secondary" className="bg-muted/50 backdrop-blur-sm">
                      {section.stats}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <CardTitle className="text-2xl group-hover:text-primary transition-colors duration-300">
                      {section.title}
                    </CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {section.description}
                    </CardDescription>
                  </div>

                  {/* Features list */}
                  <div className="space-y-2">
                    {section.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="relative z-10 p-8 pt-0">
                  <Button 
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-lg group-hover:shadow-xl"
                    variant="outline"
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(section.id);
                    }}
                  >
                    <span>Acceder</span>
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                </CardContent>

                {/* Hover effect border */}
                <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-primary/20 transition-colors duration-500"></div>
              </Card>
            );
          })}
        </div>

        {/* Additional Info Section */}
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-semibold">Sistema Inteligente de Gestión</h3>
                </div>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Nuestra plataforma utiliza algoritmos avanzados para conectar clientes con las propiedades perfectas, 
                  analizando preferencias, presupuesto y ubicación para generar matches de alta precisión.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-medium">Análisis Predictivo</h4>
                    <p className="text-sm text-muted-foreground">Tendencias de mercado en tiempo real</p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
                      <Star className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-medium">Matching Inteligente</h4>
                    <p className="text-sm text-muted-foreground">Algoritmos de compatibilidad avanzados</p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-medium">Datos en Vivo</h4>
                    <p className="text-sm text-muted-foreground">Información actualizada automáticamente</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center py-8 space-y-4">
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>Sistema operativo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Datos sincronizados</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Matches actualizados</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Selecciona una sección para comenzar a trabajar con la plataforma
          </p>
        </div>
      </div>
    </div>
  );
}