class DemoManager {
    constructor() {
        this.demoActual = {
            id: null,
            nombre: '',
            descripcion: '',
            movimientos: []
        };
        this.backendUrl = 'http://54.147.92.50:5500';
        this.progresoElement = null;
        this.demoEnEjecucion = null;
        
        // Inicializar al cargar
        document.addEventListener('DOMContentLoaded', () => {
            this.cargarDemos();
        });
    }

    // ==================== MANEJO DE EVENTOS (Llamados desde ControlManager) ====================

    /**
     * Esta función es llamada por ControlManager cuando llega un evento 'demo_progreso' por Socket.IO
     */
    actualizarProgresoDemo(data) {
        // data viene del backend: { demo_id, movimiento_actual, total_movimientos, nombre_movimiento, duracion }
        
        if (!this.progresoElement) {
            // Si por alguna razón no está la barra (ej. recarga de página), intentamos mostrarla
            // pero necesitamos saber el nombre de la demo.
            return; 
        }
        
        const { movimiento_actual, total_movimientos, nombre_movimiento } = data;
        const porcentaje = (movimiento_actual / total_movimientos) * 100;

        // Actualizar elementos del DOM
        const progresoBar = this.progresoElement.querySelector('.progress-bar');
        const contador = this.progresoElement.querySelector('.contador-movimientos');
        const porcentajeText = this.progresoElement.querySelector('.porcentaje-progreso');
        const textoMovimiento = this.progresoElement.querySelector('.movimiento-actual');
        
        if (progresoBar) progresoBar.style.width = `${porcentaje}%`;
        if (contador) contador.textContent = `${movimiento_actual}/${total_movimientos}`;
        if (porcentajeText) porcentajeText.textContent = `Progreso: ${Math.round(porcentaje)}%`;
        if (textoMovimiento) textoMovimiento.textContent = `Ejecutando: ${nombre_movimiento}`;
        
        console.log(`🔄 Demo Progreso: ${movimiento_actual}/${total_movimientos} - ${nombre_movimiento}`);
    }

    /**
     * Llamada por ControlManager cuando llega 'demo_completada'
     */
    demoCompletada(data) {
        console.log('✅ Demo completada:', data.nombre);
        
        if (this.progresoElement) {
            const progresoBar = this.progresoElement.querySelector('.progress-bar');
            const estado = this.progresoElement.querySelector('.estado-demo');
            const textoMovimiento = this.progresoElement.querySelector('.movimiento-actual');
            
            if (progresoBar) {
                progresoBar.style.width = '100%';
                progresoBar.style.background = '#00ff88';
            }
            if (estado) estado.textContent = '¡Completada!';
            if (textoMovimiento) textoMovimiento.textContent = 'Finalizado exitosamente';
            
            // Efecto visual de éxito
            this.progresoElement.style.borderColor = '#00ff88';
            this.progresoElement.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.3)';
            
            // Ocultar después de unos segundos
            setTimeout(() => {
                this.ocultarProgreso();
            }, 4000);
        }
        
