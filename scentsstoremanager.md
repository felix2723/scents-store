

![][image1]

**SCENTS STORE MANAGER**

*Sistema ERP Interno de Gestión de Perfumería*

**Documento de Especificación de Requisitos de Software**

Versión 1.0  |  Febrero 2026

Preparado para: Antigravity

| Versión | 1.0 — Draft Inicial |
| :---- | :---- |
| Fecha | Febrero 2026 |
| Estado | Listo para desarrollo |
| Propietario del producto | Cliente (Scents Perfumeria) |
| Desarrollado por | Antigravity |
| Moneda | COP (Pesos Colombianos) |
| Plataforma | Web App (Desktop-first, responsive) |

# **1\. Introducción y Propósito**

## **1.1 Propósito del Documento**

Este documento constituye la Especificación de Requisitos de Software (SRS) para Scents Store Manager, una aplicación web interna de gestión de inventario y ventas diseñada exclusivamente para el uso privado de Scents Perfumería en Colombia.

El objetivo de este SRS es proporcionar a Antigravity una descripción completa, sin ambiguüedades y lista para implementación de todos los requisitos funcionales, no funcionales, técnicos y de experiencia de usuario que debe cumplir el sistema.

## **1.2 Alcance del Producto**

Scents Store Manager es un ERP minimalista de uso interno (no es una tienda pública) que permite:

* Registrar y controlar el inventario de perfumes por lotes de compra.

* Registrar ventas con múltiples items por transacción.

* Calcular automáticamente la rentabilidad por producto usando Costo Promedio Ponderado (CPP).

* Visualizar reportes y métricas accionables del negocio en tiempo real.

El sistema NO incluye: tienda pública para clientes, pasarela de pagos, facturación electrónica DIAN, ni módulo de envíos.

## **1.3 Definiciones y Acrónimos**

| Término / Acrónimo | Definición |
| :---- | :---- |
| CPP | Costo Promedio Ponderado — método contable para valorar inventario |
| COP | Peso Colombiano — moneda de operación del sistema |
| ERP | Enterprise Resource Planning — sistema integrado de gestión empresarial |
| MVP | Minimum Viable Product — versión mínima funcional del producto |
| SRS | Software Requirements Specification — este documento |
| Owner | Rol de usuario con acceso total al sistema (el dueño del negocio) |
| Staff | Rol de usuario con acceso restringido (vendedor) |
| Lote/Batch | Ingreso de inventario en una fecha con costo y precio específicos |
| SKU | Stock Keeping Unit — código único opcional por producto |
| Supabase | Plataforma BaaS con base de datos PostgreSQL y autenticación |

## **1.4 Visión General del Documento**

Este documento está organizado en las siguientes secciones: descripción general del sistema, roles y seguridad, requisitos funcionales por módulo, modelo de datos, reglas de negocio y cálculos, requisitos no funcionales, arquitectura técnica, entregables esperados y checklist de aceptación.

# **2\. Descripción General del Sistema**

## **2.1 Perspectiva del Producto**

Scents Store Manager es una aplicación web standalone accesible exclusivamente por usuarios autenticados. No se integra con sistemas externos de terceros en esta versión MVP. Opera de forma independiente con su propia base de datos y capa de autenticación provista por Supabase.

## **2.2 Funcionalidades Principales (Resumen)**

| \# | Módulo | Descripción |
| :---- | :---- | :---- |
| 1 | Autenticación | Login seguro con email/contraseña. Sin registro público. |
| 2 | Productos | CRUD completo de catálogo de perfumes con búsqueda y filtros. |
| 3 | Inventario | Registro de ingresos por lote con costo y precio de venta. |
| 4 | Ventas | Registro de ventas multi-item con validación de stock. |
| 5 | Dashboard | Métricas clave del negocio con indicadores visuales. |
| 6 | Reportes | Análisis de rentabilidad, top/bottom vendidos, utilidad promedio. |
| 7 | Configuración | Ajustes de cuenta y parámetros del sistema (rol owner). |

## **2.3 Restricciones Generales**

