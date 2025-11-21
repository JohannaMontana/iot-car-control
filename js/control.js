class ControlManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500'; 
        this.socket = null;
        
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    init() {
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

        this.socket.on('connect', () => this.actualizarUIConexion(true));
        this.socket.on('disconnect', () => this.actualizarUIConexion(false));

        this.socket.on('movimiento_agregado', () => {
            setTimeout(() => this.cargarHistorialRapido(), 500);
        });

        this.socket.on('alerta_obstaculo', (data) => this.mostrarAlertaObstaculo(data));

        this.actualizarEstado();
        this.cargarHistorialRapido();
        
        setInterval(() => {
            this.actualizarEstado();
            this.cargarHistorialRapido();
        }, 4000);
    }

    getVelocidad() {
        const r = document.querySelector('input[name="velocidad"]:checked');
        return r ? parseInt(r.value) : 180;
    }

    // Obtener fecha local formateada para enviar al servidor
    getLocalTimestamp() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now - offset).toISOString().slice(0, 19).replace('T', ' ');
    }

    async moverCarrito(status) {
        try {
            await fetch(`${this.backendUrl}/api/movimiento`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    status_clave: status,
                    velocidad: this.getVelocidad(),
                    duracion_segundos: 0,
                    timestamp_local: this.getLocalTimestamp() // <-- ENVIAMOS HORA LOCAL
                })
            });
        } catch (e) { console.error(e); }
    }

    async detenerCarrito() {
        try { await fetch(`${this.backendUrl}/api/detener`, { method: 'POST' }); } catch(e){}
    }

    async simularObstaculo() {
        try {
            await fetch(`${this.backendUrl}/api/obstaculo`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ status_clave: 1, dispositivo_id: 1 })
            });
        } catch(e) {}
    }

    // === HISTORIAL CORREGIDO (Muestra 5 items) ===
    async cargarHistorialRapido() {
        const cont = document.getElementById('historialMovimientos');
        if (!cont) return;

        try {
            const res = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const data = await res.json();

            // CRÍTICO: Verificar éxito y que el array exista
            if (data.success && Array.isArray(data.movimientos) && data.movimientos.length > 0) {
                const ultimos5 = data.movimientos.slice(0, 5);
                
                let html = '<ul class="list-group list-group-flush">';
                ultimos5.forEach(mov => {
                    let hora = '...';
                    if(mov.fecha_hora) {
                        try {
                            // La fecha viene como string SQL ("YYYY-MM-DD HH:MM:SS"). Solo tomamos HH:MM
                            const timePart = String(mov.fecha_hora).split(' ')[1] || '';
                            hora = timePart.substring(0,5);
                        } catch(e) {}
                    }

                    // Usamos clases de texto correctas (text-white)
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
                cont.innerHTML = '<div class="text-center text-muted small py-2">Sin movimientos registrados</div>';
            }
        } catch (e) { 
            console.error("Error cargando historial:", e);
            cont.innerHTML = '<div class="text-center text-danger small py-2">Error de conexión al historial</div>';
        }
    }

    mostrarAlertaObstaculo(data) {
        // Referencias BD
        const map = { 
            1: "Adelante", 2: "Adelante-Izquierda", 3: "Adelante-Derecha", 
            4: "Adelante-Izq-Der", 5: "Retrocede" 
        };
        const txt = map[data.tipo_obstaculo] || "Obstáculo";
        
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(220,20,60,0.98);color:white;padding:30px;border-radius:15px;z-index:11000;text-align:center;width:320px;border:2px solid white;animation:pulse 0.5s infinite alternate;';
        div.innerHTML = `<i class="fas fa-exclamation-triangle fa-3x mb-3"></i><h3>¡OBSTÁCULO!</h3><div class="bg-white text-danger p-2 rounded fw-bold mb-2 text-uppercase">${txt}</div><small class="d-block">Acción: ${data.accion}</small>`;
        document.body.appendChild(div);
        try { new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play(); } catch(e){}
        setTimeout(() => div.remove(), 3500);
    }
    
    // UI Helpers
    actualizarUIConexion(online) { /* ... */ }
    async actualizarEstado() { /* ... */ }
    mostrarNotificacion(msg, type) {} 
    obtenerNombreMovimiento(id){ return "Mov "+id; }
}
window.controlManager = new ControlManager();