        this.demoEnEjecucion = null;
    }

    // ==================== API & LÓGICA DE DEMOS ====================

    async cargarDemos() {
        console.log('📥 Cargando lista de demos...');
        try {
            const response = await fetch(this.backendUrl + '/api/demos');
            if (!response.ok) throw new Error('Error HTTP: ' + response.status);
            
            const data = await response.json();
            
            if (data.success && data.demos && data.demos.length > 0) {
                this.mostrarDemos(data.demos);
            } else {
                this.mostrarSinDemos();
            }
        } catch (error) {
            console.error('Error cargando demos:', error);
            this.mostrarErrorDemos();
        }
    }

    async ejecutarDemo(demoId, nombre) {
        try {
            console.log(`▶️ Solicitando ejecución de demo: ${nombre}`);
            
            // 1. Buscar información de la demo para inicializar la barra (UX inmediata)
            // Hacemos esto antes del fetch para que el usuario vea respuesta instantánea
            const demoCard = document.querySelector(`button[onclick*="${demoId}"]`)?.closest('.demo-card');
            let totalPasosEstimados = 0;
            
            if (demoCard) {
                const textoPasos = demoCard.querySelector('.fa-list')?.parentNode?.textContent;
                if (textoPasos) totalPasosEstimados = parseInt(textoPasos) || 5;
            }

            // 2. Mostrar la barra de progreso en estado inicial
            this.inicializarUIProgreso(nombre, totalPasosEstimados || '?');
            this.demoEnEjecucion = { id: demoId, nombre: nombre };

            // 3. Enviar orden al Backend
            const response = await fetch(this.backendUrl + '/api/ejecutar-demo/' + demoId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Actualizar total real si lo tenemos
                const contador = this.progresoElement.querySelector('.contador-movimientos');
                if (contador) contador.textContent = `0/${result.total_movimientos}`;
                
                // NOTA: No usamos "progreso simple" (fallback) si Socket.IO está conectado,
                // confiamos en los eventos reales que enviará el servidor.
                const socketConectado = window.controlManager && window.controlManager.estadoApp.conectado;
                
                if (!socketConectado) {
                    // Solo si NO hay socket, usamos la simulación visual
                    console.warn('⚠️ Socket desconectado, usando progreso simulado');
                    this.simularProgresoVisual(result.total_movimientos);
                } else {
                    console.log('🔌 Esperando eventos de progreso por Socket.IO...');
                }

            } else {
                this.mostrarNotificacion('Error: ' + (result.error || 'Desconocido'), 'danger');
                this.ocultarProgreso();
            }
            
        } catch (error) {
            console.error('Error ejecutando demo:', error);
            this.mostrarNotificacion('Error de conexión', 'danger');
            this.ocultarProgreso();
        }
    }

    // ==================== UI COMPONENTS ====================

    inicializarUIProgreso(nombre, totalMovimientos) {
        this.ocultarProgreso(); // Limpiar anterior si existe
        
        this.progresoElement = document.createElement('div');
        this.progresoElement.className = 'alert alert-info position-fixed shadow-lg';
        this.progresoElement.style.cssText = `
            bottom: 20px; right: 20px; z-index: 1050; min-width: 350px; 
            background: rgba(13, 202, 240, 0.1); backdrop-filter: blur(10px); 
            border: 1px solid var(--accent-cyan); color: white;
            animation: slideInUp 0.3s ease-out;
        `;
        
        this.progresoElement.innerHTML = `
            <div class="d-flex align-items-center mb-2">
                <div class="spinner-border spinner-border-sm text-info me-2" role="status"></div>
                <div class="fw-bold flex-grow-1">${nombre}</div>
                <small class="contador-movimientos text-muted">0/${totalMovimientos}</small>
                <button type="button" class="btn-close btn-close-white ms-2" onclick="demoManager.ocultarProgreso()"></button>
            </div>
            <div class="d-flex justify-content-between small mb-1">
                <span class="estado-demo text-info">Ejecutando...</span>
                <span class="porcentaje-progreso text-muted">0%</span>
            </div>
            <div class="movimiento-actual small text-white mb-2" style="font-style: italic; opacity: 0.8;">Iniciando...</div>
            <div class="progress" style="height: 6px; background: rgba(255,255,255,0.1);">
                <div class="progress-bar bg-info" style="width: 0%; transition: width 0.5s ease;"></div>
            </div>
        `;
        
        document.body.appendChild(this.progresoElement);
    }

    simularProgresoVisual(total) {
        // Fallback simple por si el socket falla
        let paso = 0;
        const interval = setInterval(() => {
            paso++;
            const fakeData = {
                movimiento_actual: paso,
                total_movimientos: total,
                nombre_movimiento: "Simulando paso " + paso
            };
            this.actualizarProgresoDemo(fakeData);
            if (paso >= total) clearInterval(interval);
        }, 3000); // Asumiendo 3s por paso promedio
    }

    ocultarProgreso() {
        if (this.progresoElement) {
            // Animación de salida
            this.progresoElement.style.opacity = '0';
            this.progresoElement.style.transform = 'translateY(20px)';
            this.progresoElement.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                if (this.progresoElement && this.progresoElement.parentNode) {
                    this.progresoElement.parentNode.removeChild(this.progresoElement);
                }
                this.progresoElement = null;
            }, 300);
        }
        this.demoEnEjecucion = null;
    }

    mostrarDemos(demos) {
        const container = document.getElementById('listaDemos');
        if (!container) return;
        
        container.innerHTML = '';
        
        demos.forEach(demo => {
            let movimientos = [];
            try { movimientos = JSON.parse(demo.movimientos); } catch(e) {}
            
            const duracionTotal = movimientos.reduce((t, m) => t + (m.duracion || 3), 0);
            
            const div = document.createElement('div');
            div.className = 'demo-card mb-3 p-3 border rounded bg-dark bg-opacity-25';
            div.style.borderColor = 'rgba(255,255,255,0.1)';
            
            div.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1 text-white">${this.escapeHtml(demo.nombre_secuencia)}</h6>
                        <small class="text-muted d-block mb-2">${this.escapeHtml(demo.descripcion || 'Sin descripción')}</small>
                        
                        <div class="d-flex gap-3">
                            <small class="text-info"><i class="fas fa-layer-group me-1"></i>${movimientos.length} pasos</small>
                            <small class="text-warning"><i class="fas fa-stopwatch me-1"></i>~${duracionTotal}s</small>
                        </div>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="demoManager.ejecutarDemo(${demo.secuencia_id}, '${this.escapeHtml(demo.nombre_secuencia)}')" title="Ejecutar">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="demoManager.editarDemo(${demo.secuencia_id})" title="Editar">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="demoManager.eliminarDemo(${demo.secuencia_id})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    }

    // ==================== GESTIÓN EDITOR ====================

    mostrarEditor(demo = null) {
        this.demoActual = demo ? { ...demo } : { id: null, nombre: '', descripcion: '', movimientos: [] };
        
        const editor = document.getElementById('editorDemo');
        if (editor) {
            editor.style.display = 'block';
            document.getElementById('demoNombre').value = this.demoActual.nombre || '';
            document.getElementById('demoDescripcion').value = this.demoActual.descripcion || '';
            this.actualizarListaMovimientos();
            // Scroll suave al editor
            editor.scrollIntoView({ behavior: 'smooth' });
        }
    }

    ocultarEditor() {
        const editor = document.getElementById('editorDemo');
        if (editor) editor.style.display = 'none';
    }

    agregarMovimiento(statusClave) {
        const duracionInput = document.getElementById('duracionMovimientoDemo');
        const movimiento = {
            status_clave: statusClave,
            duracion: parseInt(duracionInput?.value || 3),
            nombre: this.obtenerNombreMovimiento(statusClave)
        };
        
        this.demoActual.movimientos.push(movimiento);
        this.actualizarListaMovimientos();
        this.mostrarNotificacion(`+ ${movimiento.nombre}`, 'success');
    }

    eliminarMovimiento(index) {
        this.demoActual.movimientos.splice(index, 1);
        this.actualizarListaMovimientos();
    }

    actualizarListaMovimientos() {
        const container = document.getElementById('movimientosDemo');
        const contador = document.getElementById('contadorMovimientos');
        if (!container) return;

        if (this.demoActual.movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4 border rounded border-secondary border-opacity-25">Agrega movimientos usando los controles abajo 👇</div>';
            if (contador) contador.textContent = '0 movimientos';
            return;
        }

        container.innerHTML = '';
        let tiempoTotal = 0;

        this.demoActual.movimientos.forEach((mov, index) => {
            tiempoTotal += mov.duracion;
            const div = document.createElement('div');
            div.className = 'd-flex justify-content-between align-items-center p-2 mb-2 rounded bg-secondary bg-opacity-10';
            div.innerHTML = `
                <div class="d-flex align-items-center">
                    <span class="badge bg-secondary me-2">${index + 1}</span>
                    <div>
                        <div class="fw-bold text-white small">${mov.nombre}</div>
                        <small class="text-muted">${mov.duracion} segundos</small>
                    </div>
                </div>
                <button class="btn btn-sm btn-link text-danger p-0" onclick="demoManager.eliminarMovimiento(${index})">
                    <i class="fas fa-times-circle"></i>
                </button>
            `;
            container.appendChild(div);
        });

        if (contador) contador.textContent = `${this.demoActual.movimientos.length} movs (~${tiempoTotal}s)`;
    }

    async guardarDemo() {
        const nombre = document.getElementById('demoNombre').value.trim();
        if (!nombre || this.demoActual.movimientos.length === 0) {
            this.mostrarNotificacion('Nombre y movimientos requeridos', 'warning');
            return;
        }

        try {
            const isEdit = !!this.demoActual.id;
            const url = isEdit 
                ? `${this.backendUrl}/api/demo/${this.demoActual.id}`
                : `${this.backendUrl}/api/crear-demo`;
            
            const body = {
                nombre: nombre,
                descripcion: document.getElementById('demoDescripcion').value.trim(),
                movimientos: this.demoActual.movimientos
            };

            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            const data = await res.json();
            
            if (data.success) {
                this.mostrarNotificacion('Demo guardada correctamente', 'success');
                this.ocultarEditor();
                this.cargarDemos();
            } else {
                this.mostrarNotificacion(data.error || 'Error guardando', 'danger');
            }
        } catch (e) {
            console.error(e);
            this.mostrarNotificacion('Error de conexión', 'danger');
        }
    }

    async eliminarDemo(id) {
        if(!confirm('¿Eliminar esta secuencia?')) return;
        try {
            await fetch(`${this.backendUrl}/api/demo/${id}`, { method: 'DELETE' });
            this.cargarDemos();
            this.mostrarNotificacion('Demo eliminada', 'info');
        } catch(e) {
            console.error(e);
        }
    }

    // ==================== EDITAR (Cargar datos) ====================
    async editarDemo(id) {
        try {
            // Reutilizamos la lista cargada o hacemos fetch individual
            const res = await fetch(this.backendUrl + '/api/demos');
            const data = await res.json();
            const demo = data.demos.find(d => d.secuencia_id === id);
            
            if (demo) {
                this.demoActual = {
                    id: demo.secuencia_id,
                    nombre: demo.nombre_secuencia,
                    descripcion: demo.descripcion,
                    movimientos: JSON.parse(demo.movimientos)
                };
                this.mostrarEditor(this.demoActual);
            }
        } catch(e) {
            console.error(e);
        }
    }

    // ==================== UTILIDADES ====================
    
    mostrarSinDemos() {
        const c = document.getElementById('listaDemos');
        if(c) c.innerHTML = '<div class="text-center text-muted py-5">No hay demos creadas aún.</div>';
    }

    mostrarErrorDemos() {
        const c = document.getElementById('listaDemos');
        if(c) c.innerHTML = '<div class="text-center text-danger py-5">Error cargando demos.</div>';
    }

    mostrarNotificacion(msg, type) {
        if (window.controlManager?.mostrarNotificacion) {
            window.controlManager.mostrarNotificacion(msg, type);
        } else {
            alert(msg); // Fallback
        }
    }

    obtenerNombreMovimiento(clave) {
        return window.controlManager?.obtenerNombreMovimiento(clave) || `Movimiento ${clave}`;
    }

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}

// Instancia Global
window.demoManager = new DemoManager();