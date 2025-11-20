class ControlManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500'; // Tu IP de EC2
        this.estadoApp = {
            conectado: false,
            ultimoMovimiento: null,
            alertas: [],
            movimientos: []
        };
        
        this.socket = null;
        
        // Iniciar cuando el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.inicializarApp());
        } else {
            this.inicializarApp();
        }
    }

    inicializarApp() {
        this.inicializarSocketIO();
        this.actualizarEstado();
        
        // Cargar demos si existe el manager
        if (window.demoManager && typeof window.demoManager.cargarDemos === 'function') {
            window.demoManager.cargarDemos();
        }
        
        console.log('✅ ControlManager inicializado (HTTP + Socket.IO + Velocidad)');
    }

    inicializarSocketIO() {
        console.log('🔌 Conectando Socket.IO...');
        this.socket = io(this.backendUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true
        });

        // === EVENTOS DE CONEXIÓN ===
        this.socket.on('connect', () => {
            console.log('✅ Socket.IO Conectado');
            this.actualizarEstadoConexion(true);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Socket.IO Desconectado');
            this.actualizarEstadoConexion(false);
        });

        // === EVENTOS DEL SISTEMA ===

        // 1. Confirmación de movimiento
        this.socket.on('movimiento_agregado', (data) => {
            this.mostrarNotificacion(`🚀 Ejecutando: ${this.obtenerNombreMovimiento(data.status_clave)} (Vel: ${data.velocidad})`, 'success');
            setTimeout(() => this.actualizarEstado(), 500);
        });

        // 2. Confirmación de detención
        this.socket.on('movimiento_detenido', (data) => {
            this.mostrarNotificacion('🛑 ' + data.mensaje, 'warning');
            this.actualizarEstado();
        });

        // 3. 🔥 ALERTA DE OBSTÁCULO (CRÍTICO)
        this.socket.on('alerta_obstaculo', (data) => {
            console.warn('🚨 ALERTA OBSTÁCULO:', data);
            this.mostrarAlertaObstaculo(data); // Mostrar popup grande
            this.actualizarEstado();
        });

        // 4. Eventos de Demo
        this.socket.on('demo_progreso', (data) => {
            if (window.demoManager && window.demoManager.actualizarProgresoDemo) {
                window.demoManager.actualizarProgresoDemo(data);
            }
        });

        this.socket.on('demo_completada', (data) => {
            this.mostrarNotificacion(`✅ Demo "${data.nombre}" finalizada`, 'success');
            if (window.demoManager) window.demoManager.demoCompletada(data);
        });
    }

    // === LÓGICA DE VELOCIDAD ===
    obtenerVelocidadSeleccionada() {
        const radios = document.getElementsByName('velocidad');
        for (const radio of radios) {
            if (radio.checked) {
                return parseInt(radio.value);
            }
        }
        return 180; // Valor por defecto (Media)
    }

    // === ENVÍO DE COMANDOS ===
    
    async moverCarrito(statusClave) {
        const velocidad = this.obtenerVelocidadSeleccionada();
        const nombreMovimiento = this.obtenerNombreMovimiento(statusClave);
        
        try {
            // Enviamos al Backend. El Backend se encarga de empujarlo al Arduino por WebSocket.
            const response = await fetch(`${this.backendUrl}/api/movimiento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status_clave: statusClave,
                    velocidad: velocidad,
                    duracion_segundos: 0 // 0 = Continuo (hasta que demos STOP)
                })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                this.mostrarNotificacion('Error: ' + result.error, 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error de conexión', 'danger');
            this.actualizarEstadoConexion(false);
        }
    }

    async detenerCarrito() {
        try {
            await fetch(`${this.backendUrl}/api/detener`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async simularObstaculo() {
        try {
            await fetch(`${this.backendUrl}/api/obstaculo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    status_clave: 1, // Obstáculo frontal
                    dispositivo_id: 1 
                })
            });
            // La notificación visual llegará vía Socket.IO ('alerta_obstaculo')
        } catch (error) {
            console.error('Error simulando:', error);
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
            if(result.success) this.mostrarNotificacion('Sistema reanudado', 'success');
        } catch (error) {
            this.mostrarNotificacion('Error reanudando', 'danger');
        }
    }

    // === UI & UTILIDADES ===

    obtenerNombreMovimiento(statusClave) {
        const movimientos = {
            1: 'Adelante', 2: 'Atrás', 3: 'Detener',
            4: 'Vuelta Adelante Der', 5: 'Vuelta Adelante Izq',
            6: 'Vuelta Atrás Der', 7: 'Vuelta Atrás Izq',
            8: 'Giro 90° Der', 9: 'Giro 90° Izq',
            10: 'Giro 360° Der', 11: 'Giro 360° Izq'
        };
        return movimientos[statusClave] || 'Movimiento ' + statusClave;
    }

    actualizarEstadoConexion(conectado) {
        this.estadoApp.conectado = conectado;
        const estadoElement = document.querySelector('.estado-conexion');
        const indicator = estadoElement?.querySelector('.status-indicator');
        
        if (!estadoElement) return;
        
        if (conectado) {
            indicator.className = 'status-indicator status-online pulse';
            estadoElement.innerHTML = '<span class="status-indicator status-online pulse"></span> Conectado';
        } else {
            indicator.className = 'status-indicator status-offline';
            estadoElement.innerHTML = '<span class="status-indicator status-offline"></span> Desconectado';
        }
    }

    async actualizarEstado() {
        try {
            const response = await fetch(`${this.backendUrl}/api/estado-actual`);
            const data = await response.json();
            
            if (data.ultimo_movimiento) {
                this.actualizarWidgetUltimoMovimiento(data.ultimo_movimiento);
            }
            
            // Actualizar estado del Arduino (Viene en el JSON del backend)
            // Esto nos dice si el socket Python <-> Arduino está vivo
            const arduinoStatus = document.getElementById('estadoConexion');
            if(arduinoStatus) {
                if(data.estado_ws_arduino === 'Conectado') {
                    arduinoStatus.innerHTML = '<i class="fas fa-robot me-1"></i>Robot Online';
                    arduinoStatus.style.background = '#00ff88';
                } else {
                    arduinoStatus.innerHTML = '<i class="fas fa-robot me-1"></i>Robot Offline';
                    arduinoStatus.style.background = '#ff4444';
                }
            }

        } catch (error) {
            console.error('Error polling estado:', error);
        }
    }

    actualizarWidgetUltimoMovimiento(mov) {
        const container = document.getElementById('ultimoMovimiento');
        if (container) {
            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div class="text-start">
                        <strong style="color: var(--accent-cyan);">${mov.status_texto}</strong><br>
                        <small class="text-muted">${mov.tipo_ejecucion}</small>
                    </div>
                    <div class="text-end">
                        <small class="text-muted">${new Date(mov.fecha_hora).toLocaleTimeString()}</small>
                    </div>
                </div>
            `;
        }
    }

    mostrarNotificacion(mensaje, tipo) {
        const bgColor = tipo === 'success' ? '#00ff88' : (tipo === 'danger' ? '#ff4444' : '#ff9500');
        const toast = document.createElement('div');
        toast.className = 'alert position-fixed shadow-lg';
        toast.style.cssText = `top: 20px; right: 20px; z-index: 9999; min-width: 300px; background: ${bgColor}20; border: 1px solid ${bgColor}; color: white; backdrop-filter: blur(5px);`;
        
        toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${tipo === 'success' ? 'check' : 'info'}-circle me-2" style="color: ${bgColor};"></i>
                <div>${mensaje}</div>
            </div>
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    mostrarAlertaObstaculo(data) {
        // Alerta visual GRANDE en el centro de la pantalla
        const alerta = document.createElement('div');
        alerta.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.95); color: white; padding: 30px;
            border-radius: 15px; z-index: 10000; text-align: center;
            box-shadow: 0 0 50px rgba(255,0,0,0.5); width: 80%; max-width: 400px;
            animation: pulse 1s infinite;
        `;
        alerta.innerHTML = `
            <i class="fas fa-exclamation-triangle fa-4x mb-3"></i>
            <h2>¡OBSTÁCULO DETECTADO!</h2>
            <p class="fs-5">${data.mensaje}</p>
            <hr>
            <small>Acción automática: ${data.accion}</small>
        `;
        
        document.body.appendChild(alerta);
        
        // Sonido simple (opcional)
        try { const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'); audio.play(); } catch(e){}

        // Quitar automáticamente
        setTimeout(() => alerta.remove(), 3500);
    }
}

window.controlManager = new ControlManager();