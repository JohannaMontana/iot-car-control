// Clase DemoManager - Gestiona secuencias automáticas (demos) del robot
class DemoManager {
    constructor() {
        // URL del backend Flask (servidor EC2)
        this.backendUrl = 'http://54.147.92.50:5500';

        // Elemento DOM para mostrar progreso de demo en ejecución
        this.progresoElement = null;

        // Referencia al gestor de notificaciones
        this.notificationManager = null;

        // Objeto para almacenar la demo actual que se está editando/creando
        this.demoActual = {
            id: null,           // ID de la demo (null si es nueva)
            nombre: '',         // Nombre de la demo
            descripcion: '',    // Descripción opcional
            movimientos: []     // Array de movimientos de la demo
        };

        // Espera a que el DOM esté completamente cargado
        document.addEventListener('DOMContentLoaded', () => {
            this.cargarDemos(); // Carga la lista de demos existentes

            // Inicializar notification manager después de 500ms
            // Esto asegura que window.notificationManager ya esté disponible
            setTimeout(() => {
                if (window.notificationManager) {
                    this.notificationManager = window.notificationManager;
                }
            }, 500);
        });
    }

    // Helper para obtener la velocidad actual del panel de control
    getVelocidadActual() {
        // Usa el controlManager global si está disponible
        if (window.controlManager && typeof window.controlManager.obtenerVelocidadSeleccionada === 'function') {
            return window.controlManager.obtenerVelocidadSeleccionada();
        }
        return 180; // Velocidad por defecto si no hay controlManager
    }

    // ============================================================
    // 1. SECUENCIAS AUTOMÁTICAS (Botones Rápidos) - MANTENIDAS
    // ============================================================

    // Ejecuta secuencia predefinida: Circuito Cuadrado
    async ejecutarCircuitoCuadrado() {
        // Pide confirmación al usuario
        if (!confirm("¿Iniciar secuencia CUADRADO?\nEl carrito avanzará y girará 4 veces.")) return;

        // Notificar inicio de la demo
        if (window.notificationManager) {
            window.notificationManager.demoIniciada("Circuito Cuadrado", 8);
        }

        // Configura velocidades: rectas con velocidad actual, giros más rápido
        const velRecta = this.getVelocidadActual();
        const velGiro = Math.max(velRecta, 200); // Giros mínimo 200

        // Define los 8 movimientos del cuadrado + 1 de detención
        const movimientos = [
            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 1" },
            { status_clave: 8, duracion: 1, velocidad: velGiro, nombre: "Giro 90°" },

            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 2" },
            { status_clave: 8, duracion: 1, velocidad: velGiro, nombre: "Giro 90°" },

            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 3" },
            { status_clave: 8, duracion: 1, velocidad: velGiro, nombre: "Giro 90°" },

            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 4" },
            { status_clave: 8, duracion: 1, velocidad: velGiro, nombre: "Giro Final" },

            { status_clave: 3, duracion: 1, velocidad: 0, nombre: "Finalizar" }
        ];

        // Crea y ejecuta la demo temporal
        this.crearYEjecutarDemoTemporal("Circuito Cuadrado", movimientos);
    }

    // Ejecuta secuencia predefinida: Zig-Zag
    async ejecutarZigZag() {
        if (!confirm("¿Iniciar secuencia ZIG-ZAG?")) return;

        // Notificar inicio
        if (window.notificationManager) {
            window.notificationManager.demoIniciada("Zig-Zag Dinámico", 5);
        }

        const vel = this.getVelocidadActual();
        const velCurva = vel < 150 ? 160 : vel; // Curvas mínimo 160 si velocidad baja

        // Define 4 curvas alternadas + 1 detención
        const movimientos = [
            { status_clave: 4, duracion: 2, velocidad: velCurva, nombre: "Curva Derecha" },
            { status_clave: 5, duracion: 2, velocidad: velCurva, nombre: "Curva Izquierda" },
            { status_clave: 4, duracion: 2, velocidad: velCurva, nombre: "Curva Derecha" },
            { status_clave: 5, duracion: 2, velocidad: velCurva, nombre: "Curva Izquierda" },
            { status_clave: 3, duracion: 1, velocidad: 0, nombre: "Finalizar" }
        ];

        this.crearYEjecutarDemoTemporal("Zig-Zag Dinámico", movimientos);
    }

