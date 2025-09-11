# Endpoints Necesarios en Backend

## 🚀 PRIORIDAD ALTA - Implementar Ya

### Categories

#### 1. `GET /categories/hierarchy`
**Uso**: Se usa en `CategoriesList` para mostrar vista jerárquica
**Función**: Devuelve categorías con subcategorías anidadas
**Request**: `GET /categories/hierarchy`
**Response**: 
```typescript
Category[] // Array con subcategorías incluidas
```
**Por qué es necesario**: El frontend tiene vista de jerarquía activa y falla sin este endpoint.

#### 2. `POST /categories/bulk`
**Uso**: Se usa en `CategoriesList` para operaciones bulk (desactivar/activar/eliminar múltiples)
**Función**: Permite operaciones masivas sobre categorías
**Request**: 
```typescript
{
  operation: 'delete' | 'activate' | 'deactivate';
  categoryIds: string[];
}
```
**Response**: 
```typescript
{
  success: number;
  failed: number;
  errors?: Array<{ categoryId: string, error: string }>;
}
```
**Por qué es necesario**: La UI tiene selección múltiple y botones bulk que fallan.

### Goals

#### 3. `PATCH /goals/{id}/archive` / `PATCH /goals/{id}/unarchive`
**Uso**: Se usa en mutations `useArchiveGoal` y `useUnarchiveGoal` 
**Función**: Gestión del ciclo de vida de goals
**Request**: `PATCH /goals/{goalId}/archive`
**Response**: 
```typescript
GoalResponseDto // Goal actualizado con status archivado
```
**Por qué es necesario**: La UI tiene botones de archivar que están rotos.

#### 4. `PATCH /goals/{id}/complete`
**Uso**: Se usa en `useCompleteGoal` mutation
**Función**: Marca goal como completado, dispara celebraciones
**Request**: `PATCH /goals/{goalId}/complete`
**Response**: 
```typescript
GoalResponseDto // Goal con status completed y fecha de completado
```
**Por qué es necesario**: Sin esto no se pueden marcar goals como completados.

## ⚡ PRIORIDAD MEDIA - Implementar Pronto

### Categories

#### 5. `GET /categories/analytics`
**Uso**: Podría usarse en reportes y estadísticas
**Función**: Analytics de uso de categorías
**Request**: 
```typescript
GET /categories/analytics?categoryId=xxx&startDate=2024-01-01&endDate=2024-12-31
```
**Response**: 
```typescript
{
  categoryId: string;
  usageCount: number;
  totalAmount: number;
  monthlyTrend: Array<{ month: string, count: number, amount: number }>;
}[]
```
**Por qué lo necesitamos**: Para insights y mejorar la categorización automática.

### Goals

#### 6. `GET /goals/{id}/analytics`
**Uso**: Se usa en `useGoalAnalytics` para mostrar progreso detallado
**Función**: Analytics detallados del goal
**Request**: `GET /goals/{goalId}/analytics?period=month`
**Response**: 
```typescript
{
  progressTrend: Array<{ date: string, amount: number, percentage: number }>;
  averageProgress: number;
  projectedCompletion: string;
  milestoneProgress: number;
}
```
**Por qué lo necesitamos**: Para mostrar gráficos y análisis de progreso.

#### 7. `PATCH /goals/{id}/pause` / `PATCH /goals/{id}/resume`
**Uso**: Se usa en `usePauseGoal` y `useResumeGoal`
**Función**: Pausar/reanudar goals temporalmente
**Request**: `PATCH /goals/{goalId}/pause`
**Response**: 
```typescript
GoalResponseDto // Goal con status paused
```
**Por qué lo necesitamos**: Control granular del estado de goals.

## 🔧 PRIORIDAD BAJA - Implementar Después

### Categories

#### 8. `PUT /categories/reorder`
**Uso**: Para reordenar categorías drag & drop (no implementado en UI aún)
**Función**: Cambiar orden de categorías
**Request**: 
```typescript
{
  categoryOrders: Array<{ id: string, sortOrder: number }>;
}
```
**Por qué es baja prioridad**: La UI no tiene drag & drop implementado.

#### 9. `GET /category-templates`
**Uso**: Para templates predefinidos de categorías
**Función**: Obtener plantillas de categorías por industria/tipo
**Por qué es baja prioridad**: Feature avanzada, no crítica.

#### 10. `GET/POST /categories/export|import`
**Uso**: Para backup/restore de categorías
**Función**: Importar/exportar configuración de categorías
**Por qué es baja prioridad**: Feature administrativa avanzada.

### Goals

#### 11. `GET /goals/categories`
**Uso**: Para dropdown de categorías de goals
**Función**: Lista de categorías disponibles para goals
**Por qué es baja prioridad**: Puede usar endpoint de categories normal.

#### 12. Milestone endpoints
**Uso**: Para gestión detallada de milestones
**Función**: CRUD de milestones individuales
**Por qué es baja prioridad**: Los milestones se pueden editar a través del goal principal.

## ❌ NO IMPLEMENTAR

### Categories
- `GET /category-rules` - Sistema complejo de reglas automáticas, no usado en UI actual
- `POST /category-rules/test` - Idem anterior

### Goals  
- `GET /goals/{id}/progress-history` - Se puede calcular del goal principal
- `GET /goals/type/{type}` - Ya se puede filtrar en GET /goals
- `GET /goals/status/{status}` - Ya se puede filtrar en GET /goals

## 📋 Resumen de Implementación

**Total necesario**: 7 endpoints críticos
**Tiempo estimado**: 2-3 días de desarrollo

**Orden recomendado**:
1. `GET /categories/hierarchy` - Arregla vista jerárquica
2. `POST /categories/bulk` - Arregla operaciones masivas  
3. `PATCH /goals/{id}/archive` - Gestión lifecycle goals
4. `PATCH /goals/{id}/complete` - Completar goals
5. `PATCH /goals/{id}/unarchive` - Desarchivar goals
6. `GET /categories/analytics` - Analytics categorías
7. `GET /goals/{id}/analytics` - Analytics goals

**Endpoints que NO valen la pena**: 8 endpoints eliminados por ser redundantes o complejos innecesariamente.