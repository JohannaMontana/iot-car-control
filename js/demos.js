class DemoManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500'; 
        this.progresoElement = null;
        
        this.demoActual = {
            id: null,
            nombre: '',
            descripcion: '',
            movimientos: []
        };

        document.addEventListener('DOMContentLoaded', () => {
            this.cargarDemos();
        });
    }

    // Helper para obtener la velocidad del panel de control
    getVelocidadActual() {
        if (window.controlManager && typeof window.controlManager.obtenerVelocidadSeleccionada === 'function') {
            return window.controlManager.obtenerVelocidadSeleccionada();
        }
        return 180;
    }

    // ============================================================
    // 1. SECUENCIAS AUTOMÁTICAS (Botones Rápidos) - MANTENIDAS
    // ============================================================

    async ejecutarCircuitoCuadrado() {
        if(!confirm("¿Iniciar secuencia CUADRADO?\nEl carrito avanzará y girará 4 veces.")) return;

        const velRecta = this.getVelocidadActual();
        const velGiro = Math.max(velRecta, 200); 

        const movimientos = [
            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 1" },
            { status_clave: 8, duracion: 1, velocidad: velGiro,  nombre: "Giro 90°" },
            
            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 2" },
            { status_clave: 8, duracion: 1, velocidad: velGiro,  nombre: "Giro 90°" },
            
            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 3" },
            { status_clave: 8, duracion: 1, velocidad: velGiro,  nombre: "Giro 90°" },
            
            { status_clave: 1, duracion: 2, velocidad: velRecta, nombre: "Lado 4" },
            { status_clave: 8, duracion: 1, velocidad: velGiro,  nombre: "Giro Final" },
            
            { status_clave: 3, duracion: 1, velocidad: 0,        nombre: "Finalizar" }
        ];

        this.crearYEjecutarDemoTemporal("Circuito Cuadrado", movimientos);
    }

    async ejecutarZigZag() {
        if(!confirm("¿Iniciar secuencia ZIG-ZAG?")) return;

        const vel = this.getVelocidadActual();
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

    async crearYEjecutarDemoTemporal(nombre, movimientos) {
        try {
            this.mostrarNotificacion(`Generando ${nombre}...`, 'info');

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
                this.ejecutarDemo(dataCrear.demo_id, nombre);
                this.cargarDemos();
            } else {
                this.mostrarNotificacion('Error: ' + (dataCrear.error || 'Desconocido'), 'danger');
            }

        } catch (error) {
            console.error(error);
            this.mostrarNotificacion('Error de conexión', 'danger');
        }
    }

    // ============================================================
    // 2. EJECUCIÓN Y PROGRESO VISUAL - MANTENIDAS
    // ============================================================

    async ejecutarDemo(id, nombre) {
        this.inicializarUIProgreso(nombre, "?");
        
        try {
            const res = await fetch(`${this.backendUrl}/api/ejecutar-demo/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            
            if (data.success) {
                const contador = this.progresoElement.querySelector('.contador-movimientos');
                if(contador) contador.textContent = `0/${data.total_movimientos}`;
            } else {
                this.mostrarNotificacion('Error: ' + (data.error || 'Desconocido'), 'danger');
                this.ocultarProgreso();
            }
        } catch (error) {
            console.error(error);
            this.mostrarNotificacion('Error de conexión', 'danger');
            this.ocultarProgreso();
        }
    }

    actualizarProgresoDemo(data) {
        const { movimiento_actual, total_movimientos, nombre_movimiento } = data;
        
        if (!this.progresoElement) {
            this.inicializarUIProgreso("Demo en curso...", total_movimientos);
        }

        const porcentaje = (movimiento_actual / total_movimientos) * 100;

        const barra = this.progresoElement.querySelector('.progress-bar');
        const textoContador = this.progresoElement.querySelector('.contador-movimientos');
        const textoMovimiento = this.progresoElement.querySelector('.movimiento-actual');
        const textoPorcentaje = this.progresoElement.querySelector('.porcentaje-progreso');

        if (barra) barra.style.width = `${porcentaje}%`;
        if (textoContador) textoContador.textContent = `${movimiento_actual}/${total_movimientos}`;
        if (textoMovimiento) textoMovimiento.textContent = `Ejecutando: ${nombre_movimiento}`;
        if (textoPorcentaje) textoPorcentaje.textContent = `${Math.round(porcentaje)}%`;
    }

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
            setTimeout(() => this.ocultarProgreso(), 3000);
        }
        this.mostrarNotificacion(`✅ Secuencia "${data.nombre}" finalizada`, 'success');
    }

    inicializarUIProgreso(nombre, total) {
        this.ocultarProgreso();
        
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
    // 3. LISTA DE DEMOS COMPACTA (INTERFAZ ACTUALIZADA)
    // ============================================================

    async cargarDemos() {
        const container = document.getElementById('listaDemos');
        if (!container) return;

        try {
            const res = await fetch(`${this.backendUrl}/api/demos`);
            const data = await res.json();

            if (data.success && data.demos && data.demos.length > 0) {
                container.innerHTML = '';
                data.demos.forEach(demo => {
                    let movimientos = [];
                    try { 
                        movimientos = typeof demo.movimientos === 'string' 
                            ? JSON.parse(demo.movimientos) 
                            : demo.movimientos || []; 
                    } catch(e){ 
                        movimientos = [];
                    }
                    
                    const duracionTotal = movimientos.reduce((acc, curr) => acc + (curr.duracion || 0), 0);

                    const item = document.createElement('div');
                    item.className = 'demo-item-compact';
                    
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

    mostrarEditor() {
        const modal = new bootstrap.Modal(document.getElementById('demoEditorModal'));
        this.demoActual = { id: null, nombre: '', descripcion: '', movimientos: [] };
        document.getElementById('demoNombre').value = '';
        document.getElementById('demoDescripcion').value = '';
        this.actualizarListaMovimientos();
        modal.show();
    }

    agregarMovimiento(statusClave) {
        const duracionInput = document.getElementById('duracionMovimientoDemo');
        const duracion = parseInt(duracionInput?.value || 2);
        const velocidad = this.getVelocidadActual();

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
        if (index >= 0 && index < this.demoActual.movimientos.length) {
            this.demoActual.movimientos.splice(index, 1);
            this.actualizarListaMovimientos();
        }
    }

    actualizarListaMovimientos() {
        const container = document.getElementById('movimientosDemo');
        if (!container) return;
        
        if(this.demoActual.movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-2">Agrega movimientos...</div>';
            return;
        }

        container.innerHTML = '';
        this.demoActual.movimientos.forEach((mov, idx) => {
            const div = document.createElement('div');
            div.className = 'd-flex justify-content-between align-items-center border-bottom border-secondary py-1';
            div.innerHTML = `
                <span class="text-white small">
                    ${idx+1}. ${mov.nombre} (${mov.duracion}s @ ${mov.velocidad})
                </span>
                <button class="btn btn-sm text-danger p-0" onclick="demoManager.eliminarMovimiento(${idx})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(div);
        });
    }

    async guardarDemo() {
        const nombre = document.getElementById('demoNombre')?.value.trim();
        if (!nombre || this.demoActual.movimientos.length === 0) {
            this.mostrarNotificacion('Nombre y al menos un movimiento son requeridos', 'warning');
            return;
        }

        try {
            const url = this.demoActual.id 
                ? `${this.backendUrl}/api/demo/${this.demoActual.id}` 
                : `${this.backendUrl}/api/crear-demo`;
            const method = this.demoActual.id ? 'PUT' : 'POST';

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
                this.mostrarNotificacion('Demo guardada correctamente', 'success');
                bootstrap.Modal.getInstance(document.getElementById('demoEditorModal')).hide();
                this.cargarDemos();
            } else {
                this.mostrarNotificacion('Error al guardar: ' + (data.error || 'Desconocido'), 'danger');
            }
        } catch (e) {
            console.error("Error guardando demo:", e);
            this.mostrarNotificacion('Error de conexión al guardar', 'danger');
        }
    }

    async editarDemo(id) {
        try {
            const res = await fetch(`${this.backendUrl}/api/demos`);
            const data = await res.json();
            
            if (data.success && data.demos) {
                const demo = data.demos.find(d => d.secuencia_id === id);
                
                if(demo) {
                    let movimientos = [];
                    try {
                        movimientos = typeof demo.movimientos === 'string' 
                            ? JSON.parse(demo.movimientos) 
                            : demo.movimientos || [];
                    } catch(e) {
                        console.error("Error parseando movimientos:", e);
                    }

                    this.demoActual = {
                        id: demo.secuencia_id,
                        nombre: demo.nombre_secuencia,
                        descripcion: demo.descripcion || '',
                        movimientos: movimientos
                    };
                    
                    document.getElementById('demoNombre').value = this.demoActual.nombre;
                    document.getElementById('demoDescripcion').value = this.demoActual.descripcion;
                    this.actualizarListaMovimientos();
                    
                    const modal = new bootstrap.Modal(document.getElementById('demoEditorModal'));
                    modal.show();
                }
            }
        } catch(e) { 
            console.error("Error editando demo:", e);
            this.mostrarNotificacion('Error al cargar demo', 'danger');
        }
    }

    async eliminarDemo(id) {
        if(!confirm("¿Estás seguro de eliminar esta secuencia?")) return;
        
        try {
            const response = await fetch(`${this.backendUrl}/api/demo/${id}`, { 
                method: 'DELETE' 
            });
            const data = await response.json();
            
            if (data.success) {
                this.mostrarNotificacion('Secuencia eliminada', 'info');
                this.cargarDemos();
            } else {
                this.mostrarNotificacion('Error al eliminar', 'danger');
            }
        } catch (e) {
            console.error("Error eliminando demo:", e);
            this.mostrarNotificacion('Error de conexión', 'danger');
        }
    }

    // ==================== UTILIDADES ====================

    mostrarNotificacion(msg, type) {
        if (window.controlManager && typeof window.controlManager.mostrarNotificacion === 'function') {
            window.controlManager.mostrarNotificacion(msg, type);
        } else {
            alert(msg);
        }
    }

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

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.demoManager = new DemoManager();