* La aplicación es de uso interno exclusivamente — no tiene páginas públicas ni acceso sin autenticación.

* No se permite el registro de nuevos usuarios desde la app. Los usuarios son creados manualmente por el administrador.

* Toda la información financiera (costos, utilidades, márgenes) es visible únicamente para el rol owner.

* El sistema opera únicamente con la moneda COP. No hay conversión de divisas en el MVP.

* El logo oficial del negocio (Scents Perfumería) debe ubicarse en /public/brand/logo.png del proyecto.

# **3\. Roles, Usuarios y Seguridad**

## **3.1 Roles del Sistema**

El sistema define dos roles de usuario. Para el MVP se implementa completamente el rol owner. El rol staff se estructura en el código para activación futura sin necesidad de refactorizar.

| Rol | Nombre | Descripción |
| :---- | :---- | :---- |
| owner | Propietario | Acceso total al sistema. Ve costos, utilidades, reportes financieros. Puede gestionar productos, inventario, ventas y configuración. |
| staff | Vendedor | Acceso restringido. Puede registrar ventas pero NO ve costUnitCOP ni reportes de rentabilidad. (Implementación futura — código preparado en MVP) |

## **3.2 Permisos por Módulo**

| Módulo / Acción | Owner | Staff | Notas |
| :---- | :---- | :---- | :---- |
| Login / Autenticación | Sí | Sí |  |
| Ver Dashboard general | Sí | Limitado | Staff no ve métricas de costo/utilidad |
| CRUD Productos | Sí | No | Solo owner puede crear/editar/eliminar productos |
| Registrar Inventario (lotes) | Sí | No | Solo owner ve y registra costos de compra |
| Ver stock actual | Sí | Sí | Staff puede ver si hay stock disponible |
| Registrar Ventas | Sí | Sí | Ambos roles pueden crear ventas |
| Ver historial de ventas | Sí | Solo las propias | Staff solo ve las ventas que registró |
| Ver Reportes de rentabilidad | Sí | No | Información financiera exclusiva de owner |
| Ver costos de productos | Sí | No | costUnitCOP oculto para staff |
| Configuración del sistema | Sí | No | Solo owner accede a settings |

## **3.3 Seguridad de Autenticación**

* El sistema usa Supabase Auth con email/contraseña. No existe página de registro público.

* Todas las rutas /app/\* están protegidas por middleware de Next.js que redirige a /login si no hay sesión activa.

* Las políticas Row Level Security (RLS) de Supabase impiden cualquier lectura o escritura de datos sin sesión autenticada.

* Las columnas costUnitCOP y los campos de utilidad están protegidos a nivel de RLS: solo usuarios con role='owner' pueden leerlas.

* Los tokens de sesión se manejan exclusivamente en el lado del servidor (SSR) para evitar exposición en el cliente.

## **3.4 Creación del Usuario Owner (Bootstrap)**

1. Crear el usuario en Supabase Auth (panel de administración) con email y contraseña.

2. Ejecutar el script /scripts/seed.ts que crea el registro en la tabla users con role='owner'.

3. Verificar acceso iniciando sesión en /login con las credenciales del owner.

4. Mantener desactivado 'Allow new users to sign up' en Supabase Auth.

# **4\. Arquitectura Técnica**

## **4.1 Stack Tecnológico**

| Capa | Tecnología | Justificación |
| :---- | :---- | :---- |
| Framework | Next.js 14+ (App Router) | SSR, rutas protegidas, API Routes integradas, excelente rendimiento |
| Lenguaje | TypeScript (strict mode) | Tipado estricto para mayor confiabilidad y mantenibilidad |
| Estilos | Tailwind CSS | Utilidades CSS rápidas, consistencia visual, fácil mantenimiento |
| Base de datos | Supabase (PostgreSQL) | Base de datos relacional robusta, RLS nativo, escala fácilmente |
| Autenticación | Supabase Auth | Integrado con la BD, manejo de sesiones SSR, OAuth listo para el futuro |
| Validación | Zod | Validación de esquemas en cliente y servidor con TypeScript nativo |
| Iconos | Lucide React | Librería ligera, consistente y profesional |
| Hosting App | Vercel | Deploy automático desde Git, edge network, integración con Next.js |
| Hosting BD/Auth | Supabase Cloud | Free tier suficiente para MVP, escalable |

