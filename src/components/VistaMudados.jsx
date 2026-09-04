import { useState } from 'react'
import { Search, Home, UserX, RotateCcw, Calendar, User, Phone, Mail } from 'lucide-react'
import { formatearFecha } from '../utils/dateUtils'
import { db } from '../lib/supabase'

export default function VistaMudados({ publicadores, onReload }) {
  const [filtro, setFiltro] = useState('')
  const [reactivando, setReactivando] = useState(null)

  // Publicadores mudados
  const publicadoresMudados = publicadores.filter(p => p.fecha_mudanza)

  // Publicadores inactivos (que NO estén también mudados, para no duplicar)
  const publicadoresInactivos = publicadores.filter(
    p => !p.fecha_mudanza && p.tipo_servicio === 'Inactivo'
  )

  // Lista combinada
  const listaCombinada = [...publicadoresMudados, ...publicadoresInactivos]

  // Aplicar búsqueda
  const listaFiltrada = listaCombinada.filter(p => {
    if (!filtro) return true
    const texto = `${p.nombre} ${p.apellido}`.toLowerCase()
    return texto.includes(filtro.toLowerCase())
  })

  // Ordenar alfabéticamente (apellido, nombre)
  const listaOrdenada = [...listaFiltrada].sort((a, b) => {
    return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`)
  })

  const handleReactivar = async (publicador) => {
    const esInactivo = !publicador.fecha_mudanza && publicador.tipo_servicio === 'Inactivo'

    const confirmMsg = esInactivo
      ? `¿Reactivar a ${publicador.apellido}, ${publicador.nombre}?\n\nVolverá a tener tipo de servicio "Publicador" y aparecerá como activo.`
      : `¿Reactivar a ${publicador.apellido}, ${publicador.nombre}?\n\nVolverá a aparecer en la lista de publicadores activos.`

    if (!window.confirm(confirmMsg)) {
      return
    }

    setReactivando(publicador.id)
    try {
      const updates = esInactivo
        ? { tipo_servicio: 'Publicador' }
        : { fecha_mudanza: null }

      await db.updatePublicador(publicador.id, updates)
      onReload()
    } catch (error) {
      console.error('Error reactivando publicador:', error)
      alert('Error al reactivar')
    } finally {
      setReactivando(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              Publicadores Mudados/Inactivos
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              {publicadoresMudados.length} {publicadoresMudados.length === 1 ? 'mudado' : 'mudados'} · {publicadoresInactivos.length} {publicadoresInactivos.length === 1 ? 'inactivo' : 'inactivos'}
            </p>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="custom-input pl-10"
          />
        </div>
      </div>

      {/* Lista combinada */}
      {listaOrdenada.length === 0 ? (
        <div className="card p-12 text-center">
          {listaCombinada.length === 0 ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-orange-50 rounded-full">
                  <Home className="text-orange-600" size={48} />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No hay publicadores mudados ni inactivos
              </h3>
              <p className="text-slate-600">
                Cuando marques a alguien como mudado o inactivo, aparecerá aquí
              </p>
            </>
          ) : (
            <p className="text-slate-600">No se encontraron resultados</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {listaOrdenada.map(pub => {
            const esInactivo = !pub.fecha_mudanza && pub.tipo_servicio === 'Inactivo'

            return (
              <div 
                key={pub.id} 
                className="card p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  {/* Info del publicador */}
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${esInactivo ? 'bg-slate-100' : 'bg-orange-50'}`}>
                        {esInactivo ? (
                          <UserX className="text-slate-500" size={20} />
                        ) : (
                          <Home className="text-orange-600" size={20} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900 text-lg">
                            {pub.apellido}, {pub.nombre}
                          </h3>
                          {esInactivo && (
                            <span className="badge badge-gray text-xs">Inactivo</span>
                          )}
                        </div>

                        {/* Datos específicos de mudanza */}
                        {!esInactivo && (
                          <>
                            <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                              <Calendar size={14} />
                              <span>
                                Mudanza: <strong>{formatearFecha(pub.fecha_mudanza)}</strong>
                              </span>
                            </div>

                            {pub.congregacion_destino && (
                              <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                                <Home size={14} />
                                <span>
                                  Destino: <strong>{pub.congregacion_destino}</strong>
                                </span>
                              </div>
                            )}
                          </>
                        )}

                        {/* Info adicional (común a ambos casos) */}
                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                          {pub.grupo && (
                            <div className="flex items-center gap-2">
                              <User size={14} />
                              <span>Grupo {pub.grupo}</span>
                            </div>
                          )}
                          
                          {!esInactivo && pub.tipo_servicio && pub.tipo_servicio !== 'Publicador' && (
                            <div className="flex items-center gap-2">
                              <span className="badge badge-yellow text-xs">
                                {pub.tipo_servicio}
                              </span>
                            </div>
                          )}

                          {pub.telefono && (
                            <div className="flex items-center gap-2">
                              <Phone size={14} />
                              <span>{pub.telefono}</span>
                            </div>
                          )}

                          {pub.email && (
                            <div className="flex items-center gap-2">
                              <Mail size={14} />
                              <span className="text-xs">{pub.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botón reactivar */}
                  <div className="flex items-start">
                    <button
                      onClick={() => handleReactivar(pub)}
                      disabled={reactivando === pub.id}
                      className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200 transition-colors inline-flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reactivando === pub.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-700"></div>
                          Reactivando...
                        </>
                      ) : (
                        <>
                          <RotateCcw size={16} />
                          Reactivar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info footer */}
      <div className="card p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> Al reactivar a un inactivo o mudado, volverá a la lista de activos y deberá informar a partir del mes siguiente. Si se trata de un inactivo, su tipo de servicio volverá a “Publicador”.
        </p>
      </div>
    </div>
  )
}