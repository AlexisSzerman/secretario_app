import { useState, useEffect } from 'react'
import { FileText, Copy, CheckCircle, Download, Users, AlertCircle, Star } from 'lucide-react'
import { getMesNombre } from '../utils/dateUtils'
import { db } from '../lib/supabase'
import jsPDF from 'jspdf'

export default function VistaInformeS1({ publicadores, informes, mesActual }) {
  const [asistenciaFinSemana, setAsistenciaFinSemana] = useState('')
  const [asistenciaEntreSemana, setAsistenciaEntreSemana] = useState('')
  const [copiado, setCopiado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  
  // Listas dinámicas
  const [publicadoresAlerta, setPublicadoresAlerta] = useState([])

  // Cargar asistencia al montar
  useEffect(() => {
    loadAsistencia()
  }, [mesActual])

  const loadAsistencia = async () => {
    try {
      const datos = await db.getDatosMensuales(mesActual.mes, mesActual.ano)
      if (datos) {
        setAsistenciaFinSemana(datos.asistencia_fin_semana || '')
        setAsistenciaEntreSemana(datos.asistencia_entre_semana || '')
      }
    } catch (error) {
      console.error('Error cargando asistencia:', error)
    }
  }

  const guardarAsistencia = async () => {
    setGuardando(true)
    try {
      await db.saveDatosMensuales({
        mes: mesActual.mes,
        ano: mesActual.ano,
        asistencia_fin_semana: parseFloat(asistenciaFinSemana) || null,
        asistencia_entre_semana: parseFloat(asistenciaEntreSemana) || null
      })
      alert('Asistencia guardada correctamente')
    } catch (error) {
      console.error('Error guardando asistencia:', error)
      alert('Error al guardar asistencia')
    } finally {
      setGuardando(false)
    }
  }

  // FUNCIÓN HELPER: Verifica si debía informar en este mes
  const debiaInformarEnMes = (publicador) => {
    if (publicador.tipo_servicio === 'Inactivo') return false

    // informar_desde tiene prioridad sobre en_congregacion_desde para el
    // cálculo de elegibilidad (permite habilitar un mes de transición sin
    // afectar el cálculo de "Nuevos Publicadores" más abajo).
    const fechaBase = publicador.informar_desde || publicador.en_congregacion_desde || publicador.activo_desde
    const fechaMes = new Date(mesActual.ano, mesActual.mes - 1, 1)
    
    if (fechaBase) {
      const fechaInicio = new Date(fechaBase)
      if (fechaMes < fechaInicio) return false
    }
    
    if (publicador.fecha_mudanza) {
      const fechaSalida = new Date(publicador.fecha_mudanza)
      if (fechaMes > fechaSalida) return false
    }
    
    return true
  }

  const publicadoresActivos = publicadores.filter(p => 
    p.tipo_servicio !== 'Inactivo' &&
    (!p.fecha_mudanza || new Date(p.fecha_mudanza) >= new Date(mesActual.ano, mesActual.mes - 1, 1))
  )
  const publicadoresDeberian = publicadores.filter(p => debiaInformarEnMes(p))

  // Separar informes por tipo
  const informesPublicadores = informes.filter(inf => {
    const pub = publicadores.find(p => p.id === inf.publicador_id)
    return (
      pub &&
      pub.tipo_servicio === 'Publicador' &&
      !inf.precursor_auxiliar
    )
  })

  const informesPrecAux = informes.filter(inf => inf.precursor_auxiliar)

  const informesPrecReg = informes.filter(inf => {
    const pub = publicadores.find(p => p.id === inf.publicador_id)
    return (
      pub &&
      (pub.tipo_servicio === 'Precursor Regular' ||
       pub.tipo_servicio === 'Precursor Especial')
    )
  })

  // Estadísticas para S-1
  const stats = {
    totalPublicadoresActivos: publicadoresActivos.length,
    
    publicadores: {
      informes: informesPublicadores.length,
      cursos: informesPublicadores.reduce((sum, i) => sum + (i.cursos || 0), 0)
    },
    
    precursoresAuxiliares: {
      informes: informesPrecAux.length,
      horas: informesPrecAux.reduce((sum, i) => sum + (i.horas || 0), 0),
      cursos: informesPrecAux.reduce((sum, i) => sum + (i.cursos || 0), 0)
    },
    
    precursoresRegulares: {
      informes: informesPrecReg.length,
      horas: informesPrecReg.reduce((sum, i) => sum + (i.horas || 0), 0),
      cursos: informesPrecReg.reduce((sum, i) => sum + (i.cursos || 0), 0)
    }
  }

  // === LISTAS ADICIONALES ===

  // 1. Precursores auxiliares (con nombres)
  const precursoresAuxiliaresLista = informesPrecAux.map(inf => {
    const pub = publicadores.find(p => p.id === inf.publicador_id)
    return pub
  }).filter(Boolean)

  // 2. Nuevos publicadores (en_congregacion_desde = mes actual)
  const nuevosPublicadores = publicadores.filter(pub => {
    if (!pub.en_congregacion_desde) return false
    const fecha = new Date(pub.en_congregacion_desde)
    return fecha.getMonth() + 1 === mesActual.mes && fecha.getFullYear() === mesActual.ano
  })

  // 3. Publicadores mudados (fecha_mudanza = mes actual)
  const publicadoresMudados = publicadores.filter(pub => {
    if (!pub.fecha_mudanza) return false
    const fecha = new Date(pub.fecha_mudanza)
    return fecha.getMonth() + 1 === mesActual.mes && fecha.getFullYear() === mesActual.ano
  })

  // 4. NO PARTICIPARON (informaron pero no participaron)
  const noParticiparon = informes
    .filter(inf => !inf.participo)
    .map(inf => publicadores.find(p => p.id === inf.publicador_id))
    .filter(Boolean)

  // 5. Irregulares: 3 meses consecutivos sin informar
  useEffect(() => {
    calcularAlerta()
  }, [publicadores, informes, mesActual])

  const calcularAlerta = async () => {
    const alerta = []

    // Helper para retroceder N meses correctamente
    const getMesAno = (offset) => {
      let mes = mesActual.mes + offset
      let ano = mesActual.ano
      while (mes <= 0) { mes += 12; ano -= 1 }
      return { mes, ano }
    }

    const mesAno1 = getMesAno(-1)
    const mesAno2 = getMesAno(-2)

    try {
      // Solo 2 queries para todos los publicadores
      const [informesMes1, informesMes2] = await Promise.all([
        db.getInformesByMesAno(mesAno1.mes, mesAno1.ano),
        db.getInformesByMesAno(mesAno2.mes, mesAno2.ano)
      ])

      for (const pub of publicadoresDeberian) {
        const inf0 = informes.find(i => i.publicador_id === pub.id)
        const inf1 = informesMes1.find(i => i.publicador_id === pub.id)
        const inf2 = informesMes2.find(i => i.publicador_id === pub.id)

        const noParticipo0 = !inf0 || !inf0.participo
        const noParticipo1 = !inf1 || !inf1.participo
        const noParticipo2 = !inf2 || !inf2.participo

        if (noParticipo0 && noParticipo1 && noParticipo2) {
          alerta.push(pub)
        }
      }
    } catch (error) {
      console.error('Error calculando irregulares:', error)
    }

    setPublicadoresAlerta(alerta)
  }

  // === COPIAR AL PORTAPAPELES ===
  const copiarAlPortapapeles = (texto, id) => {
    navigator.clipboard.writeText(texto.toString())
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }

  // === EXPORTAR PDF ===
  const exportarPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const mesNombre = getMesNombre(mesActual.mes).toUpperCase() + ' ' + mesActual.ano
    const M = 10
    const PW = 210
    const UW = PW - M * 2

    const filled = (x, y, w, h, r, g, b) => {
      doc.setFillColor(r, g, b)
      doc.rect(x, y, w, h, 'F')
    }
    const txt = (text, x, y, size, bold, color = [30, 30, 30], align = 'left') => {
      doc.setFontSize(size)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(...color)
      doc.text(String(text), x, y, { align })
    }

    // HEADER
    filled(0, 0, PW, 20, 30, 64, 175)
    txt('INFORME S-1', PW / 2, 8.5, 13, true, [255, 255, 255], 'center')
    txt('PREDICACION Y ASISTENCIA A LAS REUNIONES', PW / 2, 13.5, 7, false, [180, 200, 255], 'center')
    txt(mesNombre, PW / 2, 18.5, 9, true, [255, 255, 255], 'center')

    let y = 25

    // ASISTENCIA
    if (asistenciaFinSemana || asistenciaEntreSemana) {
      filled(M, y, UW, 14, 241, 245, 249)
      filled(M, y, UW, 5.5, 71, 85, 105)
      txt('ASISTENCIA PROMEDIO', M + UW / 2, y + 3.8, 7, true, [255, 255, 255], 'center')
      let ax = M + 10
      const ay = y + 11
      if (asistenciaFinSemana) {
        txt('Fin de semana:', ax, ay, 8, false)
        txt(String(asistenciaFinSemana), ax + 32, ay, 8, true)
        ax += 85
      }
      if (asistenciaEntreSemana) {
        txt('Entre semana:', ax, ay, 8, false)
        txt(String(asistenciaEntreSemana), ax + 30, ay, 8, true)
      }
      y += 18
    }

    // BLOQUES STATS (3 columnas)
    const colW = (UW - 8) / 3
    const cols = [M, M + colW + 4, M + (colW + 4) * 2]
    const statsH = 34

    const drawStatBox = (x, bg, hd, title, rows) => {
      filled(x, y, colW, statsH, ...bg)
      filled(x, y, colW, 7, ...hd)
      txt(title, x + colW / 2, y + 4.8, 6.8, true, [255, 255, 255], 'center')
      let ry = y + 13
      rows.forEach(([label, value]) => {
        txt(label, x + 3, ry, 8, false)
        txt(String(value), x + colW - 3, ry, 9, true, [30, 30, 30], 'right')
        ry += 7
      })
    }

    drawStatBox(cols[0], [219, 234, 254], [30, 64, 175], 'PUBLICADORES', [
      ['Total activos',   stats.totalPublicadoresActivos],
      ['Informes',        stats.publicadores.informes],
      ['Cursos biblicos', stats.publicadores.cursos],
    ])
    drawStatBox(cols[1], [254, 249, 195], [133, 77, 14], 'PREC. AUXILIARES', [
      ['Informes', stats.precursoresAuxiliares.informes],
      ['Horas',    stats.precursoresAuxiliares.horas],
      ['Cursos',   stats.precursoresAuxiliares.cursos],
    ])
    drawStatBox(cols[2], [254, 243, 199], [120, 53, 15], 'PREC. REGULARES', [
      ['Informes', stats.precursoresRegulares.informes],
      ['Horas',    stats.precursoresRegulares.horas],
      ['Cursos',   stats.precursoresRegulares.cursos],
    ])

    y += statsH + 5

    // LISTAS (2 columnas, balanceadas por altura)
    const allLists = []
    if (precursoresAuxiliaresLista.length > 0)
      allLists.push({ title: 'PRECURSORES AUXILIARES', items: precursoresAuxiliaresLista, bg: [254,249,195], hd: [133,77,14] })
    if (nuevosPublicadores.length > 0)
      allLists.push({ title: 'NUEVOS PUBLICADORES',    items: nuevosPublicadores,          bg: [220,252,231], hd: [22,101,52] })
    if (publicadoresMudados.length > 0)
      allLists.push({ title: 'MUDADOS',                items: publicadoresMudados,          bg: [255,237,213], hd: [154,52,18] })
    if (noParticiparon.length > 0)
      allLists.push({ title: 'NO PARTICIPARON',        items: noParticiparon,              bg: [241,245,249], hd: [71,85,105] })
    if (publicadoresAlerta.length > 0)
      allLists.push({ title: 'IRREGULARES',            items: publicadoresAlerta,          bg: [254,226,226], hd: [153,27,27] })

    const lColW = (UW - 5) / 2
    const lc = [M, M + lColW + 5]
    const itemH = 4.5
    const hdH = 6.5

    const itemHeights = allLists.map(l => hdH + l.items.length * itemH + 7)
    const col1idx = [], col2idx = []
    let h1 = 0, h2 = 0
    itemHeights.forEach((h, i) => {
      if (h1 <= h2) { col1idx.push(i); h1 += h }
      else          { col2idx.push(i); h2 += h }
    })

    const drawList = (list, x, startY) => {
      const h = hdH + list.items.length * itemH + 4
      filled(x, startY, lColW, h, ...list.bg)
      filled(x, startY, lColW, hdH, ...list.hd)
      txt(`${list.title} (${list.items.length})`, x + 3, startY + 4.5, 6.5, true, [255, 255, 255])
      list.items.forEach((pub, idx) => {
        txt(`• ${pub.apellido}, ${pub.nombre}`, x + 3, startY + hdH + 4 + idx * itemH, 7.5, false)
      })
      return startY + h + 3
    }

    let y1 = y, y2 = y
    col1idx.forEach(i => { y1 = drawList(allLists[i], lc[0], y1) })
    col2idx.forEach(i => { y2 = drawList(allLists[i], lc[1], y2) })

    // FOOTER
    filled(0, 290, PW, 7, 30, 64, 175)
    txt(`Generado el ${new Date().toLocaleDateString('es-AR')}`, PW / 2, 294.5, 6, false, [200, 215, 255], 'center')

    doc.save(`S1-${mesNombre.replace(' ', '-')}.pdf`)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-600" size={32} />
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Informe S-1 - {getMesNombre(mesActual.mes)} {mesActual.ano}
              </h2>
              <p className="text-sm text-slate-700">
                PREDICACIÓN Y ASISTENCIA A LAS REUNIONES
              </p>
            </div>
          </div>
          <button
            onClick={exportarPDF}
            className="btn-primary flex items-center gap-2"
          >
            <Download size={20} />
            Exportar PDF
          </button>
        </div>
        <p className="text-sm text-blue-700">
          📋 Cifras listas para copiar a JW.org Hub • Click en cada número para copiar
        </p>
      </div>

      {/* Asistencia promedio */}
      <div className="card p-6">
        <h4 className="text-lg font-semibold text-slate-900 mb-4">Asistencia Promedio</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reuniones Fin de Semana
            </label>
            <input
              type="number"
              step="0.1"
              value={asistenciaFinSemana}
              onChange={(e) => setAsistenciaFinSemana(e.target.value)}
              placeholder="Ej: 95.5"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reuniones Entre Semana
            </label>
            <input
              type="number"
              step="0.1"
              value={asistenciaEntreSemana}
              onChange={(e) => setAsistenciaEntreSemana(e.target.value)}
              placeholder="Ej: 87.3"
              className="input"
            />
          </div>
        </div>
        <button
          onClick={guardarAsistencia}
          disabled={guardando}
          className="btn-primary mt-4"
        >
          {guardando ? 'Guardando...' : 'Guardar Asistencia'}
        </button>
      </div>

      {/* Total publicadores activos */}
      <div className="card p-6">
        <div className="text-sm text-slate-600 mb-2">Todos los publicadores activos</div>
        <div className="flex items-center gap-3">
          <div 
            onClick={() => copiarAlPortapapeles(stats.totalPublicadoresActivos, 'total')}
            className="text-5xl font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
          >
            {stats.totalPublicadoresActivos}
          </div>
          <button
            onClick={() => copiarAlPortapapeles(stats.totalPublicadoresActivos, 'total')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {copiado === 'total' ? (
              <CheckCircle className="text-green-600" size={20} />
            ) : (
              <Copy className="text-slate-400" size={20} />
            )}
          </button>
        </div>
      </div>

      {/* Publicadores */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          Publicadores
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-slate-600 mb-2">Cantidad de informes</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.publicadores.informes, 'pub-informes')}
                className="text-4xl font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
              >
                {stats.publicadores.informes}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.publicadores.informes, 'pub-informes')}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                {copiado === 'pub-informes' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-slate-400" size={18} />
                )}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-600 mb-2">Cursos bíblicos</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.publicadores.cursos, 'pub-cursos')}
                className="text-4xl font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
              >
                {stats.publicadores.cursos}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.publicadores.cursos, 'pub-cursos')}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                {copiado === 'pub-cursos' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-slate-400" size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Precursores auxiliares */}
      <div className="card p-6 bg-yellow-50 border-yellow-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Precursores auxiliares</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-yellow-700 mb-2">Cantidad de informes</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.informes, 'aux-informes')}
                className="text-4xl font-bold text-yellow-900 cursor-pointer hover:text-yellow-600 transition-colors"
              >
                {stats.precursoresAuxiliares.informes}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.informes, 'aux-informes')}
                className="p-2 hover:bg-yellow-100 rounded-lg"
              >
                {copiado === 'aux-informes' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-yellow-600" size={18} />
                )}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-yellow-700 mb-2">Horas</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.horas, 'aux-horas')}
                className="text-4xl font-bold text-yellow-900 cursor-pointer hover:text-yellow-600 transition-colors"
              >
                {stats.precursoresAuxiliares.horas}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.horas, 'aux-horas')}
                className="p-2 hover:bg-yellow-100 rounded-lg"
              >
                {copiado === 'aux-horas' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-yellow-600" size={18} />
                )}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-yellow-700 mb-2">Cursos bíblicos</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.cursos, 'aux-cursos')}
                className="text-4xl font-bold text-yellow-900 cursor-pointer hover:text-yellow-600 transition-colors"
              >
                {stats.precursoresAuxiliares.cursos}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.cursos, 'aux-cursos')}
                className="p-2 hover:bg-yellow-100 rounded-lg"
              >
                {copiado === 'aux-cursos' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-yellow-600" size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Precursores regulares */}
      <div className="card p-6 bg-amber-50 border-amber-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Precursores regulares</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-amber-700 mb-2">Cantidad de informes</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.informes, 'reg-informes')}
                className="text-4xl font-bold text-amber-900 cursor-pointer hover:text-amber-600 transition-colors"
              >
                {stats.precursoresRegulares.informes}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.informes, 'reg-informes')}
                className="p-2 hover:bg-amber-100 rounded-lg"
              >
                {copiado === 'reg-informes' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-amber-600" size={18} />
                )}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-amber-700 mb-2">Horas</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.horas, 'reg-horas')}
                className="text-4xl font-bold text-amber-900 cursor-pointer hover:text-amber-600 transition-colors"
              >
                {stats.precursoresRegulares.horas}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.horas, 'reg-horas')}
                className="p-2 hover:bg-amber-100 rounded-lg"
              >
                {copiado === 'reg-horas' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-amber-600" size={18} />
                )}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-amber-700 mb-2">Cursos bíblicos</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.cursos, 'reg-cursos')}
                className="text-4xl font-bold text-amber-900 cursor-pointer hover:text-amber-600 transition-colors"
              >
                {stats.precursoresRegulares.cursos}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.cursos, 'reg-cursos')}
                className="p-2 hover:bg-amber-100 rounded-lg"
              >
                {copiado === 'reg-cursos' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-amber-600" size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === LISTAS ADICIONALES === */}

      {/* Precursores Auxiliares del mes (con nombres) */}
      {precursoresAuxiliaresLista.length > 0 && (
        <div className="card p-6 bg-yellow-50 border-yellow-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Star className="text-yellow-600" size={20} />
            Precursores Auxiliares del Mes ({precursoresAuxiliaresLista.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {precursoresAuxiliaresLista.map(pub => (
              <div key={pub.id} className="text-sm text-slate-700">
                • {pub.apellido}, {pub.nombre}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nuevos Publicadores */}
      {nuevosPublicadores.length > 0 && (
        <div className="card p-6 bg-green-50 border-green-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="text-green-600" size={20} />
            Nuevos Publicadores ({nuevosPublicadores.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {nuevosPublicadores.map(pub => (
              <div key={pub.id} className="text-sm text-slate-700">
                • {pub.apellido}, {pub.nombre}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Publicadores Mudados */}
      {publicadoresMudados.length > 0 && (
        <div className="card p-6 bg-orange-50 border-orange-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Mudados ({publicadoresMudados.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {publicadoresMudados.map(pub => (
              <div key={pub.id} className="text-sm text-slate-700">
                • {pub.apellido}, {pub.nombre}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NO PARTICIPARON */}
      {noParticiparon.length > 0 && (
        <div className="card p-6 bg-slate-50 border-slate-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="text-slate-600" size={20} />
            No Participaron ({noParticiparon.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {noParticiparon.map(pub => (
              <div key={pub.id} className="text-sm text-slate-700">
                • {pub.apellido}, {pub.nombre}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Irregulares: 3 meses consecutivos sin informar */}
      {publicadoresAlerta.length > 0 && (
        <div className="card p-6 bg-red-50 border-red-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            Irregulares ({publicadoresAlerta.length})
          </h4>
          <p className="text-sm text-red-700 mb-3">
            3 meses consecutivos sin informar
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {publicadoresAlerta.map(pub => (
              <div key={pub.id} className="text-sm text-slate-700">
                • {pub.apellido}, {pub.nombre}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer info */}
      <div className="card p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> Click en cualquier número para copiarlo al portapapeles. 
          Luego pégalo directamente en JW.org Hub.
        </p>
      </div>
    </div>
  )
}