    // Crea una demo temporal y la ejecuta inmediatamente
    async crearYEjecutarDemoTemporal(nombre, movimientos) {
        try {
            // Notificar que se está creando la demo
            if (window.notificationManager) {
                window.notificationManager.showInfo('🔄 Generando Demo', `Creando "${nombre}"...`);
            }

            // Enviar petición POST para crear la demo en el backend
            const responseCrear = await fetch(`${this.backendUrl}/api/demos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nombre,
                    descripcion: "Secuencia rápida generada automáticamente",
                    movimientos: movimientos
                })
            });

            const dataCrear = await responseCrear.json();

            if (dataCrear.success) {
                // Notificar que la demo fue creada exitosamente
                if (window.notificationManager) {
                    window.notificationManager.showSuccess('✅ Demo Creada', `"${nombre}" lista para ejecutar`);
                }

                // Ejecutar la demo recién creada
                this.ejecutarDemo(dataCrear.demo_id, nombre);

                // Actualizar lista de demos
                this.cargarDemos();
            } else {
                // Notificar error en creación
                if (window.notificationManager) {
                    window.notificationManager.showDanger('❌ Error', 'No se pudo crear la demo: ' + (dataCrear.error || 'Desconocido'));
                }
            }

        } catch (error) {
            console.error(error);
            // Notificar error de conexión
            if (window.notificationManager) {
                window.notificationManager.showDanger('❌ Error de Conexión', 'No se pudo crear la demo');
            }
        }
    }

    // ============================================================
    // 2. EJECUCIÓN Y PROGRESO VISUAL - MANTENIDAS
    // ============================================================

    // Inicia la ejecución de una demo existente
    async ejecutarDemo(id, nombre) {
        // Muestra la barra de progreso
        this.inicializarUIProgreso(nombre, "?");

        // Notificar inicio de ejecución
        if (window.notificationManager) {
            window.notificationManager.demoIniciada(nombre, "?");
        }

        try {
            // Enviar petición POST para ejecutar la demo
            const res = await fetch(`${this.backendUrl}/api/ejecutar-demo/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();

            if (data.success) {
                // Actualizar contador en la UI de progreso
                const contador = this.progresoElement.querySelector('.contador-movimientos');
                if (contador) contador.textContent = `0/${data.total_movimientos}`;

                // Notificar que la demo fue programada exitosamente
                if (window.notificationManager) {
                    window.notificationManager.showSuccess('✅ Demo Programada', `"${data.nombre}" en ejecución (${data.total_movimientos} pasos)`);
                }
            } else {
                // Notificar error en ejecución
                if (window.notificationManager) {
                    window.notificationManager.demoFallida(nombre, data.error || 'Error desconocido');
                }
                this.ocultarProgreso();
            }
        } catch (error) {
            console.error(error);
            // Notificar error de conexión
            if (window.notificationManager) {
                window.notificationManager.demoFallida(nombre, 'Error de conexión');
            }
            this.ocultarProgreso();
        }
    }

    // Actualiza la barra de progreso con datos recibidos via WebSocket
    actualizarProgresoDemo(data) {
        const { movimiento_actual, total_movimientos, nombre_movimiento } = data;

        // Inicializar UI de progreso si no existe
        if (!this.progresoElement) {
            this.inicializarUIProgreso("Demo en curso...", total_movimientos);
        }

        // Calcular porcentaje completado
        const porcentaje = (movimiento_actual / total_movimientos) * 100;

        // Referencias a elementos de la UI de progreso
        const barra = this.progresoElement.querySelector('.progress-bar');
        const textoContador = this.progresoElement.querySelector('.contador-movimientos');
        const textoMovimiento = this.progresoElement.querySelector('.movimiento-actual');
        const textoPorcentaje = this.progresoElement.querySelector('.porcentaje-progreso');

        // Actualizar todos los elementos de la UI
        if (barra) barra.style.width = `${porcentaje}%`;
        if (textoContador) textoContador.textContent = `${movimiento_actual}/${total_movimientos}`;
        if (textoMovimiento) textoMovimiento.textContent = `Ejecutando: ${nombre_movimiento}`;
        if (textoPorcentaje) textoPorcentaje.textContent = `${Math.round(porcentaje)}%`;
    }

    // Procesa evento de demo completada
    demoCompletada(data) {
        if (this.progresoElement) {
            const barra = this.progresoElement.querySelector('.progress-bar');
            const estado = this.progresoElement.querySelector('.estado-demo');

            // Cambiar a estado "completado" (verde)
            if (barra) {
                barra.style.width = '100%';
                barra.className = 'progress-bar bg-success';
            }
            if (estado) {
                estado.textContent = '¡Completado!';
                estado.className = 'estado-demo text-success fw-bold';
            }

            // Ocultar progreso después de 3 segundos
            setTimeout(() => this.ocultarProgreso(), 3000);
        }

        // Nota: La notificación de demo completada también viene del WebSocket en control.js
    }

    // Crea y muestra la UI de progreso flotante
    inicializarUIProgreso(nombre, total) {
        this.ocultarProgreso(); // Limpia cualquier progreso anterior

        // Crea elemento div para el progreso
        this.progresoElement = document.createElement('div');
        this.progresoElement.className = 'alert position-fixed shadow-lg';

        // Estilos CSS inyectados para posición fija y apariencia moderna
        this.progresoElement.style.cssText = `
            bottom: 20px; right: 20px; z-index: 1060; min-width: 320px;
            background: rgba(15, 23, 42, 0.95); border: 1px solid var(--accent-cyan);
            color: white; backdrop-filter: blur(5px); border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5); animation: slideInUp 0.3s ease;
        `;

        // HTML interno con estructura de progreso
        this.progresoElement.innerHTML = `
            <div class="d-flex align-items-center justify-content-between mb-2">
                <strong style="color: var(--accent-cyan);"><i class="fas fa-robot fa-spin me-2"></i>${nombre}</strong>
                <small class="contador-movimientos text-muted">0/${total}</small>
            </div>
            <div class="d-flex justify-content-between small mb-1">
                <span class="estado-demo text-white-50">En progreso...</span>
                <span class="porcentaje-progreso text-white">0%</span>
            </div>
            <div class="progress" style="height: 8px; background: rgba(255,255,255,0.1);">
                <div class="progress-bar bg-info progress-bar-striped progress-bar-animated" style="width: 0%"></div>
            </div>
            <div class="movimiento-actual small mt-2 text-end text-white-50" style="font-style: italic;">Iniciando...</div>
        `;

        // Agrega el elemento al body del documento
        document.body.appendChild(this.progresoElement);
    }

    // Oculta y elimina la UI de progreso
    ocultarProgreso() {
        if (this.progresoElement) {
            this.progresoElement.remove();
            this.progresoElement = null;
        }
    }

    // ============================================================
    // 3. LISTA DE DEMOS COMPACTA (INTERFAZ ACTUALIZADA)
    // ============================================================

    // Carga y muestra la lista de demos disponibles
    async cargarDemos() {
        const container = document.getElementById('listaDemos');
        if (!container) return; // Sale si no existe el contenedor

        try {
            // Obtener lista de demos del backend
            const res = await fetch(`${this.backendUrl}/api/demos`);
            const data = await res.json();

            if (data.success && data.demos && data.demos.length > 0) {
                container.innerHTML = ''; // Limpia contenedor

                // Itera sobre cada demo y crea su tarjeta
                data.demos.forEach(demo => {
                    // Parsear movimientos (pueden venir como string JSON o array)
                    let movimientos = [];
                    try {
                        movimientos = typeof demo.movimientos === 'string'
                            ? JSON.parse(demo.movimientos)
                            : demo.movimientos || [];
                    } catch (e) {
                        movimientos = [];
                    }

                    // Calcular duración total sumando duraciones individuales
                    const duracionTotal = movimientos.reduce((acc, curr) => acc + (curr.duracion || 0), 0);

                    // Crear elemento para cada demo
                    const item = document.createElement('div');
                    item.className = 'demo-item-compact';

                    // HTML de la tarjeta de demo
                    item.innerHTML = `
                        <div>
                            <div class="fw-bold small">${this.escapeHtml(demo.nombre_secuencia)}</div>
                            <div class="text-muted" style="font-size: 0.7rem;">
                                ${movimientos.length} pasos • ${duracionTotal}s
                            </div>
                        </div>
                        <div class="demo-actions">
                            <button class="btn btn-sm btn-primary" onclick="demoManager.ejecutarDemo(${demo.secuencia_id}, '${this.escapeHtml(demo.nombre_secuencia)}')" title="Ejecutar">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-secondary" onclick="demoManager.editarDemo(${demo.secuencia_id})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="demoManager.eliminarDemo(${demo.secuencia_id})" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                    container.appendChild(item);
                });
            } else {
                // Mensaje cuando no hay demos
                container.innerHTML = '<div class="text-center text-muted py-3 small">No hay secuencias guardadas</div>';
            }
        } catch (error) {
            console.error("Error cargando demos:", error);
            container.innerHTML = '<div class="text-center text-danger small">Error cargando</div>';
        }
    }

    // ============================================================
    // 4. EDITOR EN MODAL (INTERFAZ ACTUALIZADA)
    // ============================================================

    // Muestra el modal para crear una nueva demo
    mostrarEditor() {
        const modal = new bootstrap.Modal(document.getElementById('demoEditorModal'));

        // Reinicia el objeto demoActual
        this.demoActual = { id: null, nombre: '', descripcion: '', movimientos: [] };

        // Limpia los campos del formulario
        document.getElementById('demoNombre').value = '';
        document.getElementById('demoDescripcion').value = '';

        // Actualiza lista de movimientos (vacía inicialmente)
        this.actualizarListaMovimientos();

        // Muestra el modal
        modal.show();
    }

    // Agrega un movimiento a la demo actual
    agregarMovimiento(statusClave) {
        // Obtiene duración del input (default 2 segundos)
        const duracionInput = document.getElementById('duracionMovimientoDemo');
        const duracion = parseInt(duracionInput?.value || 2);

        // Obtiene velocidad actual del panel
        const velocidad = this.getVelocidadActual();

        // Crea objeto de movimiento
        const movimiento = {
            status_clave: statusClave,
            duracion: duracion,
            velocidad: velocidad,
            nombre: this.obtenerNombreMovimiento(statusClave)
        };

        // Agrega al array de movimientos
        this.demoActual.movimientos.push(movimiento);

        // Actualiza la lista visual
        this.actualizarListaMovimientos();

        // Notifica que se agregó el movimiento
        if (window.notificationManager) {
            const nombreMov = this.obtenerNombreMovimiento(statusClave);
            window.notificationManager.showInfo('➕ Movimiento Agregado', `${nombreMov}`);
        }
    }

    // Elimina un movimiento de la demo actual por índice
    eliminarMovimiento(index) {
        if (index >= 0 && index < this.demoActual.movimientos.length) {
            // Guarda referencia al movimiento eliminado para notificación
            const movEliminado = this.demoActual.movimientos[index];

            // Elimina del array
            this.demoActual.movimientos.splice(index, 1);

            // Actualiza lista visual
            this.actualizarListaMovimientos();

            // Notifica eliminación
            if (window.notificationManager) {
                window.notificationManager.showWarning('➖ Movimiento Eliminado', `${movEliminado.nombre} removido de la secuencia`);
            }
        }
    }

    // Actualiza la lista visual de movimientos en el modal
    actualizarListaMovimientos() {
        const container = document.getElementById('movimientosDemo');
        if (!container) return;

        // Mensaje si no hay movimientos
        if (this.demoActual.movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-2">Agrega movimientos...</div>';
            return;
        }

        // Limpia contenedor
        container.innerHTML = '';

        // Crea elemento para cada movimiento
        this.demoActual.movimientos.forEach((mov, idx) => {
            const div = document.createElement('div');
            div.className = 'd-flex justify-content-between align-items-center border-bottom border-secondary py-1';

            // Formato: "1. Adelante (2s @ 180)"
            div.innerHTML = `
                <span class="text-white small">
                    ${idx + 1}. ${mov.nombre} (${mov.duracion}s @ ${mov.velocidad})
                </span>
                <button class="btn btn-sm text-danger p-0" onclick="demoManager.eliminarMovimiento(${idx})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(div);
        });
    }

    // Guarda la demo actual (crea nueva o actualiza existente)
    async guardarDemo() {
        // Valida que tenga nombre y al menos un movimiento
        const nombre = document.getElementById('demoNombre')?.value.trim();
        if (!nombre || this.demoActual.movimientos.length === 0) {
            // Notificar error de validación
            if (window.notificationManager) {
                window.notificationManager.showWarning('⚠️ Datos Incompletos', 'Nombre y al menos un movimiento son requeridos');
            }
            return;
        }

        try {
            // Determina URL y método según si es nueva o edición
            const url = this.demoActual.id
                ? `${this.backendUrl}/api/demo/${this.demoActual.id}`
                : `${this.backendUrl}/api/demos`;
            const method = this.demoActual.id ? 'PUT' : 'POST';

            // Notificar que se está guardando
            if (window.notificationManager) {
                window.notificationManager.showInfo('💾 Guardando...', `Creando demo "${nombre}"...`);
            }

            // Envía petición al backend
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nombre,
                    descripcion: document.getElementById('demoDescripcion')?.value || '',
                    movimientos: this.demoActual.movimientos
                })
            });

            const data = await response.json();

            if (data.success) {
                // Cierra el modal y actualiza lista de demos
                bootstrap.Modal.getInstance(document.getElementById('demoEditorModal')).hide();
                this.cargarDemos();

                // Nota: La notificación de éxito también viene del WebSocket
            } else {
                // Notifica error del backend
                if (this.notificationManager) {
                    window.notificationManager.showDanger('❌ Error al Guardar', 'No se pudo guardar la demo: ' + (data.error || 'Desconocido'));
                }
            }
        } catch (e) {
            console.error("Error guardando demo:", e);
            // Notifica error de conexión
            if (window.notificationManager) {
                window.notificationManager.showDanger('❌ Error de Conexión', 'No se pudo guardar la demo');
            }
        }
    }

    // Carga una demo existente para editar
    async editarDemo(id) {
        try {
            // Obtiene lista de demos
            const res = await fetch(`${this.backendUrl}/api/demos`);
            const data = await res.json();

            if (data.success && data.demos) {
                // Busca la demo específica por ID
                const demo = data.demos.find(d => d.secuencia_id === id);

                if (demo) {
                    // Parsea los movimientos (pueden ser string JSON o array)
                    let movimientos = [];
                    try {
                        movimientos = typeof demo.movimientos === 'string'
                            ? JSON.parse(demo.movimientos)
                            : demo.movimientos || [];
                    } catch (e) {
                        console.error("Error parseando movimientos:", e);
                    }

                    // Carga la demo en demoActual
                    this.demoActual = {
                        id: demo.secuencia_id,
                        nombre: demo.nombre_secuencia,
                        descripcion: demo.descripcion || '',
                        movimientos: movimientos
                    };

                    // Rellena campos del formulario
                    document.getElementById('demoNombre').value = this.demoActual.nombre;
                    document.getElementById('demoDescripcion').value = this.demoActual.descripcion;

                    // Actualiza lista visual de movimientos
                    this.actualizarListaMovimientos();

                    // Muestra el modal de edición
                    const modal = new bootstrap.Modal(document.getElementById('demoEditorModal'));
                    modal.show();

                    // Notifica que se está editando
                    if (window.notificationManager) {
                        window.notificationManager.showInfo('✏️ Editando Demo', `Editando "${this.demoActual.nombre}"`);
                    }
                }
            }
        } catch (e) {
            console.error("Error editando demo:", e);
            // Notifica error
            if (window.notificationManager) {
                window.notificationManager.showDanger('❌ Error', 'No se pudo cargar la demo para editar');
            }
        }
    }

    // Elimina (desactiva) una demo
    async eliminarDemo(id) {
        // Pide confirmación al usuario
        if (!confirm("¿Estás seguro de eliminar esta secuencia?")) return;

        try {
            // Notifica que se está eliminando
            if (window.notificationManager) {
                window.notificationManager.showWarning('🗑️ Eliminando...', 'Eliminando secuencia...');
            }

            // Envía petición DELETE al backend
            const response = await fetch(`${this.backendUrl}/api/demo/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                // Nota: La notificación de éxito viene del WebSocket
                this.cargarDemos(); // Actualiza lista
            } else {
                // Notifica error del backend
                if (window.notificationManager) {
                    window.notificationManager.showDanger('❌ Error', 'No se pudo eliminar la secuencia');
                }
            }
        } catch (e) {
            console.error("Error eliminando demo:", e);
            // Notifica error de conexión
            if (window.notificationManager) {
                window.notificationManager.showDanger('❌ Error de Conexión', 'No se pudo eliminar la demo');
            }
        }
    }

    // ==================== UTILIDADES ====================

    // Función de compatibilidad para mostrar notificaciones
    mostrarNotificacion(msg, type) {
        // Intenta usar controlManager primero
        if (window.controlManager && typeof window.controlManager.mostrarNotificacion === 'function') {
            window.controlManager.mostrarNotificacion(msg, type);
        } else if (window.notificationManager) {
            // Usa el nuevo sistema de notificaciones
            const methodName = `show${type.charAt(0).toUpperCase() + type.slice(1)}`;
            if (typeof window.notificationManager[methodName] === 'function') {
                // Define título según tipo
                const title = type === 'success' ? '✅ Éxito' :
                    type === 'danger' ? '❌ Error' :
                        type === 'warning' ? '⚠️ Advertencia' : 'ℹ️ Información';
                window.notificationManager[methodName](title, msg);
            }
        } else {
            // Fallback simple
            alert(msg);
        }
    }

    // Convierte ID de movimiento a nombre legible
    obtenerNombreMovimiento(clave) {
        const movimientos = {
            1: "Adelante",
            2: "Atrás",
            3: "Detener",
            4: "Adelante-Derecha",
            5: "Adelante-Izquierda",
            6: "Atrás-Derecha",
            7: "Atrás-Izquierda",
            8: "Giro Derecha",
            9: "Giro Izquierda",
            10: "Vuelta 360° Derecha",
            11: "Vuelta 360° Izquierda"
        };
        return movimientos[clave] || `Mov ${clave}`;
    }

    // Escapa HTML para prevenir XSS
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Crea instancia global accesible desde toda la aplicación
window.demoManager = new DemoManager();