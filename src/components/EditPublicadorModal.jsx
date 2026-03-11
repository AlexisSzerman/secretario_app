import { useState, useEffect } from 'react'
import { X, Save, Star, Trash2, Info } from 'lucide-react'
import { db } from '../lib/supabase'
import { getMesNombre } from '../utils/dateUtils'

export default function EditPublicadorModal({ publicador, onClose, onSave }) {
  const [datos, setDatos] = useState({
    nombre: publicador?.nombre || '',
    apellido: publicador?.apellido || '',
    grupo: publicador?.grupo || '',
    tipo_servicio: publicador?.tipo_servicio || 'Publicador',
    responsabilidad: publicador?.responsabilidad || '',
    telefono: publicador?.telefono || '',
    email: publicador?.email || '',
    direccion: publicador?.direccion || '',
    bautizado: publicador?.bautizado || false,
    fecha_bautismo: publicador?.fecha_bautismo || '',
    en_congregacion_desde: publicador?.en_congregacion_desde || '' 
    // ELIMINADO: fecha_llegada (redundante con en_congregacion_desde)
  })
  
  const [tipoServicioAnterior, setTipoServicioAnterior] = useState(publicador?.tipo_servicio || 'Publicador')
  const [historialPrecAux, setHistorialPrecAux] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (publicador) {
      loadHistorialPrecursorAuxiliar()
    } else {
      setLoading(false)
      // Si es nuevo publicador, sugerir fecha actual
      setDatos(prev => ({
        ...prev,
        en_congregacion_desde: new Date().toISOString().split('T')[0]
      }))
    }
  }, [publicador])

  const loadHistorialPrecursorAuxiliar = async () => {
    try {
      const informes = await db.getInformesByPublicador(publicador.id)
      const mesesAuxiliar = informes
        .filter(inf => inf.precursor_auxiliar)
        .map(inf => ({
          mes: inf.mes,
          ano: inf.ano,
          horas: inf.horas
        }))
        .sort((a, b) => {
          if (a.ano !== b.ano) return b.ano - a.ano
          return b.mes - a.mes
        })
      
      setHistorialPrecAux(mesesAuxiliar)
    } catch (error) {
      console.error('Error cargando historial:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTipoServicioChange = (nuevoTipo) => {
    const eraInactivo = tipoServicioAnterior === 'Inactivo'
    const esActivoAhora = nuevoTipo !== 'Inactivo'
    
    if (eraInactivo && esActivoAhora && !datos.en_congregacion_desde) {
      const hoy = new Date().toISOString().split('T')[0]
      setDatos({...datos, tipo_servicio: nuevoTipo, en_congregacion_desde: hoy})
    } else {
      setDatos({...datos, tipo_servicio: nuevoTipo})
    }
    
    setTipoServicioAnterior(nuevoTipo)
  }
const handleSubmit = async (e) => {
  e.preventDefault()

  if (!datos.nombre.trim() || !datos.apellido.trim()) {
    alert('Nombre y apellido son obligatorios')
    return
  }

  try {
    const datosLimpios = {
      ...datos,
      fecha_bautismo: datos.fecha_bautismo || null,
      fecha_llegada: datos.fecha_llegada || null,
      en_congregacion_desde: datos.en_congregacion_desde || null
    }

    if (publicador) {
      await db.updatePublicador(publicador.id, datosLimpios)
    } else {
      await db.addPublicador(datosLimpios)
    }

    onSave()
  } catch (error) {
    console.error('Error guardando publicador:', error)
    alert('Error al guardar')
  }
}

  const handleDelete = async () => {
    if (!publicador) return
    
    try {
      await db.deletePublicador(publicador.id)
      onSave()
    } catch (error) {
      console.error('Error eliminando publicador:', error)
      alert('Error al eliminar. Es posible que tenga informes asociados.')
    }
  }

  const esActivo = datos.tipo_servicio !== 'Inactivo'
  const esPrecursorRegular = datos.tipo_servicio === 'Precursor Regular' || 
                            datos.tipo_servicio === 'Precursor Especial'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-auto p-6 animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-900">
            {publicador ? 'Editar Publicador' : 'Nuevo Publicador'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre y Apellido */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nombre *
              </label>
              <input
                type="text"
                value={datos.nombre}
                onChange={(e) => setDatos({...datos, nombre: e.target.value})}
                className="custom-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Apellido *
              </label>
              <input
                type="text"
                value={datos.apellido}
                onChange={(e) => setDatos({...datos, apellido: e.target.value})}
                className="custom-input"
                required
              />
            </div>
          </div>

          {/* Grupo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Grupo
            </label>
            <input
              type="text"
              value={datos.grupo}
              onChange={(e) => setDatos({...datos, grupo: e.target.value})}
              className="custom-input"
              placeholder="Ej: 1, 2, 3..."
            />
          </div>

          {/* Tipo de Servicio y Responsabilidad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tipo de Servicio
              </label>
              <select
                value={datos.tipo_servicio}
                onChange={(e) => handleTipoServicioChange(e.target.value)}
                className="custom-input"
              >
                <option value="Publicador">Publicador</option>
                <option value="Precursor Regular">Precursor Regular</option>
                <option value="Precursor Especial">Precursor Especial</option>
                <option value="Misionero">Misionero</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Responsabilidad
              </label>
              <select
                value={datos.responsabilidad}
                onChange={(e) => setDatos({...datos, responsabilidad: e.target.value})}
                className="custom-input"
              >
                <option value="">Ninguna</option>
                <option value="Anciano">Anciano</option>
                <option value="Siervo Ministerial">Siervo Ministerial</option>
              </select>
            </div>
          </div>

          {/* En congregación desde */}
          {esActivo && (
            <div className={`rounded-lg p-4 ${
              esPrecursorRegular 
                ? 'bg-amber-50 border border-amber-200' 
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <label className={`block text-sm font-medium mb-2 ${
                esPrecursorRegular ? 'text-amber-900' : 'text-blue-900'
              }`}>
                En congregación desde
              </label>
              <input
                type="date"
                value={datos.en_congregacion_desde}
                onChange={(e) => setDatos({...datos, en_congregacion_desde: e.target.value})}
                className="custom-input"
              />
              <div className="flex items-start gap-2 mt-2">
                <Info className={`mt-0.5 flex-shrink-0 ${
                  esPrecursorRegular ? 'text-amber-600' : 'text-blue-600'
                }`} size={16} />
                <div className={`text-xs ${
                  esPrecursorRegular ? 'text-amber-700' : 'text-blue-700'
                }`}>
                  {esPrecursorRegular ? (
                    <>
                      <p className="font-semibold mb-1">Para Precursores Regulares:</p>
                      <p>
                        • Solo se evaluará "sin informar" desde esta fecha<br/>
                        • Podrás cargar informes de meses anteriores (para promedio de 600h anuales)<br/>
                        • Útil si vino de otra congregación o se reactivó
                      </p>
                    </>
                  ) : (
                    <p>
                      Indica desde qué fecha debe informar en esta congregación. 
                      Solo se evaluará "sin informar" desde esta fecha en adelante. 
                      Úsalo para mudanzas o reactivaciones.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Teléfono y Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                value={datos.telefono}
                onChange={(e) => setDatos({...datos, telefono: e.target.value})}
                className="custom-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={datos.email}
                onChange={(e) => setDatos({...datos, email: e.target.value})}
                className="custom-input"
              />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Dirección
            </label>
            <input
              type="text"
              value={datos.direccion}
              onChange={(e) => setDatos({...datos, direccion: e.target.value})}
              className="custom-input"
              placeholder="Dirección completa"
            />
          </div>

          {/* Bautizado */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={datos.bautizado}
                onChange={(e) => setDatos({...datos, bautizado: e.target.checked})}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-700">Bautizado</span>
            </label>
          </div>

          {/* Fecha de Bautismo */}
          {datos.bautizado && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Fecha de Bautismo
              </label>
              <input
                type="date"
                value={datos.fecha_bautismo}
                onChange={(e) => setDatos({...datos, fecha_bautismo: e.target.value})}
                className="custom-input"
              />
            </div>
          )}

          {/* Historial de Precursor Auxiliar */}
          {publicador && !loading && historialPrecAux.length > 0 && (
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="text-yellow-600" size={20} />
                <h3 className="text-sm font-semibold text-slate-900">
                  Historial como Precursor Auxiliar
                </h3>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex flex-wrap gap-2">
                  {historialPrecAux.map((m, idx) => (
                    <span key={idx} className="badge badge-yellow">
                      <Star size={12} />
                      {getMesNombre(m.mes)} {m.ano} ({m.horas}h)
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Total: {historialPrecAux.length} {historialPrecAux.length === 1 ? 'mes' : 'meses'}
                </p>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 justify-between pt-4 border-t border-slate-200">
            {publicador && !showDeleteConfirm && (
              <button 
                type="button" 
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-200 transition-colors inline-flex items-center gap-2 font-medium"
              >
                <Trash2 size={16} />
                Eliminar
              </button>
            )}

            {showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-700">¿Confirmar eliminación?</span>
                <button 
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Sí, eliminar
                </button>
                <button 
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300"
                >
                  Cancelar
                </button>
              </div>
            )}

            {!publicador && <div></div>}

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                <Save size={16} />
                Guardar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
