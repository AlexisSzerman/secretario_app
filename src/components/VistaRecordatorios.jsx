import { useState, useEffect } from 'react'
import { Bell, Plus, Edit2, Trash2, Check, X, Eye, EyeOff, Calendar } from 'lucide-react'
import { db } from '../lib/supabase'

export default function VistaRecordatorios() {
  const [recordatorios, setRecordatorios] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('ACTIVOS') // ACTIVOS, COMPLETADOS, TODOS
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  
  // Form state
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    fecha_inicio: '',
    fecha_fin: '',
    mostrar_en_dashboard: true
  })

  useEffect(() => {
    loadRecordatorios()
  }, [])

  const loadRecordatorios = async () => {
    setLoading(true)
    try {
      const data = await db.getAllRecordatorios()
      setRecordatorios(data)
    } catch (error) {
      console.error('Error cargando recordatorios:', error)
      alert('Error al cargar recordatorios')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.titulo.trim()) {
      alert('El título es requerido')
      return
    }

    try {
      if (editando) {
        await db.updateRecordatorio(editando.id, form)
      } else {
        await db.addRecordatorio(form)
      }
      
      await loadRecordatorios()
      cerrarModal()
    } catch (error) {
      console.error('Error guardando recordatorio:', error)
      alert('Error al guardar recordatorio')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este recordatorio?')) return
    
    try {
      await db.deleteRecordatorio(id)
      await loadRecordatorios()
    } catch (error) {
      console.error('Error eliminando recordatorio:', error)
      alert('Error al eliminar recordatorio')
    }
  }

  const handleCompletar = async (id) => {
    try {
      await db.marcarCompletada(id)
      await loadRecordatorios()
    } catch (error) {
      console.error('Error marcando completada:', error)
      alert('Error al completar recordatorio')
    }
  }

  const handleToggleDashboard = async (id, mostrar) => {
    try {
      await db.toggleDashboard(id, !mostrar)
      await loadRecordatorios()
    } catch (error) {
      console.error('Error actualizando dashboard:', error)
      alert('Error al actualizar')
    }
  }

  const abrirModal = (recordatorio = null) => {
    if (recordatorio) {
      setEditando(recordatorio)
      setForm({
        titulo: recordatorio.titulo,
        descripcion: recordatorio.descripcion || '',
        fecha_inicio: recordatorio.fecha_inicio || '',
        fecha_fin: recordatorio.fecha_fin || '',
        mostrar_en_dashboard: recordatorio.mostrar_en_dashboard
      })
    } else {
      setEditando(null)
      setForm({
        titulo: '',
        descripcion: '',
        fecha_inicio: '',
        fecha_fin: '',
        mostrar_en_dashboard: true
      })
    }
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setEditando(null)
    setForm({
      titulo: '',
      descripcion: '',
      fecha_inicio: '',
      fecha_fin: '',
      mostrar_en_dashboard: true
    })
  }

  // FUNCIONES CORREGIDAS: Manejo de fechas sin conversión UTC

  // Parsear fecha como local (sin conversión UTC)
  const parseFechaLocal = (fechaStr) => {
    if (!fechaStr) return null
    const [year, month, day] = fechaStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Calcular si está vencido
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

  // Formatear fecha
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return ''
    const fecha = parseFechaLocal(fechaStr)
    return fecha.toLocaleDateString('es-ES')
  }

  // Filtrar recordatorios
  const recordatoriosFiltrados = recordatorios.filter(r => {
    if (filtro === 'ACTIVOS') return !r.completada
    if (filtro === 'COMPLETADOS') return r.completada
    return true
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Recordatorios</h2>
          <p className="text-slate-600 text-sm mt-1">
            Gestiona tus recordatorios y tareas pendientes
          </p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Nuevo Recordatorio
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex gap-2">
          {['ACTIVOS', 'COMPLETADOS', 'TODOS'].map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filtro === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f === 'ACTIVOS' ? 'Activos' : f === 'COMPLETADOS' ? 'Completados' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="text-sm text-slate-600 mb-2">Activos</div>
          <div className="text-3xl font-semibold text-blue-600">
            {recordatorios.filter(r => !r.completada).length}
          </div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-slate-600 mb-2">Completados</div>
          <div className="text-3xl font-semibold text-green-600">
            {recordatorios.filter(r => r.completada).length}
          </div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-slate-600 mb-2">Vencidos</div>
          <div className="text-3xl font-semibold text-red-600">
            {recordatorios.filter(r => !r.completada && estaVencido(r.fecha_fin)).length}
          </div>
        </div>
      </div>

      {/* Lista de recordatorios */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          </div>
        ) : recordatoriosFiltrados.length === 0 ? (
          <div className="card p-12 text-center">
            <Bell className="mx-auto text-slate-400 mb-4" size={48} />
            <p className="text-slate-600">No hay recordatorios para mostrar</p>
            <button
              onClick={() => abrirModal()}
              className="btn-primary mt-4"
            >
              Crear primer recordatorio
            </button>
          </div>
        ) : (
          recordatoriosFiltrados.map(rec => {
            const vencido = !rec.completada && estaVencido(rec.fecha_fin)
            const dias = diasRestantes(rec.fecha_fin)
            
            return (
              <div
                key={rec.id}
                className={`card p-6 ${
                  rec.completada
                    ? 'bg-slate-50 border-slate-200'
                    : vencido
                    ? 'bg-red-50 border-red-200'
                    : 'hover:shadow-md transition-shadow'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-lg font-semibold ${
                        rec.completada ? 'text-slate-500 line-through' : 'text-slate-900'
                      }`}>
                        {rec.titulo}
                      </h3>
                      
                      {/* Badges */}
                      <div className="flex gap-2">
                        {rec.mostrar_en_dashboard && !rec.completada && (
                          <span className="badge badge-blue text-xs">Dashboard</span>
                        )}
                        {vencido && (
                          <span className="badge badge-red text-xs">Vencido</span>
                        )}
                        {!rec.completada && dias !== null && dias >= 0 && dias <= 3 && (
                          <span className="badge badge-yellow text-xs">
                            {dias === 0 ? 'Hoy' : `${dias}d`}
                          </span>
                        )}
                      </div>
                    </div>

                    {rec.descripcion && (
                      <p className="text-sm text-slate-600 mb-3">{rec.descripcion}</p>
                    )}

                    <div className="flex gap-4 text-sm text-slate-600">
                      {rec.fecha_inicio && (
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          Inicio: {formatearFecha(rec.fecha_inicio)}
                        </div>
                      )}
                      {rec.fecha_fin && (
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          Fin: {formatearFecha(rec.fecha_fin)}
                          {dias !== null && dias >= 0 && (
                            <span className="text-xs text-slate-500">
                              ({dias === 0 ? 'hoy' : `en ${dias}d`})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2">
                    {!rec.completada && (
                      <>
                        <button
                          onClick={() => handleToggleDashboard(rec.id, rec.mostrar_en_dashboard)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          title={rec.mostrar_en_dashboard ? 'Ocultar de dashboard' : 'Mostrar en dashboard'}
                        >
                          {rec.mostrar_en_dashboard ? (
                            <Eye className="text-blue-600" size={18} />
                          ) : (
                            <EyeOff className="text-slate-400" size={18} />
                          )}
                        </button>
                        <button
                          onClick={() => handleCompletar(rec.id)}
                          className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                          title="Marcar como completada"
                        >
                          <Check className="text-green-600" size={18} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => abrirModal(rec)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="text-slate-600" size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="text-red-600" size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-slate-900">
                {editando ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
              </h3>
              <button
                onClick={cerrarModal}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ej: Preparar informe S-1"
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Detalles adicionales (opcional)"
                  className="input w-full resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={form.fecha_inicio}
                    onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={form.fecha_fin}
                    onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mostrar_dashboard"
                  checked={form.mostrar_en_dashboard}
                  onChange={(e) => setForm({ ...form, mostrar_en_dashboard: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="mostrar_dashboard" className="text-sm text-slate-700">
                  Mostrar en Dashboard
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={cerrarModal} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editando ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
