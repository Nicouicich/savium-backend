Quiero que construyas un **backend NestJS monolítico** completo y robusto, listo para producción, para una aplicación de **finanzas personales, familiares, en pareja y empresariales**.  
La descripción funcional completa está en este documento (revísalo y úsalo como guía de funcionalidades, entidades y casos de uso): [LINK_NOTION].

### Requerimientos técnicos

- **Framework:** NestJS, en arquitectura modular (no microservicios).
- **Base de datos:** MongoDB con **Mongoose** como ODM.
- **Cache:** Redis, para:
  - Manejo de sesiones.
  - Rate limiting.
  - Cacheo de queries pesadas (ej. reportes).
  - Validación rápida de tokens.
- **Autenticación:** JWT (access + refresh tokens), con posibilidad de invalidar tokens al cerrar sesión.
- **Seguridad:**
  - Helmet.
  - CORS configurado.
  - Rate limiting con Redis.
  - Guards y roles por tipo de cuenta (personal, pareja, familiar, empresa).
- **DTOs:** usar `class-validator` y `class-transformer`.
- **Documentación:** Swagger documentando **cada endpoint y DTO directamente en los controladores y clases**.
- **Interceptors y middleware:**
  - Logging global.
  - Transformación de respuestas.
  - Manejo centralizado de errores.
  - Rate limiting con Redis.
- **Tests:** configurar unit tests y e2e.
- **Configuración:** módulo `ConfigModule` con variables de entorno (.env).
- **Carpeta docs/**: que Swagger pueda exportar la especificación.

### Módulos principales

1. **Auth**
   - Registro, login, logout.
   - Refresh tokens.
   - Gestión de sesiones.
   - Roles y permisos.

2. **Users**
   - CRUD de usuarios.
   - Gestión de perfiles (datos personales, preferencias).
   - Relación con cuentas (personal, pareja, familiar, empresa).

3. **Accounts**
   - Crear y administrar cuentas de tipo: personal, pareja, familiar, empresa.
   - Invitar miembros, aceptar/rechazar invitaciones.
   - Configuración de privacidad y permisos.

4. **Transactions**
   - Registrar gasto manual (texto, imagen).
   - Registrar gasto desde WhatsApp/Telegram.
   - Procesar ticket con IA (API GPT): extracción de monto, fecha, categoría.
   - CRUD de gastos.

5. **Reports**
   - Reportes mensuales, visuales y exportables.
   - Resúmenes por categoría, ingresos vs egresos.
   - Reportes diferenciados por roles (familiares/empresariales).

6. **Budgets & Goals**
   - CRUD de presupuestos.
   - Metas conjuntas (modo pareja/familiar).
   - Predicciones y simulaciones.

7. **Integrations**
   - Conexión a WhatsApp.
   - Conexión a Telegram.
   - Conexión a API GPT para IA de categorización y procesamiento.

8. **Common**
   - Pipes globales.
   - Filtros de excepciones.
   - Utilidades y helpers compartidos.

---

### Endpoints sugeridos (por módulo)

#### 1. Auth

- `POST /auth/register` – Crear usuario.
- `POST /auth/login` – Iniciar sesión.
- `POST /auth/logout` – Cerrar sesión.
- `POST /auth/refresh` – Obtener nuevo token.
- `GET /auth/me` – Perfil autenticado.

#### 2. Users

- `GET /users` – Listar usuarios (admin).
- `GET /users/:id` – Ver usuario.
- `PATCH /users/:id` – Actualizar usuario.
- `DELETE /users/:id` – Eliminar usuario.

#### 3. Accounts

- `POST /accounts` – Crear cuenta.
- `GET /accounts` – Listar cuentas.
- `GET /accounts/:id` – Detalle cuenta.
- `PATCH /accounts/:id` – Actualizar cuenta.
- `DELETE /accounts/:id` – Eliminar cuenta.
- `POST /accounts/:id/invite` – Invitar usuario.
- `POST /accounts/:id/accept` – Aceptar invitación.
- `POST /accounts/:id/reject` – Rechazar invitación.

#### 4. Transactions

- `POST /transactions` – Crear gasto.
- `POST /transactions/upload` – Subir ticket para IA.
- `POST /transactions/whatsapp` – Gasto vía WhatsApp.
- `POST /transactions/telegram` – Gasto vía Telegram.
- `GET /transactions` – Listar gastos.
- `GET /transactions/:id` – Ver gasto.
- `PATCH /transactions/:id` – Actualizar gasto.
- `DELETE /transactions/:id` – Eliminar gasto.

#### 5. Reports

- `GET /reports/monthly` – Reporte mensual.
- `GET /reports/category` – Reporte por categoría.
- `GET /reports/summary` – Resumen general.
- `GET /reports/export` – Exportar reporte.
- `GET /reports/:accountId` – Reporte por cuenta.

#### 6. Budgets & Goals

- `POST /budgets` – Crear presupuesto.
- `GET /budgets` – Listar presupuestos.
- `GET /budgets/:id` – Ver presupuesto.
- `PATCH /budgets/:id` – Actualizar presupuesto.
- `DELETE /budgets/:id` – Eliminar presupuesto.
- `POST /goals` – Crear meta.
- `GET /goals` – Listar metas.
- `PATCH /goals/:id` – Actualizar meta.
- `DELETE /goals/:id` – Eliminar meta.

#### 7. Integrations

- `POST /integrations/telegram/webhook` – Webhook Telegram.
- `POST /integrations/whatsapp/webhook` – Webhook WhatsApp.
- `POST /integrations/ai/process` – Procesar ticket con IA.
- `POST /integrations/ai/categorize` – Categorizar gasto IA.

#### 8. Common / Health

- `GET /health` – Estado de la app.
- `GET /cache/clear` – Limpiar cache (admin).

---

### Reglas de implementación

- Toda clase debe tener su DTO validado con `class-validator`.
- Todos los endpoints deben estar **documentados con Swagger**.
- Usar guards e interceptors donde corresponda.
- Redis debe estar integrado en los módulos de:
  - Autenticación (tokens, sesiones).
  - Rate limiting.
  - Reportes (cache).
- Implementar pruebas básicas unitarias y e2e por módulo.
- Código limpio, desacoplado y escalable.

### Objetivo

Quiero que me entregues el **backend completo de la aplicación**, con:

- Estructura del proyecto.
- Configuración inicial lista.
- Módulos creados.
- Endpoints, DTOs, servicios y controladores implementados.
- Swagger documentando todo.
- Interceptores, guards y middlewares configurados.
- Integraciones externas listas para usarse.

Debe ser un **backend excelente, robusto, seguro y escalable**.
