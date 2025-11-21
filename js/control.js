class ControlManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500';
        this.socket = null;
        this.estadoApp = {
            conectado: false
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.inicializarApp());
        } else {
            this.inicializarApp();
        }
    }

    inicializarApp() {
        this.inicializarSocketIO();
        this.actualizarEstado();
        this.cargarHistorialRapido(); // Cargar historial al inicio
        
        // Refrescar datos periódicamente
        setInterval(() => {
            this.actualizarEstado();
            this.cargarHistorialRapido();
        }, 4000);

        console.log('✅ ControlManager Listo');
    }

    inicializarSocketIO() {
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

        this.socket.on('connect', () => this.actualizarEstadoConexion(true));
        this.socket.on('disconnect', () => this.actualizarEstadoConexion(false));

        // Actualizar historial inmediatamente cuando se hace un movimiento
        this.socket.on('movimiento_agregado', () => {
            setTimeout(() => this.cargarHistorialRapido(), 500);
        });

        // ALERTA DE OBSTÁCULO
        this.socket.on('alerta_obstaculo', (data) => {
            console.warn('🚨', data);
            this.mostrarAlertaObstaculo(data);
        });
    }

    // === LÓGICA DE VELOCIDAD (Pública para Demos) ===
    obtenerVelocidadSeleccionada() {
        const radios = document.getElementsByName('velocidad');
        for (const radio of radios) {
            if (radio.checked) return parseInt(radio.value);
        }
        return 180;
    }

    // === COMANDOS ===
    async moverCarrito(statusClave) {
        const velocidad = this.obtenerVelocidadSeleccionada();
        
        // Determinar si es continuo (0) o temporizado por defecto
        // 1 y 2 son continuos. El resto (diagonales y giros) son temporizados en Arduino
        let duracion = 0; 
        
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
            this.mostrarNotificacion('Error de conexión', 'danger');
        }
    }

    async detenerCarrito() {
        try {
            await fetch(`${this.backendUrl}/api/detener`, { method: 'POST' });
        } catch (e) { console.error(e); }
    }

    async simularObstaculo() {
        // Simular obstáculo frontal (1)
        try {
            await fetch(`${this.backendUrl}/api/obstaculo`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ status_clave: 1, dispositivo_id: 1 })
            });
        } catch(e) {}
    }

    // === HISTORIAL MINIATURA (Para el panel lateral) ===
    async cargarHistorialRapido() {
        const container = document.getElementById('historialMovimientos');
        if (!container) return;

        try {
            const res = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const data = await res.json();

            if (data.success && data.movimientos && data.movimientos.length > 0) {
                // Mostrar solo los primeros 5
                const ultimos5 = data.movimientos.slice(0, 5);
                let html = '<ul class="list-group list-group-flush">';
                
                ultimos5.forEach(mov => {
                    const hora = new Date(mov.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
                    html += `
                        <li class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between px-0 py-1">
                            <span><i class="fas fa-arrow-right me-2 text-info"></i>${mov.status_texto}</span>
                            <small class="text-muted">${hora}</small>
                        </li>
                    `;
                });
                html += '</ul>';
                container.innerHTML = html;
            } else {
                container.innerHTML = '<div class="text-center text-muted py-2">Sin datos</div>';
            }
        } catch (e) { console.error("Error cargando historial:", e); }
    }

    // === UI ===
    async actualizarEstado() {
        try {
            const res = await fetch(`${this.backendUrl}/api/estado-actual`);
            const data = await res.json();
            
            // Ultimo Movimiento Widget
            const elUltimo = document.getElementById('ultimoMovimiento');
            if (elUltimo && data.ultimo_movimiento) {
                elUltimo.innerHTML = `
                    <div class="text-center">
                        <h5 class="text-info mb-0">${data.ultimo_movimiento.status_texto}</h5>
                        <small class="text-muted">${new Date(data.ultimo_movimiento.fecha_hora).toLocaleTimeString()}</small>
                    </div>
                `;
            }

            // Estado Robot
            const elRobot = document.getElementById('estadoConexion');
            if (elRobot) {
                if(data.estado_ws_arduino === 'Conectado') {
                    elRobot.className = 'badge bg-success';
                    elRobot.innerHTML = '<i class="fas fa-robot me-1"></i>Robot Online';
                } else {
                    elRobot.className = 'badge bg-danger';
                    elRobot.innerHTML = '<i class="fas fa-robot me-1"></i>Robot Offline';
                }
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

    mostrarNotificacion(msg, type) {
        const div = document.createElement('div');
        const color = type === 'success' ? '#00ff88' : '#ff4444';
        div.style.cssText = `position:fixed; top:20px; right:20px; background:rgba(0,0,0,0.8); color:${color}; border:1px solid ${color}; padding:10px 20px; border-radius:5px; z-index:10000;`;
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    mostrarAlertaObstaculo(data) {
        // Mapeo de IDs a Texto para el usuario
        const tipos = {
            1: "Frontal",
            2: "Frontal-Izquierda",
            3: "Frontal-Derecha",
            4: "Encerrado",
            5: "Trasero"
        };
        const donde = tipos[data.tipo_obstaculo] || "Desconocido";

        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.95); color: white; padding: 30px;
            border-radius: 15px; z-index: 10000; text-align: center;
            box-shadow: 0 0 50px rgba(255,0,0,0.6); width: 90%; max-width: 400px;
            animation: pulse 0.5s infinite alternate;
        `;
        div.innerHTML = `
            <i class="fas fa-exclamation-triangle fa-4x mb-3"></i>
            <h2>¡OBSTÁCULO!</h2>
            <h4 class="text-warning">${donde.toUpperCase()}</h4>
            <p class="mb-0 fs-5">${data.mensaje}</p>
            <hr>
            <small>Acción automática: ${data.accion}</small>
        `;
        document.body.appendChild(div);
        
        // Sonido
        try { new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play(); } catch(e){}

        setTimeout(() => div.remove(), 3500);
    }
}

window.controlManager = new ControlManager();