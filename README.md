# 🚀 Secretario Congregacional - Guía de Instalación

Sistema profesional de gestión para secretarios congregacionales con base de datos en la nube.

## 📋 PASO 1: Configurar Supabase (5 min)

### 1.1 Crear cuenta y proyecto
1. Ve a https://supabase.com
2. Sign up con tu cuenta de Google/GitHub
3. Click en "New Project"
4. Completa:
   - **Name**: `secretario-congregacional`
   - **Database Password**: (guárdala en un lugar seguro)
   - **Region**: South America (São Paulo)
   - **Pricing Plan**: Free
5. Click "Create new project"
6. Espera 2 minutos mientras se crea

### 1.2 Crear las tablas
1. En el menú izquierdo → **SQL Editor**
2. Click en **"New query"**
3. Copia y pega el contenido del archivo `supabase-schema.sql`
4. Click **"Run"**
5. ✅ Deberías ver: "Success. No rows returned"

### 1.3 Obtener las credenciales
1. En el menú izquierdo → **Settings** → **API**
2. Copia estos dos valores:
   - **Project URL** (algo como: `https://tu-proyecto.supabase.co`)
   - **anon public key** (un token largo)
3. Guárdalos, los necesitarás en el siguiente paso

---

## 💻 PASO 2: Instalar y Configurar el Proyecto (5 min)

### 2.1 Verificar Node.js
Abre una terminal y ejecuta:
```bash
node --version
```

Si NO tienes Node.js:
- **Windows/Mac**: Descarga de https://nodejs.org (versión LTS)
- **Linux**: `sudo apt install nodejs npm`

### 2.2 Instalar dependencias
Navega a la carpeta del proyecto:
```bash
cd secretario-app
npm install
```

### 2.3 Configurar variables de entorno
1. Copia el archivo de ejemplo:
```bash
cp .env.example .env.local
```

2. Abre `.env.local` y pega tus credenciales:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

---

## 🎨 PASO 3: Iniciar la Aplicación (1 min)

```bash
npm run dev
```

La app se abrirá automáticamente en `http://localhost:3000`

✅ **¡Listo!** Ya tienes tu webapp funcionando localmente.

---

## 📱 PASO 4: Deploy a Vercel (Opcional - 3 min)

Para acceder desde cualquier dispositivo:

### 4.1 Crear cuenta en Vercel
1. Ve a https://vercel.com
2. Sign up con GitHub
3. Autoriza Vercel

### 4.2 Deploy
```bash
npm run build
npx vercel --prod
```

Sigue las instrucciones en pantalla:
- Set up and deploy? **Y**
- Which scope? (tu cuenta)
- Link to existing project? **N**
- Project name? **secretario-congregacional**
- Directory? **./** (presiona Enter)
- Override settings? **N**

**¡Listo!** Te dará una URL como: `https://secretario-congregacional.vercel.app`

### 4.3 Configurar variables en Vercel
1. Ve a tu proyecto en Vercel dashboard
2. Settings → Environment Variables
3. Agrega:
   - `VITE_SUPABASE_URL` → tu URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` → tu anon key
4. Redeploy (Deployments → ... → Redeploy)

---

## 📊 PASO 5: Importar tus Datos Existentes (Opcional)

Si tienes datos en IndexedDB que quieres migrar, crea este script en tu navegador:

```javascript
// En la consola del navegador con tu HTML viejo abierto:
async function exportarDatos() {
  const db = await indexedDB.open('SecretarioDB', 1);
  // ... (te puedo dar el script completo si lo necesitas)
}
```

O simplemente importa tu Excel maestro desde la interfaz nueva.

---

## 🎯 Funcionalidades Actuales

✅ Gestión de publicadores
✅ Dashboard con estadísticas
✅ Módulo de informes mensuales
✅ Sistema de mes vencido (Sept-Agosto)
✅ Base de datos sincronizada en la nube
✅ Acceso desde cualquier dispositivo
✅ Responsive (funciona en móvil)

## 📝 Próximos Pasos

- [ ] Importación desde Excel
- [ ] Captura de informes inline
- [ ] Vista de año de servicio
- [ ] Análisis de precursores
- [ ] Exportación para sucursal
- [ ] PWA (instalable en teléfono)

---

## 🆘 Problemas Comunes

**Error: "Missing environment variables"**
- Verifica que `.env.local` existe y tiene las credenciales correctas

**Error al conectar a Supabase**
- Verifica que copiaste bien la URL y la anon key
- Asegúrate de haber ejecutado el SQL en Supabase

**Página en blanco**
- Abre la consola del navegador (F12) y revisa errores
- Verifica que `npm run dev` no tenga errores

---

## 📞 Soporte

Si algo no funciona:
1. Revisa la consola del navegador (F12)
2. Verifica que Supabase esté online
3. Confirma que las credenciales estén bien configuradas

---

¡Éxito! 🎉
