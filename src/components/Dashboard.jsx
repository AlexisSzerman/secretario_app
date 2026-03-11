// Dashboard.jsx - CON WIDGET DE RECORDATORIOS
// Copiar a: src/components/Dashboard.jsx (REEMPLAZAR)

import { useState, useEffect } from 'react'
import { Users, CheckCircle, UserX, AlertCircle, Star, Droplet, MessageCircle, Calendar, Cake } from 'lucide-react'
import { db } from '../lib/supabase'
import { calcularTiempoBautizado, calcularProximoAniversario, formatearFecha } from '../utils/dateUtils'
import WidgetRecordatorios from './WidgetRecordatorios'

export default function Dashboard({ publicadores }) {
  const [aniversariosPendientes, setAniversariosPendientes] = useState([])
  const [aniversariosMes, setAniversariosMes] = useState([])
  const [aniversariosSemana, setAniversariosSemana] = useState([])
  const [irregulares, setIrregulares] = useState([])
  const [alertaDosAMeses, setAlertaDosAMeses] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    activos: 0,
    inactivos: 0,
    irregulares: 0,
    alerta2Meses: 0,
    precursoresRegulares: 0,
    bautizados: 0
  })

  useEffect(() => {
    if (!publicadores || publicadores.length === 0) {
      setLoading(false)
      return
    }

    loadStats()
  }, [publicadores])

  // FUNCIÓN HELPER: Verifica si debía informar en un mes específico
  const debiaInformarEnMes = (publicador, mes, ano) => {
    // Si es inactivo, no debe informar
    if (publicador.tipo_servicio === 'Inactivo') {
      return false
    }

    // Verificar con en_congregacion_desde (nuevo) o activo_desde (legacy)
    const fechaBase = publicador.en_congregacion_desde || publicador.activo_desde
    
    // Si no tiene fecha, asumimos que sí debe informar
    if (!fechaBase) {
      return true
    }

    // Verificar si el mes está después de la fecha base
    const fechaMes = new Date(ano, mes - 1, 1)
    const fechaInicio = new Date(fechaBase)
    
    return fechaMes >= fechaInicio
  }

  const loadStats = async () => {
    setLoading(true)
    try {
      const inactivos = publicadores.filter(p => p.tipo_servicio === 'Inactivo')
      const activos = publicadores.filter(p => p.tipo_servicio !== 'Inactivo')
      const precursoresRegulares = publicadores.filter(p => p.tipo_servicio === 'Precursor Regular')
      const bautizados = publicadores.filter(p => p.bautizado && p.fecha_bautismo)

      // LÓGICA CORREGIDA: Meses cerrados
      const hoy = new Date()
      const mesActual = hoy.getMonth() + 1
      const anoActual = hoy.getFullYear()
      
      // CRÍTICO: No evaluar el mes vencido actual (todavía se está entregando)
      // Solo evaluar meses COMPLETAMENTE CERRADOS
      // Si hoy es 10 de marzo, el mes vencido es febrero (se entrega hasta ~5 de marzo)
      // Pero NO lo evaluamos para irregulares, solo evaluamos enero, diciembre, noviembre
      
      const irregularesDetectados = []
      const alertaDosAMesesDetectados = []

      for (const pub of activos) {
        const informes = await db.getInformesByPublicador(pub.id)
        
        // Obtener últimos 3 meses CERRADOS (no el mes vencido actual)
        // Si estamos en marzo, evaluamos: Enero, Diciembre, Noviembre
        // (Febrero todavía se está entregando, no cuenta)
        const mesesCerrados = []
        for (let i = 1; i <= 3; i++) { // CAMBIADO: Empezar en 1 (no en 0)
          let mes = mesActual - i
          let ano = anoActual
          if (mes <= 0) {
            mes += 12
            ano -= 1
          }
          mesesCerrados.push({ mes, ano })
        }

        // DEBUG: Descomentar para ver qué meses está evaluando
        // console.log('Evaluando:', pub.apellido, 'Meses cerrados:', mesesCerrados)

        // Verificar participación SOLO en meses donde debía informar
        const participaciones = mesesCerrados.map(({ mes, ano }) => {
          // Solo cuenta si debía informar en ese mes
          if (!debiaInformarEnMes(pub, mes, ano)) {
            return null // No aplica este mes
          }

          const informe = informes.find(inf => inf.mes === mes && inf.ano === ano)
          return informe?.participo || false
        })

        // Filtrar solo los meses que sí debía informar
        const participacionesValidas = participaciones.filter(p => p !== null)

        // DEBUG: Descomentar para ver participaciones
        // console.log('  Participaciones válidas:', participacionesValidas)

        // Solo evaluar si tiene al menos 3 meses donde debía informar
        if (participacionesValidas.length >= 3) {
          // Irregular: 3 meses consecutivos sin participar
          if (participacionesValidas.slice(0, 3).every(p => p === false)) {
            irregularesDetectados.push({ ...pub, mesesSinParticipar: 3 })
          }
          // Alerta: 2 meses consecutivos sin participar (pero no 3)
          else if (participacionesValidas.length >= 2 && 
                   participacionesValidas.slice(0, 2).every(p => p === false)) {
            alertaDosAMesesDetectados.push({ ...pub, mesesSinParticipar: 2 })
          }
        }
      }

      setIrregulares(irregularesDetectados)
      setAlertaDosAMeses(alertaDosAMesesDetectados)

      setStats({
        total: publicadores.length,
        activos: activos.length,
        inactivos: inactivos.length,
        irregulares: irregularesDetectados.length,
        alerta2Meses: alertaDosAMesesDetectados.length,
        precursoresRegulares: precursoresRegulares.length,
        bautizados: bautizados.length
      })

      // Aniversarios (sin cambios)
      const bautizadosActivos = bautizados.filter(p => p.tipo_servicio !== 'Inactivo')
      const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
      const finSemana = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000)

      const aniversarios = bautizadosActivos
        .map(p => {
          const tiempo = calcularTiempoBautizado(p.fecha_bautismo)
          const proximo = calcularProximoAniversario(p.fecha_bautismo)
          return { ...p, tiempo, proximo }
        })
        .filter(p => p.proximo && p.tiempo.years >= 0)

      const pendientes = aniversarios
        .filter(p => p.tiempo.years === 0 && p.tiempo.months >= 10 && p.proximo.dias <= 60)
        .sort((a, b) => a.proximo.dias - b.proximo.dias)

      setAniversariosPendientes(pendientes)
      setAniversariosMes(aniversarios.filter(p => p.proximo.fecha >= hoy && p.proximo.fecha <= finMes))
      setAniversariosSemana(aniversarios.filter(p => p.proximo.fecha >= hoy && p.proximo.fecha <= finSemana))
    } catch (error) {
      console.error('Error cargando stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-slate-100 rounded-lg w-10 h-10 animate-pulse"></div>
                <div className="h-4 bg-slate-200 rounded w-20 animate-pulse"></div>
              </div>
              <div className="h-8 bg-slate-200 rounded w-12 animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const statCards = [
    { label: 'Total', value: stats.total, icon: Users, color: 'slate' },
    { label: 'Activos', value: stats.activos, icon: CheckCircle, color: 'emerald' },
    { label: 'Inactivos', value: stats.inactivos, icon: UserX, color: 'slate' },
    { label: 'Irregulares', value: stats.irregulares, icon: AlertCircle, color: 'red' },
    { label: 'Precursores', value: stats.precursoresRegulares, icon: Star, color: 'amber' },
    { label: 'Bautizados', value: stats.bautizados, icon: Droplet, color: 'blue' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 bg-${stat.color}-50 rounded-lg`}>
                  <Icon className={`text-${stat.color}-600`} size={20} />
                </div>
                <div className="text-sm font-medium text-slate-600">{stat.label}</div>
              </div>
              <div className="text-3xl font-semibold text-slate-900">{stat.value}</div>
            </div>
          )
        })}
      </div>

      {/* Alerta de 2 meses sin participar */}
      {alertaDosAMeses.length > 0 && (
        <div className="card p-6 bg-orange-50 border border-orange-200 animate-slide-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-orange-600 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 mb-2">
                ⚠️ {alertaDosAMeses.length} Publicador{alertaDosAMeses.length > 1 ? 'es' : ''} con 2 Meses Consecutivos Sin Participar
              </h3>
              <p className="text-sm text-orange-800 mb-3">
                Atención: Estos hermanos necesitan seguimiento pastoral urgente:
              </p>
              <div className="space-y-1">
                {alertaDosAMeses.slice(0, 5).map(p => (
                  <div key={p.id} className="text-sm text-orange-900">
                    • {p.apellido}, {p.nombre} - Grupo {p.grupo}
                  </div>
                ))}
                {alertaDosAMeses.length > 5 && (
                  <div className="text-sm text-orange-800">
                    ... y {alertaDosAMeses.length - 5} más
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Irregulares (3 meses consecutivos) */}
      {irregulares.length > 0 && (
        <div className="card p-6 bg-red-50 border border-red-200 animate-slide-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-2">
                🔴 {irregulares.length} Publicador{irregulares.length > 1 ? 'es' : ''} Irregular{irregulares.length > 1 ? 'es' : ''}
              </h3>
              <p className="text-sm text-red-800 mb-3">
                3 meses consecutivos sin participar en la predicación:
              </p>
              <div className="space-y-1">
                {irregulares.slice(0, 5).map(p => (
                  <div key={p.id} className="text-sm text-red-900">
                    • {p.apellido}, {p.nombre} - Grupo {p.grupo}
                  </div>
                ))}
                {irregulares.length > 5 && (
                  <div className="text-sm text-red-800">
                    ... y {irregulares.length - 5} más
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NUEVO: Widget de Recordatorios */}
      <WidgetRecordatorios />

      {/* Layout de 2 columnas para widgets más pequeños */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charlas de 1 año pendientes */}
        {aniversariosPendientes.length > 0 && (
          <div className="card p-6 animate-slide-in">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="text-slate-700" size={24} />
              <h2 className="text-lg font-semibold text-slate-900">Charlas de Primer Año</h2>
            </div>
            <div className="space-y-3">
              {aniversariosPendientes.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <div>
                    <div className="font-medium text-slate-900">
                      {p.apellido}, {p.nombre}
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      Grupo {p.grupo} • 1 año el {formatearFecha(p.proximo.fecha)}
                    </div>
                  </div>
                  <div className="text-right">
                    {p.proximo.dias <= 7 ? (
                      <span className="badge badge-red">
                        {p.proximo.dias} días
                      </span>
                    ) : p.proximo.dias <= 30 ? (
                      <span className="badge badge-yellow">
                        {p.proximo.dias} días
                      </span>
                    ) : (
                      <span className="badge badge-green">
                        {p.proximo.dias} días
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aniversarios de la semana */}
        {aniversariosSemana.length > 0 && (
          <div className="card p-6 animate-slide-in">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-slate-700" size={24} />
              <h2 className="text-lg font-semibold text-slate-900">Aniversarios Esta Semana</h2>
            </div>
            <div className="space-y-2">
              {aniversariosSemana.map(p => (
                <div key={p.id} className="flex justify-between items-center text-sm py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <span className="font-medium text-slate-900">{formatearFecha(p.proximo.fecha)}</span>
                    <span className="mx-2 text-slate-400">•</span>
                    <span className="text-slate-700">{p.apellido}, {p.nombre}</span>
                  </div>
                  <span className="badge badge-gray">
                    {p.proximo.anos > 1 ? `${p.proximo.anos} años` : '1 año'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Aniversarios del mes */}
      {aniversariosMes.length > 0 && (
        <div className="card p-6 animate-slide-in">
          <div className="flex items-center gap-2 mb-4">
            <Cake className="text-slate-700" size={24} />
            <h2 className="text-lg font-semibold text-slate-900">Aniversarios Este Mes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {aniversariosMes.map(p => (
              <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-100">
                <div>
                  <span className="font-medium text-slate-900">{formatearFecha(p.proximo.fecha)}</span>
                  <span className="mx-2 text-slate-400">•</span>
                  <span className="text-slate-700">{p.apellido}, {p.nombre}</span>
                </div>
                <span className="text-slate-500 text-xs">
                  {p.proximo.anos} {p.proximo.anos === 1 ? 'año' : 'años'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mensaje si no hay datos */}
      {publicadores.length === 0 && (
        <div className="card p-12 text-center animate-fade-in">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-slate-100 rounded-full">
              <Users className="text-slate-600" size={48} />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            ¡Bienvenido!
          </h2>
          <p className="text-slate-600 mb-6">
            Comienza importando tu archivo Excel maestro de publicadores
          </p>
        </div>
      )}
    </div>
  )
}