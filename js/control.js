/**
 * Control Manager - Control Principal del Carrito IoT
 * Maneja movimientos, WebSocket y estado en tiempo real
 */

class ControlManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500'; 
        this.socket = null;
        this.notificationManager = null;
        
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    init() {
        console.log('🚀 Iniciando ControlManager...');
        
        // Inicializar notification manager primero
        if (!window.notificationManager) {
            window.notificationManager = new NotificationManager();
        }
        this.notificationManager = window.notificationManager;
        
        // Conectar WebSocket
        try {
            this.socket = io(this.backendUrl, { 
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });
            
            console.log('📡 WebSocket configurado en:', this.backendUrl);
        } catch (error) {
            console.error('❌ Error configurando WebSocket:', error);
        }

        // Configurar eventos WebSocket
        this.configurarEventosWebSocket();
        
        // Cargar datos iniciales
        this.cargarDatosIniciales();
        
        // Actualizar cada 5 segundos
        setInterval(() => {
            this.actualizarEstadoConexion();
        }, 5000);
        
        console.log('✅ ControlManager listo');
    }

    configurarEventosWebSocket() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ WebSocket CONECTADO al servidor');
            this.updateServerLight(true);
            
            // Notificación de conexión
            if (this.notificationManager) {
                this.notificationManager.showSuccess('🔌 Conectado', 'Conexión establecida con servidor');
            }
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('❌ WebSocket DESCONECTADO:', reason);
            this.updateServerLight(false);
            this.updateCarLight(false);
            
            if (this.notificationManager) {
                this.notificationManager.showWarning('🔌 Desconectado', 'Conexión perdida con servidor');
            }
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('❌ Error de conexión WebSocket:', error);
        });

        // Evento cuando se agrega un movimiento
        this.socket.on('movimiento_agregado', (data) => {
            console.log('📦 Movimiento agregado recibido:', data);
            
            // Actualizar UI
            setTimeout(() => {
                this.cargarHistorialMovimientos();
                this.actualizarContadorMovimientos();
            }, 300);
            
            // Mostrar notificación
            if (this.notificationManager) {
                const nombre = this.obtenerNombreMovimiento(data.status_clave);
                this.notificationManager.showSuccess(
                    '✅ Movimiento Ejecutado', 
                    `${nombre} completado`
                );
            }
        });

        // Evento de alerta de obstáculo
        this.socket.on('alerta_obstaculo', (data) => {
            console.log('🚨 Alerta de obstáculo:', data);
            
            // Incrementar contador de alertas
            this.incrementarContadorAlertas();
            
            // Mostrar notificación
            if (this.notificationManager) {
                const tipo = data.nombre_obstaculo || `Obstáculo ${data.tipo_obstaculo}`;
                this.notificationManager.showDanger(
                    '⚠️ ¡Alerta de Obstáculo!',
                    `${tipo} detectado a ${data.distancia || '?'}cm`
                );
            }
            
            // Actualizar lista de alertas si el modal está abierto
            if (window.modalMonitoringManager) {
                window.modalMonitoringManager.cargarAlertas();
            }
        });

        // Eventos de demo
        this.socket.on('demo_progreso', (data) => {
            console.log('🔄 Progreso de demo:', data);
            if (window.demoManager) {
                window.demoManager.actualizarProgresoDemo(data);
            }
        });

        this.socket.on('demo_completada', (data) => {
            console.log('✅ Demo completada:', data);
            if (window.demoManager) {
                window.demoManager.demoCompletada(data);
            }
            
            if (this.notificationManager) {
                this.notificationManager.showSuccess(
                    '🎉 Demo Completada',
                    `"${data.nombre}" finalizada`
                );
            }
        });

        this.socket.on('demo_creada', (data) => {
            console.log('📁 Demo creada:', data);
            if (this.notificationManager) {
                this.notificationManager.showSuccess(
                    '📁 Demo Creada',
                    `"${data.nombre}" guardada`
                );
            }
        });

        this.socket.on('demo_eliminada', (data) => {
            console.log('🗑️ Demo eliminada:', data);
            if (this.notificationManager) {
                this.notificationManager.showWarning(
                    '🗑️ Demo Eliminada',
                    'Secuencia eliminada'
                );
            }
        });
    }

    // FUNCIONES DE MOVIMIENTO
    getVelocidad() {
        const r = document.querySelector('input[name="velocidad"]:checked');
        return r ? parseInt(r.value) : 180;
    }

    async moverCarrito(status) {
        const movimiento = this.obtenerNombreMovimiento(status);
        const velocidad = this.getVelocidad();
        
        console.log(`🚀 Enviando: ${movimiento} (status: ${status}, velocidad: ${velocidad})`);
        
        // Mostrar notificación de envío
        if (this.notificationManager) {
            this.notificationManager.showInfo('🚀 Enviando...', `${movimiento}`);
        }
        
        try {
            const response = await fetch(`${this.backendUrl}/api/movimiento`, {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    status_clave: status,
                    velocidad: velocidad
                })
            });
            
            const data = await response.json();
            console.log('📡 Respuesta:', data);
            
            // Incrementar contador localmente
            this.incrementarContadorMovimientos();
            
        } catch (e) { 
            console.error("❌ Error:", e);
            if (this.notificationManager) {
                this.notificationManager.showDanger('❌ Error', 'No se pudo conectar');
            }
        }
    }

    async detenerCarrito() {
        console.log('⏹️ Deteniendo carrito...');
        
        if (this.notificationManager) {
            this.notificationManager.showInfo('⏹️ Deteniendo...', 'Enviando comando');
        }
        
        try { 
            const response = await fetch(`${this.backendUrl}/api/detener`, { 
                method: 'POST' 
            });
            
            const data = await response.json();
            console.log('📡 Respuesta detención:', data);
            
        } catch(e){
            console.error("❌ Error deteniendo:", e);
            if (this.notificationManager) {
                this.notificationManager.showDanger('❌ Error', 'No se pudo detener');
            }
        }
    }

    // FUNCIONES DE DATOS INICIALES
    async cargarDatosIniciales() {
        await Promise.all([
            this.actualizarEstadoConexion(),
            this.cargarHistorialMovimientos(),
            this.actualizarContadorMovimientos(),
            this.actualizarContadorAlertas()
        ]);
    }

    async actualizarEstadoConexion() {
        try {
            const res = await fetch(`${this.backendUrl}/api/estado-actual`);
            const data = await res.json();
            
            // Actualizar luz del carro
            if (data.estado_ws_arduino === 'Conectado') {
                this.updateCarLight(true);
            } else {
                this.updateCarLight(false);
            }
            
            // Actualizar estado en UI si existe
            const statusEl = document.getElementById('statusConexion');
            if (statusEl) {
                statusEl.textContent = data.estado_ws_arduino === 'Conectado' ? 'En Línea' : 'Offline';
                statusEl.className = data.estado_ws_arduino === 'Conectado' ? 'text-success fw-bold' : 'text-danger fw-bold';
            }
            
        } catch (e) {
            console.error("❌ Error actualizando estado:", e);
            this.updateCarLight(false);
        }
    }

    // CONTADORES
    async actualizarContadorMovimientos() {
        try {
            const res = await fetch(`${this.backendUrl}/api/metricas`);
            const data = await res.json();
            
            let total = 0;
            if (data.movimientos_por_tipo && Array.isArray(data.movimientos_por_tipo)) {
                data.movimientos_por_tipo.forEach(tipo => {
                    total += tipo.cantidad || 0;
                });
            }
            
            // Actualizar en todos los lugares
            const elementos = ['totalMovimientos', 'modalMetricMovimientos'];
            elementos.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = total;
            });
            
        } catch (e) {
            console.error("❌ Error cargando total movimientos:", e);
        }
    }

    incrementarContadorMovimientos() {
        const elementos = ['totalMovimientos', 'modalMetricMovimientos'];
        elementos.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const current = parseInt(el.textContent) || 0;
                el.textContent = current + 1;
            }
        });
    }

    async actualizarContadorAlertas() {
        try {
            const res = await fetch(`${this.backendUrl}/api/alertas`);
            const data = await res.json();
            
            const alertas = data.alertas || [];
            const count = alertas.length;
            
            // Actualizar en todos los lugares
            const elementos = ['totalAlertas', 'modalMetricAlertas', 'modalContadorAlertas'];
            elementos.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = count;
                    if (id === 'modalContadorAlertas') {
                        el.style.display = count > 0 ? 'inline-block' : 'none';
                    }
                }
            });
            
        } catch (e) {
            console.error("❌ Error cargando alertas:", e);
        }
    }

    incrementarContadorAlertas() {
        const elementos = ['totalAlertas', 'modalMetricAlertas', 'modalContadorAlertas'];
        elementos.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const current = parseInt(el.textContent) || 0;
                el.textContent = current + 1;
                if (id === 'modalContadorAlertas') {
                    el.style.display = 'inline-block';
                }
            }
        });
    }

    // HISTORIAL
    async cargarHistorialMovimientos() {
        const cont = document.getElementById('historialMovimientos');
        if (!cont) return;

        try {
            const res = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const data = await res.json();

            if (data.success && Array.isArray(data.movimientos) && data.movimientos.length > 0) {
                const ultimos5 = data.movimientos.slice(0, 5);
                
                let html = '<ul class="list-group list-group-flush">';
                ultimos5.forEach(mov => {
                    let hora = '--:--';
                    if(mov.fecha_hora) {
                        try {
                            const timePart = String(mov.fecha_hora).split(' ')[1] || '';
                            hora = timePart.substring(0,5);
                        } catch(e) {}
                    }

                    html += `
                        <li class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between px-0 py-2 small">
                            <span><i class="fas fa-check me-2 text-success"></i>${mov.status_texto}</span>
                            <span class="text-white-50" style="font-family:monospace">${hora}</span>
                        </li>
                    `;
                });
                html += '</ul>';
                cont.innerHTML = html;
            } else {
                cont.innerHTML = '<div class="text-center text-muted small py-2">Sin movimientos</div>';
            }
        } catch (e) { 
            console.error("❌ Error cargando historial:", e);
            cont.innerHTML = '<div class="text-center text-danger small py-2">Error</div>';
        }
    }

    // FUNCIONES PARA LAS LUCES
    updateServerLight(online) {
        const serverLight = document.getElementById('serverLight');
        const serverStatus = document.getElementById('serverStatus');
        
        if (serverLight) {
            serverLight.classList.remove('online');
            if (online) serverLight.classList.add('online');
        }
        
        if (serverStatus) {
            serverStatus.textContent = online ? 'Servidor ✓' : 'Servidor ✗';
            serverStatus.className = online ? 'text-success' : 'text-danger';
        }
    }

    updateCarLight(online) {
        const carLight = document.getElementById('carLight');
        const carStatus = document.getElementById('carStatus');
        
        if (carLight) {
            carLight.classList.remove('online');
            if (online) carLight.classList.add('online');
        }
        
        if (carStatus) {
            carStatus.textContent = online ? 'Carro ✓' : 'Carro ✗';
            carStatus.className = online ? 'text-success' : 'text-danger';
        }
    }

    // UTILIDADES
    obtenerNombreMovimiento(id) {
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
        return movimientos[id] || `Mov ${id}`;
    }
}

window.controlManager = new ControlManager();