## **4.2 Estructura de Archivos del Proyecto**

| Ruta | Descripción |
| :---- | :---- |
| /src/app/(auth)/login | Página de inicio de sesión (ruta pública) |
| /src/app/(dashboard)/layout.tsx | Layout protegido con validación de sesión |
| /src/app/(dashboard)/dashboard | Página principal con métricas y KPIs |
| /src/app/(dashboard)/products | Gestión del catálogo de productos (CRUD) |
| /src/app/(dashboard)/inventory | Registro de ingresos de inventario por lote |
| /src/app/(dashboard)/sales | Registro y listado de ventas |
| /src/app/(dashboard)/reports | Reportes de rentabilidad y analítica |
| /src/app/(dashboard)/settings | Configuración del sistema (solo owner) |
| /src/lib/supabase.ts | Cliente Supabase (browser y server) |
| /src/lib/auth-context.tsx | Contexto de autenticación y rol del usuario |
| /src/lib/services/products.ts | Lógica de negocio para productos |
| /src/lib/services/inventory.ts | Lógica de negocio para lotes de inventario |
| /src/lib/services/sales.ts | Lógica de negocio para ventas y CPP |
| /src/lib/services/reports.ts | Cálculos de analítica y reportes |
| /src/components/ui/ | Componentes reutilizables (Button, Input, Card, etc.) |
| /src/components/features/ | Componentes específicos de cada módulo |
| /src/types/index.ts | Interfaces TypeScript: Product, Batch, Sale, User |
| /src/hooks/ | Custom hooks para fetching y estado |
| /src/middleware.ts | Protección de rutas /app/\* sin sesión activa |
| /scripts/seed.ts | Script para insertar datos de prueba iniciales |
| /public/brand/logo.png | LOGO DE SCENTS PERFUMERÍA (provisto por el cliente — ver sección 8.2) |
| /.env.local | Variables de entorno (no incluido en repositorio) |
| /supabase/migrations/ | Migraciones SQL de la base de datos |

## **4.3 Rutas de la Aplicación**

| Ruta | Acceso | Descripción |
| :---- | :---- | :---- |
| /login | Público | Formulario de inicio de sesión. Redirige a /dashboard si ya hay sesión. |
| /dashboard | Autenticado | Vista principal con KPIs, gráficas de tendencia y alertas de stock. |
| /products | Owner | Listado, búsqueda, creación y edición de productos del catálogo. |
| /inventory | Owner | Registro de lotes de compra con costo y precio de venta. |
| /sales | Ambos roles | Registro de ventas y consulta de historial. |
| /reports | Owner | Análisis de rentabilidad, top/bottom vendidos, utilidad promedio. |
| /settings | Owner | Configuración de cuenta y parámetros del sistema. |

# **5\. Modelo de Datos (Supabase / PostgreSQL)**

## **5.1 Tabla: users**

| Columna | Tipo | Restricción | Descripción |
| :---- | :---- | :---- | :---- |
| id | UUID | PK, FK → auth.users | UID del usuario en Supabase Auth |
| role | TEXT | NOT NULL, CHECK | Valores: 'owner' | 'staff' |
| display\_name | TEXT | NULLABLE | Nombre para mostrar en la interfaz |
| created\_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Fecha de creación del registro |

## **5.2 Tabla: products**

