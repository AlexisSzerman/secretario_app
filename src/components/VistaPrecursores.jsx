// VistaPrecursores.jsx - ANÁLISIS DE PRECURSORES DEL MES
// Copiar a: src/components/VistaPrecursores.jsx

import { useState } from 'react'
import { ArrowUpDown } from 'lucide-react'

export default function VistaPrecursores({ publicadores, informes, mesActual }) {
  const [ordenarPorHoras, setOrdenarPorHoras] = useState(true)

  const precursores = publicadores.filter(p => 
    (p.tipo_servicio === 'Precursor Regular' || p.tipo_servicio === 'Precursor Especial') &&
    p.tipo_servicio !== 'Inactivo'
  )

  const analisis = precursores.map(p => {
    const informe = informes.find(i => i.publicador_id === p.id)
    const horas = informe?.horas || 0
    return { ...p, horas }
  })

  // Ordenar
  const analisisOrdenado = [...analisis].sort((a, b) => {
    if (ordenarPorHoras) {
      return b.horas - a.horas // Descendente por horas
    }
    return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`)
  })

  // Top 3
  const top3 = [...analisis]
    .sort((a, b) => b.horas - a.horas)
    .slice(0, 3)

  // Stats
  const stats = {
    total: precursores.length,
    promedio: analisis.reduce((sum, p) => sum + p.horas, 0) / Math.max(analisis.length, 1),
    totalHoras: analisis.reduce((sum, p) => sum + p.horas, 0)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="text-sm text-slate-600 mb-2">Total Precursores</div>
          <div className="text-3xl font-semibold text-slate-900">{stats.total}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-slate-600 mb-2">Promedio Mensual</div>
          <div className="text-3xl font-semibold text-blue-600">{stats.promedio.toFixed(1)}h</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-slate-600 mb-2">Total Horas</div>
          <div className="text-3xl font-semibold text-slate-900">{stats.totalHoras}h</div>
        </div>
      </div>

      {/* Top 3 */}
      {top3.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Top 3 del Mes</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {top3.map((prec, index) => (
              <div 
                key={prec.id}
                className={`p-4 rounded-lg border-2 ${
                  index === 0 
                    ? 'bg-amber-50 border-amber-200' 
                    : index === 1 
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-orange-50 border-orange-200'
                }`}
              >
                <div className="text-center">
                  <div className={`text-sm font-medium mb-1 ${
                    index === 0 
                      ? 'text-amber-700' 
                      : index === 1 
                      ? 'text-slate-700'
                      : 'text-orange-700'
                  }`}>
                    {index === 0 ? '1er Lugar' : index === 1 ? '2do Lugar' : '3er Lugar'}
                  </div>
                  <div className="font-semibold text-slate-900 mb-1">
                    {prec.apellido}, {prec.nombre}
                  </div>
                  <div className="text-xs text-slate-600 mb-2">Grupo {prec.grupo}</div>
                  <div className={`text-2xl font-bold ${
                    index === 0 
                      ? 'text-amber-600' 
                      : index === 1 
                      ? 'text-slate-600'
                      : 'text-orange-600'
                  }`}>
                    {prec.horas}h
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista completa */}
      <div className="card">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">Todos los Precursores</h3>
          <button
            onClick={() => setOrdenarPorHoras(!ordenarPorHoras)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowUpDown size={16} />
            {ordenarPorHoras ? 'Ordenar alfabéticamente' : 'Ordenar por horas'}
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {analisisOrdenado.map(prec => (
            <div key={prec.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-slate-900">
                    {prec.apellido}, {prec.nombre}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Grupo {prec.grupo} • {prec.tipo_servicio}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold text-slate-900">
                    {prec.horas}h
                  </div>
                </div>
              </div>
            </div>
          ))}

          {analisisOrdenado.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-slate-600">No hay precursores registrados este mes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
