class ControlManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500'; 
        this.socket = null;
        
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    init() {
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

        this.socket.on('connect', () => {
            this.actualizarUIConexion(true);
            this.updateServerLight(true);
        });
        
        this.socket.on('disconnect', () => {
            this.actualizarUIConexion(false);
            this.updateServerLight(false);
        });

        this.socket.on('movimiento_agregado', () => {
            setTimeout(() => this.cargarHistorialRapido(), 500);
            this.cargarTotalMovimientos(); // Actualizar contador
        });

        this.socket.on('alerta_obstaculo', (data) => this.mostrarAlertaObstaculo(data));

        // ESCUCHAR EVENTOS DE DEMO
        this.socket.on('demo_progreso', (data) => {
            if (window.demoManager) {
                window.demoManager.actualizarProgresoDemo(data);
            }
        });

        this.socket.on('demo_completada', (data) => {
            if (window.demoManager) {
                window.demoManager.demoCompletada(data);
            }
        });

        this.actualizarEstado();
        this.cargarHistorialRapido();
        this.cargarTotalMovimientos();
        
        setInterval(() => {
            this.actualizarEstado();
            this.cargarHistorialRapido();
            this.cargarTotalMovimientos();
        }, 4000);
    }

    // FUNCIONES ORIGINALES MANTENIDAS
    getVelocidad() {
        const r = document.querySelector('input[name="velocidad"]:checked');
        return r ? parseInt(r.value) : 180;
    }

    getLocalTimestamp() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now - offset).toISOString().slice(0, 19).replace('T', ' ');
    }

    async moverCarrito(status) {
        try {
            await fetch(`${this.backendUrl}/api/movimiento`, {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    status_clave: status,
                    velocidad: this.getVelocidad(),
                    duracion_segundos: 0,
                    timestamp_local: this.getLocalTimestamp()
                })
            });
        } catch (e) { 
            console.error("Error moviendo carrito:", e);
            this.mostrarNotificacion('Error de conexión', 'danger');
        }
    }

    async detenerCarrito() {
        try { 
            await fetch(`${this.backendUrl}/api/detener`, { method: 'POST' }); 
        } catch(e){
            console.error("Error deteniendo carrito:", e);
        }
    }

    async simularObstaculo() {
        try {
            await fetch(`${this.backendUrl}/api/obstaculo`, {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ status_clave: 1, dispositivo_id: 1 })
            });
        } catch(e) {
            console.error("Error simulando obstáculo:", e);
        }
    }

    // HISTORIAL CORREGIDO (Muestra 5 items) - MANTENIDO
    async cargarHistorialRapido() {
        const cont = document.getElementById('historialMovimientos');
        if (!cont) return;

        try {
            const res = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const data = await res.json();

            if (data.success && Array.isArray(data.movimientos) && data.movimientos.length > 0) {
                const ultimos5 = data.movimientos.slice(0, 5);
                
                let html = '<ul class="list-group list-group-flush">';
                ultimos5.forEach(mov => {
                    let hora = '...';
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
                cont.innerHTML = '<div class="text-center text-muted small py-2">Sin movimientos registrados</div>';
            }
        } catch (e) { 
            console.error("Error cargando historial:", e);
            cont.innerHTML = '<div class="text-center text-danger small py-2">Error de conexión</div>';
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
        div.innerHTML = `<i class="fas fa-exclamation-triangle fa-3x mb-3"></i><h3>¡OBSTÁCULO!</h3><div class="bg-white text-danger p-2 rounded fw-bold mb-2 text-uppercase">${txt}</div><small class="d-block">Acción: ${data.accion}</small>`;
        document.body.appendChild(div);
        try { 
            new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play(); 
        } catch(e){}
        setTimeout(() => div.remove(), 3500);
    }
    
    // FUNCIONES DE UI MANTENIDAS
    actualizarUIConexion(online) {
        const estadoConexion = document.getElementById('estadoConexion');
        const textoConexion = document.getElementById('textoConexion');
        const statusIndicator = document.querySelector('.status-indicator');
        
        if (online) {
            if (estadoConexion) {
                estadoConexion.className = 'badge bg-success';
                estadoConexion.textContent = 'Conectado';
            }
            if (textoConexion) {
                textoConexion.textContent = 'Conectado';
            }
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator status-online pulse';
            }
        } else {
            if (estadoConexion) {
                estadoConexion.className = 'badge bg-danger';
                estadoConexion.textContent = 'Desconectado';
            }
            if (textoConexion) {
                textoConexion.textContent = 'Desconectado';
            }
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator status-offline';
            }
        }
    }

    async actualizarEstado() {
        try {
            const res = await fetch(`${this.backendUrl}/api/estado-actual`);
            const data = await res.json();
            
            const robotEstado = document.getElementById('robotEstado');
            if (robotEstado) {
                if (data.estado_ws_arduino === 'Conectado') {
                    robotEstado.innerHTML = '<span class="text-success fw-bold">En Línea</span>';
                    this.updateCarLight(true);
                } else {
                    robotEstado.innerHTML = '<span class="text-danger fw-bold">Offline</span>';
                    this.updateCarLight(false);
                }
            }
        } catch (e) {
            console.error("Error actualizando estado:", e);
            const robotEstado = document.getElementById('robotEstado');
            if (robotEstado) {
                robotEstado.innerHTML = '<span class="text-warning fw-bold">Error</span>';
                this.updateCarLight(false);
            }
        }
    }

    // NUEVAS FUNCIONES PARA LAS LUCES
    updateServerLight(online) {
        const serverLight = document.getElementById('serverLight');
        const serverStatus = document.getElementById('serverStatus');
        
        if (serverLight) {
            serverLight.classList.remove('online');
            if (online) {
                serverLight.classList.add('online');
            }
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
            if (online) {
                carLight.classList.add('online');
            }
        }
        
        if (carStatus) {
            carStatus.textContent = online ? 'Carro ✓' : 'Carro ✗';
            carStatus.className = online ? 'text-success' : 'text-danger';
        }
    }

    // FUNCIÓN NUEVA: Cargar total de movimientos
    async cargarTotalMovimientos() {
        try {
            const res = await fetch(`${this.backendUrl}/api/metricas`);
            const data = await res.json();
            
            const totalMov = document.getElementById('totalMovimientos');
            if (totalMov && data.total_movimientos !== undefined) {
                totalMov.textContent = data.total_movimientos;
            }
            
            // También actualizar en el modal si está abierto
            const modalMov = document.getElementById('modalMetricMovimientos');
            if (modalMov) {
                modalMov.textContent = data.total_movimientos || 0;
            }
        } catch (e) {
            console.error("Error cargando total de movimientos:", e);
        }
    }

    mostrarNotificacion(msg, type) {
        const div = document.createElement('div');
        div.className = `alert alert-${type} position-fixed`;
        div.style.cssText = 'top: 20px; right: 20px; z-index: 10000; min-width: 300px;';
        div.innerHTML = msg;
        
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    obtenerNombreMovimiento(id) {
        const movimientos = {
            1: "Adelante", 2: "Atrás", 3: "Detener",
            4: "Adelante-Derecha", 5: "Adelante-Izquierda", 
            6: "Atrás-Derecha", 7: "Atrás-Izquierda",
            8: "Giro Derecha", 9: "Giro Izquierda",
            10: "Vuelta 360° Derecha", 11: "Vuelta 360° Izquierda"
        };
        return movimientos[id] || `Mov ${id}`;
    }

    obtenerVelocidadSeleccionada() {
        return this.getVelocidad();
    }
}

window.controlManager = new ControlManager();