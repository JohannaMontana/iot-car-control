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
        
        document.addEventListener('DOMContentLoaded', () => {
            this.cargarDemos();
            this.registrarManejadorWebSocket();
        });
    }

    registrarManejadorWebSocket() {
        // Registrar este manager para recibir mensajes WebSocket del controlManager
        if (window.controlManager) {
            // Sobrescribir el manejador de mensajes para incluir demos
            const manejadorOriginal = window.controlManager.manejarMensajeWebSocket;
            window.controlManager.manejarMensajeWebSocket = (mensaje) => {
                // Manejar mensajes de demo
                if (mensaje.tipo && mensaje.tipo.startsWith('demo_')) {
                    this.manejarMensajeDemo(mensaje);
                } else {
                    // Llamar al manejador original para otros mensajes
                    if (manejadorOriginal) {
                        manejadorOriginal.call(window.controlManager, mensaje);
                    }
                }
            };
        }
    }

    manejarMensajeDemo(mensaje) {
        console.log('Mensaje demo recibido:', mensaje);
        
        switch(mensaje.tipo) {
            case 'demo_progreso':
                this.actualizarProgresoDemo(mensaje);
                break;
                
            case 'demo_completada':
                this.demoCompletada(mensaje);
                break;
        }
    }

    actualizarProgresoDemo(mensaje) {
        if (!this.demoEnEjecucion) return;
        
        const { demo_id, movimiento_actual, total_movimientos, status_clave } = mensaje;
        
        // Actualizar el progreso en la interfaz
        if (this.progresoElement) {
            const porcentaje = (movimiento_actual / total_movimientos) * 100;
            const progresoBar = this.progresoElement.querySelector('.progress-bar');
            const contador = this.progresoElement.querySelector('.contador-movimientos');
            const porcentajeText = this.progresoElement.querySelector('.porcentaje-progreso');
            
            if (progresoBar) {
                progresoBar.style.width = `${porcentaje}%`;
            }
            if (contador) {
                contador.textContent = `${movimiento_actual}/${total_movimientos}`;
            }
            if (porcentajeText) {
                porcentajeText.textContent = `Progreso: ${Math.round(porcentaje)}%`;
            }
            
            // Actualizar el movimiento actual
            const movimientoActual = this.progresoElement.querySelector('.movimiento-actual');
            if (movimientoActual) {
                movimientoActual.textContent = `Movimiento: ${this.obtenerNombreMovimiento(status_clave)}`;
            }
        }
        
        console.log(`Progreso demo: ${movimiento_actual}/${total_movimientos} (${Math.round(porcentaje)}%)`);
    }

    demoCompletada(mensaje) {
        if (this.progresoElement) {
            const progresoBar = this.progresoElement.querySelector('.progress-bar');
            const estado = this.progresoElement.querySelector('.estado-demo');
            
            if (progresoBar) {
                progresoBar.style.width = '100%';
                progresoBar.style.background = '#00ff88';
            }
            if (estado) {
                estado.textContent = 'Demo completada';
            }
            
            // Cambiar a éxito después de 2 segundos
            setTimeout(() => {
                this.progresoElement.style.background = 'rgba(0, 255, 136, 0.15)';
                this.progresoElement.style.border = '1px solid #00ff88';
            }, 2000);
            
            // Ocultar después de 5 segundos
            setTimeout(() => {
                this.ocultarProgreso();
            }, 5000);
        }
        
        this.demoEnEjecucion = null;
        
        if (window.controlManager) {
            window.controlManager.mostrarNotificacion(`Demo "${mensaje.nombre_demo}" completada exitosamente`, 'success');
        }
    }

    async cargarDemos() {
        console.log('Cargando demos...');
        try {
            const response = await fetch(this.backendUrl + '/api/demos');
            
            if (!response.ok) {
                throw new Error('Error HTTP: ' + response.status);
            }
            
            const data = await response.json();
            console.log('Datos recibidos:', data);
            
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

    mostrarDemos(demos) {
        const container = document.getElementById('listaDemos');
        if (!container) {
            console.error('No se encontro el contenedor listaDemos');
            return;
        }
        
        container.innerHTML = '';
        
        demos.forEach(demo => {
            const movimientos = JSON.parse(demo.movimientos);
            const duracionTotal = movimientos.reduce((total, mov) => total + (mov.duracion || 3), 0);
            
            const demoCard = document.createElement('div');
            demoCard.className = 'demo-card mb-3';
            demoCard.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${this.escapeHtml(demo.nombre_secuencia)}</h6>
                        ${demo.descripcion ? `<small class="text-muted">${this.escapeHtml(demo.descripcion)}</small>` : ''}
                        <div class="mt-2">
                            <small class="text-muted">
                                <i class="fas fa-list me-1"></i>
                                ${movimientos.length} movimientos
                            </small>
                            <small class="text-muted ms-2">
                                <i class="fas fa-clock me-1"></i>
                                ${duracionTotal}s total
                            </small>
                        </div>
                    </div>
                    <div class="btn-group ms-3">
                        <button class="btn btn-sm btn-ejecutar" onclick="demoManager.ejecutarDemo(${demo.secuencia_id}, '${this.escapeHtml(demo.nombre_secuencia)}')" title="Ejecutar">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="btn btn-sm btn-editar" onclick="demoManager.editarDemo(${demo.secuencia_id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-eliminar" onclick="demoManager.eliminarDemo(${demo.secuencia_id})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(demoCard);
        });
        
        this.aplicarEstilosBotones();
    }

    aplicarEstilosBotones() {
        document.querySelectorAll('.btn-ejecutar').forEach(btn => {
            btn.style.background = 'var(--accent-pink)';
            btn.style.color = 'white';
            btn.style.border = 'none';
        });
        
        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.style.background = 'var(--accent-cyan)';
            btn.style.color = 'white';
            btn.style.border = 'none';
        });
        
        document.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.style.background = '#ff4444';
            btn.style.color = 'white';
            btn.style.border = 'none';
        });
    }

    mostrarSinDemos() {
        const container = document.getElementById('listaDemos');
        if (!container) return;
        
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-inbox fa-2x mb-3"></i>
                <p>No hay secuencias DEMO creadas</p>
                <button class="btn btn-sm btn-nueva-demo" style="background: var(--accent-cyan); color: white; border: none;">
                    <i class="fas fa-plus me-1"></i>Crear Primera Demo
                </button>
            </div>
        `;
        
        document.querySelector('.btn-nueva-demo').addEventListener('click', () => {
            this.mostrarEditor();
        });
    }

    mostrarErrorDemos() {
        const container = document.getElementById('listaDemos');
        if (!container) return;
        
        container.innerHTML = `
            <div class="text-center text-danger py-3">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error cargando demos<br>
                <button class="btn btn-sm mt-2" onclick="demoManager.cargarDemos()" style="background: var(--accent-pink); color: white;">
                    <i class="fas fa-refresh me-1"></i>Reintentar
                </button>
            </div>
        `;
    }

    mostrarEditor(demo = null) {
        this.demoActual = demo ? { ...demo } : { 
            id: null, 
            nombre: '', 
            descripcion: '', 
            movimientos: [] 
        };
        
        const editor = document.getElementById('editorDemo');
        if (editor) {
            editor.style.display = 'block';
            document.getElementById('demoNombre').value = this.demoActual.nombre || '';
            document.getElementById('demoDescripcion').value = this.demoActual.descripcion || '';
            this.actualizarListaMovimientos();
        }
    }

    ocultarEditor() {
        const editor = document.getElementById('editorDemo');
        if (editor) {
            editor.style.display = 'none';
        }
    }

    agregarMovimiento(statusClave) {
        const duracionInput = document.getElementById('duracionMovimientoDemo');
        const movimiento = {
            status_clave: statusClave,
            duracion: parseInt(duracionInput ? duracionInput.value : 3) || 3,
            nombre: this.obtenerNombreMovimiento(statusClave),
            timestamp: new Date().toISOString()
        };
        
        this.demoActual.movimientos.push(movimiento);
        this.actualizarListaMovimientos();
        this.mostrarNotificacion('Movimiento "' + movimiento.nombre + '" agregado', 'success');
    }

    obtenerNombreMovimiento(statusClave) {
        const movimientos = {
            1: 'Adelante', 2: 'Atras', 3: 'Detener',
            4: 'Vuelta Adelante Derecha', 5: 'Vuelta Adelante Izquierda',
            6: 'Vuelta Atras Derecha', 7: 'Vuelta Atras Izquierda',
            8: 'Giro 90 Derecha', 9: 'Giro 90 Izquierda',
            10: 'Giro 360 Derecha', 11: 'Giro 360 Izquierda'
        };
        return movimientos[statusClave] || 'Movimiento ' + statusClave;
    }

    actualizarListaMovimientos() {
        const container = document.getElementById('movimientosDemo');
        if (!container) return;
        
        if (this.demoActual.movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-3">Agrega movimientos desde los botones de abajo</div>';
        } else {
            container.innerHTML = '';
            this.demoActual.movimientos.forEach((mov, index) => {
                const movItem = document.createElement('div');
                movItem.className = 'd-flex justify-content-between align-items-center border-bottom py-2';
                movItem.innerHTML = `
                    <div>
                        <span class="badge me-2" style="background: var(--accent-purple);">${index + 1}</span>
                        ${mov.nombre} (${mov.duracion}s)
                    </div>
                    <button class="btn btn-sm btn-eliminar-movimiento" style="background: #ff4444; color: white; border: none;">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                
                movItem.querySelector('.btn-eliminar-movimiento').addEventListener('click', () => {
                    this.eliminarMovimiento(index);
                });
                
                container.appendChild(movItem);
            });
        }
        
        this.actualizarContadorMovimientos();
    }

    eliminarMovimiento(index) {
        this.demoActual.movimientos.splice(index, 1);
        this.actualizarListaMovimientos();
        this.mostrarNotificacion('Movimiento eliminado', 'warning');
    }

    actualizarContadorMovimientos() {
        const contador = document.getElementById('contadorMovimientos');
        if (contador) {
            const duracionTotal = this.demoActual.movimientos.reduce((total, mov) => total + (mov.duracion || 3), 0);
            contador.textContent = `${this.demoActual.movimientos.length} movimientos (${duracionTotal}s total)`;
        }
    }

    async guardarDemo() {
        const nombre = document.getElementById('demoNombre').value.trim();
        
        if (!nombre) {
            this.mostrarNotificacion('El nombre de la demo es requerido', 'danger');
            return;
        }
        
        if (this.demoActual.movimientos.length === 0) {
            this.mostrarNotificacion('Agrega al menos un movimiento a la demo', 'danger');
            return;
        }
        
        try {
            const method = this.demoActual.id ? 'PUT' : 'POST';
            const url = this.demoActual.id ? 
                this.backendUrl + '/api/demo/' + this.demoActual.id : 
                this.backendUrl + '/api/crear-demo';
            
            console.log('Enviando demo:', {
                method: method,
                url: url,
                data: {
                    nombre: nombre,
                    descripcion: document.getElementById('demoDescripcion').value.trim(),
                    movimientos: this.demoActual.movimientos
                }
            });
            
            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    nombre: nombre,
                    descripcion: document.getElementById('demoDescripcion').value.trim(),
                    movimientos: this.demoActual.movimientos
                })
            });
            
            const result = await response.json();
            console.log('Respuesta del servidor:', result);
            
            if (result.success) {
                this.mostrarNotificacion(result.message || 'Demo guardada correctamente', 'success');
                this.ocultarEditor();
                this.cargarDemos();
            } else {
                this.mostrarNotificacion('Error: ' + (result.error || 'Error desconocido'), 'danger');
            }
            
        } catch (error) {
            console.error('Error guardando demo:', error);
            this.mostrarNotificacion('Error de conexion con el servidor', 'danger');
        }
    }

    async ejecutarDemo(demoId, nombre) {
        try {
            console.log('Ejecutando demo:', demoId, nombre);
            
            // Mostrar progreso inmediatamente
            const response = await fetch(this.backendUrl + '/api/demos');
            const dataDemos = await response.json();
            
            if (dataDemos.success && dataDemos.demos) {
                const demo = dataDemos.demos.find(d => d.secuencia_id === demoId);
                if (demo) {
                    const movimientos = JSON.parse(demo.movimientos);
                    const totalMovimientos = movimientos.length;
                    
                    this.mostrarProgresoWebSocket(nombre, totalMovimientos);
                    this.demoEnEjecucion = { id: demoId, nombre: nombre };
                }
            }
            
            // Ejecutar la demo
            const responseEjecutar = await fetch(this.backendUrl + '/api/ejecutar-demo/' + demoId, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            const result = await responseEjecutar.json();
            console.log('Respuesta ejecucion:', result);
            
            if (result.success) {
                this.mostrarNotificacion('Demo "' + nombre + '" iniciada - ' + result.total_movimientos + ' movimientos (' + result.duracion_total + 's total)', 'info');
                
                // Si no hay WebSocket, usar progreso simple como fallback
                if (!window.controlManager || !window.controlManager.estadoApp.websocketConectado) {
                    this.mostrarProgresoSimple(nombre, result.total_movimientos);
                }
            } else {
                this.mostrarNotificacion('Error: ' + (result.error || 'Error desconocido'), 'danger');
                this.ocultarProgreso();
            }
            
        } catch (error) {
            console.error('Error ejecutando demo:', error);
            this.mostrarNotificacion('Error de conexion con el servidor', 'danger');
            this.ocultarProgreso();
        }
    }

    mostrarProgresoWebSocket(nombre, totalMovimientos) {
        this.ocultarProgreso();
        
        this.progresoElement = document.createElement('div');
        this.progresoElement.className = 'alert alert-info position-fixed';
        this.progresoElement.style.cssText = 'bottom: 20px; right: 20px; z-index: 1050; min-width: 400px; background: rgba(0, 255, 255, 0.15); backdrop-filter: blur(10px); border: 1px solid var(--accent-cyan); color: white;';
        
        this.progresoElement.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-play-circle me-2" style="color: var(--accent-cyan);"></i>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="estado-demo">Ejecutando demo...</small>
                        <small class="contador-movimientos">0/${totalMovimientos}</small>
                    </div>
                    <div class="fw-bold">${nombre}</div>
                    <div class="movimiento-actual small text-muted mb-1">Preparando...</div>
                    <div class="progress mt-1" style="height: 6px; background: rgba(255,255,255,0.2);">
                        <div class="progress-bar" style="background: var(--accent-cyan); width: 0%; transition: width 0.3s ease;"></div>
                    </div>
                    <small class="porcentaje-progreso text-muted">Progreso: 0%</small>
                </div>
                <button type="button" class="btn-close btn-close-white ms-2" onclick="demoManager.ocultarProgreso()"></button>
            </div>
        `;
        
        document.body.appendChild(this.progresoElement);
    }

    mostrarProgresoSimple(nombre, totalMovimientos) {
        this.mostrarProgresoWebSocket(nombre, totalMovimientos);
        
        // Simular progreso (fallback cuando no hay WebSocket)
        let progreso = 0;
        const intervalo = setInterval(() => {
            progreso += 100 / (totalMovimientos * 2);
            if (progreso >= 100) {
                progreso = 100;
                clearInterval(intervalo);
                
                setTimeout(() => {
                    this.ocultarProgreso();
                }, 2000);
            }
            
            if (this.progresoElement) {
                const progresoBar = this.progresoElement.querySelector('.progress-bar');
                const porcentajeText = this.progresoElement.querySelector('.porcentaje-progreso');
                
                if (progresoBar) {
                    progresoBar.style.width = `${progreso}%`;
                }
                if (porcentajeText) {
                    porcentajeText.textContent = `Progreso: ${Math.round(progreso)}%`;
                }
            }
        }, 500);
    }

    ocultarProgreso() {
        if (this.progresoElement && this.progresoElement.parentNode) {
            this.progresoElement.parentNode.removeChild(this.progresoElement);
            this.progresoElement = null;
        }
        this.demoEnEjecucion = null;
    }

    async editarDemo(demoId) {
        try {
            console.log('Editando demo:', demoId);
            const response = await fetch(this.backendUrl + '/api/demos');
            const data = await response.json();
            
            if (data.success && data.demos) {
                const demo = data.demos.find(d => d.secuencia_id === demoId);
                if (demo) {
                    this.demoActual.id = demo.secuencia_id;
                    this.demoActual.nombre = demo.nombre_secuencia;
                    this.demoActual.descripcion = demo.descripcion || '';
                    this.demoActual.movimientos = JSON.parse(demo.movimientos);
                    
                    this.mostrarEditor(this.demoActual);
                    this.mostrarNotificacion('Editando demo "' + demo.nombre_secuencia + '"', 'info');
                }
            }
        } catch (error) {
            console.error('Error cargando demo para editar:', error);
            this.mostrarNotificacion('Error cargando demo', 'danger');
        }
    }

    async eliminarDemo(demoId) {
        if (!confirm('Estas seguro de que quieres eliminar esta demo?')) {
            return;
        }
        
        try {
            console.log('Eliminando demo:', demoId);
            const response = await fetch(this.backendUrl + '/api/demo/' + demoId, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            const result = await response.json();
            console.log('Respuesta eliminacion:', result);
            
            if (result.success) {
                this.mostrarNotificacion(result.message || 'Demo eliminada correctamente', 'success');
                this.cargarDemos();
            } else {
                this.mostrarNotificacion('Error: ' + (result.error || 'Error desconocido'), 'danger');
            }
            
        } catch (error) {
            console.error('Error eliminando demo:', error);
            this.mostrarNotificacion('Error de conexion con el servidor', 'danger');
        }
    }

    mostrarNotificacion(mensaje, tipo) {
        if (window.controlManager && typeof window.controlManager.mostrarNotificacion === 'function') {
            window.controlManager.mostrarNotificacion(mensaje, tipo);
            return;
        }
        
        const toast = document.createElement('div');
        const bgColor = tipo === 'success' ? '#00ff88' : 
                       tipo === 'warning' ? '#ff9500' : 
                       tipo === 'danger' ? '#ff4444' : '#8a2be2';
        
        toast.className = 'alert alert-dismissible fade show position-fixed';
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 1050; min-width: 300px; background: ' + bgColor + '15; backdrop-filter: blur(10px); border: 1px solid ' + bgColor + '30; color: white;';
        toast.innerHTML = '<div class="d-flex align-items-center"><i class="fas fa-' + (tipo === 'success' ? 'check' : tipo === 'warning' ? 'exclamation-triangle' : 'info') + '-circle me-2" style="color: ' + bgColor + ';"></i><div>' + mensaje + '</div></div><button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>';
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 4000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.demoManager = new DemoManager();