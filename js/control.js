class ControlManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500';
        this.estadoApp = {
            conectado: true, // Siempre conectado con HTTP
            ultimoMovimiento: null,
            alertas: [],
            movimientos: []
        };
        
        this.inicializarApp(); // Cambiar nombre
    }

    inicializarApp() {
        // 🔥 QUITAR TODO EL CÓDIGO DE SOCKET
        this.actualizarEstadoConexion(true);
        this.actualizarEstado();
        
        // Cargar demos si existe demoManager
        if (window.demoManager && typeof window.demoManager.cargarDemos === 'function') {
            window.demoManager.cargarDemos();
        }
        
        console.log('✅ ControlManager inicializado (HTTP Only)');
    }

    // 🔥 QUITAR: inicializarSocket() - TODO EL MÉTODO

    async moverCarrito(statusClave) {
        const duracion = document.getElementById('duracionMovimiento').value;
        const nombreMovimiento = this.obtenerNombreMovimiento(statusClave);
        
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
                // Actualizar estado después del movimiento
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
            
            // Actualizar estado de conexión
            this.actualizarEstadoConexion(true);
            
        } catch (error) {
            console.error('Error actualizando estado:', error);
            this.actualizarEstadoConexion(false);
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
            estadoElement.innerHTML = '<span class="status-indicator status-online pulse"></span>Conectado al servidor';
            if (conexionBadge) {
                conexionBadge.innerHTML = '<i class="fas fa-wifi me-1"></i>Conectado';
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
                    Obstáculo detectado (Tipo ${ultimaAlerta.tipo_obstaculo})
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
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 4000);
    }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.controlManager = new ControlManager();
    
    // Actualizar estado cada 3 segundos
    setInterval(() => {
        controlManager.actualizarEstado();
    }, 3000);
    
    console.log('🚀 IoT Car Control inicializado (HTTP Only)');
});