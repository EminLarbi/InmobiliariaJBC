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
      color: 'from-blue-500 via-cyan-500 to-blue-600',
      accentColor: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      stats: `${propertiesCount.toLocaleString()} propiedades`,
      features: ['Filtros avanzados', 'Vista de tarjetas y lista', 'Ordenamiento múltiple']
    },
    {
      id: 'clients',
      title: 'Buscar Clientes',
      description: 'Gestiona y explora la base de datos completa de clientes registrados con sus preferencias',
      icon: Users,
      color: 'from-orange-500 via-red-500 to-pink-600',
      accentColor: 'bg-orange-500',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
      stats: 'Base de clientes activa',
      features: ['Perfiles detallados', 'Historial de búsquedas', 'Preferencias guardadas']
    },
    {
      id: 'analytics',
      title: 'Análisis de Mercado',
      description: 'Insights profundos y tendencias del mercado inmobiliario local con datos en tiempo real',
      icon: BarChart3,
      color: 'from-emerald-500 via-teal-500 to-green-600',
      accentColor: 'bg-emerald-500',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      stats: 'Datos actualizados',
      features: ['Tendencias de precios', 'Análisis por zonas', 'Competencia']
    },
    {
      id: 'matches',
      title: 'Matches de Clientes',
      description: 'Sistema inteligente de coincidencias entre clientes y propiedades disponibles',
      icon: Target,
      color: 'from-purple-500 via-violet-500 to-indigo-600',
      accentColor: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
      stats: `${matchesCount.toLocaleString()} matches activos`,
      features: ['Algoritmo de matching', 'Scores de compatibilidad', 'Ranking automático']
    }
  ];

  const quickStats = [
    {
      label: 'Propiedades Totales',
      value: propertiesCount.toLocaleString(),
      icon: Building2,
      color: 'text-blue-700',
      bgColor: 'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    {
      label: 'Matches Activos',
      value: matchesCount.toLocaleString(),
      icon: Target,
      color: 'text-purple-700',
      bgColor: 'bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40',
      borderColor: 'border-purple-200 dark:border-purple-800'
    },
    {
      label: 'Zonas Cubiertas',
      value: '15+',
      icon: Eye,
      color: 'text-emerald-700',
      bgColor: 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40',
      borderColor: 'border-emerald-200 dark:border-emerald-800'
    },
    {
      label: 'Análisis Diario',
      value: 'Activo',
      icon: Activity,
      color: 'text-orange-700',
      bgColor: 'bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/40 dark:to-red-900/40',
      borderColor: 'border-orange-200 dark:border-orange-800'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-emerald-50 dark:from-gray-900 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="container mx-auto p-6 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-6 py-12 relative">
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-1/4 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute top-40 right-1/4 w-24 h-24 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-2xl animate-pulse delay-1000"></div>
            <div className="absolute bottom-20 left-1/3 w-28 h-28 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
          </div>
          
          <div className="relative">
            {/* Logo with glow effect */}
            <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 via-purple-500 to-emerald-500 flex items-center justify-center mb-8 shadow-2xl shadow-purple-500/30 relative overflow-hidden animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-tl from-yellow-400/20 via-transparent to-transparent"></div>
              <img 
                src="/logo-inmo.png" 
                alt="Inmobiliaria JBC Logo" 
                className="w-14 h-14 object-contain relative z-10 drop-shadow-lg"
              />
            </div>
            
            {/* Floating elements */}
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full animate-bounce opacity-60"></div>
            <div className="absolute -bottom-2 -right-6 w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full animate-bounce delay-1000 opacity-60"></div>
            <div className="absolute top-8 -right-8 w-4 h-4 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-full animate-ping opacity-40"></div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent animate-pulse">
              Inmobiliaria JBC
            </h1>
            <p className="text-xl md:text-2xl bg-gradient-to-r from-gray-600 via-blue-600 to-purple-600 bg-clip-text text-transparent max-w-3xl mx-auto leading-relaxed font-medium">
              Plataforma integral de gestión inmobiliaria con tecnología avanzada
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
              <span>Sistema activo y actualizado</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {quickStats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="text-center space-y-3 group">
                <div className={`w-16 h-16 ${stat.bgColor} ${stat.borderColor} border-2 rounded-2xl flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                  <IconComponent className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-200 dark:to-gray-400 bg-clip-text text-transparent">{stat.value}</div>
                  <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
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
                className={`group relative overflow-hidden hover:shadow-2xl transition-all duration-500 cursor-pointer hover:scale-[1.02] border-2 border-transparent hover:border-gradient-to-r ${section.bgColor} backdrop-blur-sm hover:shadow-${section.accentColor.split('-')[1]}-500/25`}
                onClick={() => onNavigate(section.id)}
              >
                {/* Background gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${section.color} opacity-5 group-hover:opacity-15 transition-opacity duration-500`}></div>
                
                {/* Animated color orbs */}
                <div className={`absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br ${section.color} rounded-full opacity-10 group-hover:opacity-20 group-hover:scale-150 transition-all duration-700 blur-xl`}></div>
                <div className={`absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-tr ${section.color} rounded-full opacity-5 group-hover:opacity-15 group-hover:scale-125 transition-all duration-500 blur-lg`}></div>
                
                {/* Floating decoration */}
                <div className={`absolute top-4 right-4 w-32 h-32 bg-gradient-to-br ${section.color} opacity-10 rounded-full blur-2xl group-hover:scale-150 group-hover:opacity-20 transition-all duration-700`}></div>
                
                <CardHeader className="relative z-10 space-y-6 p-8">
                  <div className="flex items-start justify-between">
                    <div className={`w-18 h-18 rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-xl shadow-${section.accentColor.split('-')[1]}-500/30 group-hover:shadow-2xl`}>
                      <IconComponent className="h-8 w-8 text-white" />
                    </div>
                    
                    <Badge variant="secondary" className={`${section.bgColor} backdrop-blur-sm border ${section.textColor} font-medium shadow-sm`}>
                      {section.stats}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <CardTitle className={`text-2xl group-hover:${section.textColor} transition-colors duration-300 font-bold`}>
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
                        <div className={`w-2 h-2 bg-gradient-to-r ${section.color} rounded-full shadow-sm`}></div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="relative z-10 p-8 pt-0">
                  <Button 
                    className={`w-full group-hover:bg-gradient-to-r group-hover:${section.color} group-hover:text-white transition-all duration-300 shadow-lg group-hover:shadow-xl group-hover:shadow-${section.accentColor.split('-')[1]}-500/25 border-2 border-transparent group-hover:border-white/20`}
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
                <div className={`absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-gradient-to-r group-hover:${section.color} group-hover:opacity-30 transition-all duration-500`}></div>
              </Card>
            );
          })}
        </div>

        {/* Additional Info Section */}
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-r from-blue-50 via-purple-50 to-emerald-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-emerald-950/30 border-2 border-gradient-to-r from-blue-200 via-purple-200 to-emerald-200 dark:from-blue-800 dark:via-purple-800 dark:to-emerald-800 shadow-xl">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Sistema Inteligente de Gestión</h3>
                </div>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Nuestra plataforma utiliza algoritmos avanzados para conectar clientes con las propiedades perfectas, 
                  analizando preferencias, presupuesto y ubicación para generar matches de alta precisión.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 border-2 border-green-200 dark:border-green-800 rounded-xl flex items-center justify-center mx-auto shadow-lg hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-green-700 dark:text-green-300">Análisis Predictivo</h4>
                    <p className="text-sm text-muted-foreground">Tendencias de mercado en tiempo real</p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/40 dark:to-orange-900/40 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl flex items-center justify-center mx-auto shadow-lg hover:scale-110 transition-transform duration-300">
                      <Star className="h-6 w-6 text-yellow-600" />
                    </div>
                    <h4 className="font-semibold text-yellow-700 dark:text-yellow-300">Matching Inteligente</h4>
                    <p className="text-sm text-muted-foreground">Algoritmos de compatibilidad avanzados</p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 border-2 border-purple-200 dark:border-purple-800 rounded-xl flex items-center justify-center mx-auto shadow-lg hover:scale-110 transition-transform duration-300">
                      <Activity className="h-6 w-6 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-purple-700 dark:text-purple-300">Datos en Vivo</h4>
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
              <div className="w-3 h-3 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full animate-pulse shadow-sm"></div>
              <span>Sistema operativo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full animate-pulse delay-500 shadow-sm"></div>
              <span>Datos sincronizados</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full animate-pulse delay-1000 shadow-sm"></div>
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