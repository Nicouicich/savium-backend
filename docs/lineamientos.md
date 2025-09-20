# 📘 Lineamientos de desarrollo – Backend NestJS

Este documento define las reglas y buenas prácticas que deben seguirse al desarrollar la aplicación backend en **NestJS**.  
El objetivo es garantizar un código **robusto, limpio, escalable, seguro y mantenible**.

---

## 🎯 Principios generales

- Seguir los principios **SOLID** en todo el diseño.
- Aplicar **Clean Architecture**: separar responsabilidades y mantener las capas desacopladas.
- Favorecer la **legibilidad sobre la “magia”**: código claro, explícito y fácil de mantener.
- **Convención > Configuración**: seguir los estándares de NestJS siempre que sea posible.
- Todo lo que no sea trivial debe estar **testeado** (unit tests y e2e).

---

## 🏗️ Organización del código

- Cada **módulo** de NestJS debe contener:
  - `*.controller.ts` → maneja las rutas y requests.
  - `*.service.ts` → maneja la lógica de negocio.
  - `*.repository.ts` (si aplica) → centraliza queries a la DB.
  - `dto/` → definir DTOs con `class-validator`.
  - `schemas/` → definir modelos de Mongoose.
- Nunca mezclar lógica de negocio con acceso a datos.
- Evitar controladores “gordos”: la mayor parte de la lógica debe ir a los servicios.
- Crear un **módulo común (`common/`)** con pipes, interceptores, guards, decoradores y filtros reutilizables.
- Todas las **integraciones externas** (WhatsApp, Telegram, GPT, etc.) deben ser **módulos independientes con su servicio**.
- **ConfigModule + ConfigService** deben usarse siempre para leer variables de entorno (no usar `dotenv` directo).

---

## 🛡️ Seguridad y buenas prácticas

- Siempre usar **DTOs con validación estricta** en la entrada de datos.
- Sanitizar inputs para evitar **inyecciones de código** (Mongo injection, XSS, etc.).
- Nunca exponer datos sensibles en respuestas.
- Usar **interceptores** para:
  - Logging.
  - Transformación de respuestas.
  - **Manejo centralizado de errores** (para no tener que usar `try/catch` en todos los controladores).
- Usar **guards** para roles/permisos.
- Manejo centralizado de errores con **filtros globales**.
- Configurar siempre **rate limiting** y **Helmet**.

---

## 📚 Documentación

- Todos los endpoints deben estar documentados con **Swagger**.
- Todos los DTOs deben tener descripciones de cada campo.
- El repositorio debe tener un `README.md` explicando cómo correr el proyecto.
- Los lineamientos de este archivo deben ser respetados y actualizados en `docs/LINEAMIENTOS.md`.

---

## 🧪 Testing

- Usar **Jest** para unit tests y e2e.
- Cobertura mínima: **80% líneas**.
- Tests unitarios para cada servicio.
- Tests e2e para endpoints críticos (auth, transactions, reports).
- Los tests deben correr en CI/CD (pipeline).

---

## 🗄️ Base de datos

- Usar **Mongoose** con esquemas tipados.
- Definir siempre **interfaces o clases** que representen entidades.
- Queries encapsuladas en **repositories** o servicios específicos de persistencia.
- Nunca hacer `Model.find()` directamente en controladores ni en servicios de negocio.
- Usar índices en MongoDB para campos consultados frecuentemente.

---

## ⚡ Performance

- Usar **Redis** para cachear consultas pesadas (ej: reportes).
- Evitar N+1 queries, usar agregaciones en Mongo cuando sea más eficiente.
- Usar paginación en endpoints que devuelvan listas grandes.
- Usar `async/await` correctamente y manejar errores con interceptores globales.

---

## 📦 Dependencias

- Mantener dependencias actualizadas.
- No incluir librerías innecesarias.
- Verificar vulnerabilidades con `npm audit`.
- **Nunca usar dotenv directamente.** Usar `@nestjs/config` + `ConfigService`.

---

## 🧑‍💻 Estilo de código

- Usar **TypeScript estricto** (`strict: true` en tsconfig).
- Nombrar archivos y clases de forma clara:
  - `*.controller.ts`
  - `*.service.ts`
  - `*.repository.ts`
- Respetar el **estilo de commits** (ej: Conventional Commits).
- Usar **ESLint + Prettier** con reglas consistentes en todo el proyecto.
- Revisiones obligatorias en PR (mínimo 1 reviewer).

---

## 🚦 Flujo de desarrollo

1. Crear una rama feature: `feature/nombre-funcionalidad`.
2. Desarrollar la feature siguiendo estos lineamientos.
3. Escribir tests unitarios/e2e.
4. Abrir PR hacia `develop`.
5. Revisar, aprobar y mergear solo si pasan todos los tests y linting.
6. `develop` se mergea en `main` solo en releases.

---

## 🔑 Otros lineamientos

- Usar **interceptores globales de logging y error handling**.
- Configurar un **error handler global** para devolver respuestas consistentes.
- Si se usa **IA externa (GPT)**, encapsular siempre la integración en un **módulo y servicio dedicado** (`integrations/ai/ai.service.ts`).
- Si se usa **mensajería (WhatsApp, Telegram)**, los webhooks deben estar desacoplados y delegar la lógica a sus servicios.
- Siempre manejar **timeouts/reintentos** en integraciones externas.
- Documentar **diagramas de arquitectura y flujo de datos** en `/docs`.

---

👉 Este archivo debe formar parte del repo como `docs/LINEAMIENTOS.md`.  
Es la **biblia de desarrollo** para este backend.
