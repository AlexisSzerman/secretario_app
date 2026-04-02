import { useState, useEffect } from 'react'
import { Calendar, AlertCircle, CheckCircle } from 'lucide-react'
import { getAnoServicioActual, getMesesAnoServicio, esMesVencido, getMesNombre, getMesVencido } from '../utils/dateUtils'
import { db } from '../lib/supabase'

export default function VistaAnoServicio({ publicadores }) {
  const [analisis, setAnalisis] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Cargando datos...')
  const [filtro, setFiltro] = useState('TODOS')

  useEffect(() => {
    loadAnalisis()
  }, [publicadores])

  // FUNCIÓN HELPER: Verifica si debía informar en un mes específico
  const debiaInformarEnMes = (publicador, mes, ano) => {
    if (publicador.tipo_servicio === 'Inactivo') return false
    
    const fechaBase = publicador.en_congregacion_desde || publicador.activo_desde
    if (!fechaBase) return true
    
    const fechaMes = new Date(ano, mes - 1, 1)
    const fechaInicio = new Date(fechaBase)
    
    return fechaMes >= fechaInicio
  }

const loadAnalisis = async () => {
  setLoading(true)
  setLoadingMessage('Calculando año de servicio...')
  
  try {
    const anoServicio = getAnoServicioActual()
    const mesesAnoServicio = getMesesAnoServicio(anoServicio)

    const hoy = new Date()
    const diaActual = hoy.getDate()
    const mesActual = hoy.getMonth() + 1
    const anoActual = hoy.getFullYear()

    // Mes vencido
    let mesVencido = mesActual - 1
    let anoVencido = anoActual
    if (mesVencido <= 0) {
      mesVencido += 12
      anoVencido -= 1
    }

    // 🔒 Meses cerrados (solo para promedio)
    const mesesCerradosSet = new Set(
      mesesAnoServicio
        .filter(m => {
          const fechaMes = new Date(m.ano, m.mes - 1, 1)
          const fechaVencido = new Date(anoVencido, mesVencido - 1, 1)

          if (m.mes === mesVencido && m.ano === anoVencido) {
            return diaActual >= 6
          }

          return fechaMes < fechaVencido
        })
        .map(m => `${m.mes}-${m.ano}`)
    )

    const precursores = publicadores.filter(p => 
      p.tipo_servicio === 'Precursor Regular' && 
      p.tipo_servicio !== 'Inactivo'
    )

    setLoadingMessage('Cargando informes...')

    // 🔥 Traer TODOS los meses
    const informesPromises = mesesAnoServicio.map(m =>
      db.getInformesByMesAno(m.mes, m.ano)
    )

    const todosLosInformes = await Promise.all(informesPromises)

    // Map mes-año → informes[]
    const informesMap = new Map()
    mesesAnoServicio.forEach((mesInfo, index) => {
      const key = `${mesInfo.mes}-${mesInfo.ano}`
      informesMap.set(key, todosLosInformes[index])
    })

    const analisisPrecursores = []

    for (const pub of precursores) {
      let horasTotales = 0
      let mesesInformados = 0              // 🔥 UI
      let mesesInformadosCerrados = 0      // 🔒 promedio

      for (const mesInfo of mesesAnoServicio) {
        if (!debiaInformarEnMes(pub, mesInfo.mes, mesInfo.ano)) continue

        const key = `${mesInfo.mes}-${mesInfo.ano}`
        const informes = informesMap.get(key) || []

        const informe = informes.find(i => 
          String(i.publicador_id) === String(pub.id)
        )

        if (informe) {
          const horas = informe.horas || 0

          // 🔥 acumulado real
          horasTotales += horas
          mesesInformados++

          // 🔒 si es mes cerrado, cuenta para promedio
          if (mesesCerradosSet.has(key)) {
            mesesInformadosCerrados++
          }
        }
      }

      // === CÁLCULOS ===
      let mesDelAnoServicio
      if (mesActual >= 9) {
        mesDelAnoServicio = mesActual - 8
      } else {
        mesDelAnoServicio = mesActual + 4
      }

      const totalMesesAno = 12
      const mesesRestantes = totalMesesAno - mesDelAnoServicio + 1

      const promedioMensual = mesesInformadosCerrados > 0 
        ? horasTotales / mesesInformadosCerrados 
        : 0

      const proyeccion12Meses = promedioMensual * 12

      const horasFaltanPara560 = Math.max(560 - horasTotales, 0)
      const horasFaltanPara600 = Math.max(600 - horasTotales, 0)

      const horasMesPara560 = mesesRestantes > 0 
        ? horasFaltanPara560 / mesesRestantes 
        : 0

      const horasMesPara600 = mesesRestantes > 0 
        ? horasFaltanPara600 / mesesRestantes 
        : 0

      let estado = 'ok'
      if (horasMesPara560 >= 60) {
        estado = 'critico'
      } else if (horasMesPara560 >= 55) {
        estado = 'atencion'
      } else if (proyeccion12Meses >= 560) {
        estado = 'en-meta'
      } else {
        estado = 'bajo-meta'
      }

      analisisPrecursores.push({
        ...pub,
        horasTotales: Math.round(horasTotales),
        mesesInformados, // ✅ ESTE ES EL QUE VA A LA UI (ya está bien)
        totalMesesAno,
        mesesRestantes,
        promedioMensual: parseFloat(promedioMensual.toFixed(1)),
        horasMesPara560: parseFloat(horasMesPara560.toFixed(1)),
        horasMesPara600: parseFloat(horasMesPara600.toFixed(1)),
        proyeccion12Meses: Math.round(proyeccion12Meses),
        estado
      })
    }

    analisisPrecursores.sort((a, b) => {
      const estadoOrder = { critico: 0, atencion: 1, 'bajo-meta': 2, 'en-meta': 3, ok: 4 }
      if (estadoOrder[a.estado] !== estadoOrder[b.estado]) {
        return estadoOrder[a.estado] - estadoOrder[b.estado]
      }
      return a.proyeccion12Meses - b.proyeccion12Meses
    })

    setAnalisis(analisisPrecursores)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    setLoading(false)
  }
}

  const anoServicio = getAnoServicioActual()
  
  const analisisFiltrado = analisis.filter(a => {
    if (filtro === 'ALERTA') return a.estado === 'critico' || a.estado === 'atencion' || a.estado === 'bajo-meta'
    if (filtro === 'OK') return a.estado === 'en-meta'
    return true
  })

  const stats = {
    total: analisis.length,
    criticos: analisis.filter(a => a.estado === 'critico').length,
    atencion: analisis.filter(a => a.estado === 'atencion').length,
    bajoMeta: analisis.filter(a => a.estado === 'bajo-meta').length,
    enMeta: analisis.filter(a => a.estado === 'en-meta').length,
    promedioGeneral: analisis.length > 0 
      ? (analisis.reduce((sum, a) => sum + a.horasTotales, 0) / analisis.reduce((sum, a) => sum + a.mesesInformados, 0)).toFixed(1)
      : 0
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
            <p className="text-slate-900 font-medium">{loadingMessage}</p>
            <p className="text-xs text-slate-500">Optimizando cálculos...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="text-amber-600" size={32} />
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              Año de Servicio {anoServicio.nombre}
            </h3>
            <p className="text-sm text-slate-700">{anoServicio.label}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <div className="text-sm text-slate-600">Meta Ideal</div>
            <div className="text-2xl font-semibold text-amber-600">600h</div>
            <div className="text-xs text-slate-500">50h/mes</div>
          </div>
          <div>
            <div className="text-sm text-slate-600">Meta Mínima</div>
            <div className="text-2xl font-semibold text-yellow-600">560h</div>
            <div className="text-xs text-slate-500">46.7h/mes</div>
          </div>
          <div>
            <div className="text-sm text-slate-600">Precursores</div>
            <div className="text-2xl font-semibold text-slate-900">{stats.total}</div>
          </div>
          <div>
            <div className="text-sm text-slate-600">Promedio General</div>
            <div className="text-2xl font-semibold text-slate-900">{stats.promedioGeneral}h</div>
            <div className="text-xs text-slate-500">por mes</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="text-sm text-slate-600 mb-1">Total</div>
          <div className="text-2xl font-semibold text-slate-900">{stats.total}</div>
        </div>
        <div className="card p-4 bg-red-50 border-red-200">
          <div className="text-sm text-red-700 mb-1">Críticos</div>
          <div className="text-2xl font-semibold text-red-900">{stats.criticos}</div>
          <div className="text-xs text-red-700 mt-1">≥60h/mes</div>
        </div>
        <div className="card p-4 bg-amber-50 border-amber-200">
          <div className="text-sm text-amber-700 mb-1">Atención</div>
          <div className="text-2xl font-semibold text-amber-900">{stats.atencion}</div>
          <div className="text-xs text-amber-700 mt-1">55-60h/mes</div>
        </div>
        <div className="card p-4 bg-orange-50 border-orange-200">
          <div className="text-sm text-orange-700 mb-1">Bajo Meta</div>
          <div className="text-2xl font-semibold text-orange-900">{stats.bajoMeta}</div>
          <div className="text-xs text-orange-700 mt-1">&lt;560h</div>
        </div>
        <div className="card p-4 bg-emerald-50 border-emerald-200">
          <div className="text-sm text-emerald-700 mb-1">En Meta</div>
          <div className="text-2xl font-semibold text-emerald-900">{stats.enMeta}</div>
          <div className="text-xs text-emerald-700 mt-1">≥560h</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex gap-2">
          {['TODOS', 'ALERTA', 'OK'].map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filtro === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f === 'TODOS' ? 'Todos' : f === 'ALERTA' ? 'Solo Alertas' : 'Solo OK'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {analisisFiltrado.map(prec => {
          // Calcular horas faltantes
          const faltanPara560 = Math.max(560 - prec.horasTotales, 0)
          const faltanPara600 = Math.max(600 - prec.horasTotales, 0)
          
          // Determinar badge y nota
          let badge = null
          let notaMeta = null
          
          if (prec.estado === 'critico') {
            badge = '🔴 Crítico'
          } else if (prec.estado === 'atencion') {
            badge = '⚠️ Atención'
          } else if (prec.estado === 'en-meta') {
            badge = '✅ En meta'
          } else if (prec.estado === 'bajo-meta') {
            const diferencia = 560 - prec.proyeccion12Meses
            notaMeta = `${diferencia}h bajo meta mínima`
          }

          return (
            <div 
              key={prec.id} 
              className={`card p-6 ${
                prec.estado === 'critico' ? 'border-l-4 border-red-500' :
                prec.estado === 'atencion' ? 'border-l-4 border-amber-500' :
                prec.estado === 'bajo-meta' ? 'border-l-4 border-orange-500' :
                prec.estado === 'en-meta' ? 'border-l-4 border-green-500' :
                'border-l-4 border-emerald-500'
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-lg font-semibold text-slate-900">
                    {prec.apellido}, {prec.nombre}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Grupo {prec.grupo} • {prec.mesesInformados}/{prec.totalMesesAno} meses informados
                  </div>
                </div>
                {badge && (
                  <span className={`badge ${
                    prec.estado === 'critico' ? 'badge-red' :
                    prec.estado === 'atencion' ? 'badge-yellow' :
                    prec.estado === 'en-meta' ? 'badge-green' :
                    ''
                  }`}>
                    {badge}
                  </span>
                )}
              </div>

              {/* Datos compactos */}
              <div className="space-y-2 text-sm">
                {/* Acumulado y Promedio */}
                <div className="flex gap-8">
                  <div>
                    <span className="text-slate-600">Acumulado:</span>{' '}
                    <span className="font-semibold text-slate-900">{prec.horasTotales}h</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Promedio Actual:</span>{' '}
                    <span className="font-semibold text-slate-900">{prec.promedioMensual}h/mes</span>
                  </div>
                </div>

                {/* Meta 560h */}
                <div>
                  <span className="text-slate-600">Faltan para 560h:</span>{' '}
                  <span className="font-semibold text-slate-900">{faltanPara560}h</span>
                  {' • '}
                  <span className="text-slate-600">Necesita:</span>{' '}
                  <span className={`font-semibold ${
                    prec.estado === 'critico' ? 'text-red-600' :
                    prec.estado === 'atencion' ? 'text-amber-600' :
                    prec.estado === 'bajo-meta' ? 'text-orange-600' :
                    'text-emerald-600'
                  }`}>
                    {prec.horasMesPara560}h/mes
                  </span>
                </div>

                {/* Meta 600h */}
                <div>
                  <span className="text-slate-600">Faltan para 600h:</span>{' '}
                  <span className="font-semibold text-slate-900">{faltanPara600}h</span>
                  {' • '}
                  <span className="text-slate-600">Necesita:</span>{' '}
                  <span className="font-semibold text-blue-600">
                    {prec.horasMesPara600}h/mes
                  </span>
                </div>

                {/* Proyección */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Proyección actual:</span>{' '}
                  <span className={`font-semibold text-lg ${
                    prec.estado === 'critico' ? 'text-red-600' :
                    prec.estado === 'atencion' ? 'text-amber-600' :
                    prec.estado === 'bajo-meta' ? 'text-orange-600' :
                    prec.estado === 'en-meta' ? 'text-green-600' :
                    'text-emerald-600'
                  }`}>
                    {prec.proyeccion12Meses}h
                  </span>
                  {notaMeta && (
                    <span className="text-xs text-orange-600 font-medium">
                      ({notaMeta})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {analisisFiltrado.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-slate-600">No hay precursores en esta categoría</p>
          </div>
        )}
      </div>
    </div>
  )
}
