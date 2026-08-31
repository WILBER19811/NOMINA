# CONTEXTO DEL PROYECTO — Libro de Nomina Colombia 2026

> Usa este archivo para retomar el proyecto desde cualquier asistente de IA
> (ChatGPT, Gemini, Claude, Copilot, etc.).
> Comparte este archivo completo al inicio de la conversacion.

---

## DESCRIPCION DEL PROYECTO

Nombre: Libro de Nomina — Colombia 2026
Tipo: Aplicacion web de gestion de nomina laboral colombiana
Estado actual: Desarrollo en curso — archivos listos, conectado a GitHub, pendiente despliegue en Google Cloud

---

## ARCHIVOS DEL PROYECTO

Ubicacion local: C:\Users\Admin\Desktop\NOMINA\

| Archivo                        | Descripcion                                                                                  |
|-------------------------------|-----------------------------------------------------------------------------------------------|
| libro-nomina-colombia.html     | Version standalone (500 lineas). Se abre directo en el navegador. Usa localStorage.          |
| nomina_colombia.jsx            | Version componente React modular (720 lineas). Usa window.storage como API de persistencia.  |
| CONTEXTO_PROYECTO.md           | Este archivo de contexto.                                                                    |

---

## STACK TECNOLOGICO

- Frontend: React 18 (con Babel standalone en el HTML, o JSX modular)
- Estilos: CSS-in-JS embebido (variables de color tipo "libro contable")
- Persistencia: localStorage (version HTML) / window.storage (version JSX)
- Control de versiones: Git + GitHub (conectado exitosamente)
- Despliegue objetivo: Google Cloud (proceso interrumpido, pendiente retomar)

---

## FUNCIONALIDADES IMPLEMENTADAS

### Parametros normativos Colombia 2026
- SMMLV: $1.750.905
- Auxilio de transporte: $249.095 (aplica a salarios <= 2 SMMLV)
- UVT: $52.374
- Divisor hora mensual: 240 (Art. 158 CST / criterio UGPP)
- Vigencia jornada 42h: 2026-07-15

### Recargos calculados
- Hora extra diurna: +25%
- Hora extra nocturna: +75%
- Recargo nocturno ordinario: +35%
- Dominical / festivo: +75%

### Seguridad Social
- Salud empleado: 4% | Salud empleador: 8.5%
- Pension empleado: 4% | Pension empleador: 12%
- ARL por clase I a V: 0.522% hasta 6.96%

### Parafiscales (con exoneracion Ley 1607)
- Caja de compensacion: 4%
- SENA: 2% (exonerado si aplica Ley 1607)
- ICBF: 3% (exonerado si aplica Ley 1607)

### Prestaciones sociales (provision mensual)
- Cesantias: 8.33%
- Intereses cesantias: 12% anual sobre saldo
- Prima de servicios: 8.33%
- Vacaciones: 4.17%

### Pestanas de la aplicacion
1. Empleados — CRUD (nombre, cedula, salario, clase riesgo ARL, fecha ingreso)
2. Registro de horas — novedades diarias (extras, recargos, ausencias)
3. Liquidar nomina — resumen mensual con detalle por empleado
4. Respaldo de datos — exportar/importar JSON
5. Guia de uso — instrucciones paso a paso

---

## ESTADO DE INTEGRACIONES

| Servicio        | Estado       | Notas                                              |
|----------------|--------------|----------------------------------------------------|
| GitHub         | CONECTADO    | Repositorio creado y vinculado exitosamente        |
| Google Cloud   | INCOMPLETO   | Proceso interrumpido antes de completar. Pendiente.|

---

## PROXIMOS PASOS PENDIENTES

### Prioridad 1 — Completar despliegue en Google Cloud

El proceso de conexion a Google Cloud se interrumpio. Opciones recomendadas:

#### Opcion A — Firebase Hosting (RECOMENDADA para este proyecto)
- Ideal para sitios web estaticos o SPAs. Gratuito en el tier Spark.
- Pasos:
  1. Ir a https://console.firebase.google.com
  2. Crear proyecto (o vincular al proyecto de Google Cloud existente)
  3. Instalar Firebase CLI: npm install -g firebase-tools
  4. Ejecutar: firebase login
  5. Ejecutar: firebase init hosting  (en la carpeta del proyecto)
  6. Ejecutar: firebase deploy

#### Opcion B — GitHub Pages (alternativa gratuita sin Google Cloud)
- Directamente desde el repositorio de GitHub, sin instalar nada.
- Pasos:
  1. En el repositorio GitHub ir a Settings > Pages
  2. Seleccionar rama main y carpeta raiz
  3. La URL quedara: https://[usuario].github.io/[repositorio]/libro-nomina-colombia.html

#### Opcion C — Google Cloud Storage (sitio estatico)
- Subir libro-nomina-colombia.html como objeto publico en un bucket.
- Habilitar "Static website hosting" en el bucket.

---

## HERRAMIENTAS EN EL ENTORNO (detectadas al 2026-08-30)

| Herramienta             | Estado                                                        |
|------------------------|---------------------------------------------------------------|
| Git                    | No detectado en PATH — probablemente usa GitHub Desktop       |
| Google Cloud SDK       | No instalado                                                  |
| Node.js / npm          | No detectado en PATH                                          |
| Firebase CLI           | No instalado                                                  |
| Sistema operativo      | Windows 11                                                    |

---

## FUNCIONALIDADES SUGERIDAS PARA PROXIMAS VERSIONES

- Retencion en la fuente completa (tabla progresiva Art. 383 ET)
- Desprendibles de pago exportables a PDF
- Liquidacion definitiva de contrato (indemnizaciones)
- Soporte para incapacidades y licencias de maternidad/paternidad
- Manejo de salario integral
- Exportacion a Excel (.xlsx)
- Multi-empresa
- Backend con base de datos para multiples usuarios
- Festivos 2026 colombianos precargados

---

## INSTRUCCIONES PARA RETOMAR CON IA

Al iniciar una nueva conversacion con cualquier asistente de IA, adjunta o pega
este archivo y di:

"Tengo un proyecto de pagina web de nomina colombiana. Te comparto el contexto
completo en el archivo CONTEXTO_PROYECTO.md. Quiero continuar con [lo que necesites]."

---

Generado automaticamente el 2026-08-30 por Antigravity (Google DeepMind)
