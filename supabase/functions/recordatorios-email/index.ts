// @ts-nocheck

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Email destinatario (configurar)
const EMAIL_DESTINO = 'alexszer1986@gmail.com' // ← CAMBIAR POR TU EMAIL

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

       // Obtener fecha de HOY en Argentina (UTC-3)
    const hoy = new Date()
    // Ajustar a timezone Argentina
    hoy.setHours(hoy.getHours() - 3)
    hoy.setHours(0, 0, 0, 0)
    const hoyStr = hoy.toISOString().split('T')[0]

    console.log(`Buscando recordatorios vencidos hasta ${hoyStr}`)

    // Buscar recordatorios vencidos, NO completados y no notificados
    const { data: recordatorios, error } = await supabase
      .from('recordatorios')
      .select('*')
      .lte('fecha_fin', hoyStr)
      .eq('completada', false)  // ← NUEVO: Solo NO completados
      .eq('email_enviado', false)

    if (error) {
      console.error('Error buscando recordatorios:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`Encontrados ${recordatorios?.length || 0} recordatorios vencidos`)

    if (!recordatorios || recordatorios.length === 0) {
      return new Response(JSON.stringify({ 
        mensaje: 'No hay recordatorios vencidos',
        total: 0 
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let enviados = 0
    let errores = 0

    for (const rec of recordatorios) {
      try {
        const fechaFormateada = new Date(rec.fecha_fin).toLocaleDateString('es-AR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Secretario App <noreply@resend.dev>',
            to: EMAIL_DESTINO,
            subject: `⏰ Recordatorio: ${rec.titulo}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e293b;">📋 Recordatorio Por Vencer</h2>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #0f172a;">${rec.titulo}</h3>
                  <p style="color: #64748b; margin: 10px 0;">
                    <strong>Fecha:</strong> ${fechaFormateada}
                  </p>
                  ${rec.descripcion ? `<p style="color: #475569; margin: 10px 0;">${rec.descripcion}</p>` : ''}
                </div>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">
                  Este recordatorio fue configurado en la app Secretario.
                </p>
              </div>
            `
          })
        })

        if (!emailResponse.ok) {
          throw new Error(`Error enviando email: ${emailResponse.statusText}`)
        }

        await supabase
          .from('recordatorios')
          .update({ 
            email_enviado: true,
            fecha_envio_email: new Date().toISOString()
          })
          .eq('id', rec.id)

        console.log(`✅ Email enviado para: ${rec.titulo}`)
        enviados++

      } catch (emailError) {
        console.error(`❌ Error enviando email para "${rec.titulo}":`, emailError)
        errores++
      }
    }

    return new Response(JSON.stringify({ 
      mensaje: 'Proceso completado',
      total: recordatorios.length,
      enviados,
      errores
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error general:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})