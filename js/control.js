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
            setTimeout(() => this.cargarHistorialRapido(), 300);
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

    // Enviar fecha local solo como referencia para logs (la BD usará la suya, pero el front la convierte)
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
                    timestamp_local: this.getLocalTimestamp()
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

    // === HISTORIAL CON HORA LOCAL ===
    async cargarHistorialRapido() {
        const cont = document.getElementById('historialMovimientos');
        if (!container) return; // Seguridad

        try {
            const res = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const data = await res.json();

            if (data.success && data.movimientos && data.movimientos.length > 0) {
                const ultimos5 = data.movimientos.slice(0, 5);
                
                let html = '<ul class="list-group list-group-flush">';
                ultimos5.forEach(mov => {
                    // --- CORRECCIÓN DE HORA ---
                    let hora = "Reciente";
                    if(mov.fecha_hora) {
                        // Agregamos 'Z' para indicar que viene en UTC del servidor
                        // JS automáticamente lo pasa a tu hora local
                        const rawDate = mov.fecha_hora.endsWith('Z') ? mov.fecha_hora : mov.fecha_hora + 'Z';
                        const d = new Date(rawDate);
                        if(!isNaN(d)) hora = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    }

                    html += `
                        <li class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between px-0 py-2 small">
                            <span><i class="fas fa-check me-2 text-success"></i>${mov.status_texto}</span>
                            <span class="badge bg-secondary" style="font-size: 0.7rem;">${hora}</span>
                        </li>
                    `;
                });
                html += '</ul>';
                cont.innerHTML = html;
            } else {
                cont.innerHTML = '<div class="text-center text-muted small py-2">Sin movimientos</div>';
            }
        } catch (e) { 
            // Silencioso o log
        }
    }

    mostrarAlertaObstaculo(data) {
        const map = { 
            1: "Adelante", 2: "Adelante-Izquierda", 3: "Adelante-Derecha", 
            4: "Adelante-Izq-Der", 5: "Retrocede" 
        };
        const txt = map[data.tipo_obstaculo] || "Obstáculo";
        
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(220,20,60,0.98);color:white;padding:30px;border-radius:15px;z-index:11000;text-align:center;width:320px;border:2px solid white;animation:pulse 0.5s infinite alternate;';
        div.innerHTML = `
            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
            <h3 class="fw-bold">¡OBSTÁCULO!</h3>
            <div class="bg-white text-danger p-2 rounded fw-bold mb-2 text-uppercase">
                ${txt}
            </div>
            <small class="d-block">Acción: ${data.accion}</small>
        `;
        document.body.appendChild(div);
        try { new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play(); } catch(e){}
        setTimeout(() => div.remove(), 3500);
    }

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
                elRobot.innerHTML = online ? '<span class="text-success">Online</span>' : '<span class="text-danger">Offline</span>';
            }
            
            const elUltimo = document.getElementById('ultimoMovimiento');
            if(elUltimo && data.ultimo_movimiento) {
                const m = data.ultimo_movimiento;
                // Corrección hora aquí también
                let hora = '';
                if(m.fecha_hora) {
                    const raw = m.fecha_hora.endsWith('Z') ? m.fecha_hora : m.fecha_hora + 'Z';
                    hora = new Date(raw).toLocaleTimeString();
                }
                
                elUltimo.innerHTML = `
                    <div class="text-center">
                        <i class="fas fa-history fa-2x mb-2 text-info"></i><br>
                        <strong class="text-white">${m.status_texto}</strong><br>
                        <small class="text-muted">${hora}</small>
                    </div>
                `;
            }
        } catch(e){}
    }
    
    mostrarNotificacion(msg, type) {} 
    obtenerNombreMovimiento(id){ return "Mov "+id; }
}

window.controlManager = new ControlManager();