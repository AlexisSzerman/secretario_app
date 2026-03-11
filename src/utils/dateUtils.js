// ============================================
// UTILIDADES DE FECHA Y AÑO DE SERVICIO
// (Versión segura contra problemas de zona horaria)
// ============================================

// --------------------------------------------
// Parsear fecha en formato local (evita bug UTC)
// --------------------------------------------
export const parseLocalDate = (fecha) => {
  if (!fecha) return null

  // Si ya es Date
  if (fecha instanceof Date) return fecha

  // Si viene como YYYY-MM-DD (input type="date")
  if (typeof fecha === 'string' && fecha.includes('-')) {
    const [year, month, day] = fecha.split('-').map(Number)
    return new Date(year, month - 1, day) // 👈 LOCAL (no UTC)
  }

  // Fallback
  return new Date(fecha)
}

// --------------------------------------------
// Obtener mes vencido (mes anterior al actual)
// --------------------------------------------
export const getMesVencido = () => {
  const hoy = new Date()
  let mes = hoy.getMonth() // 0-11
  let ano = hoy.getFullYear()

  if (mes === 0) {
    mes = 12
    ano -= 1
  }

  return { mes, ano } // mes en formato 1-12
}

// --------------------------------------------
// Obtener año de servicio actual (Sept - Agosto)
// --------------------------------------------
export const getAnoServicioActual = () => {
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anoActual = hoy.getFullYear()

  const anoInicio = mesActual >= 9 ? anoActual : anoActual - 1
  const anoFin = anoInicio + 1

  return {
    inicio: { mes: 9, ano: anoInicio },
    fin: { mes: 8, ano: anoFin },
    nombre: `${anoInicio}-${anoFin}`,
    label: `Septiembre ${anoInicio} - Agosto ${anoFin}`
  }
}

// --------------------------------------------
// Obtener todos los meses de un año de servicio
// --------------------------------------------
export const getMesesAnoServicio = (anoServicio) => {
  const meses = []

  for (let i = 0; i < 12; i++) {
    let mes = 9 + i
    let ano = anoServicio.inicio.ano

    if (mes > 12) {
      mes -= 12
      ano = anoServicio.fin.ano
    }

    meses.push({ mes, ano })
  }

  return meses
}

// --------------------------------------------
// Verificar si un mes está vencido
// --------------------------------------------
export const esMesVencido = (mes, ano) => {
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anoActual = hoy.getFullYear()

  if (ano < anoActual) return true
  if (ano > anoActual) return false
  return mes < mesActual
}

// --------------------------------------------
// Obtener nombre del mes
// --------------------------------------------
export const getMesNombre = (mes) => {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  return meses[mes - 1]
}

// --------------------------------------------
// Formatear fecha (sin bug de día anterior)
// --------------------------------------------
export const formatearFecha = (fecha) => {
  const date = parseLocalDate(fecha)
  if (!date) return ''

  return date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// --------------------------------------------
// Calcular tiempo desde bautismo
// --------------------------------------------
export const calcularTiempoBautizado = (fechaBautismo) => {
  const bautismo = parseLocalDate(fechaBautismo)
  if (!bautismo) return null

  const hoy = new Date()

  let years = hoy.getFullYear() - bautismo.getFullYear()
  let months = hoy.getMonth() - bautismo.getMonth()

  if (months < 0) {
    years--
    months += 12
  }

  // Ajuste fino si el día aún no llegó este mes
  if (hoy.getDate() < bautismo.getDate()) {
    months--
    if (months < 0) {
      years--
      months += 12
    }
  }

  return { years, months }
}

// --------------------------------------------
// Calcular próximo aniversario de bautismo
// --------------------------------------------
export const calcularProximoAniversario = (fechaBautismo) => {
  const bautismo = parseLocalDate(fechaBautismo)
  if (!bautismo) return null

  const hoy = new Date()

  const proximoAniversario = new Date(
    hoy.getFullYear(),
    bautismo.getMonth(),
    bautismo.getDate()
  )

  if (proximoAniversario < hoy) {
    proximoAniversario.setFullYear(hoy.getFullYear() + 1)
  }

  const diasHasta = Math.ceil(
    (proximoAniversario - hoy) / (1000 * 60 * 60 * 24)
  )

  const tiempo = calcularTiempoBautizado(fechaBautismo)
  const anosProximos = tiempo ? tiempo.years + 1 : null

  return {
    fecha: proximoAniversario,
    dias: diasHasta,
    anos: anosProximos
  }
}