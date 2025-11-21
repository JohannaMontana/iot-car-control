class DemoManager {
    constructor() {
        // Asegúrate de que esta IP sea la correcta de tu EC2
        this.backendUrl = 'http://54.147.92.50:5500'; 
        this.progresoElement = null;
        
        this.demoActual = {
            id: null,
            nombre: '',
            descripcion: '',
            movimientos: []
        };

        // Cargar lista de demos al iniciar
        document.addEventListener('DOMContentLoaded', () => {
            this.cargarDemos();
        });
    }

    // ============================================================
    // 1. SECUENCIAS AUTOMÁTICAS (Botones Rápidos)
    // ============================================================

    // Obtiene la velocidad seleccionada en el panel de control
    getVelocidadActual() {
        if (window.controlManager && typeof window.controlManager.obtenerVelocidadSeleccionada === 'function') {
            return window.controlManager.obtenerVelocidadSeleccionada();
        }
        return 180; // Default Media
    }

    async ejecutarCircuitoCuadrado() {
        if(!confirm("¿Iniciar secuencia CUADRADO?\nAsegúrate de tener 1 metro libre alrededor.")) return;

        const velRecta = this.getVelocidadActual();
        // Los giros de 90 grados requieren fuerza para no atascarse, usamos un valor fijo alto o la velocidad seleccionada si es mayor
        const velGiro = Math.max(velRecta, 200); 

        // Definición del Cuadrado: 4 lados + 4 giros
        const movimientos = [
            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 1 (Adelante)" },
            { status_clave: 8, duracion: 1, velocidad: velGiro,  nombre: "Giro 90° Derecha" },
            
            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 2 (Adelante)" },
            { status_clave: 8, duracion: 1, velocidad: velGiro,  nombre: "Giro 90° Derecha" },
            
            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 3 (Adelante)" },
            { status_clave: 8, duracion: 1, velocidad: velGiro,  nombre: "Giro 90° Derecha" },
            
            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 4 (Adelante)" },
            { status_clave: 8, duracion: 1, velocidad: velGiro,  nombre: "Giro Final" },
            
            { status_clave: 3, duracion: 1, velocidad: 0,        nombre: "Finalizar" }
        ];

        this.crearYEjecutarDemoTemporal("Circuito Cuadrado", movimientos);
    }

    async ejecutarZigZag() {
        if(!confirm("¿Iniciar secuencia ZIG-ZAG?")) return;

        const vel = this.getVelocidadActual();
        // Aumentamos un poco la velocidad para curvas suaves si la seleccionada es muy baja
        const velCurva = vel < 150 ? 160 : vel; 

        const movimientos = [
            { status_clave: 4, duracion: 2, velocidad: velCurva, nombre: "Curva Derecha" },
            { status_clave: 5, duracion: 2, velocidad: velCurva, nombre: "Curva Izquierda" },
            { status_clave: 4, duracion: 2, velocidad: velCurva, nombre: "Curva Derecha" },
            { status_clave: 5, duracion: 2, velocidad: velCurva, nombre: "Curva Izquierda" },
            { status_clave: 3, duracion: 1, velocidad: 0,        nombre: "Finalizar" }
        ];

        this.crearYEjecutarDemoTemporal("Zig-Zag Dinámico", movimientos);
    }

    /**
     * Crea una demo temporal en BD y la ejecuta inmediatamente
     */
    async crearYEjecutarDemoTemporal(nombre, movimientos) {
        try {
            this.mostrarNotificacion(`Generando secuencia: ${nombre}...`, 'info');

            // 1. Crear la demo en BD
            const responseCrear = await fetch(`${this.backendUrl}/api/crear-demo`, {
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
                // 2. Ejecutarla usando el ID generado
                this.ejecutarDemo(dataCrear.demo_id, nombre);
                // Recargar lista para que aparezca en el historial
                this.cargarDemos();
            } else {
                this.mostrarNotificacion('Error creando secuencia: ' + dataCrear.error, 'danger');
            }

        } catch (error) {
            console.error(error);
            this.mostrarNotificacion('Error de conexión al generar demo', 'danger');
        }
    }

    // ============================================================
    // 2. EJECUCIÓN Y PROGRESO VISUAL
    // ============================================================

    async ejecutarDemo(id, nombre) {
        // Feedback visual inmediato (Barra de progreso vacía)
        this.inicializarUIProgreso(nombre, "?");
        
        try {
            const res = await fetch(`${this.backendUrl}/api/ejecutar-demo/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            
            if (data.success) {
                // Actualizar contador real en la barra
                const contador = this.progresoElement.querySelector('.contador-movimientos');
                if(contador) contador.textContent = `0/${data.total_movimientos}`;
            } else {
                this.mostrarNotificacion('Error: ' + data.error, 'danger');
                this.ocultarProgreso();
            }
        } catch (error) {
            console.error(error);
            this.mostrarNotificacion('Error de conexión', 'danger');
            this.ocultarProgreso();
        }
    }

    // Llamado por control.js cuando llega evento Socket.IO
    actualizarProgresoDemo(data) {
        const { movimiento_actual, total_movimientos, nombre_movimiento } = data;
        
        // Si no existe la barra, la creamos
        if (!this.progresoElement) {
            this.inicializarUIProgreso("Demo en curso...", total_movimientos);
        }

        const porcentaje = (movimiento_actual / total_movimientos) * 100;

        // Actualizar elementos del DOM
        const barra = this.progresoElement.querySelector('.progress-bar');
        const textoContador = this.progresoElement.querySelector('.contador-movimientos');
        const textoMovimiento = this.progresoElement.querySelector('.movimiento-actual');
        const textoPorcentaje = this.progresoElement.querySelector('.porcentaje-progreso');

        if (barra) barra.style.width = `${porcentaje}%`;
        if (textoContador) textoContador.textContent = `${movimiento_actual}/${total_movimientos}`;
        if (textoMovimiento) textoMovimiento.textContent = `Ejecutando: ${nombre_movimiento}`;
        if (textoPorcentaje) textoPorcentaje.textContent = `${Math.round(porcentaje)}%`;
    }

    // Llamado por control.js al finalizar
    demoCompletada(data) {
        if (this.progresoElement) {
            const barra = this.progresoElement.querySelector('.progress-bar');
            const estado = this.progresoElement.querySelector('.estado-demo');
            
            if (barra) {
                barra.style.width = '100%';
                barra.className = 'progress-bar bg-success';
            }
            if (estado) {
                estado.textContent = '¡Completado!';
                estado.className = 'estado-demo text-success fw-bold';
            }

            // Cerrar automáticamente a los 3 segundos
            setTimeout(() => this.ocultarProgreso(), 3000);
        }
        this.mostrarNotificacion(`✅ Secuencia "${data.nombre}" finalizada`, 'success');
    }

    // Crea el elemento HTML de la barra de progreso flotante
    inicializarUIProgreso(nombre, total) {
        this.ocultarProgreso(); // Limpiar previo
        
        this.progresoElement = document.createElement('div');
        this.progresoElement.className = 'alert position-fixed shadow-lg';
        this.progresoElement.style.cssText = `
            bottom: 20px; right: 20px; z-index: 1060; min-width: 320px;
            background: rgba(15, 23, 42, 0.95); border: 1px solid var(--accent-cyan);
            color: white; backdrop-filter: blur(5px); border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5); animation: slideInUp 0.3s ease;
        `;

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

        document.body.appendChild(this.progresoElement);
    }

    ocultarProgreso() {
        if (this.progresoElement) {
            this.progresoElement.remove();
            this.progresoElement = null;
        }
    }

    // ============================================================
    // 3. GESTIÓN DE LISTA Y EDITOR (CRUD)
    // ============================================================

    async cargarDemos() {
        const container = document.getElementById('listaDemos');
        if (!container) return;

        try {
            const res = await fetch(`${this.backendUrl}/api/demos`);
            const data = await res.json();

            if (data.success && data.demos.length > 0) {
                container.innerHTML = '';
                data.demos.forEach(demo => {
                    let movimientos = [];
                    try { movimientos = JSON.parse(demo.movimientos); } catch(e){}
                    const duracion = movimientos.reduce((acc, curr) => acc + (curr.duracion || 0), 0);

                    const item = document.createElement('div');
                    item.className = 'demo-card mb-2 p-3 border rounded bg-dark bg-opacity-50';
                    item.style.borderColor = 'rgba(255,255,255,0.1)';
                    
                    item.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-0 text-white">${this.escapeHtml(demo.nombre_secuencia)}</h6>
                                <small class="text-muted" style="font-size: 0.8rem;">
                                    <i class="fas fa-layer-group me-1"></i>${movimientos.length} pasos 
                                    <span class="mx-1">•</span> 
                                    <i class="fas fa-stopwatch me-1"></i>~${duracion}s
                                </small>
                            </div>
                            <div class="btn-group">
                                <button class="btn btn-sm btn-primary" onclick="demoManager.ejecutarDemo(${demo.secuencia_id}, '${this.escapeHtml(demo.nombre_secuencia)}')">
                                    <i class="fas fa-play"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-secondary" onclick="demoManager.editarDemo(${demo.secuencia_id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="demoManager.eliminarDemo(${demo.secuencia_id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                    container.appendChild(item);
                });
            } else {
                container.innerHTML = '<div class="text-center text-muted py-3">No hay demos guardadas</div>';
            }
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="text-center text-danger">Error cargando demos</div>';
        }
    }

    // --- Editor de Demos ---

    mostrarEditor() {
        document.getElementById('editorDemo').style.display = 'block';
        this.demoActual = { id: null, nombre: '', descripcion: '', movimientos: [] };
        document.getElementById('demoNombre').value = '';
        document.getElementById('demoDescripcion').value = '';
        this.actualizarListaMovimientos();
        document.getElementById('editorDemo').scrollIntoView({ behavior: 'smooth' });
    }

    ocultarEditor() {
        document.getElementById('editorDemo').style.display = 'none';
    }

    agregarMovimiento(statusClave) {
        const duracionInput = document.getElementById('duracionMovimientoDemo');
        const duracion = parseInt(duracionInput?.value || 3);
        const velocidad = this.getVelocidadActual(); // Usar la velocidad seleccionada en el panel

        const movimiento = {
            status_clave: statusClave,
            duracion: duracion,
            velocidad: velocidad,
            nombre: this.obtenerNombreMovimiento(statusClave)
        };
        this.demoActual.movimientos.push(movimiento);
        this.actualizarListaMovimientos();
    }

    eliminarMovimiento(index) {
        this.demoActual.movimientos.splice(index, 1);
        this.actualizarListaMovimientos();
    }

    actualizarListaMovimientos() {
        const container = document.getElementById('movimientosDemo');
        const contador = document.getElementById('contadorMovimientos');
        
        if(this.demoActual.movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-3">Agrega movimientos usando los botones...</div>';
            contador.textContent = '0 movimientos';
            return;
        }

        container.innerHTML = '';
        let totalTiempo = 0;

        this.demoActual.movimientos.forEach((mov, idx) => {
            totalTiempo += mov.duracion;
            const div = document.createElement('div');
            div.className = 'd-flex justify-content-between align-items-center border-bottom border-secondary py-1';
            div.innerHTML = `
                <span class="text-white small">${idx+1}. ${mov.nombre} (${mov.duracion}s @ ${mov.velocidad})</span>
                <button class="btn btn-sm text-danger" onclick="demoManager.eliminarMovimiento(${idx})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(div);
        });
        contador.textContent = `${this.demoActual.movimientos.length} movs (~${totalTiempo}s)`;
    }

    async guardarDemo() {
        const nombre = document.getElementById('demoNombre').value.trim();
        if (!nombre) return this.mostrarNotificacion('Nombre requerido', 'warning');
        if (this.demoActual.movimientos.length === 0) return this.mostrarNotificacion('Agrega movimientos', 'warning');

        const url = this.demoActual.id 
            ? `${this.backendUrl}/api/demo/${this.demoActual.id}` 
            : `${this.backendUrl}/api/crear-demo`;
        const method = this.demoActual.id ? 'PUT' : 'POST';

        try {
            await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nombre,
                    descripcion: document.getElementById('demoDescripcion').value,
                    movimientos: this.demoActual.movimientos
                })
            });
            this.mostrarNotificacion('Demo guardada exitosamente', 'success');
            this.ocultarEditor();
            this.cargarDemos();
        } catch (e) {
            this.mostrarNotificacion('Error al guardar', 'danger');
        }
    }

    async editarDemo(id) {
        try {
            const res = await fetch(`${this.backendUrl}/api/demos`);
            const data = await res.json();
            const demo = data.demos.find(d => d.secuencia_id === id);
            
            if(demo) {
                this.demoActual = {
                    id: demo.secuencia_id,
                    nombre: demo.nombre_secuencia,
                    descripcion: demo.descripcion,
                    movimientos: JSON.parse(demo.movimientos)
                };
                document.getElementById('editorDemo').style.display = 'block';
                document.getElementById('demoNombre').value = this.demoActual.nombre;
                document.getElementById('demoDescripcion').value = this.demoActual.descripcion;
                this.actualizarListaMovimientos();
                document.getElementById('editorDemo').scrollIntoView({ behavior: 'smooth' });
            }
        } catch(e) { console.error(e); }
    }

    async eliminarDemo(id) {
        if(!confirm("¿Eliminar esta secuencia?")) return;
        try {
            await fetch(`${this.backendUrl}/api/demo/${id}`, { method: 'DELETE' });
            this.cargarDemos();
            this.mostrarNotificacion('Secuencia eliminada', 'info');
        } catch(e) { console.error(e); }
    }

    // ==================== UTILIDADES ====================

    mostrarNotificacion(msg, type) {
        if (window.controlManager) window.controlManager.mostrarNotificacion(msg, type);
        else alert(msg);
    }

    obtenerNombreMovimiento(clave) {
        return window.controlManager ? window.controlManager.obtenerNombreMovimiento(clave) : `Mov ${clave}`;
    }

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}

// Inicializar
window.demoManager = new DemoManager();