class ControlManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500'; 
        this.socket = null;
        
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    init() {
        // Iniciar Socket.IO
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

        this.socket.on('connect', () => this.actualizarUIConexion(true));
        this.socket.on('disconnect', () => this.actualizarUIConexion(false));

        // Cuando el backend confirma un movimiento, recargamos el historial
        this.socket.on('movimiento_agregado', () => {
            setTimeout(() => this.cargarHistorialRapido(), 300);
        });

        // ESCUCHA DE ALERTAS (Obstáculos)
        this.socket.on('alerta_obstaculo', (data) => this.mostrarAlertaObstaculo(data));

        // Carga inicial
        this.actualizarEstado();
        this.cargarHistorialRapido();
        
        // Polling de seguridad cada 4s
        setInterval(() => {
            this.actualizarEstado();
            this.cargarHistorialRapido();
        }, 4000);
    }

    // === VELOCIDAD ===
    obtenerVelocidadSeleccionada() {
        const radios = document.getElementsByName('velocidad');
        for (const radio of radios) {
            if (radio.checked) return parseInt(radio.value);
        }
        return 180; // Default Media
    }

    // === COMANDOS ===
    async moverCarrito(statusClave) {
        const velocidad = this.obtenerVelocidadSeleccionada();
        
        try {
            await fetch(`${this.backendUrl}/api/movimiento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status_clave: statusClave,
                    velocidad: velocidad,
                    duracion_segundos: 0 // Continuo
                })
            });
        } catch (e) { console.error(e); }
    }

    async detenerCarrito() {
        try { await fetch(`${this.backendUrl}/api/detener`, { method: 'POST' }); } catch(e){}
    }

    // === HISTORIAL MINIATURA (5) ===
    async cargarHistorialRapido() {
        const container = document.getElementById('historialMovimientos');
        if (!container) return;

        try {
            const res = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const data = await res.json();

            if (data.success && data.movimientos && data.movimientos.length > 0) {
                // Tomamos solo los 5 primeros
                const ultimos5 = data.movimientos.slice(0, 5);
                
                let html = '<ul class="list-group list-group-flush">';
                ultimos5.forEach(mov => {
                    // Formateo de hora seguro
                    let hora = "Reciente";
                    if(mov.fecha_hora) {
                        hora = new Date(mov.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    }

                    html += `
                        <li class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between px-0 py-2 small">
                            <span><i class="fas fa-arrow-right me-2 text-info"></i>${mov.status_texto}</span>
                            <span class="badge bg-secondary" style="font-size: 0.7rem;">${hora}</span>
                        </li>
                    `;
                });
                html += '</ul>';
                container.innerHTML = html;
            } else {
                container.innerHTML = '<div class="text-center text-muted py-3 small">Sin movimientos</div>';
            }
        } catch (e) { 
            console.error(e);
            container.innerHTML = '<div class="text-center text-danger small">Error de carga</div>';
        }
    }

    // === ALERTAS VISUALES (Popup) ===
    mostrarAlertaObstaculo(data) {
        // MAPEO A TUS REFERENCIAS DE BD
        const referencias = {
            1: "Adelante",
            2: "Adelante-Izquierda",
            3: "Adelante-Derecha",
            4: "Adelante-Izquierda-Derecha",
            5: "Retrocede"
        };
        
        const nombreObstaculo = referencias[data.tipo_obstaculo] || "Obstáculo General";

        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(220, 20, 60, 0.98); color: white; padding: 30px;
            border-radius: 15px; z-index: 11000; text-align: center;
            box-shadow: 0 0 100px rgba(255, 0, 0, 0.8); width: 350px; border: 2px solid white;
            animation: pulse 0.5s infinite alternate;
        `;
        div.innerHTML = `
            <i class="fas fa-exclamation-triangle fa-4x mb-3"></i>
            <h3 class="fw-bold">¡OBSTÁCULO!</h3>
            <div class="bg-white text-danger p-2 rounded fw-bold mb-2 text-uppercase">
                ${nombreObstaculo}
            </div>
            <small class="d-block">Acción: ${data.accion}</small>
        `;
        document.body.appendChild(div);
        
        // Sonido simple
        try { new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play(); } catch(e){}
        
        setTimeout(() => div.remove(), 3500);
    }

    // === UI ===
    actualizarUIConexion(online) {
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

    async actualizarEstado() {
        try {
            const res = await fetch(`${this.backendUrl}/api/estado-actual`);
            const data = await res.json();
            
            const elRobot = document.getElementById('robotEstado');
            if (elRobot) {
                const online = data.estado_ws_arduino === 'Conectado';
                elRobot.innerHTML = online 
                    ? '<span class="text-success">Online</span>' 
                    : '<span class="text-danger">Offline</span>';
            }
        } catch(e){}
    }
    
    // Helpers
    mostrarNotificacion(msg, type) { /* Opcional */ }
    obtenerNombreMovimiento(id) { return "Mov " + id; }
}

window.controlManager = new ControlManager();