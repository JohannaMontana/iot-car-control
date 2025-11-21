class ControlManager {
    constructor() {
        // IP de tu servidor EC2
        this.backendUrl = 'http://54.147.92.50:5500';
        this.socket = null;
        
        this.estadoApp = {
            conectado: false,
            ultimoMovimiento: null
        };
        
        // Iniciar cuando el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.inicializarApp());
        } else {
            this.inicializarApp();
        }
    }

    inicializarApp() {
        console.log('🚀 Iniciando ControlManager...');
        
        this.inicializarSocketIO();
        this.actualizarEstado();      // Carga inicial de estado del robot
        this.cargarHistorialRapido(); // Carga inicial del historial lateral
        
        // Cargar demos si el manager existe
        if (window.demoManager && typeof window.demoManager.cargarDemos === 'function') {
            window.demoManager.cargarDemos();
        }

        // Refrescar datos periódicamente (Respaldo)
        setInterval(() => {
            this.actualizarEstado();
            this.cargarHistorialRapido();
        }, 4000);
    }

    // ==================== SOCKET.IO (Comunicación Real-Time) ====================

    inicializarSocketIO() {
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

        // 1. Conexión
        this.socket.on('connect', () => this.actualizarEstadoConexion(true));
        this.socket.on('disconnect', () => this.actualizarEstadoConexion(false));

        // 2. Movimiento Confirmado (Actualiza historial al instante)
        this.socket.on('movimiento_agregado', (data) => {
            const nombre = this.obtenerNombreMovimiento(data.status_clave);
            this.mostrarNotificacion(`Ejecutando: ${nombre}`, 'success');
            setTimeout(() => this.cargarHistorialRapido(), 500);
            this.actualizarEstado();
        });

        // 3. Detención Confirmada
        this.socket.on('movimiento_detenido', (data) => {
            this.mostrarNotificacion('🛑 ' + data.mensaje, 'warning');
            this.actualizarEstado();
        });

        // 4. 🔥 ALERTA DE OBSTÁCULO (Arduino -> Backend -> Frontend)
        this.socket.on('alerta_obstaculo', (data) => {
            console.warn('🚨 OBSTÁCULO:', data);
            this.mostrarAlertaObstaculo(data);
            this.actualizarEstado(); // Para ver si el robot se detuvo
        });

        // 5. PROGRESO DE DEMOS (Puente hacia DemoManager)
        this.socket.on('demo_progreso', (data) => {
            if (window.demoManager && window.demoManager.actualizarProgresoDemo) {
                window.demoManager.actualizarProgresoDemo(data);
            }
        });

        this.socket.on('demo_completada', (data) => {
            if (window.demoManager && window.demoManager.demoCompletada) {
                window.demoManager.demoCompletada(data);
            }
        });
    }

    // ==================== LÓGICA DE VELOCIDAD ====================
    
    obtenerVelocidadSeleccionada() {
        const radios = document.getElementsByName('velocidad');
        for (const radio of radios) {
            if (radio.checked) return parseInt(radio.value);
        }
        return 180; // Valor por defecto
    }

    // ==================== COMANDOS DE MOVIMIENTO ====================

    async moverCarrito(statusClave) {
        const velocidad = this.obtenerVelocidadSeleccionada();
        // Para control manual, duración es 0 (Continuo hasta STOP)
        const duracion = 0; 
        
        try {
            await fetch(`${this.backendUrl}/api/movimiento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status_clave: statusClave,
                    velocidad: velocidad,
                    duracion_segundos: duracion
                })
            });
        } catch (error) {
            console.error(error);
            this.mostrarNotificacion('Error de conexión con el servidor', 'danger');
        }
    }

    async detenerCarrito() {
        try {
            await fetch(`${this.backendUrl}/api/detener`, { method: 'POST' });
        } catch (e) { console.error(e); }
    }

    // ==================== HISTORIAL MINIATURA (Panel Lateral) ====================

    async cargarHistorialRapido() {
        const container = document.getElementById('historialMovimientos');
        if (!container) return;

        try {
            const res = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const data = await res.json();

            if (data.success && data.movimientos && data.movimientos.length > 0) {
                // Tomamos solo los 5 más recientes para el panel lateral
                const ultimos5 = data.movimientos.slice(0, 5);
                let html = '<ul class="list-group list-group-flush">';
                
                ultimos5.forEach(mov => {
                    // Formatear hora
                    let hora = "";
                    if(mov.fecha_hora) {
                        const d = new Date(mov.fecha_hora);
                        hora = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
                    }
                    
                    // Icono según tipo
                    let iconClass = "fa-arrow-right";
                    const txt = (mov.status_texto || "").toLowerCase();
                    if(txt.includes("giro")) iconClass = "fa-sync";
                    else if(txt.includes("detener")) iconClass = "fa-stop";

                    html += `
                        <li class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between px-0 py-2 align-items-center">
                            <span class="text-truncate" style="max-width: 140px;">
                                <i class="fas ${iconClass} me-2 text-info"></i>${mov.status_texto}
                            </span>
                            <span class="badge bg-secondary" style="font-size: 0.7rem;">${hora}</span>
                        </li>
                    `;
                });
                html += '</ul>';
                container.innerHTML = html;
            } else {
                container.innerHTML = '<div class="text-center text-muted py-3 small">Sin movimientos recientes</div>';
            }
        } catch (e) { console.error("Error cargando historial:", e); }
    }

    // ==================== UI & UTILIDADES ====================

    async actualizarEstado() {
        try {
            const res = await fetch(`${this.backendUrl}/api/estado-actual`);
            const data = await res.json();
            
            // 1. Widget Último Movimiento (Panel Derecho)
            const elUltimo = document.getElementById('ultimoMovimiento');
            if (elUltimo && data.ultimo_movimiento) {
                const mov = data.ultimo_movimiento;
                elUltimo.innerHTML = `
                    <div class="text-center">
                        <h4 class="text-info mb-0">${mov.status_texto}</h4>
                        <small class="text-muted">${mov.tipo_ejecucion} • ${new Date(mov.fecha_hora).toLocaleTimeString()}</small>
                    </div>
                `;
            }

            // 2. Badge Estado Robot (Panel Derecho)
            const elRobot = document.getElementById('robotEstado');
            if (elRobot) {
                const online = data.estado_ws_arduino === 'Conectado';
                elRobot.innerHTML = online 
                    ? '<span class="text-success"><i class="fas fa-wifi me-1"></i>En Línea</span>' 
                    : '<span class="text-danger">Desconectado</span>';
            }
        } catch(e){}
    }

    actualizarEstadoConexion(online) {
        const txt = document.getElementById('textoConexion');
        const ind = document.querySelector('.status-indicator');
        if(online) {
            if(txt) txt.textContent = 'Conectado';
            if(ind) ind.className = 'status-indicator status-online pulse';
        } else {
            if(txt) txt.textContent = 'Desconectado';
            if(ind) ind.className = 'status-indicator status-offline';
        }
    }

    obtenerNombreMovimiento(statusClave) {
        const movimientos = {
            1: 'Adelante', 2: 'Atrás', 3: 'Detener',
            4: 'Curva Der Frente', 5: 'Curva Izq Frente',
            6: 'Curva Der Atrás', 7: 'Curva Izq Atrás',
            8: 'Giro 90° Der', 9: 'Giro 90° Izq',
            10: 'Giro 360° Der', 11: 'Giro 360° Izq'
        };
        return movimientos[statusClave] || 'Movimiento ' + statusClave;
    }

    mostrarNotificacion(msg, type) {
        const div = document.createElement('div');
        const color = type === 'success' ? '#00ff88' : (type === 'danger' ? '#ff4444' : '#ff9500');
        
        div.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: rgba(0,0,0,0.85); color: ${color}; 
            border-left: 4px solid ${color};
            padding: 12px 20px; border-radius: 4px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            font-family: sans-serif; font-size: 14px;
            animation: slideInRight 0.3s ease;
        `;
        div.innerHTML = `<strong>${type === 'danger' ? 'Error' : 'Info'}:</strong> ${msg}`;
        
        document.body.appendChild(div);
        setTimeout(() => {
            div.style.opacity = '0';
            div.style.transform = 'translateX(100%)';
            div.style.transition = 'all 0.3s ease';
            setTimeout(() => div.remove(), 300);
        }, 3000);
    }

    mostrarAlertaObstaculo(data) {
        // Mapeo de IDs a Texto legible
        const mapa = {
            1: "Frontal", 2: "Frontal-Izquierda", 3: "Frontal-Derecha", 4: "Encerrado", 5: "Trasero"
        };
        const zona = mapa[data.tipo_obstaculo] || "General";

        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(220, 20, 60, 0.95); color: white; padding: 30px;
            border-radius: 15px; z-index: 11000; text-align: center;
            box-shadow: 0 0 80px rgba(255, 0, 0, 0.8); width: 300px;
            border: 2px solid white;
            animation: pulse 0.5s infinite alternate;
        `;
        div.innerHTML = `
            <i class="fas fa-hand-paper fa-4x mb-3"></i>
            <h2>¡OBSTÁCULO!</h2>
            <h4 class="text-warning bg-dark bg-opacity-50 rounded p-1">${zona.toUpperCase()}</h4>
            <p class="mb-0 mt-2">${data.mensaje}</p>
            <hr style="border-color: white;">
            <small class="d-block">Maniobra: <strong>${data.accion}</strong></small>
        `;
        document.body.appendChild(div);
        
        // Audio alerta
        try { new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play(); } catch(e){}

        setTimeout(() => div.remove(), 3500);
    }
}

// Instancia global
window.controlManager = new ControlManager();