class ControlManager {
    constructor() {
        // IP de tu servidor EC2
        this.backendUrl = 'http://54.147.92.50:5500';
        this.socket = null;
        
        // Iniciar cuando el HTML esté cargado
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.inicializarApp());
        } else {
            this.inicializarApp();
        }
    }

    inicializarApp() {
        console.log('🚀 ControlManager Iniciado');
        
        this.inicializarSocketIO();
        this.actualizarEstado();
        this.cargarHistorialRapido(); 
        
        // Refresco de seguridad cada 4s
        setInterval(() => {
            this.actualizarEstado();
            this.cargarHistorialRapido();
        }, 4000);
    }

    inicializarSocketIO() {
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

        this.socket.on('connect', () => this.actualizarUIConexion(true));
        this.socket.on('disconnect', () => this.actualizarUIConexion(false));

        // Al mover, recargar historial inmediatamente
        this.socket.on('movimiento_agregado', () => {
            setTimeout(() => this.cargarHistorialRapido(), 300);
        });

        // Alerta de Obstáculo (Popup Rojo)
        this.socket.on('alerta_obstaculo', (d) => this.mostrarAlerta(d));
    }

    getVelocidad() {
        const r = document.querySelector('input[name="velocidad"]:checked');
        return r ? parseInt(r.value) : 180;
    }

    // Obtener fecha local formateada para MySQL
    getLocalTimestamp() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now - offset).toISOString().slice(0, 19).replace('T', ' ');
    }

    async moverCarrito(status) {
        try {
            await fetch(`${this.backendUrl}/api/movimiento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status_clave: status,
                    velocidad: this.getVelocidad(),
                    duracion_segundos: 0, // 0 = Continuo para manual
                    timestamp_local: this.getLocalTimestamp() // <--- HORA DE TU PC
                })
            });
        } catch (e) { console.error(e); }
    }

    async detenerCarrito() {
        try { await fetch(`${this.backendUrl}/api/detener`, { method: 'POST' }); } catch(e){}
    }

    // === HISTORIAL MINIATURA (Panel Lateral) ===
    async cargarHistorialRapido() {
        const cont = document.getElementById('historialMovimientos');
        if(!cont) return;
        
        try {
            const res = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const data = await res.json();
            
            if(data.success && data.movimientos && data.movimientos.length > 0) {
                let html = '<ul class="list-group list-group-flush">';
                // Solo los 5 primeros para el panel lateral
                data.movimientos.slice(0, 5).forEach(m => {
                    let hora = m.fecha_hora;
                    try {
                        if(hora.includes('T')) {
                            hora = new Date(hora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                        } else {
                            hora = hora.split(' ')[1].substring(0,5);
                        }
                    } catch(e) {}

                    html += `
                        <li class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between px-0 py-1 small">
                            <span><i class="fas fa-arrow-right me-2 text-info"></i>${m.status_texto}</span>
                            <span class="text-white-50">${hora}</span>
                        </li>
                    `;
                });
                html += '</ul>';
                cont.innerHTML = html;
            } else {
                cont.innerHTML = '<div class="text-center text-muted small py-2">Sin datos</div>';
            }
        } catch(e) { 
            console.error(e);
            cont.innerHTML = '<div class="text-center text-danger small">Error carga</div>';
        }
    }

    mostrarAlerta(data) {
        // Referencias BD (Obstáculos) - TEXTOS CORRECTOS
        const map = { 
            1: "Adelante", 
            2: "Adelante-Izquierda", 
            3: "Adelante-Derecha", 
            4: "Adelante-Izquierda-Derecha", 
            5: "Retrocede" 
        };
        const txt = map[data.tipo_obstaculo] || "Obstáculo";
        
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(220,20,60,0.95);color:white;padding:30px;border-radius:15px;z-index:11000;text-align:center;width:320px;border:2px solid white;animation:pulse 0.5s infinite alternate;';
        
        div.innerHTML = `
            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
            <h3>¡OBSTÁCULO!</h3>
            <div class="bg-white text-danger p-2 rounded fw-bold mb-2 text-uppercase">${txt}</div>
            <small class="d-block">Evasión: ${data.accion}</small>
        `;
        document.body.appendChild(div);
        
        // Sonido opcional
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
            
            // Estado Robot
            const elRobot = document.getElementById('robotEstado');
            if (elRobot) {
                const online = data.estado_ws_arduino === 'Conectado';
                elRobot.innerHTML = online ? '<span class="text-success">Online</span>' : '<span class="text-danger">Offline</span>';
            }
            
            // Último Movimiento Widget
            const elUltimo = document.getElementById('ultimoMovimiento');
            if(elUltimo && data.ultimo_movimiento) {
                elUltimo.innerHTML = `<div class="text-center"><h5 class="text-info mb-0">${data.ultimo_movimiento.status_texto}</h5></div>`;
            }
        } catch(e){}
    }
    
    // Funciones auxiliares para compatibilidad con otros scripts
    mostrarNotificacion(msg, type) {} 
    obtenerNombreMovimiento(id){ return "Mov "+id; }
}

window.controlManager = new ControlManager();