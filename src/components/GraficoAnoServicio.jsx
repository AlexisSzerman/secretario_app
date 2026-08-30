import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { RefreshCw } from 'lucide-react'
import { obtenerDatosAnoServicio } from '../utils/anoServicioStats'

export default function GraficoAnoServicio({ publicadores, refreshKey = 0 }) {
  const [datos, setDatos] = useState(null)
  const [anoServicioLabel, setAnoServicioLabel] = useState('')
  const [loading, setLoading] = useState(true)
  // Estado separado del "loading" inicial: se usa cuando el usuario aprieta
  // el botón "Actualizar datos", para no ocultar los gráficos ya cargados
  // mientras se refrescan (sólo gira el ícono del botón).
  const [refrescando, setRefrescando] = useState(false)

  // Se recarga al montar Y cada vez que cambia refreshKey (por ejemplo,
  // después de guardar la asistencia en VistaInformeS1) o la lista de
  // publicadores.
  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, publicadores])

  const cargarDatos = async ({ manual = false } = {}) => {
    if (manual) {
      setRefrescando(true)
    } else {
      setLoading(true)
    }
    try {
      const { meses, anoServicioLabel } = await obtenerDatosAnoServicio(publicadores)
      setDatos(meses)
      setAnoServicioLabel(anoServicioLabel)
    } catch (error) {
      console.error('Error cargando datos del año de servicio:', error)
      if (manual) alert('Error al actualizar los datos de los gráficos')
    } finally {
      setLoading(false)
      setRefrescando(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-3"></div>
        <p className="text-slate-600 text-sm">Cargando datos del año de servicio...</p>
      </div>
    )
  }

  if (!datos || datos.length === 0) return null

  const graficos = [
    { titulo: 'Publicadores Activos', dataKey: 'activos', color: '#1e3a8a', bg: 'bg-blue-50', border: 'border-blue-200' },
    { titulo: 'Asistencia Fin de Semana', dataKey: 'asistenciaFinSemana', color: '#0f766e', bg: 'bg-teal-50', border: 'border-teal-200' },
    { titulo: 'Asistencia Entre Semana', dataKey: 'asistenciaEntreSemana', color: '#7c3aed', bg: 'bg-purple-50', border: 'border-purple-200' },
    { titulo: 'Cantidad de Precursores Auxiliares', dataKey: 'cantidadAux', color: '#ca8a04', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    { titulo: 'Horas Precursores Auxiliares', dataKey: 'horasAux', color: '#b45309', bg: 'bg-amber-50', border: 'border-amber-200' },
    { titulo: 'Horas Precursores Regulares', dataKey: 'horasReg', color: '#9a3412', bg: 'bg-orange-50', border: 'border-orange-200' },
  ]

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-lg font-semibold text-slate-900">
          Gráficos del Año de Servicio
        </h3>
        <button
          onClick={() => cargarDatos({ manual: true })}
          disabled={refrescando}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <RefreshCw size={16} className={refrescando ? 'animate-spin' : ''} />
          {refrescando ? 'Actualizando...' : 'Actualizar datos'}
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        {anoServicioLabel}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {graficos.map(g => (
          <div key={g.dataKey} className={`p-4 rounded-lg border ${g.bg} ${g.border}`}>
            <h4 className="text-sm font-semibold text-slate-800 mb-3">{g.titulo}</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={datos} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey={g.dataKey}
                  stroke={g.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  )
}