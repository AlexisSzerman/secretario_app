// ImportInformesModal.jsx - LÓGICA DE PRECURSOR CORREGIDA
// Copiar a: src/components/ImportInformesModal.jsx (REEMPLAZAR)

import { useState } from 'react'
import { Upload, X, CheckCircle, AlertCircle, UserCheck, UserX, Info } from 'lucide-react'
import * as XLSX from 'xlsx'
import { db } from '../lib/supabase'
import { getMesNombre } from '../utils/dateUtils'

export default function ImportInformesModal({ onClose, publicadores, mesActual, onImport }) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('upload') // 'upload', 'review', 'result'
  const [informesParseados, setInformesParseados] = useState([])
  const [result, setResult] = useState(null)

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      setLoading(true)
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) {
        alert('El archivo Excel está vacío')
        return
      }

      // Parsear y hacer matching
      const informesProcesados = procesarInformes(jsonData)
      setInformesParseados(informesProcesados)
      setStep('review')
    } catch (error) {
      console.error('Error procesando Excel:', error)
      alert('Error al procesar el archivo Excel')
    } finally {
      setLoading(false)
    }
  }

  const procesarInformes = (data) => {
    const mesMap = {
      'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
      'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
    }

    return data.map((row, index) => {
      // Limpiar nombre y apellido
      const nombreExcel = (row.Nombre || '').toString().trim()
      const apellidoExcel = (row.Apellido || '').toString().trim()
      
      // Intentar match automático
      const match = encontrarPublicador(nombreExcel, apellidoExcel)

      // Parsear mes
      const mesTexto = (row.Mes || '').toString().toLowerCase()
      const mes = mesMap[mesTexto] || mesActual.mes

      // Parsear marca de precursor del Excel
      const marcaPrecursorExcel = ['si', 'sí', 'yes', 'x', '1'].includes(
        (row.Precusor || row.Precursor || '').toString().toLowerCase().trim()
      )

      // LÓGICA CORREGIDA: Solo es precursor auxiliar si:
      // 1. El Excel marca "Sí" en Precusor
      // 2. Y el publicador NO es Precursor Regular/Especial
      const esPrecursorRegular = match && (
        match.tipo_servicio === 'Precursor Regular' || 
        match.tipo_servicio === 'Precursor Especial'
      )
      const precursorAuxiliar = marcaPrecursorExcel && !esPrecursorRegular

      return {
        id: `temp_${index}`,
        nombreExcel,
        apellidoExcel,
        publicador: match,
        matchAutomatico: !!match,
        mes,
        ano: row.Año || row.ano || mesActual.ano,
        participo: ['si', 'sí', 'yes', 'x', '1'].includes((row.Participó || '').toString().toLowerCase().trim()),
        cursos: parseInt(row.Cursos || 0) || 0,
        horas: parseInt(row.Horas || 0) || 0,
        marcaPrecursorExcel, // Guardamos la marca original para mostrarlo
        precursorAuxiliar, // Este es el valor correcto que se guardará
        esPrecursorRegular, // Para mostrar el badge
        notas: row.Comentarios || row.comentarios || row.Notas || ''
      }
    })
  }

  const encontrarPublicador = (nombre, apellido) => {
    const nombreClean = nombre.toLowerCase().trim()
    const apellidoClean = apellido.toLowerCase().trim()

    // 1. Match exacto
    let match = publicadores.find(p => 
      p.nombre.toLowerCase().trim() === nombreClean && 
      p.apellido.toLowerCase().trim() === apellidoClean
    )
    if (match) return match

    // 2. Match por apellido + primera palabra del nombre
    const primerNombre = nombreClean.split(' ')[0]
    match = publicadores.find(p => 
      p.apellido.toLowerCase().trim() === apellidoClean &&
      p.nombre.toLowerCase().split(' ')[0] === primerNombre
    )
    if (match) return match

    // 3. Match solo por apellido (si es único)
    const matchesPorApellido = publicadores.filter(p => 
      p.apellido.toLowerCase().trim() === apellidoClean
    )
    if (matchesPorApellido.length === 1) return matchesPorApellido[0]

    // 4. Match aproximado (contiene)
    match = publicadores.find(p => {
      const nombrePub = p.nombre.toLowerCase().trim()
      const apellidoPub = p.apellido.toLowerCase().trim()
      return apellidoPub.includes(apellidoClean) && nombrePub.includes(primerNombre)
    })
    if (match) return match

    return null
  }

  const handlePublicadorChange = (informeId, publicadorId) => {
    setInformesParseados(prev => prev.map(inf => {
      if (inf.id === informeId) {
        const publicador = publicadores.find(p => p.id === publicadorId)
        
        // Recalcular si es precursor auxiliar al cambiar de publicador
        const esPrecursorRegular = publicador && (
          publicador.tipo_servicio === 'Precursor Regular' || 
          publicador.tipo_servicio === 'Precursor Especial'
        )
        const precursorAuxiliar = inf.marcaPrecursorExcel && !esPrecursorRegular
        
        return {
          ...inf,
          publicador,
          matchAutomatico: false,
          esPrecursorRegular,
          precursorAuxiliar
        }
      }
      return inf
    }))
  }

  const handleImportar = async () => {
    setLoading(true)
    try {
      const informesConPublicador = informesParseados.filter(inf => inf.publicador)
      const informesSinPublicador = informesParseados.filter(inf => !inf.publicador)

      let guardados = 0
      let actualizados = 0
      const errores = []

      for (const inf of informesConPublicador) {
        try {
          const informeData = {
            publicador_id: inf.publicador.id,
            mes: inf.mes,
            ano: inf.ano,
            participo: inf.participo,
            cursos: inf.cursos,
            horas: inf.horas,
            precursor_auxiliar: inf.precursorAuxiliar, // Usa el valor corregido
            notas: inf.notas
          }

          // Verificar si ya existe
          const existente = await db.getInformeByPublicadorMesAno(
            inf.publicador.id,
            inf.mes,
            inf.ano
          )

          if (existente) {
            await db.updateInforme(existente.id, informeData)
            actualizados++
          } else {
            await db.addInforme(informeData)
            guardados++
          }
        } catch (error) {
          console.error('Error guardando informe:', error)
          errores.push(`${inf.apellidoExcel}, ${inf.nombreExcel}: ${error.message}`)
        }
      }

      setResult({
        total: informesParseados.length,
        guardados,
        actualizados,
        sinAsignar: informesSinPublicador.length,
        errores: errores.length,
        detalleErrores: errores
      })
      setStep('result')

      if (guardados > 0 || actualizados > 0) {
        onImport()
      }
    } catch (error) {
      console.error('Error importando:', error)
      alert('Error al importar informes')
    } finally {
      setLoading(false)
    }
  }

  const matchAutomaticos = informesParseados.filter(i => i.matchAutomatico && i.publicador).length
  const sinMatch = informesParseados.filter(i => !i.publicador).length
  const asignadosManualmente = informesParseados.filter(i => !i.matchAutomatico && i.publicador).length
  const precursoresRegularesEnExcel = informesParseados.filter(i => i.esPrecursorRegular && i.marcaPrecursorExcel).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="card max-w-4xl w-full max-h-[90vh] overflow-auto p-6 animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Importar Informes - {getMesNombre(mesActual.mes)} {mesActual.ano}
            </h2>
            {step === 'review' && (
              <p className="text-sm text-slate-600 mt-1">
                {matchAutomaticos} automáticos • {asignadosManualmente} asignados • {sinMatch} sin asignar
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X size={24} />
          </button>
        </div>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload-informes"
                disabled={loading}
              />
              <label htmlFor="file-upload-informes" className="cursor-pointer flex flex-col items-center">
                <Upload className="text-slate-400 mb-3" size={48} />
                <span className="text-slate-700 font-medium">
                  Click para seleccionar archivo Excel
                </span>
                <span className="text-slate-500 text-sm mt-1">.xlsx o .xls</span>
              </label>
            </div>

            {loading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
                <p className="text-slate-600 mt-2">Procesando y buscando coincidencias...</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">📋 Formato esperado:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✅ <strong>Apellido y Nombre</strong></li>
                <li>✅ <strong>Participó</strong> (Si/No)</li>
                <li>✅ <strong>Cursos</strong> (número)</li>
                <li>✅ <strong>Horas</strong> (número)</li>
                <li>✅ <strong>Precusor/Precursor</strong> (Si/No para auxiliar)</li>
              </ul>
              <p className="text-xs text-blue-700 mt-3 font-semibold">
                ℹ️ Nota: Los Precursores Regulares no se marcarán como auxiliares aunque el Excel diga "Sí"
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-3 bg-emerald-50 border-emerald-200">
                <div className="flex items-center gap-2">
                  <UserCheck className="text-emerald-600" size={20} />
                  <div>
                    <div className="text-xs text-emerald-700">Match automático</div>
                    <div className="text-lg font-semibold text-emerald-900">{matchAutomaticos}</div>
                  </div>
                </div>
              </div>
              <div className="card p-3 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2">
                  <UserCheck className="text-blue-600" size={20} />
                  <div>
                    <div className="text-xs text-blue-700">Asignados</div>
                    <div className="text-lg font-semibold text-blue-900">{asignadosManualmente}</div>
                  </div>
                </div>
              </div>
              <div className="card p-3 bg-red-50 border-red-200">
                <div className="flex items-center gap-2">
                  <UserX className="text-red-600" size={20} />
                  <div>
                    <div className="text-xs text-red-700">Sin asignar</div>
                    <div className="text-lg font-semibold text-red-900">{sinMatch}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerta de precursores regulares */}
            {precursoresRegularesEnExcel > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="text-amber-600 mt-0.5" size={20} />
                  <div className="text-sm text-amber-800">
                    <strong>Nota:</strong> {precursoresRegularesEnExcel} Precursor{precursoresRegularesEnExcel > 1 ? 'es' : ''} Regular{precursoresRegularesEnExcel > 1 ? 'es' : ''} detectado{precursoresRegularesEnExcel > 1 ? 's' : ''}. 
                    No se marcarán como auxiliares (la marca de "Precusor" en el Excel se ignoró automáticamente).
                  </div>
                </div>
              </div>
            )}

            {/* Lista de informes */}
            <div className="max-h-96 overflow-auto space-y-2">
              {informesParseados.map(inf => (
                <div
                  key={inf.id}
                  className={`p-3 rounded-lg border ${
                    inf.publicador
                      ? inf.matchAutomatico
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-blue-50 border-blue-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 mb-1">
                        {inf.apellidoExcel}, {inf.nombreExcel}
                      </div>
                      <div className="text-xs text-slate-600 flex gap-3 flex-wrap">
                        {inf.participo && <span>✓ Participó</span>}
                        {inf.cursos > 0 && <span>{inf.cursos} cursos</span>}
                        {inf.horas > 0 && <span>{inf.horas}h</span>}
                        {inf.esPrecursorRegular && (
                          <span className="text-amber-700 font-semibold">⭐ Precursor Regular</span>
                        )}
                        {inf.precursorAuxiliar && (
                          <span className="text-yellow-700 font-semibold">⭐ P. Auxiliar</span>
                        )}
                        {inf.marcaPrecursorExcel && inf.esPrecursorRegular && (
                          <span className="text-slate-500 line-through">P. Aux (ignorado)</span>
                        )}
                      </div>
                    </div>

                    {/* Selector de publicador */}
                    <div className="w-64">
                      {inf.publicador ? (
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            {inf.matchAutomatico && (
                              <span className="text-emerald-700">✓ Auto: </span>
                            )}
                            <span className="font-medium text-slate-900">
                              {inf.publicador.apellido}, {inf.publicador.nombre}
                            </span>
                          </div>
                          <button
                            onClick={() => handlePublicadorChange(inf.id, null)}
                            className="text-xs text-slate-500 hover:text-slate-700"
                          >
                            Cambiar
                          </button>
                        </div>
                      ) : (
                        <select
                          onChange={(e) => handlePublicadorChange(inf.id, e.target.value)}
                          className="custom-input text-sm"
                          value=""
                        >
                          <option value="">Seleccionar publicador...</option>
                          {publicadores
                            .sort((a, b) => a.apellido.localeCompare(b.apellido))
                            .map(p => (
                              <option key={p.id} value={p.id}>
                                {p.apellido}, {p.nombre} {p.grupo && `- Grupo ${p.grupo}`}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Botones */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <button onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={handleImportar}
                disabled={loading || sinMatch > 0}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>Importando...</>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Importar {informesParseados.filter(i => i.publicador).length} informes
                  </>
                )}
              </button>
            </div>

            {sinMatch > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                ⚠️ Debes asignar todos los informes antes de importar. Quedan {sinMatch} sin asignar.
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Result */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle className="text-green-600 mx-auto mb-3" size={64} />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                ¡Importación Completada!
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4 bg-emerald-50 border-emerald-200">
                <div className="text-sm text-emerald-700">Nuevos</div>
                <div className="text-2xl font-semibold text-emerald-900">{result.guardados}</div>
              </div>
              <div className="card p-4 bg-blue-50 border-blue-200">
                <div className="text-sm text-blue-700">Actualizados</div>
                <div className="text-2xl font-semibold text-blue-900">{result.actualizados}</div>
              </div>
            </div>

            {result.sinAsignar > 0 && (
              <div className="card p-4 bg-amber-50 border-amber-200">
                <div className="text-sm text-amber-700">Sin asignar (omitidos)</div>
                <div className="text-2xl font-semibold text-amber-900">{result.sinAsignar}</div>
              </div>
            )}

            {result.errores > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-red-600 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-semibold text-red-900 mb-2">
                      {result.errores} error{result.errores > 1 ? 'es' : ''}
                    </h4>
                    <div className="text-sm text-red-800 space-y-1 max-h-32 overflow-auto">
                      {result.detalleErrores.map((error, idx) => (
                        <div key={idx}>• {error}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button onClick={onClose} className="btn-primary w-full">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
