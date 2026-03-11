// VistaCapturaInformes.jsx - CON FILTRO en_congregacion_desde
// Copiar a: src/components/VistaCapturaInformes.jsx (REEMPLAZAR)

import { useState } from 'react'
import { Search, Users, CheckCircle, BookOpen, Clock, Star, Circle, Edit2, X, Check, Filter } from 'lucide-react'
import { db } from '../lib/supabase'

export default function VistaCapturaInformes({ publicadores, informes, mesActual, onReload, esDisponible }) {
  const [grupoFiltro, setGrupoFiltro] = useState('TODOS')
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [editingId, setEditingId] = useState(null)

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
  
  const grupos = ['TODOS', ...new Set(publicadoresDeberian.map(p => p.grupo).filter(Boolean).sort())]

  const getInformePublicador = (publicadorId) => {
    return informes.find(inf => inf.publicador_id === publicadorId)
  }

  const publicadoresFiltrados = publicadoresDeberian.filter(p => {
    const matchGrupo = grupoFiltro === 'TODOS' || p.grupo === grupoFiltro
    const matchBusqueda = !busqueda || 
      `${p.nombre} ${p.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
    
    const informe = getInformePublicador(p.id)
    let matchEstado = true
    
    if (filtroEstado === 'SIN_INFORMAR') {
      matchEstado = !informe
    } else if (filtroEstado === 'NO_PARTICIPARON') {
      matchEstado = informe && !informe.participo
    } else if (filtroEstado === 'PREC_AUXILIARES') {
      matchEstado = informe && informe.precursor_auxiliar
    }
    
    return matchGrupo && matchBusqueda && matchEstado
  })

  const sinInformar = publicadoresDeberian.filter(p => !getInformePublicador(p.id)).length
  const noParticiparon = publicadoresDeberian.filter(p => {
    const inf = getInformePublicador(p.id)
    return inf && !inf.participo
  }).length
  const precursoresAux = informes.filter(i => i.precursor_auxiliar).length

  return (
    <div className="space-y-6">
      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 bg-slate-50">
          <div className="text-xs text-slate-600">Sin informar</div>
          <div className="text-lg font-semibold text-slate-900">{sinInformar}</div>
        </div>
        <div className="card p-3 bg-amber-50">
          <div className="text-xs text-amber-700">No participaron</div>
          <div className="text-lg font-semibold text-amber-900">{noParticiparon}</div>
        </div>
        <div className="card p-3 bg-yellow-50">
          <div className="text-xs text-yellow-700">P. Auxiliares</div>
          <div className="text-lg font-semibold text-yellow-900">{precursoresAux}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar publicador..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
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

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFiltroEstado('TODOS')}
                className={`px-3 py-1 rounded text-sm transition-all ${
                  filtroEstado === 'TODOS'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Todos ({publicadoresFiltrados.length})
              </button>
              <button
                onClick={() => setFiltroEstado('SIN_INFORMAR')}
                className={`px-3 py-1 rounded text-sm transition-all ${
                  filtroEstado === 'SIN_INFORMAR'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Sin informar ({sinInformar})
              </button>
              <button
                onClick={() => setFiltroEstado('NO_PARTICIPARON')}
                className={`px-3 py-1 rounded text-sm transition-all ${
                  filtroEstado === 'NO_PARTICIPARON'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                No participaron ({noParticiparon})
              </button>
              <button
                onClick={() => setFiltroEstado('PREC_AUXILIARES')}
                className={`px-3 py-1 rounded text-sm transition-all ${
                  filtroEstado === 'PREC_AUXILIARES'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                }`}
              >
                P. Auxiliares ({precursoresAux})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de publicadores */}
      <div className="card divide-y divide-slate-100">
        {publicadoresFiltrados.map((pub, idx) => (
          <FilaPublicador
            key={pub.id}
            publicador={pub}
            informe={getInformePublicador(pub.id)}
            mesActual={mesActual}
            isEditing={editingId === pub.id}
            onEdit={() => setEditingId(pub.id)}
            onCancel={() => setEditingId(null)}
            onSave={async (datos) => {
              try {
                const informe = getInformePublicador(pub.id)
                const informeData = {
                  publicador_id: pub.id,
                  mes: mesActual.mes,
                  ano: mesActual.ano,
                  participo: datos.participo,
                  cursos: parseInt(datos.cursos) || 0,
                  horas: parseInt(datos.horas) || 0,
                  precursor_auxiliar: datos.precursorAuxiliar,
                  notas: datos.notas || ''
                }

                if (informe) {
                  await db.updateInforme(informe.id, informeData)
                } else {
                  await db.addInforme(informeData)
                }

                setEditingId(null)
                onReload()
              } catch (error) {
                console.error('Error guardando informe:', error)
                alert('Error al guardar el informe')
              }
            }}
            esDisponible={esDisponible}
          />
        ))}

        {publicadoresFiltrados.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-slate-600">No se encontraron publicadores con este filtro</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Componente individual de fila
function FilaPublicador({ publicador, informe, mesActual, isEditing, onEdit, onCancel, onSave, esDisponible }) {
  const [datos, setDatos] = useState({
    participo: informe?.participo || false,
    cursos: informe?.cursos || 0,
    horas: informe?.horas || 0,
    precursorAuxiliar: informe?.precursor_auxiliar || false,
    notas: informe?.notas || ''
  })

  const esPrecursor = publicador.tipo_servicio === 'Precursor Regular' || 
                     publicador.tipo_servicio === 'Precursor Especial'

  if (isEditing && esDisponible) {
    return (
      <div className="p-4 bg-slate-50">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="font-medium text-slate-900">
              {publicador.apellido}, {publicador.nombre}
            </div>
            <div className="text-sm text-slate-600">
              Grupo {publicador.grupo}
              {esPrecursor && (
                <span className="ml-2 text-amber-600">
                  <Star className="inline" size={14} />
                  {publicador.tipo_servicio}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={datos.participo}
              onChange={(e) => setDatos({...datos, participo: e.target.checked})}
              className="w-4 h-4"
            />
            <span className="text-sm">Participó</span>
          </label>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Cursos</label>
            <input
              type="number"
              min="0"
              value={datos.cursos}
              onChange={(e) => setDatos({...datos, cursos: e.target.value})}
              className="custom-input text-sm"
            />
          </div>

          {!esPrecursor && (
            <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={datos.precursorAuxiliar}
                onChange={(e) => setDatos({...datos, precursorAuxiliar: e.target.checked})}
                className="w-4 h-4"
              />
              <span className="text-sm">Prec. Auxiliar</span>
            </label>
          )}
        </div>

        {(datos.precursorAuxiliar || esPrecursor) && (
          <div className="mb-3">
            <label className="block text-xs text-slate-600 mb-1">
              Horas {esPrecursor && '(obligatorio)'}
            </label>
            <input
              type="number"
              min="0"
              value={datos.horas}
              onChange={(e) => setDatos({...datos, horas: e.target.value})}
              className="custom-input text-sm"
            />
          </div>
        )}

        <div className="mb-3">
          <label className="block text-xs text-slate-600 mb-1">Notas</label>
          <input
            type="text"
            value={datos.notas}
            onChange={(e) => setDatos({...datos, notas: e.target.value})}
            placeholder="Comentarios opcionales..."
            className="custom-input text-sm"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm">
            <X size={16} />
            Cancelar
          </button>
          <button onClick={() => onSave(datos)} className="btn-primary text-sm">
            <Check size={16} />
            Guardar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`p-4 transition-colors ${esDisponible ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-50'}`}
      onClick={esDisponible ? onEdit : undefined}
    >
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="font-medium text-slate-900">
            {publicador.apellido}, {publicador.nombre}
          </div>
          <div className="text-sm text-slate-600 flex gap-3 mt-1 flex-wrap">
            <span>Grupo {publicador.grupo}</span>
            {esPrecursor && (
              <span className="text-amber-600 flex items-center gap-1">
                <Star size={14} />
                {publicador.tipo_servicio}
              </span>
            )}
          </div>
        </div>

        {informe ? (
          <div className="flex items-center gap-4">
            {informe.participo && (
              <span className="badge badge-green">
                <CheckCircle size={14} />
                Participó
              </span>
            )}
            {informe.cursos > 0 && (
              <span className="badge badge-gray">
                <BookOpen size={14} />
                {informe.cursos} curso{informe.cursos > 1 ? 's' : ''}
              </span>
            )}
            {informe.horas > 0 && (
              <span className="badge badge-gray">
                <Clock size={14} />
                {informe.horas}h
              </span>
            )}
            {informe.precursor_auxiliar && (
              <span className="badge badge-yellow">
                <Star size={14} />
                P. Auxiliar
              </span>
            )}
            {esDisponible && <Edit2 className="text-slate-400" size={16} />}
          </div>
        ) : (
          <span className="badge badge-gray">
            <Circle size={14} />
            Sin informar
          </span>
        )}
      </div>
    </div>
  )
}