| Columna | Tipo | Restricción | Descripción |
| :---- | :---- | :---- | :---- |
| id | UUID | PK | Identificador único del producto |
| name | TEXT | NOT NULL | Nombre del perfume. Ej: 'Dior Sauvage EDP' |
| brand | TEXT | NOT NULL | Marca. Ej: 'Dior', 'Chanel', 'Tom Ford' |
| sku | TEXT | NULLABLE, UNIQUE | Código interno opcional |
| concentration | TEXT | NOT NULL | Tipo: 'EDP', 'EDT', 'Extrait', 'EDC', 'Parfum' |
| size\_ml | INTEGER | NOT NULL, \> 0 | Tamaño en mililitros |
| tags | TEXT\[\] | DEFAULT '{}' | Etiquetas descriptivas |
| current\_stock | INTEGER | NOT NULL, DEFAULT 0 | Stock actual (denormalizado, actualizado por trigger) |
| is\_active | BOOLEAN | NOT NULL, DEFAULT true | Si false, no aparece en formularios de venta |
| created\_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Fecha de creación |
| updated\_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Fecha de última modificación |

## **5.3 Tabla: inventory\_batches**

| Columna | Tipo | Restricción | Descripción |
| :---- | :---- | :---- | :---- |
| id | UUID | PK | Identificador único del lote |
| product\_id | UUID | FK → products, NOT NULL | Producto al que pertenece este lote |
| quantity\_in | INTEGER | NOT NULL, \> 0 | Unidades compradas en este lote |
| cost\_unit\_cop | NUMERIC(12,2) | NOT NULL, \>= 0 | Costo por unidad en COP (precio de compra) |
| sell\_price\_unit\_cop | NUMERIC(12,2) | NOT NULL, \> 0 | Precio de venta sugerido por unidad en COP |
| supplier | TEXT | NULLABLE | Nombre del proveedor o distribuidor |
| notes | TEXT | NULLABLE | Observaciones del lote |
| purchased\_at | DATE | NOT NULL | Fecha de compra del lote |
| created\_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Fecha de registro en el sistema |

## **5.4 Tabla: sales**

| Columna | Tipo | Restricción | Descripción |
| :---- | :---- | :---- | :---- |
| id | UUID | PK | Identificador único de la venta |
| items | JSONB | NOT NULL | Array de items vendidos con snapshots de precio y costo |
| subtotal\_cop | NUMERIC(14,2) | NOT NULL | Suma de (quantity × sell\_price) de todos los items |
| total\_cop | NUMERIC(14,2) | NOT NULL | Total final de la venta |
| total\_profit\_cop | NUMERIC(14,2) | NOT NULL | Utilidad total de la venta |
| notes | TEXT | NULLABLE | Observaciones de la venta |
| sold\_at | DATE | NOT NULL | Fecha de la venta |
| created\_by | UUID | FK → users, NOT NULL | UID del usuario que registró la venta |
| created\_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Timestamp de registro en el sistema |

# **6\. Reglas de Negocio y Cálculos**

## **6.1 Método de Costeo: Costo Promedio Ponderado (CPP)**

El sistema utiliza el método de Costo Promedio Ponderado para valorar el inventario. Este método fue seleccionado porque es el más simple y preciso para un negocio de retail con rotación moderada, evita la complejidad de FIFO/LIFO, es aceptado por la normativa contable colombiana para pequeñas empresas, y produce resultados estables.

| CPP \= Σ(quantity\_in × cost\_unit\_cop) de todos los lotes  ÷  Σ(quantity\_in) de todos los lotes Ejemplo: Lote A: 5 uds × $80.000 \= $400.000  |  Lote B: 3 uds × $95.000 \= $285.000 CPP \= ($400.000 \+ $285.000) / (5 \+ 3\) \= $685.000 / 8 \= $85.625 por unidad |
| :---- |

Al registrar cada venta, el servicio calculateCPP(productId) consulta todos los lotes del producto y calcula el CPP en ese momento. Este valor se guarda como cost\_unit\_cop\_snapshot y NUNCA cambia, garantizando la integridad histórica.

## **6.2 Cálculo de Stock Actual**

| stock\_actual \= Σ(quantity\_in de todos los lotes)  −  Σ(quantity vendida en todas las ventas) |
| :---- |

El campo current\_stock en products es un valor denormalizado actualizado mediante trigger PostgreSQL. La venta falla si current\_stock \< quantity solicitada.

## **6.3 Métricas de Rentabilidad**

