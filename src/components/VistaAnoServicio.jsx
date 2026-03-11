import { useState, useEffect } from 'react'
import { Calendar, AlertCircle, CheckCircle } from 'lucide-react'
import { getAnoServicioActual, getMesesAnoServicio, esMesVencido, getMesNombre, getMesVencido } from '../utils/dateUtils'
import { db } from '../lib/supabase'

export default function VistaAnoServicio({ publicadores }) {
  const [analisis, setAnalisis] = useState([])
  const [loading, setLoading] = useState(true)
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
    try {
      const anoServicio = getAnoServicioActual()
      const mesesAnoServicio = getMesesAnoServicio(anoServicio)
      
      // CORREGIDO: Calcular meses cerrados del año de servicio
      const hoy = new Date()
      const diaActual = hoy.getDate()
      const mesActual = hoy.getMonth() + 1
      const anoActual = hoy.getFullYear()
      
      // El mes vencido es el mes ANTERIOR al actual
      let mesVencido = mesActual - 1
      let anoVencido = anoActual
      if (mesVencido <= 0) {
        mesVencido += 12
        anoVencido -= 1
      }
      
      // MESES CERRADOS: Incluye mes vencido si ya pasó el día 6
      // (después del 5-6 ya no se aceptan informes del mes vencido)
      const mesesCerrados = mesesAnoServicio.filter(m => {
        const fechaMes = new Date(m.ano, m.mes - 1, 1)
        const fechaVencido = new Date(anoVencido, mesVencido - 1, 1)
        
        // Si es el mes vencido, incluirlo solo si ya pasó el día 6
        if (m.mes === mesVencido && m.ano === anoVencido) {
          return diaActual >= 6  // Después del día 6, el mes vencido ya está cerrado
        }
        
        // Para meses anteriores al vencido, siempre incluir
        return fechaMes < fechaVencido
      })

      const precursores = publicadores.filter(p => 
        p.tipo_servicio === 'Precursor Regular' && 
        p.tipo_servicio !== 'Inactivo'
      )

      const analisisPrecursores = []

      for (const pub of precursores) {
        let horasTotales = 0
        let mesesInformados = 0
        let mesesDebiaInformar = 0  // NUEVO: cuenta solo meses donde debía informar

        for (const mesInfo of mesesCerrados) {
          // Solo cuenta si debía informar en ese mes
          if (!debiaInformarEnMes(pub, mesInfo.mes, mesInfo.ano)) {
            continue  // Salta este mes
          }
          
          mesesDebiaInformar++  // Cuenta este mes como "debía informar"
          
          const informes = await db.getInformesByMesAno(mesInfo.mes, mesInfo.ano)
          const informe = informes.find(i => i.publicador_id === pub.id)
          
          if (informe) {
            horasTotales += informe.horas || 0
            mesesInformados++
          }
        }

        // NUEVA LÓGICA: Basada en horas/mes necesarias en meses restantes
        const hoyFecha = new Date()
        const mesActual = hoyFecha.getMonth() + 1  // Mes actual (no el vencido)
        const anoActual = hoyFecha.getFullYear()
        
        // Calcular en qué mes del año de servicio estamos (1-12)
        // Año de servicio: Sept (mes 1) - Agosto (mes 12)
        let mesDelAnoServicio
        if (mesActual >= 9) {
          // Sept-Dic: meses 1-4 del año actual
          mesDelAnoServicio = mesActual - 8  // Sept=1, Oct=2, Nov=3, Dic=4
        } else {
          // Ene-Ago: meses 5-12 del año siguiente
          mesDelAnoServicio = mesActual + 4  // Ene=5, Feb=6, Mar=7, Abr=8, etc
        }
        
        // Meses RESTANTES incluyendo el mes actual (que no se informó todavía)
        // Si estamos en marzo (mes 7), quedan: mar, abr, may, jun, jul, ago = 6 meses
        const totalMesesAno = 12
        const mesesRestantes = totalMesesAno - mesDelAnoServicio + 1
        
        // Promedio actual
        const promedioMensual = mesesInformados > 0 ? horasTotales / mesesInformados : 0
        
        // Proyección a 12 meses
        const proyeccion12Meses = promedioMensual * 12
        
        // Horas que faltan para llegar a 560h y 600h
        const horasFaltanPara560 = Math.max(560 - horasTotales, 0)
        const horasFaltanPara600 = Math.max(600 - horasTotales, 0)
        
        // Horas/mes necesarias en meses restantes
        const horasMesPara560 = mesesRestantes > 0 ? horasFaltanPara560 / mesesRestantes : 0
        const horasMesPara600 = mesesRestantes > 0 ? horasFaltanPara600 / mesesRestantes : 0
        
        // ESCALAS CORREGIDAS (basadas en 560h):
        let estado = 'ok'
        if (horasMesPara560 >= 60) {
          estado = 'critico'  // Necesita 60h/mes o más en restantes
        } else if (horasMesPara560 >= 55) {
          estado = 'atencion'  // Necesita 55-60h/mes en restantes
        }
        // Si necesita <55h/mes → Normal (estado = 'ok')

        analisisPrecursores.push({
          ...pub,
          horasTotales,
          mesesInformados,
          totalMesesAno,  // Siempre 12
          mesesRestantes,  // Meses que faltan del año
          promedioMensual: parseFloat(promedioMensual.toFixed(1)),
          horasMesPara560: parseFloat(horasMesPara560.toFixed(1)),  // NUEVO
          horasMesPara600: parseFloat(horasMesPara600.toFixed(1)),  // NUEVO
          proyeccion12Meses: Math.round(proyeccion12Meses),
          estado
        })
      }

      analisisPrecursores.sort((a, b) => {
        const estadoOrder = { 'critico': 0, 'atencion': 1, 'ok': 2 }
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
    if (filtro === 'ALERTA') return a.estado !== 'ok'
    if (filtro === 'OK') return a.estado === 'ok'
    return true
  })

  const stats = {
    total: analisis.length,
    criticos: analisis.filter(a => a.estado === 'critico').length,
    atencion: analisis.filter(a => a.estado === 'atencion').length,
    ok: analisis.filter(a => a.estado === 'ok').length,
    promedioGeneral: analisis.length > 0 
      ? (analisis.reduce((sum, a) => sum + a.horasTotales, 0) / analisis.reduce((sum, a) => sum + a.mesesInformados, 0)).toFixed(1)
      : 0
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-sm text-slate-600 mb-1">Total</div>
          <div className="text-2xl font-semibold text-slate-900">{stats.total}</div>
        </div>
        <div className="card p-4 bg-red-50 border-red-200">
          <div className="text-sm text-red-700 mb-1">Críticos (≥60h/mes)</div>
          <div className="text-2xl font-semibold text-red-900">{stats.criticos}</div>
        </div>
        <div className="card p-4 bg-amber-50 border-amber-200">
          <div className="text-sm text-amber-700 mb-1">Atención (55-60h/mes)</div>
          <div className="text-2xl font-semibold text-amber-900">{stats.atencion}</div>
        </div>
        <div className="card p-4 bg-emerald-50 border-emerald-200">
          <div className="text-sm text-emerald-700 mb-1">Normal (&lt;55h/mes)</div>
          <div className="text-2xl font-semibold text-emerald-900">{stats.ok}</div>
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
      <div className="card divide-y divide-slate-100">
        {analisisFiltrado.map(prec => (
          <div key={prec.id} className="p-4 hover:bg-slate-50">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-medium text-slate-900">
                  {prec.apellido}, {prec.nombre}
                </div>
                <div className="text-sm text-slate-600">
                  Grupo {prec.grupo} • {prec.mesesInformados}/{prec.totalMesesAno} meses informados
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-semibold ${
                  prec.estado === 'critico' ? 'text-red-600' :
                  prec.estado === 'atencion' ? 'text-amber-600' :
                  'text-emerald-600'
                }`}>
                  {prec.proyeccion12Meses}h
                </div>
                <div className="text-xs text-slate-500">proyección</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-3">
              <div>
                <div className="text-slate-600 text-xs">Acumulado</div>
                <div className="font-semibold text-slate-900">{prec.horasTotales}h</div>
              </div>
              <div>
                <div className="text-slate-600 text-xs">Promedio Actual</div>
                <div className="font-semibold text-slate-900">{prec.promedioMensual}h/mes</div>
              </div>
              <div>
                <div className="text-slate-600 text-xs">Necesita (560h)</div>
                <div className={`font-semibold ${
                  prec.estado === 'critico' ? 'text-red-600' :
                  prec.estado === 'atencion' ? 'text-amber-600' :
                  'text-emerald-600'
                }`}>
                  {prec.horasMesPara560}h/mes
                </div>
              </div>
              <div>
                <div className="text-slate-600 text-xs">Necesita (600h)</div>
                <div className="font-semibold text-blue-600">
                  {prec.horasMesPara600}h/mes
                </div>
              </div>
              <div>
                <div className="text-slate-600 text-xs">Proyección</div>
                <div className="font-semibold text-slate-900">{prec.proyeccion12Meses}h</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {prec.estado === 'critico' && (
                <span className="badge badge-red text-xs">🔴 Crítico</span>
              )}
              {prec.estado === 'atencion' && (
                <span className="badge badge-yellow text-xs">⚠️ Atención</span>
              )}
              {prec.estado === 'ok' && (
                <span className="badge badge-green text-xs">✅ Normal</span>
              )}
            </div>

            {prec.estado !== 'ok' && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm">
                <div className="space-y-2">
                  {prec.estado === 'critico' ? (
                    <div className="text-red-700">
                      <strong>🔴 Crítico:</strong> Necesita <strong>{prec.horasMesPara560}h/mes</strong> en los próximos {prec.mesesRestantes} meses para llegar a <strong>560h</strong>.
                    </div>
                  ) : (
                    <div className="text-amber-700">
                      <strong>⚠️ Atención:</strong> Necesita <strong>{prec.horasMesPara560}h/mes</strong> en los próximos {prec.mesesRestantes} meses para llegar a <strong>560h</strong>.
                    </div>
                  )}
                  <div className="text-slate-600 text-xs pt-1 border-t border-slate-200">
                    • Acumulado: {prec.horasTotales}h • Faltan para 560h: {Math.max(560 - prec.horasTotales, 0)}h<br/>
                    • Para 600h necesita: <strong>{prec.horasMesPara600}h/mes</strong> • Faltan: {Math.max(600 - prec.horasTotales, 0)}h
                  </div>
                </div>
              </div>
            )}
            
            {prec.estado === 'ok' && prec.proyeccion12Meses < 600 && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                <div className="text-blue-700">
                  <strong>ℹ️ Meta ideal (600h):</strong> Necesita <strong>{prec.horasMesPara600}h/mes</strong> en los próximos {prec.mesesRestantes} meses.
                  <div className="text-xs mt-1">
                    Camino a 560h ✓ • Faltan {Math.max(600 - prec.horasTotales, 0)}h para 600h
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {analisisFiltrado.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-slate-600">No hay precursores en esta categoría</p>
          </div>
        )}
      </div>
    </div>
  )
}
