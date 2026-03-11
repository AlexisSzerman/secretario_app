import { Users, CheckCircle, BookOpen, Clock, Star } from 'lucide-react'

export default function VistaEstadisticas({ publicadores, informes, mesActual }) {
  // FUNCIÓN HELPER: Verifica si debe informar en este mes
  const debeInformarEnMes = (publicador) => {
    if (publicador.tipo_servicio === 'Inactivo') return false
    
    const fechaBase = publicador.en_congregacion_desde || publicador.activo_desde
    if (!fechaBase) return true
    
    const fechaMes = new Date(mesActual.ano, mesActual.mes - 1, 1)
    const fechaInicio = new Date(fechaBase)
    
    return fechaMes >= fechaInicio
  }

  // FILTRAR: Solo publicadores que DEBEN informar este mes
  const publicadoresDeberian = publicadores.filter(p => debeInformarEnMes(p))
  
  // Estadísticas generales
  const totalPublicadores = publicadoresDeberian.length
  const informados = informes.length
  const participaron = informes.filter(i => i.participo).length
  const cursosTotales = informes.reduce((sum, i) => sum + (i.cursos || 0), 0)
  const horasTotales = informes.reduce((sum, i) => sum + (i.horas || 0), 0)
  
  // Precursores
  const precursoresRegulares = publicadoresDeberian.filter(p => 
    p.tipo_servicio === 'Precursor Regular'
  ).length
  const precursoresAuxiliares = informes.filter(i => i.precursor_auxiliar).length
  
  // Por grupo - CORREGIDO: Solo cuenta los que debían informar
  const grupos = {}
  publicadoresDeberian.forEach(p => {
    const grupo = p.grupo || 'Sin grupo'
    if (!grupos[grupo]) {
      grupos[grupo] = {
        total: 0,
        informados: 0,
        participaron: 0
      }
    }
    grupos[grupo].total++
    
    const informe = informes.find(i => i.publicador_id === p.id)
    if (informe) {
      grupos[grupo].informados++
      if (informe.participo) {
        grupos[grupo].participaron++
      }
    }
  })

  const promedioHoras = informados > 0 ? (horasTotales / informados).toFixed(1) : 0
  const promedioCursos = informados > 0 ? (cursosTotales / informados).toFixed(1) : 0
  const porcentajeInformado = totalPublicadores > 0 
    ? Math.round((informados / totalPublicadores) * 100) 
    : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Users className="text-slate-700" size={20} />
            </div>
            <div className="text-sm font-medium text-slate-600">Informaron</div>
          </div>
          <div className="text-3xl font-semibold text-slate-900">{informados}</div>
          <div className="text-xs text-slate-500 mt-1">de {totalPublicadores} ({porcentajeInformado}%)</div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <CheckCircle className="text-emerald-600" size={20} />
            </div>
            <div className="text-sm font-medium text-slate-600">Participaron</div>
          </div>
          <div className="text-3xl font-semibold text-slate-900">{participaron}</div>
          <div className="text-xs text-slate-500 mt-1">
            {informados > 0 ? Math.round((participaron / informados) * 100) : 0}% de informados
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <BookOpen className="text-blue-600" size={20} />
            </div>
            <div className="text-sm font-medium text-slate-600">Cursos</div>
          </div>
          <div className="text-3xl font-semibold text-slate-900">{cursosTotales}</div>
          <div className="text-xs text-slate-500 mt-1">Promedio: {promedioCursos}</div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Clock className="text-amber-600" size={20} />
            </div>
            <div className="text-sm font-medium text-slate-600">Horas</div>
          </div>
          <div className="text-3xl font-semibold text-slate-900">{horasTotales}</div>
          <div className="text-xs text-slate-500 mt-1">Promedio: {promedioHoras}h</div>
        </div>
      </div>

      {/* Precursores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="text-amber-600" size={24} />
            <h3 className="text-lg font-semibold text-slate-900">Precursores Regulares</h3>
          </div>
          <div className="text-4xl font-semibold text-slate-900 mb-2">{precursoresRegulares}</div>
          <p className="text-sm text-slate-600">Total de precursores regulares</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="text-yellow-600" size={24} />
            <h3 className="text-lg font-semibold text-slate-900">Precursores Auxiliares</h3>
          </div>
          <div className="text-4xl font-semibold text-slate-900 mb-2">{precursoresAuxiliares}</div>
          <p className="text-sm text-slate-600">Este mes</p>
        </div>
      </div>

      {/* Por grupo */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Por Grupo</h3>
        <div className="space-y-4">
          {Object.keys(grupos).sort().map(grupo => {
            const data = grupos[grupo]
            const pct = data.total > 0 ? Math.round((data.informados / data.total) * 100) : 0
            
            return (
              <div key={grupo}>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="font-medium text-slate-900">{grupo}</span>
                    <span className="text-sm text-slate-600 ml-2">
                      {data.informados}/{data.total} informaron • {data.participaron} participaron
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{pct}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-slate-900 h-2 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