| Métrica | Fórmula | Notas |
| :---- | :---- | :---- |
| Ingresos (COP) | Σ(quantity × sell\_price\_unit) | Por producto, en rango de fechas |
| Costo Total (COP) | Σ(quantity × cost\_snapshot) | Usa el snapshot guardado en la venta |
| Utilidad (COP) | Ingresos − Costo Total | Ganancia neta en pesos |
| Margen (%) | (Utilidad / Ingresos) × 100 | Si Ingresos \= 0, retorna 0 |
| Utilidad prom. / unidad | Utilidad Total / Unidades Vendidas | Promedio de ganancia por unidad |
| Ticket Promedio | Total Ingresos / Número de ventas | Valor promedio por transacción |
| Top Vendidos | ORDER BY unidades\_vendidas DESC | Ranking por volumen en el período |
| Bottom Vendidos | ORDER BY unidades\_vendidas ASC | Incluye productos con 0 ventas |
| Top por Utilidad | ORDER BY utilidad\_cop DESC LIMIT 5 | Los 5 productos más rentables en COP |

# **7\. Requisitos Funcionales por Módulo**

## **7.1 Autenticación (/login)**

* Logo de Scents Perfumería centrado sobre el formulario, cargado desde /public/brand/logo.png, máximo 180px de ancho.

* Campos: email y contraseña con validación inmediata.

* Error claro ante credenciales inválidas. Redirección a /dashboard al autenticarse.

* Logout disponible en todas las páginas protegidas.

## **7.2 Productos (/products)**

* CRUD completo: crear, editar, activar/desactivar (soft delete, no se eliminan registros).

* Tabla con búsqueda en tiempo real, filtro por estado y ordenamiento por columna.

* Validación con Zod: nombre, marca, concentración, tamaño ml, SKU (opcional), tags (opcional).

* Indicador visual de stock bajo en rojo cuando current\_stock ≤ threshold configurado.

## **7.3 Inventario (/inventory)**

* Formulario de ingreso de lote: producto (autocomplete), cantidad, costo COP, precio venta COP, proveedor, fecha, notas.

* Al guardar: inserta batch y actualiza current\_stock atómicamente. Muestra confirmación con nuevo stock.

* Historial de lotes con filtros por producto y rango de fechas. Solo visible para owner.

## **7.4 Ventas (/sales)**

* Formulario multi-item: fecha, notas, items dinámicos (producto \+ cantidad \+ precio por unidad).

* Stock disponible visible junto al selector. Precio pre-poblado con último sell\_price del producto.

* Resumen en tiempo real: subtotal, total, utilidad estimada (solo owner).

* Validación: no se puede vender más stock del disponible. Operación transaccional (todo o nada).

* Historial de ventas con filtros de fecha y producto. Ver detalle expandible.

## **7.5 Dashboard (/dashboard)**

* 6 StatCards con filtro de período (Hoy / 7d / 30d / Mes actual): Ventas COP, Utilidad COP (owner), Margen % (owner), Unidades vendidas, Ticket promedio, Productos activos.

* Gráfica de barras: ingresos por día en los últimos 14 o 30 días.

* Sección de alertas: productos con stock ≤ threshold, con acceso rápido a registrar inventario.

## **7.6 Reportes (/reports)**

* Selector de rango de fechas: 7d / 30d / mes actual / rango personalizado.

* Tabla de rentabilidad por producto (solo owner): Unidades vendidas, Ingresos, Costo, Utilidad, Margen %, Utilidad prom./unidad.

* Secciones: Top 5 Más Vendidos, Bottom 5 Menos Vendidos (incluye 0 ventas), Top 5 por Utilidad Total.

## **7.7 Configuración (/settings)**

* Cambiar email o contraseña del owner.

* Configurar threshold de alerta de stock bajo (default: 3 unidades).

* Solo accesible para el rol owner.

# **8\. Requisitos de Diseño y Experiencia de Usuario**

## **8.1 Paleta de Colores y Estética**

La app sigue una estética 'High-End Minimalist' coherente con la identidad visual de Scents Perfumería (negro, blanco, gris).

