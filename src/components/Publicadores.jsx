// Publicadores.jsx - CON BADGES DE RESPONSABILIDAD
// Copiar a: src/components/Publicadores.jsx (REEMPLAZAR)

import { useState } from 'react'
import { Search, Upload, Star, Phone, Droplet, Edit2, Plus, Shield, Award, FileText } from 'lucide-react'
import { formatearFecha } from '../utils/dateUtils'
import ImportModal from './ImportModal'
import EditPublicadorModal from './EditPublicadorModal'
import VistaMudados from './VistaMudados'
import GenerarS21Modal from './GenerarS21Modal'

export default function Publicadores({ publicadores, onReload }) {
  const [filtro, setFiltro] = useState('')
  const [grupoFiltro, setGrupoFiltro] = useState('TODOS')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [publicadorEditar, setPublicadorEditar] = useState(null)
  const [vistaActual, setVistaActual] = useState('activos') // 'activos' o 'mudados'
  const [showS21Modal, setShowS21Modal] = useState(false)

  const grupos = ['TODOS', ...new Set(publicadores.map(p => p.grupo).filter(Boolean).sort())]

  // NUEVO: Filtrar publicadores mudados
  const publicadoresActivos = publicadores.filter(p => !p.fecha_mudanza)

  const publicadoresFiltrados = publicadoresActivos.filter(p => {
    const matchNombre = !filtro || 
      `${p.nombre} ${p.apellido}`.toLowerCase().includes(filtro.toLowerCase())
    const matchGrupo = grupoFiltro === 'TODOS' || p.grupo === grupoFiltro
    return matchNombre && matchGrupo
  })

  const publicadoresPorGrupo = publicadoresFiltrados.reduce((acc, p) => {
    const grupo = p.grupo || 'Sin grupo'
    if (!acc[grupo]) acc[grupo] = []
    acc[grupo].push(p)
    return acc
  }, {})

  const handleEdit = (publicador) => {
    setPublicadorEditar(publicador)
    setShowEditModal(true)
  }

  const handleNuevo = () => {
    setPublicadorEditar(null)
    setShowEditModal(true)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-900">Publicadores</h2>
            <p className="text-slate-600 text-sm mt-1">
              {vistaActual === 'activos' 
                ? `${publicadoresActivos.length} publicadores activos`
                : `${publicadores.filter(p => p.fecha_mudanza).length} publicadores mudados`
              }
            </p>
          </div>
          
          {/* Botones de vista */}
          <div className="flex gap-2">
            <button
              onClick={() => setVistaActual('activos')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                vistaActual === 'activos'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Activos
            </button>
            <button
              onClick={() => setVistaActual('mudados')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 ${
                vistaActual === 'mudados'
                  ? 'bg-orange-600 text-white'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              Mudados
            </button>
          </div>

          {/* Botones de acción (solo en vista activos) */}
          {vistaActual === 'activos' && (
            <div className="flex gap-2">
              <button 
                className="btn-secondary inline-flex items-center gap-2"
                onClick={() => setShowS21Modal(true)}
              >
                <FileText size={16} />
                Generar S-21
              </button>
              <button 
                className="btn-secondary"
                onClick={() => setShowImportModal(true)}
              >
                <Upload size={16} />
                Importar Excel
              </button>
              <button 
                className="btn-primary"
                onClick={handleNuevo}
              >
                <Plus size={16} />
                Nuevo
              </button>
            </div>
          )}
        </div>

        {/* Filtros - Solo en vista activos */}
        {vistaActual === 'activos' && (
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="custom-input pl-10"
              />
            </div>
            <select
              value={grupoFiltro}
              onChange={(e) => setGrupoFiltro(e.target.value)}
              className="custom-input md:w-48"
            >
              {grupos.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Vista Activos */}
      {vistaActual === 'activos' && (
        <>
          {/* Lista por grupos */}
          {Object.keys(publicadoresPorGrupo).sort().map((grupo, idx) => (
        <div key={grupo} className="card p-6 animate-slide-in" style={{ animationDelay: `${idx * 0.05}s` }}>
          <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            {grupo} ({publicadoresPorGrupo[grupo].length})
          </h3>
          <div className="space-y-2">
            {publicadoresPorGrupo[grupo].map(p => (
              <div 
                key={p.id} 
                className="flex justify-between items-center hover:bg-slate-50 p-3 rounded-lg transition-all border border-transparent hover:border-slate-200 cursor-pointer"
                onClick={() => handleEdit(p)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">
                      {p.apellido}, {p.nombre}
                    </span>
                    {p.tipo_servicio === 'Inactivo' && (
                      <span className="badge badge-gray text-xs">Inactivo</span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 flex gap-3 flex-wrap mt-1">
                    {/* Badge de Tipo de Servicio (solo si es precursor) */}
                    {p.tipo_servicio && p.tipo_servicio !== 'Publicador' && p.tipo_servicio !== 'Inactivo' && (
                      <span className="flex items-center gap-1">
                        <Star className="text-amber-500" size={14} />
                        {p.tipo_servicio}
                      </span>
                    )}
                    
                    {/* Badge de Responsabilidad - NUEVO */}
                    {p.responsabilidad === 'Anciano' && (
                      <span className="flex items-center gap-1 text-purple-700">
                        <Shield size={14} className="text-purple-600" />
                        Anciano
                      </span>
                    )}
                    {p.responsabilidad === 'Siervo Ministerial' && (
                      <span className="flex items-center gap-1 text-blue-700">
                        <Award size={14} className="text-blue-600" />
                        Siervo Ministerial
                      </span>
                    )}
                    
                    {/* Teléfono */}
                    {p.telefono && (
                      <span className="flex items-center gap-1">
                        <Phone size={14} />
                        {p.telefono}
                      </span>
                    )}
                    
                    {/* Fecha de bautismo */}
                    {p.bautizado && p.fecha_bautismo && (
                      <span className="flex items-center gap-1">
                        <Droplet className="text-blue-500" size={14} />
                        {formatearFecha(p.fecha_bautismo)}
                      </span>
                    )}
                  </div>
                </div>
                <Edit2 className="text-slate-400" size={16} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {publicadoresFiltrados.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-slate-600">No se encontraron publicadores</p>
        </div>
      )}
        </>
      )}

      {/* Vista Mudados */}
      {vistaActual === 'mudados' && (
        <VistaMudados 
          publicadores={publicadores}
          onReload={onReload}
        />
      )}

      {/* Modal de importación */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false)
            onReload()
          }}
          existingPublicadores={publicadores}
        />
      )}

      {/* Modal de edición */}
      {showEditModal && (
        <EditPublicadorModal
          publicador={publicadorEditar}
          onClose={() => {
            setShowEditModal(false)
            setPublicadorEditar(null)
          }}
          onSave={() => {
            setShowEditModal(false)
            setPublicadorEditar(null)
            onReload()
          }}
        />
      )}

      {/* Modal S-21 */}
      {showS21Modal && (
        <GenerarS21Modal
          publicadores={publicadores}
          onClose={() => setShowS21Modal(false)}
        />
      )}
    </div>
  )
}
