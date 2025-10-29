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
        
        document.addEventListener('DOMContentLoaded', () => {
            this.cargarDemos();
            this.inicializarSocketDemo();
        });
    }

    inicializarSocketDemo() {
        socketManager.on('demo_progreso', (data) => {
            this.mostrarProgresoEjecucion(data);
        });

        socketManager.on('demo_completada', (data) => {
            this.mostrarNotificacion('Demo completada: ' + data.total_movimientos + ' movimientos', 'success');
            this.ocultarProgreso();
        });

        socketManager.on('demo_error', (data) => {
            this.mostrarNotificacion('Error en demo: ' + data.error, 'danger');
            this.ocultarProgreso();
        });
    }

    mostrarProgresoEjecucion(data) {
        this.ocultarProgreso();
        
        this.progresoElement = document.createElement('div');
        this.progresoElement.className = 'alert alert-info position-fixed';
        this.progresoElement.style.cssText = 'bottom: 20px; right: 20px; z-index: 1050; min-width: 350px; background: rgba(0, 255, 255, 0.15); backdrop-filter: blur(10px); border: 1px solid var(--accent-cyan); color: white;';
        
        const porcentaje = Math.round((data.movimiento_actual / data.total_movimientos) * 100);
        
        this.progresoElement.innerHTML = '<div class="d-flex align-items-center"><i class="fas fa-play-circle me-2" style="color: var(--accent-cyan);"></i><div class="flex-grow-1"><div class="d-flex justify-content-between"><small>Ejecutando demo...</small><small>' + data.movimiento_actual + '/' + data.total_movimientos + '</small></div><div class="fw-bold">' + data.nombre_movimiento + ' (' + data.duracion + 's)</div><div class="progress mt-2" style="height: 6px; background: rgba(255,255,255,0.2);"><div class="progress-bar" style="background: var(--accent-cyan); width: ' + porcentaje + '%"></div></div><small class="text-muted">Progreso: ' + porcentaje + '%</small></div></div>';
        
        document.body.appendChild(this.progresoElement);
    }

    ocultarProgreso() {
        if (this.progresoElement && this.progresoElement.parentNode) {
            this.progresoElement.parentNode.removeChild(this.progresoElement);
            this.progresoElement = null;
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
            const demoCard = document.createElement('div');
            demoCard.className = 'demo-card mb-3';
            demoCard.innerHTML = '<div class="d-flex justify-content-between align-items-start"><div class="flex-grow-1"><h6 class="mb-1">' + this.escapeHtml(demo.nombre_secuencia) + '</h6>' + (demo.descripcion ? '<small class="text-muted">' + this.escapeHtml(demo.descripcion) + '</small>' : '') + '<div class="mt-2"><small class="text-muted"><i class="fas fa-list me-1"></i>' + JSON.parse(demo.movimientos).length + ' movimientos</small></div></div><div class="btn-group ms-3"><button class="btn btn-sm btn-ejecutar" onclick="demoManager.ejecutarDemo(' + demo.secuencia_id + ', \'' + this.escapeHtml(demo.nombre_secuencia) + '\')" title="Ejecutar"><i class="fas fa-play"></i></button><button class="btn btn-sm btn-editar" onclick="demoManager.editarDemo(' + demo.secuencia_id + ')" title="Editar"><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-eliminar" onclick="demoManager.eliminarDemo(' + demo.secuencia_id + ')" title="Eliminar"><i class="fas fa-trash"></i></button></div></div>';
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
        
        container.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-inbox fa-2x mb-3"></i><p>No hay secuencias DEMO creadas</p><button class="btn btn-sm btn-nueva-demo" style="background: var(--accent-cyan); color: white; border: none;"><i class="fas fa-plus me-1"></i>Crear Primera Demo</button></div>';
        
        document.querySelector('.btn-nueva-demo').addEventListener('click', () => {
            this.mostrarEditor();
        });
    }

    mostrarErrorDemos() {
        const container = document.getElementById('listaDemos');
        if (!container) return;
        
        container.innerHTML = '<div class="text-center text-danger py-3"><i class="fas fa-exclamation-triangle me-2"></i>Error cargando demos<br><button class="btn btn-sm mt-2" onclick="demoManager.cargarDemos()" style="background: var(--accent-pink); color: white;"><i class="fas fa-refresh me-1"></i>Reintentar</button></div>';
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
                movItem.innerHTML = '<div><span class="badge me-2" style="background: var(--accent-purple);">' + (index + 1) + '</span>' + mov.nombre + ' (' + mov.duracion + 's)</div><button class="btn btn-sm btn-eliminar-movimiento" style="background: #ff4444; color: white; border: none;"><i class="fas fa-times"></i></button>';
                
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
            contador.textContent = this.demoActual.movimientos.length + ' movimientos';
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
            
            const response = await fetch(this.backendUrl + '/api/ejecutar-demo/' + demoId, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            const result = await response.json();
            console.log('Respuesta ejecucion:', result);
            
            if (result.success) {
                this.mostrarNotificacion('Demo "' + nombre + '" iniciada - ' + result.total_movimientos + ' movimientos (' + result.duracion_total + 's total)', 'info');
            } else {
                this.mostrarNotificacion('Error: ' + (result.error || 'Error desconocido'), 'danger');
            }
            
        } catch (error) {
            console.error('Error ejecutando demo:', error);
            this.mostrarNotificacion('Error de conexion con el servidor', 'danger');
        }
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