| Elemento | Color (Hex) | Uso |
| :---- | :---- | :---- |
| Fondo principal | \#FFFFFF | Fondo de toda la app y tarjetas |
| Fondo secundario | \#F9FAFB | Fondo del sidebar, tablas alternadas |
| Texto principal | \#111111 | Títulos, datos importantes |
| Texto secundario | \#555555 | Labels, subtítulos, placeholders |
| Bordes / divisores | \#E5E7EB | Líneas de separación, bordes de tablas |
| Acción primaria | \#111111 (negro) | Botones principales, CTAs |
| Acción secundaria | \#F3F4F6 (gris claro) | Botones secundarios, cancelar |
| Estado positivo | \#16A34A | Métricas de utilidad positiva, stock OK |
| Estado negativo | \#DC2626 | Stock bajo, errores, valores negativos |
| Estado neutro | \#D97706 | Advertencias, stock medio |

## **8.2 Logo de Scents Perfumería**

El logo oficial de Scents Perfumería (monograma S/S con texto 'SCENTS Perfumeria' sobre fondo negro) debe integrarse en la aplicación de la siguiente manera:

![][image2]

*Logo oficial — archivo a entregar como /public/brand/logo.png*

| Ubicación en la app | Tamaño máximo | Notas |
| :---- | :---- | :---- |
| Página /login (encima del formulario) | 180px ancho | Centrado, fondo oscuro o claro según versión del logo que provea el cliente |
| Sidebar (parte superior izquierda) | 120px ancho | Versión compacta o completa según el espacio disponible |
| Componente que lo carga | — | /src/components/ui/Logo.tsx con fallback si el archivo no existe |
| Ruta del archivo en el proyecto | — | /public/brand/logo.png (el cliente debe copiar su archivo aquí) |

## **8.3 Componentes UI Requeridos**

| Componente | Descripción |
| :---- | :---- |
| DataTable | Tabla con búsqueda, ordenamiento y paginación. |
| StatCard | Tarjeta de métrica con ícono, valor, label e indicador de tendencia. |
| ProductForm | Formulario de producto validado con Zod. |
| SaleForm | Formulario de venta con items dinámicos y cálculo en tiempo real. |
| InventoryForm | Formulario de ingreso de lote con autocomplete de producto. |
| DateRangePicker | Selector de rango de fechas para filtros de reportes. |
| Sidebar | Navegación lateral con logo de Scents, links y botón de logout. |
| Toast | Notificaciones de éxito/error/advertencia no intrusivas. |
| ConfirmDialog | Modal de confirmación para acciones destructivas. |
| StockBadge | Indicador visual de stock: verde (OK), amarillo (bajo), rojo (crítico). |
| Logo | Componente /src/components/ui/Logo.tsx que carga /public/brand/logo.png |

# **9\. Requisitos No Funcionales**

## **9.1 Rendimiento**

* Dashboard carga en menos de 2 segundos en condiciones normales de red.

* Queries de reportes ejecutadas en menos de 3 segundos para hasta 10.000 ventas.

* current\_stock denormalizado para consultas de stock O(1).

## **9.2 Seguridad**

* Row Level Security (RLS) activado en todas las tablas de Supabase.

* Ninguna tabla es legible o escribible sin usuario autenticado.

* Campos de costo y utilidad solo visibles para role='owner' a nivel de RLS.

* Variables de entorno sensibles nunca expuestas al cliente.

* Sin registro público: allow\_signups \= false en Supabase Auth.

## **9.3 Mantenibilidad**

* TypeScript strict mode activo en todo el proyecto.

* Lógica de base de datos únicamente en /src/lib/services/ — nunca en componentes UI.

* Validación con Zod en frontend y en API Routes del servidor.

* Código documentado con comentarios JSDoc en funciones de negocio críticas.

## **9.4 Escalabilidad**

* Arquitectura permite agregar rol staff sin cambios en el esquema de base de datos.

* Supabase PostgreSQL soporta hasta millones de registros sin cambios de infraestructura.

# **10\. Entregables Requeridos**

## **10.1 Código Fuente Completo**

* Repositorio Git con estructura de archivos completa según sección 4.2.

