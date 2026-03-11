import { useState } from 'react'
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { db } from '../lib/supabase'

export default function ImportModal({ onClose, onSuccess, existingPublicadores = [] }) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      setLoading(true)
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { cellDates: true })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false })

      if (jsonData.length === 0) {
        alert('El archivo Excel está vacío')
        return
      }

      // Mostrar preview
      setPreview(jsonData.slice(0, 5))

      // Procesar automáticamente
      await procesarYGuardar(jsonData)
    } catch (error) {
      console.error('Error procesando Excel:', error)
      alert('Error al procesar el archivo Excel: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const procesarYGuardar = async (data) => {
    const publicadoresNuevos = []
    const publicadoresExistentes = []
    const errores = []

    for (const row of data) {
      try {
        // Mapeo de columnas
        const nombre = (row.Nombre || row.nombre || row.NOMBRE || '').toString().trim()
        const apellido = (row.Apellido || row.apellido || row.APELLIDO || '').toString().trim()
        
        // Validar datos mínimos
        if (!nombre || !apellido) {
          errores.push(`Fila sin nombre o apellido completo`)
          continue
        }

        // Mapear grupo - limpiar paréntesis y texto extra
        let grupo = row.Grupo || row.grupo || row.GRUPO || ''
        grupo = grupo.toString().trim()
        // Remover paréntesis si existen
        grupo = grupo.replace(/[()]/g, '').trim()
        // Si tiene "grupo" al inicio, removerlo
        grupo = grupo.replace(/^grupo\s*/i, '').trim()

        // Mapear bautizado - CORREGIDO
        const bautizadoRaw = (row.Bautizado || row.bautizado || row.BAUTIZADO || '').toString().trim().toLowerCase()
        const bautizado = ['si', 'sí', 'yes', 'true', '1', 'x'].includes(bautizadoRaw)

        // Mapear fecha de bautismo - CORREGIDO
        let fechaBautismo = null
        const fechaRaw = row['Fecha Bautismo'] || row['Fecha de Bautismo'] || 
                        row.fechaBautismo || row['fecha bautismo'] || row.FechaBautismo
        
        if (fechaRaw) {
          try {
            // Si ya es string en formato ISO o similar
            if (typeof fechaRaw === 'string') {
              const date = new Date(fechaRaw)
              if (!isNaN(date.getTime())) {
                fechaBautismo = date.toISOString().split('T')[0]
              }
            } 
            // Si es un número (serial date de Excel)
            else if (typeof fechaRaw === 'number') {
              // Convertir serial date de Excel a fecha
              const date = new Date((fechaRaw - 25569) * 86400 * 1000)
              if (!isNaN(date.getTime())) {
                fechaBautismo = date.toISOString().split('T')[0]
              }
            }
            // Si ya viene procesado como fecha por XLSX
            else {
              const date = new Date(fechaRaw)
              if (!isNaN(date.getTime())) {
                fechaBautismo = date.toISOString().split('T')[0]
              }
            }
          } catch (e) {
            console.log(`Error procesando fecha para ${apellido}, ${nombre}:`, e)
          }
        }

        const publicador = {
          nombre: nombre,
          apellido: apellido,
          grupo: grupo,
          tipo_servicio: (row['Tipo de Servicio'] || row['Tipo Servicio'] || 
                        row.tipoServicio || row['tipo de servicio'] || 'Publicador').toString().trim(),
          responsabilidad: (row.Responsabilidad || row.responsabilidad || 
                          row.RESPONSABILIDAD || '').toString().trim(),
          telefono: (row.Teléfono || row.Telefono || row.telefono || row.TELEFONO || '').toString().trim(),
          email: (row.Email || row.email || row.EMAIL || row.Correo || '').toString().trim(),
          direccion: (row.Dirección || row.Direccion || row.direccion || row.DIRECCION || '').toString().trim(),
          bautizado: bautizado,
          fecha_bautismo: fechaBautismo,
          en_congregacion_desde: null // ← AGREGADO: consistente con EditPublicadorModal
        }

        // DEBUG - Descomentar para ver qué se está procesando
        console.log('Procesando:', publicador.apellido, publicador.nombre, 
                   'Bautizado:', publicador.bautizado, 
                   'Fecha:', publicador.fecha_bautismo)

        // Verificar si ya existe
        const existe = existingPublicadores.some(p => 
          p.nombre.toLowerCase() === publicador.nombre.toLowerCase() && 
          p.apellido.toLowerCase() === publicador.apellido.toLowerCase()
        )

        if (existe) {
          publicadoresExistentes.push(publicador)
        } else {
          publicadoresNuevos.push(publicador)
        }
      } catch (error) {
        console.error('Error procesando fila:', error)
        errores.push(`Error en fila: ${row.Nombre || ''} ${row.Apellido || ''} - ${error.message}`)
      }
    }

    // Guardar en Supabase
    let guardados = 0
    for (const pub of publicadoresNuevos) {
      try {
        await db.addPublicador(pub)
        guardados++
      } catch (error) {
        console.error('Error guardando publicador:', error)
        errores.push(`No se pudo guardar: ${pub.apellido}, ${pub.nombre} - ${error.message}`)
      }
    }

    setResult({
      total: data.length,
      guardados,
      existentes: publicadoresExistentes.length,
      errores: errores.length,
      detalleErrores: errores
    })

    if (guardados > 0) {
      onSuccess()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-auto p-6 animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Upload className="text-slate-700" size={24} />
            <h2 className="text-xl font-semibold text-slate-900">
              Importar Excel - Publicadores
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X size={24} />
          </button>
        </div>

        {!result && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={loading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="text-slate-400 mb-3" size={48} />
                <span className="text-slate-700 font-medium">
                  Click para seleccionar archivo Excel
                </span>
                <span className="text-slate-500 text-sm mt-1">
                  .xlsx o .xls
                </span>
              </label>
            </div>

            {loading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
                <p className="text-slate-600 mt-2">Procesando archivo...</p>
              </div>
            )}

            {preview && (
              <div className="mt-4">
                <h3 className="font-semibold text-slate-900 mb-2">Preview (primeras 5 filas):</h3>
                <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2">
                  {preview.map((row, idx) => (
                    <div key={idx} className="py-2 border-b border-slate-200 last:border-0">
                      <strong>{row.Apellido || row.apellido}, {row.Nombre || row.nombre}</strong>
                      <div className="text-xs text-slate-600 mt-1">
                        Grupo: {row.Grupo || row.grupo} • 
                        Bautizado: {row.Bautizado || row.bautizado} • 
                        Fecha: {row['Fecha Bautismo'] || 'Sin fecha'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">📋 Formato del Excel:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✅ <strong>Nombre y Apellido</strong> (obligatorios)</li>
                <li>✅ <strong>Grupo</strong> (número: 1, 2, 3...)</li>
                <li>✅ <strong>Bautizado</strong> (Si/No)</li>
                <li>✅ <strong>Fecha Bautismo</strong> (cualquier formato)</li>
                <li>✅ <strong>Responsabilidad</strong> (Anciano, Siervo Ministerial)</li>
                <li>✅ <strong>Dirección, Teléfono, Email</strong> (opcionales)</li>
              </ul>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle className="text-green-600 mx-auto mb-3" size={64} />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                ¡Importación Completada!
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4 bg-emerald-50 border-emerald-200">
                <div className="text-sm text-emerald-700">Guardados</div>
                <div className="text-2xl font-semibold text-emerald-900">{result.guardados}</div>
              </div>
              <div className="card p-4 bg-slate-50">
                <div className="text-sm text-slate-600">Ya existentes</div>
                <div className="text-2xl font-semibold text-slate-900">{result.existentes}</div>
              </div>
            </div>

            {result.errores > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-amber-600 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-900 mb-2">
                      {result.errores} error{result.errores > 1 ? 'es' : ''}
                    </h4>
                    <div className="text-sm text-amber-800 space-y-1 max-h-32 overflow-auto">
                      {result.detalleErrores.slice(0, 10).map((error, idx) => (
                        <div key={idx}>• {error}</div>
                      ))}
                      {result.detalleErrores.length > 10 && (
                        <div className="text-xs text-amber-700 mt-2">
                          ... y {result.detalleErrores.length - 10} errores más
                        </div>
                      )}
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
