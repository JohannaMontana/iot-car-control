class ControlManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500'; 
        this.socket = null;
        this.notificationManager = null;
        
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    init() {
        console.log('🚀 Iniciando ControlManager...');
        
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
        
        // Inicializar notification manager
        setTimeout(() => {
            if (window.notificationManager) {
                this.notificationManager = window.notificationManager;
                console.log('🔔 NotificationManager inicializado');
            }
        }, 1000);

        // Cargar datos iniciales
        this.actualizarEstado();
        this.cargarHistorialRapido();
        this.cargarTotalMovimientos();
        
        // Actualizar cada 3 segundos
        setInterval(() => {
            this.actualizarEstado();
        }, 3000);
        
        console.log('✅ ControlManager listo');
    }

    configurarEventosWebSocket() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ WebSocket CONECTADO al servidor');
            this.updateServerLight(true);
            
            // Forzar actualización del estado
            setTimeout(() => this.actualizarEstado(), 1000);
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('❌ WebSocket DESCONECTADO:', reason);
            this.updateServerLight(false);
            this.updateCarLight(false);
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('❌ Error de conexión WebSocket:', error);
        });

        // Eventos de aplicación
        this.socket.on('movimiento_agregado', (data) => {
            console.log('📦 Movimiento agregado recibido:', data);
            
            // Actualizar UI
            setTimeout(() => this.cargarHistorialRapido(), 300);
            this.cargarTotalMovimientos();
            
            // Mostrar notificación
            if (this.notificationManager) {
                const nombre = this.obtenerNombreMovimiento(data.status_clave);
                this.notificationManager.showSuccess(
                    '✅ Movimiento Completado', 
                    `${nombre} ejecutado correctamente`
                );
            }
        });

        this.socket.on('alerta_obstaculo', (data) => {
            console.log('🚨 Alerta de obstáculo:', data);
            
            // Mostrar alerta visual
            this.mostrarAlertaObstaculo(data);
            
            // Notificación
            if (this.notificationManager) {
                const tipo = data.nombre_obstaculo || `Obstáculo ${data.tipo_obstaculo}`;
                
                this.notificationManager.showDanger(
                    '⚠️ ¡Alerta de Obstáculo!',
                    `${tipo} a ${data.distancia || '?'}cm - ${data.accion || 'Evasión automática'}`
                );
            }
            
            // ⚠️ ACTUALIZAR CONTADOR DE ALERTAS EN TIEMPO REAL
            this.incrementarContadorAlertas();
            
            // ⚠️ IMPORTANTE: CORREGIDO - Ya NO enviamos comando urgente automáticamente
            // El Arduino ya maneja su propia evasión
            console.log('⚠️ Alerta recibida - Arduino manejará la evasión automática');
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
                    `"${data.nombre}" finalizada exitosamente`
                );
            }
        });

        this.socket.on('demo_creada', (data) => {
            console.log('📁 Demo creada:', data);
            if (this.notificationManager) {
                this.notificationManager.showSuccess(
                    '📁 Demo Creada',
                    `"${data.nombre}" guardada correctamente`
                );
            }
        });

        this.socket.on('demo_eliminada', (data) => {
            console.log('🗑️ Demo eliminada:', data);
            if (this.notificationManager) {
                this.notificationManager.showWarning(
                    '🗑️ Demo Eliminada',
                    'Secuencia eliminada del sistema'
                );
            }
        });
    }

    // 🆕 NUEVA FUNCIÓN PARA INCREMENTAR CONTADOR DE ALERTAS
    incrementarContadorAlertas() {
        console.log('📈 Incrementando contador de alertas...');
        
        // 1. Actualizar en el panel principal si existe
        const totalAlertas = document.getElementById('totalAlertas');
        if (totalAlertas) {
            const current = parseInt(totalAlertas.textContent) || 0;
            totalAlertas.textContent = current + 1;
            console.log(`✅ totalAlertas incrementado a: ${current + 1}`);
        }
        
        // 2. Actualizar en el modal (KPI)
        const modalMetricAlertas = document.getElementById('modalMetricAlertas');
        if (modalMetricAlertas) {
            const current = parseInt(modalMetricAlertas.textContent) || 0;
            modalMetricAlertas.textContent = current + 1;
            console.log(`✅ modalMetricAlertas incrementado a: ${current + 1}`);
        }
        
        // 3. Actualizar badge del modal
        const modalContadorAlertas = document.getElementById('modalContadorAlertas');
        if (modalContadorAlertas) {
            const current = parseInt(modalContadorAlertas.textContent) || 0;
            modalContadorAlertas.textContent = current + 1;
            modalContadorAlertas.style.display = 'inline-block';
            console.log(`✅ modalContadorAlertas incrementado a: ${current + 1}`);
        }
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
        const movimiento = this.obtenerNombreMovimiento(status);
        const velocidad = this.getVelocidad();
        
        console.log(`🚀 Enviando: ${movimiento} (status: ${status}, velocidad: ${velocidad})`);
        
        try {
            if (this.notificationManager) {
                this.notificationManager.showInfo(
                    '🚀 Enviando Comando',
                    `${movimiento} (Vel: ${velocidad})...`
                );
            }
            
            const response = await fetch(`${this.backendUrl}/api/movimiento`, {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    status_clave: status,
                    velocidad: velocidad,
                    duracion_segundos: 0,
                    timestamp_local: this.getLocalTimestamp()
                })
            });
            
            const data = await response.json();
            console.log('📡 Respuesta:', data);
            
        } catch (e) { 
            console.error("❌ Error:", e);
            if (this.notificationManager) {
                this.notificationManager.showDanger(
                    '❌ Error de Conexión',
                    `${movimiento} - No se pudo conectar`
                );
            }
        }
    }

    async detenerCarrito() {
        console.log('⏹️ Deteniendo carrito...');
        
        try { 
            if (this.notificationManager) {
                this.notificationManager.showWarning('⏹️ Deteniendo', 'Enviando comando...');
            }
            
            const response = await fetch(`${this.backendUrl}/api/detener`, { 
                method: 'POST' 
            });
            
            const data = await response.json();
            console.log('📡 Respuesta detención:', data);
            
            if (data.success) {
                setTimeout(() => {
                    if (this.notificationManager) {
                        this.notificationManager.showSuccess('✅ Robot Detenido', 'Movimiento interrumpido');
                    }
                }, 300);
            }
            
        } catch(e){
            console.error("❌ Error deteniendo:", e);
            if (this.notificationManager) {
                this.notificationManager.showDanger('❌ Error', 'No se pudo detener');
            }
        }
    }

    // HISTORIAL
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

    mostrarAlertaObstaculo(data) {
        const txt = data.nombre_obstaculo || `Obstáculo ${data.tipo_obstaculo}`;
        
        console.log(`🚨 Mostrando alerta: ${txt}`);
        
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(220,20,60,0.98);color:white;padding:30px;border-radius:15px;z-index:11000;text-align:center;width:320px;border:2px solid white;animation:pulse 0.5s infinite alternate;';
        div.innerHTML = `<i class="fas fa-exclamation-triangle fa-3x mb-3"></i><h3>¡OBSTÁCULO!</h3><div class="bg-white text-danger p-2 rounded fw-bold mb-2 text-uppercase">${txt}</div><small class="d-block">Distancia: ${data.distancia || '?'}cm</small><small class="d-block">${data.accion || 'Evasión automática'}</small>`;
        document.body.appendChild(div);
        try { 
            new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play(); 
        } catch(e){}
        setTimeout(() => div.remove(), 3500);
    }
    
    // FUNCIONES DE UI
    actualizarUIConexion(online) {
        console.log(`📡 UI conexión: ${online ? 'Conectado' : 'Desconectado'}`);
    }

    async actualizarEstado() {
        try {
            const res = await fetch(`${this.backendUrl}/api/estado-actual`);
            const data = await res.json();
            
            console.log('📊 Datos estado:', data);
            
            // ACTUALIZAR FOCO DEL CARRO
            if (data.estado_ws_arduino === 'Conectado' || 
                (data.estadisticas && data.estadisticas.total_movimientos !== undefined)) {
                this.updateCarLight(true);
                console.log('✅ Carro CONECTADO - Luz verde');
            } else {
                this.updateCarLight(false);
                console.log('❌ Carro DESCONECTADO - Luz roja');
            }
            
        } catch (e) {
            console.error("❌ Error actualizando estado:", e);
            this.updateCarLight(false);
        }
    }

    // FUNCIONES PARA LAS LUCES
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
        
        console.log(`🚗 Luz carro: ${online ? 'Verde' : 'Rojo'}`);
        
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

    // TOTAL DE MOVIMIENTOS
    async cargarTotalMovimientos() {
        try {
            const res = await fetch(`${this.backendUrl}/api/metricas`);
            const data = await res.json();
            
            let total = 0;
            if (data.movimientos_por_tipo && Array.isArray(data.movimientos_por_tipo)) {
                data.movimientos_por_tipo.forEach(tipo => {
                    total += tipo.cantidad || 0;
                });
            }
            
            const totalMov = document.getElementById('totalMovimientos');
            if (totalMov) {
                totalMov.textContent = total;
            }
            
            const modalMov = document.getElementById('modalMetricMovimientos');
            if (modalMov) {
                modalMov.textContent = total;
            }
            
            console.log(`📊 Total movimientos: ${total}`);
            
        } catch (e) {
            console.error("❌ Error cargando total:", e);
        }
    }

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

    obtenerVelocidadSeleccionada() {
        return this.getVelocidad();
    }
}

window.controlManager = new ControlManager();