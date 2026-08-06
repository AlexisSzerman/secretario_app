import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { db } from '../lib/supabase'
import { getAnoServicioActual, getMesesAnoServicio, getMesNombre, getMesVencido } from '../utils/dateUtils'

export default function GraficoAnoServicio({ publicadores }) {
  const [datos, setDatos] = useState(null)
  const [anoServicioLabel, setAnoServicioLabel] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  // Mismo criterio de elegibilidad que usa VistaInformeS1
  const debiaInformarEnMesEspecifico = (publicador, mes, ano) => {
    if (publicador.tipo_servicio === 'Inactivo') return false
    if (publicador.fecha_mudanza) return false

    const fechaBase = publicador.informar_desde || publicador.en_congregacion_desde || publicador.activo_desde
    if (!fechaBase) return true

    const [yb, mb] = fechaBase.split('-').map(Number)
    const fechaInicioNum = yb * 12 + (mb - 1)
    const mesNum = ano * 12 + (mes - 1)

    return mesNum >= fechaInicioNum
  }

const cargarDatos = async () => {
    setLoading(true)
    try {
      const mesVencido = getMesVencido()

      // Año de servicio calculado a partir del último mes vencido (no de "hoy"),
      // para que agosto siga apareciendo dentro de SU año de servicio hasta
      // que termine, en vez de saltar al año nuevo apenas empieza septiembre
      const anoInicio = mesVencido.mes >= 9 ? mesVencido.ano : mesVencido.ano - 1
      const anoServicio = {
        inicio: { mes: 9, ano: anoInicio },
        fin: { mes: 8, ano: anoInicio + 1 },
        nombre: `${anoInicio}-${anoInicio + 1}`,
        label: `Septiembre ${anoInicio} - Agosto ${anoInicio + 1}`
      }

      const todosMeses = getMesesAnoServicio(anoServicio)

      const limiteNum = mesVencido.ano * 12 + (mesVencido.mes - 1)
      const meses = todosMeses.filter(m => (m.ano * 12 + (m.mes - 1)) <= limiteNum)

      const resultados = await Promise.all(
        meses.map(async ({ mes, ano }) => {
          const [informes, asistencia] = await Promise.all([
            db.getInformesByMesAno(mes, ano),
            db.getDatosMensuales(mes, ano)
          ])

          const activos = publicadores.filter(p => debiaInformarEnMesEspecifico(p, mes, ano)).length

          const cantidadAux = new Set(
  informes
    .filter(i => i.precursor_auxiliar)
    .map(i => i.publicador_id)
).size

          const horasAux = informes
          .filter(i => i.precursor_auxiliar)
          .reduce((sum, i) => sum + (i.horas || 0), 0)

          // Usamos tipo_servicio_mes (guardado en cada informe al momento de
          // cargarlo) en vez del tipo_servicio actual del publicador, para
          // que el gráfico refleje correctamente la historia de cada mes
          const horasReg = informes
            .filter(i => i.tipo_servicio_mes === 'Precursor Regular' || i.tipo_servicio_mes === 'Precursor Especial')
            .reduce((sum, i) => sum + (i.horas || 0), 0)

          return {
  mes: `${getMesNombre(mes).slice(0, 3)} '${String(ano).slice(2)}`,
  activos,
  cantidadAux,
  asistenciaFinSemana: asistencia?.asistencia_fin_semana ?? null,
  asistenciaEntreSemana: asistencia?.asistencia_entre_semana ?? null,
  horasAux,
  horasReg
}
        })
      )

      setDatos(resultados)
      setAnoServicioLabel(anoServicio.label)
    } catch (error) {
      console.error('Error cargando datos del año de servicio:', error)
    } finally {
      setLoading(false)
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
  { titulo: 'Cantidad de Precursores Auxiliares', dataKey: 'cantidadAux', color: '#ca8a04', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { titulo: 'Asistencia Fin de Semana', dataKey: 'asistenciaFinSemana', color: '#0f766e', bg: 'bg-teal-50', border: 'border-teal-200' },
  { titulo: 'Asistencia Entre Semana', dataKey: 'asistenciaEntreSemana', color: '#7c3aed', bg: 'bg-purple-50', border: 'border-purple-200' },
  { titulo: 'Horas Precursores Auxiliares', dataKey: 'horasAux', color: '#b45309', bg: 'bg-amber-50', border: 'border-amber-200' },
  { titulo: 'Horas Precursores Regulares', dataKey: 'horasReg', color: '#9a3412', bg: 'bg-orange-50', border: 'border-orange-200' },
]

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-1">
        Gráficos del Año de Servicio
      </h3>
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
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
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