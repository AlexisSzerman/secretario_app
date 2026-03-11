// VistaPrecursores.jsx - ANÁLISIS DE PRECURSORES DEL MES
// Copiar a: src/components/VistaPrecursores.jsx

import { useState } from 'react'
import { Star, AlertCircle, CheckCircle } from 'lucide-react'

export default function VistaPrecursores({ publicadores, informes, mesActual }) {
  const [mostrarSoloProblemas, setMostrarSoloProblemas] = useState(false)

  const precursores = publicadores.filter(p => 
    (p.tipo_servicio === 'Precursor Regular' || p.tipo_servicio === 'Precursor Especial') &&
    p.tipo_servicio !== 'Inactivo'
  )

  const analisis = precursores.map(p => {
    const informe = informes.find(i => i.publicador_id === p.id)
    const horas = informe?.horas || 0
    
    let estado = 'ok'
    if (!informe) estado = 'sin-informe'
    else if (horas < 45) estado = 'critico'
    else if (horas < 50) estado = 'atencion'
    
    return { ...p, informe, horas, estado }
  })

  // Ordenar por prioridad
  const ordenPrioridad = {
    'sin-informe': 0,
    'critico': 1,
    'atencion': 2,
    'ok': 3
  }
  
  analisis.sort((a, b) => {
    if (ordenPrioridad[a.estado] !== ordenPrioridad[b.estado]) {
      return ordenPrioridad[a.estado] - ordenPrioridad[b.estado]
    }
    return a.horas - b.horas
  })

  const precursoresFiltrados = mostrarSoloProblemas
    ? analisis.filter(p => p.estado !== 'ok')
    : analisis

  const stats = {
    total: precursores.length,
    promedio: analisis.reduce((sum, p) => sum + p.horas, 0) / Math.max(analisis.length, 1),
    sinInforme: analisis.filter(p => p.estado === 'sin-informe').length,
    critico: analisis.filter(p => p.estado === 'critico').length,
    atencion: analisis.filter(p => p.estado === 'atencion').length,
    ok: analisis.filter(p => p.estado === 'ok').length
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="text-sm text-slate-600 mb-1">Total</div>
          <div className="text-2xl font-semibold text-slate-900">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1">Promedio: {stats.promedio.toFixed(1)}h</div>
        </div>
        <div className="card p-4 bg-red-50">
          <div className="text-sm text-red-700 mb-1">Sin Informe</div>
          <div className="text-2xl font-semibold text-red-900">{stats.sinInforme}</div>
        </div>
        <div className="card p-4 bg-red-50">
          <div className="text-sm text-red-700 mb-1">Crítico</div>
          <div className="text-2xl font-semibold text-red-900">{stats.critico}</div>
          <div className="text-xs text-red-700 mt-1">&lt; 45h</div>
        </div>
        <div className="card p-4 bg-amber-50">
          <div className="text-sm text-amber-700 mb-1">Atención</div>
          <div className="text-2xl font-semibold text-amber-900">{stats.atencion}</div>
          <div className="text-xs text-amber-700 mt-1">&lt; 50h</div>
        </div>
        <div className="card p-4 bg-emerald-50">
          <div className="text-sm text-emerald-700 mb-1">En Regla</div>
          <div className="text-2xl font-semibold text-emerald-900">{stats.ok}</div>
          <div className="text-xs text-emerald-700 mt-1">≥ 50h</div>
        </div>
      </div>

      {/* Filtro */}
      <div className="card p-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={mostrarSoloProblemas}
            onChange={(e) => setMostrarSoloProblemas(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-700">Mostrar solo los que necesitan atención</span>
        </label>
      </div>

      {/* Lista de precursores */}
      <div className="card divide-y divide-slate-100">
        {precursoresFiltrados.map(prec => (
          <div key={prec.id} className="p-4 hover:bg-slate-50 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-slate-900">
                  {prec.apellido}, {prec.nombre}
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Grupo {prec.grupo} • {prec.tipo_servicio}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-semibold ${
                  prec.estado === 'sin-informe' ? 'text-red-600' :
                  prec.estado === 'critico' ? 'text-red-600' :
                  prec.estado === 'atencion' ? 'text-amber-600' :
                  'text-emerald-600'
                }`}>
                  {prec.horas}h
                </div>
                {prec.estado === 'sin-informe' && (
                  <span className="badge badge-red text-xs mt-1">
                    <AlertCircle size={12} />
                    Sin informe
                  </span>
                )}
                {prec.estado === 'critico' && (
                  <span className="badge badge-red text-xs mt-1">
                    <AlertCircle size={12} />
                    Crítico
                  </span>
                )}
                {prec.estado === 'atencion' && (
                  <span className="badge badge-yellow text-xs mt-1">
                    <AlertCircle size={12} />
                    Atención
                  </span>
                )}
                {prec.estado === 'ok' && (
                  <span className="badge badge-green text-xs mt-1">
                    <CheckCircle size={12} />
                    En regla
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {precursoresFiltrados.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-slate-600">No hay precursores en esta categoría</p>
          </div>
        )}
      </div>
    </div>
  )
}
