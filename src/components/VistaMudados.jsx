import { useState } from 'react'
import { Search, Home, RotateCcw, Calendar, User, Phone, Mail } from 'lucide-react'
import { formatearFecha } from '../utils/dateUtils'
import { db } from '../lib/supabase'

export default function VistaMudados({ publicadores, onReload }) {
  const [filtro, setFiltro] = useState('')
  const [reactivando, setReactivando] = useState(null)

  // Filtrar solo publicadores mudados
  const publicadoresMudados = publicadores.filter(p => p.fecha_mudanza)

  // Aplicar búsqueda
  const mudadosFiltrados = publicadoresMudados.filter(p => {
    if (!filtro) return true
    const texto = `${p.nombre} ${p.apellido}`.toLowerCase()
    return texto.includes(filtro.toLowerCase())
  })

  // Ordenar por fecha de mudanza (más recientes primero)
  const mudadosOrdenados = [...mudadosFiltrados].sort((a, b) => {
    return new Date(b.fecha_mudanza) - new Date(a.fecha_mudanza)
  })

  const handleReactivar = async (publicador) => {
    if (!window.confirm(`¿Reactivar a ${publicador.apellido}, ${publicador.nombre}?\n\nVolverá a aparecer en la lista de publicadores activos.`)) {
      return
    }

    setReactivando(publicador.id)
    try {
      await db.updatePublicador(publicador.id, {
        fecha_mudanza: null
      })
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
              <Home className="text-orange-600" size={24} />
              Publicadores Mudados
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              {publicadoresMudados.length} {publicadoresMudados.length === 1 ? 'publicador mudado' : 'publicadores mudados'}
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

      {/* Lista de mudados */}
      {mudadosOrdenados.length === 0 ? (
        <div className="card p-12 text-center">
          {publicadoresMudados.length === 0 ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-orange-50 rounded-full">
                  <Home className="text-orange-600" size={48} />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No hay publicadores mudados
              </h3>
              <p className="text-slate-600">
                Cuando marques a alguien como mudado, aparecerá aquí
              </p>
            </>
          ) : (
            <p className="text-slate-600">No se encontraron resultados</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {mudadosOrdenados.map(pub => (
            <div 
              key={pub.id} 
              className="card p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row justify-between gap-4">
                {/* Info del publicador */}
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-50 rounded-lg">
                      <Home className="text-orange-600" size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 text-lg">
                        {pub.apellido}, {pub.nombre}
                      </h3>
                      
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                        <Calendar size={14} />
                        <span>
                          Mudanza: <strong>{formatearFecha(pub.fecha_mudanza)}</strong>
                        </span>
                      </div>

                      {/* Info adicional */}
                      <div className="mt-3 space-y-1 text-sm text-slate-600">
                        {pub.grupo && (
                          <div className="flex items-center gap-2">
                            <User size={14} />
                            <span>Grupo {pub.grupo}</span>
                          </div>
                        )}
                        
                        {pub.tipo_servicio && pub.tipo_servicio !== 'Publicador' && (
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
          ))}
        </div>
      )}

      {/* Info footer */}
      <div className="card p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> Si reactivás a un publicador, volverá a aparecer en la lista de publicadores 
          activos y deberá informar a partir del mes siguiente.
        </p>
      </div>
    </div>
  )
}