* Código de layout.tsx y page.tsx para cada ruta del sistema.

* Servicios completos: products.ts, inventory.ts, sales.ts, reports.ts.

* Middleware de protección de rutas (middleware.ts).

* Componentes UI completos incluyendo Logo.tsx preparado para /public/brand/logo.png.

## **10.2 Base de Datos**

* Migraciones SQL en /supabase/migrations/ listas para ejecutar en Supabase.

* Triggers PostgreSQL para actualización automática de current\_stock.

* Políticas RLS completas para todas las tablas.

* Script de seed /scripts/seed.ts con 10 perfumes (Dior Sauvage EDP, Chanel No. 5, Tom Ford Black Orchid, y otros), 3 lotes por 5 productos, 15 ventas variadas.

## **10.3 Configuración y Documentación**

* Archivo .env.example con todas las variables necesarias documentadas.

* README.md con instrucciones paso a paso: crear proyecto Supabase, configurar Auth, ejecutar migraciones, configurar .env.local, npm install && npm run dev, crear usuario owner, deploy a Vercel.

* Instrucciones claras sobre cómo reemplazar /public/brand/logo.png con el logo de Scents Perfumería.

## **10.4 Checklist de QA / Criterios de Aceptación**

| Criterio de Aceptación | Estado Esperado |
| :---- | :---- |
| Acceder a /dashboard sin sesión redirige a /login | PASS |
| Login con credenciales válidas redirige a /dashboard | PASS |
| Login con credenciales inválidas muestra error descriptivo | PASS |
| Crear un producto y verlo en el listado inmediatamente | PASS |
| Registrar un lote y ver el stock actualizado en el producto | PASS |
| Registrar una venta y ver el stock reducido correctamente | PASS |
| Intentar vender más stock del disponible y recibir error | PASS |
| El CPP se calcula correctamente con múltiples lotes | PASS |
| Dashboard muestra métricas correctas para el período seleccionado | PASS |
| Reportes muestran top y bottom vendidos con datos de seed | PASS |
| Utilidad y costos NO son visibles para el rol staff | PASS |
| El logo de Scents aparece correctamente en login y sidebar | PASS |
| App funciona correctamente en Vercel (deploy de producción) | PASS |
| Las migraciones SQL corren sin errores en Supabase | PASS |

# **11\. Variables de Entorno (.env.local)**

| Variable | Usado en | Descripción |
| :---- | :---- | :---- |
| NEXT\_PUBLIC\_SUPABASE\_URL | Cliente \+ Servidor | URL del proyecto Supabase. Ej: https://xxx.supabase.co |
| NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY | Cliente | Clave pública de Supabase. Segura para el browser con RLS activo. |
| SUPABASE\_SERVICE\_ROLE\_KEY | Solo Servidor | Clave admin. NUNCA exponer al cliente. Solo en API Routes. |

# **12\. Supuestos, Limitaciones y Fuera de Alcance**

## **12.1 Supuestos**

* El cliente proveerá el logo de Scents Perfumería en formato PNG (idealmente con fondo transparente) antes del deploy.

* El cliente creará el usuario owner siguiendo la guía del README.md.

* El sistema operará en Colombia con moneda COP. No se requieren múltiples monedas en el MVP.

## **12.2 Fuera del Alcance (MVP)**

* Facturación electrónica DIAN o integración con sistemas contables.

* Pasarela de pagos o módulo de cobro.

* Aplicación móvil nativa (iOS/Android).

* Tienda pública para clientes finales.

* Descuentos por volumen o sistema de promociones.

* Exportar reportes a Excel/PDF.

# **13\. Aprobación del Documento**

Este documento debe ser revisado y aprobado por ambas partes antes del inicio del desarrollo:

| Cliente — Scents Perfumería | Desarrollador — Antigravity |
| :---- | :---- |
| Nombre: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Firma:   \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Fecha:   \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | Nombre: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Firma:   \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Fecha:   \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |

*Scents Store Manager  —  SRS v1.0  —  Confidencial  —  Scents Perfumería × Antigravity*

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>