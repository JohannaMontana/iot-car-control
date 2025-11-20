class ControlManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500';
        this.estadoApp = {
            conectado: true,
            websocketConectado: false,
            ultimoMovimiento: null,
            alertas: [],
            movimientos: [],
            estadoArduino: null
        };
        
        // WebSocket
        this.websocket = null;
        this.reconectarTimeout = null;
        
        this.inicializarApp();
    }

    inicializarApp() {
        this.inicializarWebSocket();
        this.actualizarEstadoConexion(true);
        this.actualizarEstado();
        
        // Cargar demos si existe demoManager
        if (window.demoManager && typeof window.demoManager.cargarDemos === 'function') {
            window.demoManager.cargarDemos();
        }
        
        console.log('ControlManager inicializado (HTTP + WebSockets)');
    }

    inicializarWebSocket() {
        try {
            const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocolo}//54.147.92.50:5500/websocket`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket conectado');
                this.estadoApp.websocketConectado = true;
                this.actualizarEstadoConexion(true);
                
                // Identificarse como navegador
                this.identificarComoNavegador();
                
                // Configurar reconexión automática
                this.iniciarReconexionAutomatica();
            };
            
            this.websocket.onmessage = (event) => {
                this.manejarMensajeWebSocket(JSON.parse(event.data));
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket desconectado');
                this.estadoApp.websocketConectado = false;
                this.actualizarEstadoConexion(false);
                this.reconectar();
            };
            
            this.websocket.onerror = (error) => {
                console.error('Error WebSocket:', error);
                this.estadoApp.websocketConectado = false;
                this.actualizarEstadoConexion(false);
            };
            
        } catch (error) {
            console.error('Error inicializando WebSocket:', error);
            this.estadoApp.websocketConectado = false;
        }
    }

    identificarComoNavegador() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                tipo: 'identificacion',
                cliente: 'navegador',
                userAgent: navigator.userAgent
            }));
        }
    }

    manejarMensajeWebSocket(mensaje) {
        console.log('Mensaje WebSocket recibido:', mensaje);
        
        switch(mensaje.tipo) {
            case 'movimiento_ejecutado':
                this.mostrarNotificacion(`Movimiento ${mensaje.status_clave} ejecutado`, 'success');
                this.actualizarEstado(); // Actualizar estado desde servidor
                break;
                
            case 'estado_arduino':
                this.estadoApp.estadoArduino = mensaje.data;
                this.actualizarEstadoArduino();
                break;
                
            case 'obstaculo_detectado':
                this.mostrarNotificacion(`Obstáculo detectado a ${mensaje.data.distancia}cm`, 'warning');
                this.agregarAlerta(mensaje);
                break;
                
            case 'movimiento_solicitado':
                console.log('Movimiento solicitado via WebSocket:', mensaje.status_clave);
                break;
                
            case 'movimiento_detenido':
                this.mostrarNotificacion('Movimiento detenido', 'info');
                break;
                
            case 'demo_progreso':
                if (window.demoManager && window.demoManager.actualizarProgresoDemo) {
                    window.demoManager.actualizarProgresoDemo(mensaje);
                }
                break;
                
            case 'demo_completada':
                this.mostrarNotificacion(`Demo "${mensaje.nombre_demo}" completada`, 'success');
                break;
                
            case 'identificacion_confirmada':
                console.log('Identificación confirmada:', mensaje.mensaje);
                break;
        }
    }

    async moverCarrito(statusClave) {
        const duracion = document.getElementById('duracionMovimiento').value;
        const nombreMovimiento = this.obtenerNombreMovimiento(statusClave);
        
        // Intentar WebSocket primero
        if (this.estadoApp.websocketConectado && this.websocket) {
            try {
                this.websocket.send(JSON.stringify({
                    tipo: 'movimiento',
                    status_clave: statusClave,
                    duracion: parseInt(duracion),
                    timestamp: new Date().toISOString()
                }));
                
                this.mostrarNotificacion(`${nombreMovimiento} enviado via WebSocket`, 'success');
                return;
                
            } catch (error) {
                console.error('Error enviando via WebSocket, usando HTTP fallback:', error);
                this.estadoApp.websocketConectado = false;
            }
        }
        
        // Fallback a HTTP
        try {
            const response = await fetch(`${this.backendUrl}/api/movimiento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status_clave: statusClave,
                    duracion_segundos: parseInt(duracion)
                })
            });
            
            const result = await response.json();
            if (result.success) {
                this.mostrarNotificacion(`${nombreMovimiento} ejecutado`, 'success');
                setTimeout(() => this.actualizarEstado(), 1000);
            } else {
                this.mostrarNotificacion('Error: ' + result.error, 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error de conexión con el servidor', 'danger');
            this.actualizarEstadoConexion(false);
        }
    }

    obtenerNombreMovimiento(statusClave) {
        const movimientos = {
            1: 'Adelante', 2: 'Atrás', 3: 'Detener',
            4: 'Vuelta Adelante Derecha', 5: 'Vuelta Adelante Izquierda',
            6: 'Vuelta Atrás Derecha', 7: 'Vuelta Atrás Izquierda',
            8: 'Giro 90° Derecha', 9: 'Giro 90° Izquierda',
            10: 'Giro 360° Derecha', 11: 'Giro 360° Izquierda'
        };
        return movimientos[statusClave] || 'Movimiento ' + statusClave;
    }

    async detenerCarrito() {
        // Intentar WebSocket primero
        if (this.estadoApp.websocketConectado && this.websocket) {
            try {
                this.websocket.send(JSON.stringify({
                    tipo: 'movimiento',
                    status_clave: 3,
                    timestamp: new Date().toISOString()
                }));
                
                this.mostrarNotificacion('Comando detener enviado via WebSocket', 'info');
                return;
                
            } catch (error) {
                console.error('Error enviando detener via WebSocket:', error);
                this.estadoApp.websocketConectado = false;
            }
        }
        
        // Fallback a HTTP
        await this.moverCarrito(3);
    }

    async simularObstaculo() {
        try {
            const response = await fetch(`${this.backendUrl}/api/obstaculo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status_clave: 1
                })
            });
            
            const result = await response.json();
            if (result.success) {
                this.mostrarNotificacion('Obstáculo simulado y evadido', 'warning');
                setTimeout(() => this.actualizarEstado(), 1000);
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error simulando obstáculo', 'danger');
        }
    }

    async reanudarEjecucion() {
        try {
            const response = await fetch(`${this.backendUrl}/api/reanudar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dispositivo_id: 1
                })
            });
            
            const result = await response.json();
            if (result.success) {
                this.mostrarNotificacion('Ejecución reanudada', 'success');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error reanudando ejecución', 'danger');
        }
    }

    async actualizarEstado() {
        try {
            const response = await fetch(`${this.backendUrl}/api/estado-actual`);
            const data = await response.json();
            
            if (data.ultimo_movimiento) {
                this.estadoApp.ultimoMovimiento = data.ultimo_movimiento;
                this.actualizarUltimoMovimiento();
            }
            
            if (data.movimientos_recientes) {
                this.estadoApp.movimientos = data.movimientos_recientes;
                this.actualizarHistorial();
            }
            
            // Actualizar información de WebSocket si está disponible
            if (data.websocket_clients !== undefined) {
                this.actualizarInfoWebSocket(data.websocket_clients);
            }
            
        } catch (error) {
            console.error('Error actualizando estado:', error);
        }
    }

    actualizarEstadoArduino() {
        const container = document.getElementById('estadoArduino');
        if (!container || !this.estadoApp.estadoArduino) return;
        
        const estado = this.estadoApp.estadoArduino;
        container.innerHTML = `
            <div class="row small">
                <div class="col-6">
                    <i class="fas fa-ruler-vertical me-1"></i>
                    ${estado.distancia}cm
                </div>
                <div class="col-6">
                    <i class="fas fa-broadcast-tower me-1"></i>
                    ${estado.rssi}dBm
                </div>
                <div class="col-12 mt-1">
                    <i class="fas fa-play-circle me-1"></i>
                    Estado: ${estado.status_actual}
                </div>
            </div>
        `;
    }

    actualizarInfoWebSocket(clientesConectados) {
        const badge = document.getElementById('estadoWebSocket');
        if (badge) {
            if (this.estadoApp.websocketConectado) {
                badge.innerHTML = `<i class="fas fa-plug me-1"></i>WebSocket (${clientesConectados})`;
                badge.style.background = '#00ff88';
            } else {
                badge.innerHTML = '<i class="fas fa-unplug me-1"></i>HTTP';
                badge.style.background = '#ff9500';
            }
        }
    }

    actualizarEstadoConexion(conectado) {
        this.estadoApp.conectado = conectado;
        const estadoElement = document.querySelector('.estado-conexion');
        const indicator = estadoElement?.querySelector('.status-indicator');
        const conexionBadge = document.getElementById('estadoConexion');
        
        if (!estadoElement) return;
        
        if (conectado) {
            const modo = this.estadoApp.websocketConectado ? 'WebSocket' : 'HTTP';
            indicator.className = 'status-indicator status-online pulse';
            estadoElement.innerHTML = `<span class="status-indicator status-online pulse"></span>Conectado al servidor (${modo})`;
            
            if (conexionBadge) {
                conexionBadge.innerHTML = `<i class="fas fa-wifi me-1"></i>Conectado (${modo})`;
                conexionBadge.style.background = '#00ff88';
            }
        } else {
            indicator.className = 'status-indicator status-offline';
            estadoElement.innerHTML = '<span class="status-indicator status-offline"></span>Desconectado del servidor';
            if (conexionBadge) {
                conexionBadge.innerHTML = '<i class="fas fa-wifi-slash me-1"></i>Desconectado';
                conexionBadge.style.background = '#ff4444';
            }
        }
        
        // Actualizar también la info de WebSocket
        this.actualizarInfoWebSocket(0);
    }

    actualizarUltimoMovimiento() {
        const mov = this.estadoApp.ultimoMovimiento;
        const container = document.getElementById('ultimoMovimiento');
        
        if (mov && container) {
            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${mov.status_texto}</strong><br>
                        <small class="text-muted">${mov.duracion_segundos}s • ${mov.tipo_ejecucion}</small>
                    </div>
                    <div class="text-end">
                        <small class="text-muted">${new Date(mov.fecha_hora).toLocaleTimeString()}</small>
                    </div>
                </div>
            `;
        }
    }

    actualizarHistorial() {
        const container = document.getElementById('historialMovimientos');
        if (!container) return;
        
        if (this.estadoApp.movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-robot fa-2x mb-2"></i><br>No hay movimientos recientes</div>';
            return;
        }
        
        container.innerHTML = '';
        this.estadoApp.movimientos.slice(0, 8).forEach(mov => {
            const item = document.createElement('div');
            item.className = 'movement-item';
            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${mov.status_texto}</strong><br>
                        <small class="text-muted">${mov.duracion_segundos}s</small>
                    </div>
                    <div class="text-end">
                        <small class="text-muted">${new Date(mov.fecha_hora).toLocaleTimeString()}</small><br>
                        <span class="badge" style="background: ${mov.tipo_ejecucion === 'manual' ? 'var(--accent-pink)' : 'var(--accent-purple)'}; font-size: 0.6rem;">
                            ${mov.tipo_ejecucion}
                        </span>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    agregarAlerta(alertaData) {
        this.estadoApp.alertas.unshift(alertaData);
        if (this.estadoApp.alertas.length > 10) {
            this.estadoApp.alertas = this.estadoApp.alertas.slice(0, 10);
        }
        this.actualizarAlertas();
    }

    actualizarAlertas() {
        const container = document.getElementById('alertasActivas');
        if (!container) return;
        
        if (this.estadoApp.alertas.length > 0) {
            const ultimaAlerta = this.estadoApp.alertas[0];
            container.innerHTML = `
                <span class="pulse" style="color: #ff9500;">
                    <i class="fas fa-exclamation-triangle me-1"></i>
                    Obstáculo detectado (${ultimaAlerta.distancia}cm)
                </span>
            `;
        } else {
            container.innerHTML = '<i class="fas fa-check-circle me-1"></i>Sin alertas';
        }
    }

    iniciarReconexionAutomatica() {
        // Limpiar timeout anterior si existe
        if (this.reconectarTimeout) {
            clearTimeout(this.reconectarTimeout);
        }
    }

    reconectar() {
        if (this.reconectarTimeout) {
            clearTimeout(this.reconectarTimeout);
        }
        
        this.reconectarTimeout = setTimeout(() => {
            console.log('Intentando reconectar WebSocket...');
            this.inicializarWebSocket();
        }, 3000);
    }

    mostrarNotificacion(mensaje, tipo) {
        const toast = document.createElement('div');
        const bgColor = tipo === 'success' ? '#00ff88' : 
                       tipo === 'warning' ? '#ff9500' : 
                       tipo === 'danger' ? '#ff4444' : '#8a2be2';
        
        toast.className = `alert alert-dismissible fade show position-fixed`;
        toast.style.cssText = `
            top: 20px; 
            right: 20px; 
            z-index: 1050; 
            min-width: 300px;
            background: ${bgColor}15;
            backdrop-filter: blur(10px);
            border: 1px solid ${bgColor}30;
            color: white;
        `;
        toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${tipo === 'success' ? 'check' : tipo === 'warning' ? 'exclamation-triangle' : 'info'}-circle me-2" 
                   style="color: ${bgColor};"></i>
                <div>${mensaje}</div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 4000);
    }

    // Método para probar WebSocket manualmente
    probarWebSocket() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                tipo: 'ping',
                mensaje: 'Test desde navegador'
            }));
            this.mostrarNotificacion('Ping enviado via WebSocket', 'info');
        } else {
            this.mostrarNotificacion('WebSocket no conectado', 'danger');
        }
    }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.controlManager = new ControlManager();
    
    // Actualizar estado cada 3 segundos (solo para datos HTTP)
    setInterval(() => {
        controlManager.actualizarEstado();
    }, 3000);
    
    console.log('IoT Car Control inicializado (HTTP + WebSockets)');
    
    // Agregar botón de prueba WebSocket si no existe
    if (!document.getElementById('probarWebSocket')) {
        const botonPrueba = document.createElement('button');
        botonPrueba.id = 'probarWebSocket';
        botonPrueba.className = 'btn btn-sm btn-outline-info position-fixed';
        botonPrueba.style.cssText = 'bottom: 10px; right: 10px; z-index: 1000;';
        botonPrueba.innerHTML = '<i class="fas fa-bolt"></i>';
        botonPrueba.title = 'Probar WebSocket';
        botonPrueba.onclick = () => window.controlManager.probarWebSocket();
        document.body.appendChild(botonPrueba);
    }
});