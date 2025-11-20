class ControlManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500';
        this.estadoApp = {
            conectado: false,
            ultimoMovimiento: null,
            alertas: [],
            movimientos: []
        };
        
        // Variable para la instancia de Socket.IO
        this.socket = null;
        
        this.inicializarApp();
    }

    inicializarApp() {
        // 1. Iniciar conexión Socket.IO (La forma correcta para la Web)
        this.inicializarSocketIO();
        
        // 2. Cargar estado inicial vía HTTP
        this.actualizarEstado();
        
        // 3. Cargar demos si existe el manager
        if (window.demoManager && typeof window.demoManager.cargarDemos === 'function') {
            window.demoManager.cargarDemos();
        }
        
        console.log('✅ ControlManager inicializado (HTTP + Socket.IO)');
    }

    inicializarSocketIO() {
        // Conectar usando la librería cliente de Socket.IO
        console.log('🔌 Conectando Socket.IO...');
        this.socket = io(this.backendUrl, {
            transports: ['websocket', 'polling'], // Intentar WebSocket primero
            reconnection: true
        });

        // === EVENTOS DE CONEXIÓN ===
        
        this.socket.on('connect', () => {
            console.log('✅ Socket.IO Conectado:', this.socket.id);
            this.actualizarEstadoConexion(true);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Socket.IO Desconectado');
            this.actualizarEstadoConexion(false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Error de conexión Socket.IO:', error);
            this.actualizarEstadoConexion(false);
        });

        // === EVENTOS DEL NEGOCIO (Lo que emite tu app.py) ===

        // 1. Movimiento Agregado
        this.socket.on('movimiento_agregado', (data) => {
            console.log('📩 Evento recibido: movimiento_agregado', data);
            this.mostrarNotificacion(`Movimiento ejecutado: ${this.obtenerNombreMovimiento(data.status_clave)}`, 'success');
            // Actualizar la UI inmediatamente
            setTimeout(() => this.actualizarEstado(), 500);
        });

        // 2. Movimiento Detenido
        this.socket.on('movimiento_detenido', (data) => {
            this.mostrarNotificacion('🛑 ' + data.mensaje, 'warning');
            this.actualizarEstado();
        });

        // 3. Alerta de Obstáculo
        this.socket.on('alerta_obstaculo', (data) => {
            console.warn('🚨 Obstáculo:', data);
            this.mostrarNotificacion(`⚠️ Obstáculo detectado (Tipo ${data.tipo_obstaculo})`, 'danger');
            
            // Agregar a la lista local de alertas
            const alerta = {
                mensaje: data.mensaje,
                timestamp: data.timestamp,
                tipo: data.tipo_obstaculo
            };
            this.estadoApp.alertas.unshift(alerta);
            this.actualizarAlertas();
        });

        // 4. Progreso de Demo
        this.socket.on('demo_progreso', (data) => {
            // Si tienes el DemoManager, pasale los datos
            if (window.demoManager && typeof window.demoManager.mostrarProgresoSimple === 'function') {
                // Adaptamos para usar tu función de progreso visual
                // Nota: Podrías necesitar crear un método actualizarProgreso en demoManager
                console.log(`Demo progreso: ${data.movimiento_actual}/${data.total_movimientos}`);
            }
        });

        // 5. Demo Completada
        this.socket.on('demo_completada', (data) => {
            this.mostrarNotificacion(`✅ Demo "${data.nombre}" finalizada`, 'success');
            if (window.demoManager && typeof window.demoManager.ocultarProgreso === 'function') {
                window.demoManager.ocultarProgreso();
            }
        });
    }

    // === ENVÍO DE COMANDOS (Usamos HTTP POST para activar la cadena Backend -> Arduino) ===
    
    async moverCarrito(statusClave) {
        const duracion = document.getElementById('duracionMovimiento')?.value || 5;
        const nombreMovimiento = this.obtenerNombreMovimiento(statusClave);
        
        // IMPORTANTE: Usamos HTTP POST. 
        // El backend recibe el POST y él se encarga de enviarlo por WebSocket al Arduino.
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
                // No necesitamos mostrar notificación aquí si esperamos el evento del socket,
                // pero para feedback inmediato está bien dejarlo.
                console.log('Comando enviado al servidor');
            } else {
                this.mostrarNotificacion('Error: ' + result.error, 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error de conexión con el servidor', 'danger');
            this.actualizarEstadoConexion(false);
        }
    }

    async detenerCarrito() {
        try {
            const response = await fetch(`${this.backendUrl}/api/detener`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (!result.success) {
                this.mostrarNotificacion('Error al detener: ' + result.error, 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    // === UTILIDADES Y UI ===

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

    async simularObstaculo() {
        try {
            await fetch(`${this.backendUrl}/api/obstaculo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status_clave: 1 })
            });
            // La notificación llegará por el evento del socket 'alerta_obstaculo'
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async reanudarEjecucion() {
        try {
            const response = await fetch(`${this.backendUrl}/api/reanudar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dispositivo_id: 1 })
            });
            const result = await response.json();
            if (result.success) {
                this.mostrarNotificacion('Ejecución reanudada', 'success');
            }
        } catch (error) {
            this.mostrarNotificacion('Error reanudando', 'danger');
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

            // Actualizar estado de conexión del ARDUINO (Viene en el JSON de estado-actual)
            this.actualizarEstadoArduino(data.estado_ws_arduino === 'Conectado');
            
        } catch (error) {
            console.error('Error actualizando estado:', error);
        }
    }

    actualizarEstadoArduino(conectado) {
        const badge = document.getElementById('estadoArduino'); // Asegúrate de tener este elemento en tu HTML o créalo
        if (badge) {
            if (conectado) {
                badge.innerHTML = '<i class="fas fa-robot me-1"></i>Robot Online';
                badge.className = 'badge bg-success';
            } else {
                badge.innerHTML = '<i class="fas fa-robot me-1"></i>Robot Offline';
                badge.className = 'badge bg-danger';
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
            indicator.className = 'status-indicator status-online pulse';
            estadoElement.innerHTML = '<span class="status-indicator status-online pulse"></span>Conectado (Socket.IO)';
            if (conexionBadge) {
                conexionBadge.innerHTML = '<i class="fas fa-wifi me-1"></i>Online';
                conexionBadge.style.background = '#00ff88';
            }
        } else {
            indicator.className = 'status-indicator status-offline';
            estadoElement.innerHTML = '<span class="status-indicator status-offline"></span>Desconectado';
            if (conexionBadge) {
                conexionBadge.innerHTML = '<i class="fas fa-wifi-slash me-1"></i>Offline';
                conexionBadge.style.background = '#ff4444';
            }
        }
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

    actualizarAlertas() {
        const container = document.getElementById('alertasActivas');
        if (!container) return;
        
        if (this.estadoApp.alertas.length > 0) {
            const ultimaAlerta = this.estadoApp.alertas[0];
            container.innerHTML = `
                <span class="pulse" style="color: #ff9500;">
                    <i class="fas fa-exclamation-triangle me-1"></i>
                    ${ultimaAlerta.mensaje || 'Obstáculo detectado'}
                </span>
            `;
        } else {
            container.innerHTML = '<i class="fas fa-check-circle me-1"></i>Sin alertas';
        }
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
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 4000);
    }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.controlManager = new ControlManager();
    
    // Actualizar estado cada 3 segundos como respaldo
    setInterval(() => {
        controlManager.actualizarEstado();
    }, 3000);
    
    console.log('🚀 IoT Car Control inicializado (Socket.IO + HTTP)');
});