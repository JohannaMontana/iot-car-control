class ControlManager {
    constructor() {
        // IP de tu servidor EC2 (Asegúrate de que sea la correcta)
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
        console.log('🚀 Iniciando ControlManager...');
        
        this.inicializarSocketIO();
        this.actualizarEstado();
        this.cargarHistorialRapido(); // Cargar lista lateral al inicio
        
        // Cargar demos si existe el gestor de demos
        if (window.demoManager && typeof window.demoManager.cargarDemos === 'function') {
            window.demoManager.cargarDemos();
        }

        // Refresco de seguridad cada 4s
        setInterval(() => {
            this.actualizarEstado();
            this.cargarHistorialRapido();
        }, 4000);
    }

    // ==================== SOCKET.IO (Tiempo Real) ====================

    inicializarSocketIO() {
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

        // 1. Estado de Conexión
        this.socket.on('connect', () => this.actualizarUIConexion(true));
        this.socket.on('disconnect', () => this.actualizarUIConexion(false));

        // 2. Al recibir confirmación de movimiento, recargar historial
        this.socket.on('movimiento_agregado', (data) => {
            // Esperamos un poco para asegurar que el backend guardó en BD
            setTimeout(() => this.cargarHistorialRapido(), 300);
        });

        // 3. ALERTA DE OBSTÁCULO (Crítico)
        this.socket.on('alerta_obstaculo', (data) => {
            console.warn('🚨 Alerta recibida:', data);
            this.mostrarAlertaObstaculo(data);
        });
        
        // 4. Puente para Demos
        this.socket.on('demo_progreso', (d) => { if(window.demoManager) window.demoManager.actualizarProgresoDemo(d); });
        this.socket.on('demo_completada', (d) => { if(window.demoManager) window.demoManager.demoCompletada(d); });
    }

    // ==================== VELOCIDAD Y COMANDOS ====================

    obtenerVelocidadSeleccionada() {
        const radios = document.getElementsByName('velocidad');
        for (const radio of radios) {
            if (radio.checked) return parseInt(radio.value);
        }
        return 180; // Default Media
    }

    async moverCarrito(statusClave) {
        const velocidad = this.obtenerVelocidadSeleccionada();
        
        try {
            // Enviamos movimiento continuo (duracion = 0)
            await fetch(`${this.backendUrl}/api/movimiento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status_clave: statusClave,
                    velocidad: velocidad,
                    duracion_segundos: 0 
                })
            });
        } catch (error) {
            console.error("Error enviando comando:", error);
            this.mostrarNotificacion('Error de conexión', 'danger');
        }
    }

    async detenerCarrito() {
        try {
            await fetch(`${this.backendUrl}/api/detener`, { method: 'POST' });
        } catch (e) { console.error(e); }
    }

    // ==================== HISTORIAL MINIATURA (5 ÚLTIMOS) ====================

    async cargarHistorialRapido() {
        const container = document.getElementById('historialMovimientos');
        if (!container) return;

        try {
            // Consumimos el endpoint que arreglamos en app.py
            const res = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const data = await res.json();

            if (data.success && data.movimientos && data.movimientos.length > 0) {
                // Tomamos solo los 5 más recientes
                const ultimos5 = data.movimientos.slice(0, 5);
                
                let html = '<ul class="list-group list-group-flush">';
                
                ultimos5.forEach(mov => {
                    // Formatear hora (viene como ISO string del backend nuevo)
                    let hora = "Reciente";
                    if (mov.fecha_hora) {
                        const dateObj = new Date(mov.fecha_hora);
                        // Validar si la fecha es válida
                        if (!isNaN(dateObj.getTime())) {
                            hora = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
                        }
                    }

                    // Icono según movimiento
                    let icono = "fa-arrow-right";
                    const texto = (mov.status_texto || "").toLowerCase();
                    if(texto.includes("giro")) icono = "fa-sync";
                    else if(texto.includes("detener")) icono = "fa-stop";
                    else if(texto.includes("adelante")) icono = "fa-arrow-up";
                    else if(texto.includes("atras") || texto.includes("atrás")) icono = "fa-arrow-down";

                    html += `
                        <li class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between px-0 py-2 small align-items-center">
                            <span class="text-truncate">
                                <i class="fas ${icono} me-2 text-info"></i>${mov.status_texto}
                            </span>
                            <span class="badge bg-secondary bg-opacity-50 font-monospace">${hora}</span>
                        </li>
                    `;
                });
                html += '</ul>';
                container.innerHTML = html;
            } else {
                container.innerHTML = '<div class="text-center text-muted py-3 small">Sin movimientos recientes</div>';
            }
        } catch (e) { 
            console.error("Error cargando historial:", e);
            container.innerHTML = '<div class="text-center text-danger small">Error de conexión</div>';
        }
    }

    // ==================== ALERTAS DE OBSTÁCULOS ====================

    mostrarAlertaObstaculo(data) {
        // MAPEO SEGÚN TU BASE DE DATOS
        // Aseguramos que coincida con INSERT INTO referencia_obstaculos...
        const mapaReferencias = {
            1: "Adelante",
            2: "Adelante-Izquierda",
            3: "Adelante-Derecha",
            4: "Adelante-Izquierda-Derecha",
            5: "Retrocede" // Si el robot iba hacia atrás y chocó
        };
        
        const nombreObstaculo = mapaReferencias[data.tipo_obstaculo] || "Obstáculo Detectado";

        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(220, 20, 60, 0.95); color: white; padding: 30px;
            border-radius: 15px; z-index: 11000; text-align: center;
            box-shadow: 0 0 80px rgba(255, 0, 0, 0.8); width: 320px;
            border: 2px solid white; animation: pulse 0.5s infinite alternate;
        `;
        
        div.innerHTML = `
            <i class="fas fa-radiation fa-4x mb-3"></i>
            <h2 class="fw-bold">¡ALERTA!</h2>
            <div class="bg-white text-danger p-2 rounded fw-bold mb-2 text-uppercase fs-5">
                ${nombreObstaculo}
            </div>
            <p class="mb-0">${data.mensaje || ''}</p>
            <hr style="border-color:white; opacity:0.5">
            <small class="d-block text-warning">Acción: ${data.accion}</small>
        `;
        
        document.body.appendChild(div);
        
        // Sonido de alerta
        try { new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play(); } catch(e){}
        
        setTimeout(() => div.remove(), 4000);
    }

    // ==================== UTILIDADES UI ====================

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
            
            // Actualizar badge de estado del Robot
            const elRobot = document.getElementById('robotEstado');
            if (elRobot) {
                const online = data.estado_ws_arduino === 'Conectado';
                elRobot.innerHTML = online 
                    ? '<span class="text-success"><i class="fas fa-wifi me-1"></i> En Línea</span>' 
                    : '<span class="text-danger">Offline</span>';
            }
            
            // Actualizar widget de último movimiento
            const elUltimo = document.getElementById('ultimoMovimiento');
            if (elUltimo && data.ultimo_movimiento) {
                const m = data.ultimo_movimiento;
                elUltimo.innerHTML = `
                    <div class="text-center">
                        <i class="fas fa-history fa-2x mb-2 text-info"></i><br>
                        <strong class="text-white">${m.status_texto}</strong><br>
                        <small class="text-muted">${new Date(m.fecha_hora).toLocaleTimeString()}</small>
                    </div>
                `;
            }
        } catch(e){}
    }

    mostrarNotificacion(msg, type) {
        const div = document.createElement('div');
        const color = type === 'success' ? '#00ff88' : '#ff4444';
        div.style.cssText = `position:fixed; top:20px; right:20px; background:rgba(0,0,0,0.9); color:${color}; border-left:4px solid ${color}; padding:12px 20px; border-radius:4px; z-index:10000; font-family:sans-serif;`;
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    obtenerNombreMovimiento(id) {
        const nombres = {1:"Adelante", 2:"Atrás", 3:"Detener", 4:"Curva Der", 5:"Curva Izq", 8:"Giro Der", 9:"Giro Izq"};
        return nombres[id] || "Movimiento " + id;
    }
}

window.controlManager = new ControlManager();