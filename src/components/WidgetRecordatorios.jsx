import { useState, useEffect } from 'react'
import { Bell, Calendar, Check, ChevronRight } from 'lucide-react'
import { db } from '../lib/supabase'

export default function WidgetRecordatorios() {
  const [recordatorios, setRecordatorios] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecordatorios()
  }, [])

  const loadRecordatorios = async () => {
    try {
      const data = await db.getRecordatoriosDashboard()
      setRecordatorios(data)
    } catch (error) {
      console.error('Error cargando recordatorios:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompletar = async (id) => {
    try {
      await db.marcarCompletada(id)
      await loadRecordatorios()
    } catch (error) {
      console.error('Error marcando completada:', error)
    }
  }

  // FUNCIÓN CORREGIDA: Parsea fecha sin conversión UTC
  const parseFechaLocal = (fechaStr) => {
    if (!fechaStr) return null
    // Parsear como fecha local (YYYY-MM-DD)
    const [year, month, day] = fechaStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Calcular si está vencido (comparando solo fechas, sin horas)
  const estaVencido = (fechaFin) => {
    if (!fechaFin) return false
    
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    const fin = parseFechaLocal(fechaFin)
    fin.setHours(0, 0, 0, 0)
    
    return fin < hoy
  }

  // Calcular días restantes
  const diasRestantes = (fechaFin) => {
    if (!fechaFin) return null
    
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    const fin = parseFechaLocal(fechaFin)
    fin.setHours(0, 0, 0, 0)
    
    const diff = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))
    return diff
  }

  // Formatear fecha local
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return ''
    const fecha = parseFechaLocal(fechaStr)
    return fecha.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    })
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Bell className="text-blue-600" size={20} />
          <h3 className="text-lg font-semibold text-slate-900">Recordatorios</h3>
        </div>
        {/* Nota: El enlace "Ver todos" funcionará cuando agregues la pestaña de Recordatorios */}
      </div>

      {recordatorios.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="mx-auto text-slate-300 mb-2" size={32} />
          <p className="text-sm text-slate-500">No hay recordatorios pendientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recordatorios.map(rec => {
            const vencido = estaVencido(rec.fecha_fin)
            const dias = diasRestantes(rec.fecha_fin)

            return (
              <div
                key={rec.id}
                className={`p-3 rounded-lg border-l-4 ${
                  vencido
                    ? 'bg-red-50 border-red-500'
                    : dias !== null && dias <= 3
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-slate-50 border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-900 text-sm">
                        {rec.titulo}
                      </h4>
                      {vencido && (
                        <span className="badge badge-red text-xs">Vencido</span>
                      )}
                      {!vencido && dias !== null && dias <= 3 && (
                        <span className="badge badge-yellow text-xs">
                          {dias === 0 ? 'Hoy' : `${dias}d`}
                        </span>
                      )}
                    </div>

                    {rec.descripcion && (
                      <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                        {rec.descripcion}
                      </p>
                    )}

                    {rec.fecha_fin && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar size={12} />
                        {formatearFecha(rec.fecha_fin)}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleCompletar(rec.id)}
                    className="p-1 hover:bg-green-100 rounded transition-colors flex-shrink-0"
                    title="Marcar como completada"
                  >
                    <Check className="text-green-600" size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
