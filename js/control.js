class ControlManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500'; 
        this.socket = null;
        this.notificationManager = null;
        
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    init() {
        console.log('🚀 Iniciando ControlManager...');
        
        // Intentar conectar al WebSocket
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
            this.mostrarNotificacion('Error configurando conexión WebSocket', 'danger');
        }

        // Eventos del WebSocket
        if (this.socket) {
            this.socket.on('connect', () => {
                console.log('✅ Conectado al servidor WebSocket');
                this.actualizarUIConexion(true);
                this.updateServerLight(true);
                
                // Notificar conexión exitosa
                setTimeout(() => {
                    if (window.notificationManager) {
                        window.notificationManager.showSuccess('🔗 Conectado', 'Conexión establecida con el servidor');
                    }
                }, 500);
            });
            
            this.socket.on('disconnect', (reason) => {
                console.log('❌ Desconectado del servidor WebSocket:', reason);
                this.actualizarUIConexion(false);
                this.updateServerLight(false);
                
                // Notificar desconexión
                if (window.notificationManager) {
                    window.notificationManager.showWarning('🔌 Desconectado', 'Conexión WebSocket perdida');
                }
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('❌ Error de conexión WebSocket:', error);
                if (window.notificationManager) {
                    window.notificationManager.showDanger('❌ Error de Conexión', 'No se puede conectar al servidor');
                }
            });

            // Escuchar eventos del servidor
            this.socket.on('movimiento_agregado', (data) => {
                console.log('📦 Evento movimiento_agregado recibido:', data);
                setTimeout(() => this.cargarHistorialRapido(), 500);
                this.cargarTotalMovimientos();
                
                // Notificar movimiento registrado en BD
                if (window.notificationManager) {
                    const movimiento = this.obtenerNombreMovimiento(data.status_clave);
                    window.notificationManager.showSuccess(
                        '✅ Movimiento Ejecutado', 
                        `${movimiento} completado correctamente`
                    );
                }
            });

            this.socket.on('alerta_obstaculo', (data) => {
                console.log('🚨 Alerta de obstáculo recibida:', data);
                this.mostrarAlertaObstaculo(data);

                // Notificar alerta de obstáculo
                if (window.notificationManager) {
                    // 🚨 CORREGIR EL MAPEO - USAR EL DE TU BD
                    const tipos = {
                        1: 'Obstáculo Adelante',
                        2: 'Obstáculo Adelante-Izquierda',
                        3: 'Obstáculo Adelante-Derecha',
                        4: 'Obstáculo Adelante-Izquierda-Derecha',
                        5: 'Obstáculo Retrocede'
                    };
                    const tipo = data.nombre_obstaculo || `Obstáculo ${data.tipo_obstaculo}`;

                    window.notificationManager.showDanger(
                        '⚠️ ¡Alerta de Obstáculo!',
                        `${tipo} a ${data.distancia || '?'}cm - ${data.accion || 'Evasión automática'}`
                    );
                }
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
                
                // Notificar demo completada
                if (window.notificationManager) {
                    window.notificationManager.showSuccess(
                        '🎉 Demo Completada',
                        `"${data.nombre}" finalizada exitosamente`
                    );
                }
            });

            this.socket.on('demo_creada', (data) => {
                console.log('📁 Demo creada:', data);
                // Notificar demo creada
                if (window.notificationManager) {
                    window.notificationManager.showSuccess(
                        '📁 Demo Creada',
                        `"${data.nombre}" guardada correctamente`
                    );
                }
            });

            this.socket.on('demo_eliminada', (data) => {
                console.log('🗑️ Demo eliminada:', data);
                // Notificar demo eliminada
                if (window.notificationManager) {
                    window.notificationManager.showWarning(
                        '🗑️ Demo Eliminada',
                        'Secuencia eliminada del sistema'
                    );
                }
            });
        }

        // Inicializar notification manager
        setTimeout(() => {
            if (window.notificationManager) {
                this.notificationManager = window.notificationManager;
                console.log('🔔 NotificationManager inicializado');
            } else {
                console.warn('⚠️ NotificationManager no encontrado');
            }
        }, 1000);

        // Cargar datos iniciales
        this.actualizarEstado();
        this.cargarHistorialRapido();
        this.cargarTotalMovimientos();
        
        // Actualizar periódicamente
        setInterval(() => {
            this.actualizarEstado();
            this.cargarHistorialRapido();
            this.cargarTotalMovimientos();
        }, 4000);
        
        console.log('✅ ControlManager inicializado correctamente');
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
        
        console.log(`🚀 Intentando mover carrito: ${movimiento} (status: ${status}, velocidad: ${velocidad})`);
        
        try {
            // Notificar inmediatamente al usuario
            if (window.notificationManager) {
                window.notificationManager.showInfo(
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
            console.log('📡 Respuesta del servidor:', data);
            
            if (data.success) {
                // Notificación de éxito se manejará por WebSocket (movimiento_agregado)
                console.log('✅ Comando enviado exitosamente');
            } else {
                // Notificar error del servidor
                if (window.notificationManager) {
                    window.notificationManager.showDanger(
                        '❌ Error del Servidor',
                        `${movimiento} - El servidor reportó un error`
                    );
                }
            }
            
        } catch (e) { 
            console.error("❌ Error moviendo carrito:", e);
            
            // Notificar error de conexión
            if (window.notificationManager) {
                window.notificationManager.showDanger(
                    '❌ Error de Conexión',
                    `${movimiento} - No se pudo conectar con el servidor`
                );
            }
        }
    }

    async detenerCarrito() {
        console.log('⏹️ Intentando detener carrito...');
        
        try { 
            // Notificar
            if (window.notificationManager) {
                window.notificationManager.showWarning('⏹️ Deteniendo', 'Enviando comando de detención...');
            }
            
            const response = await fetch(`${this.backendUrl}/api/detener`, { 
                method: 'POST' 
            });
            
            const data = await response.json();
            console.log('📡 Respuesta de detención:', data);
            
            if (data.success) {
                // Notificar éxito de detención
                setTimeout(() => {
                    if (window.notificationManager) {
                        window.notificationManager.showSuccess('✅ Robot Detenido', 'Movimiento interrumpido correctamente');
                    }
                }, 300);
            }
            
        } catch(e){
            console.error("❌ Error deteniendo carrito:", e);
            
            if (window.notificationManager) {
                window.notificationManager.showDanger('❌ Error', 'No se pudo detener el carro');
            }
        }
    }

    async simularObstaculo() {
        console.log('⚠️ Simulando obstáculo...');
        
        try {
            // Notificar simulación
            if (window.notificationManager) {
                window.notificationManager.showWarning('⚠️ Simulando Obstáculo', 'Enviando señal de prueba...');
            }
            
            const response = await fetch(`${this.backendUrl}/api/obstaculo`, {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ status_clave: 1, dispositivo_id: 1 })
            });
            
            const data = await response.json();
            console.log('📡 Respuesta de simulación:', data);
            
        } catch(e) {
            console.error("❌ Error simulando obstáculo:", e);
            if (window.notificationManager) {
                window.notificationManager.showDanger('❌ Error', 'No se pudo simular obstáculo');
            }
        }
    }

    // HISTORIAL CORREGIDO
    async cargarHistorialRapido() {
        const cont = document.getElementById('historialMovimientos');
        if (!cont) return;

        try {
            console.log('📋 Cargando historial...');
            const res = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const data = await res.json();
            console.log('📊 Datos historial recibidos:', data);

            if (data.success && Array.isArray(data.movimientos) && data.movimientos.length > 0) {
                const ultimos5 = data.movimientos.slice(0, 5);
                
                let html = '<ul class="list-group list-group-flush">';
                ultimos5.forEach(mov => {
                    let hora = '--:--';
                    if(mov.fecha_hora) {
                        try {
                            const timePart = String(mov.fecha_hora).split(' ')[1] || '';
                            hora = timePart.substring(0,5);
                        } catch(e) {
                            console.log('Error parseando hora:', e);
                        }
                    }

                    html += `
                        <li class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between px-0 py-2 small">
                            <span><i class="fas fa-check me-2 text-success"></i>${mov.status_texto || 'Movimiento'}</span>
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
            console.error("❌ Error cargando historial:", e);
            cont.innerHTML = '<div class="text-center text-danger small py-2">Error de conexión</div>';
        }
    }

    mostrarAlertaObstaculo(data) {
        const map = { 
            1: "Adelante", 2: "Adelante-Izquierda", 3: "Adelante-Derecha", 
            4: "Adelante-Izq-Der", 5: "Retrocede" 
        };
        const txt = data.nombre_obstaculo || `Obstáculo ${data.tipo_obstaculo}`;
        
        console.log(`🚨 Mostrando alerta visual: ${txt}`);
        
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(220,20,60,0.98);color:white;padding:30px;border-radius:15px;z-index:11000;text-align:center;width:320px;border:2px solid white;animation:pulse 0.5s infinite alternate;';
        div.innerHTML = `<i class="fas fa-exclamation-triangle fa-3x mb-3"></i><h3>¡OBSTÁCULO!</h3><div class="bg-white text-danger p-2 rounded fw-bold mb-2 text-uppercase">${txt}</div><small class="d-block">Acción: ${data.accion || 'Robot detenido'}</small>`;
        document.body.appendChild(div);
        try { 
            new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play(); 
        } catch(e){
            console.log('No se pudo reproducir sonido');
        }
        setTimeout(() => div.remove(), 3500);
    }
    
    // FUNCIONES DE UI
    actualizarUIConexion(online) {
        const estadoConexion = document.getElementById('estadoConexion');
        const textoConexion = document.getElementById('textoConexion');
        const statusIndicator = document.querySelector('.status-indicator');
        
        console.log(`📡 Actualizando UI conexión: ${online ? 'Conectado' : 'Desconectado'}`);
        
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
        console.log('📊 Actualizando estado...');
        const res = await fetch(`${this.backendUrl}/api/estado-actual`);
        const data = await res.json();
        console.log('📡 Datos estado recibidos:', data);
        
        const robotEstado = document.getElementById('robotEstado');
        if (robotEstado) {
            // CORREGIDO: Verifica correctamente la conexión
            if (data.estado_ws_arduino === 'Conectado' || data.conexiones_count > 0) {
                robotEstado.innerHTML = '<span class="text-success fw-bold">En Línea</span>';
                this.updateCarLight(true);
                console.log('✅ Carro CONECTADO - Luz verde');
            } else {
                robotEstado.innerHTML = '<span class="text-danger fw-bold">Offline</span>';
                this.updateCarLight(false);
                console.log('❌ Carro DESCONECTADO - Luz roja');
            }
        }
    } catch (e) {
        console.error("❌ Error actualizando estado:", e);
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
        
        console.log(`💡 Actualizando luz servidor: ${online ? 'Verde' : 'Rojo'}`);
        
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
        
        console.log(`🚗 Actualizando luz carro: ${online ? 'Verde' : 'Rojo'}`);
        
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
        console.log('📈 Cargando total de movimientos...');
        const res = await fetch(`${this.backendUrl}/api/metricas`);
        const data = await res.json();
        
        // CORREGIDO: Sumar todos los movimientos
        let totalMovimientos = 0;
        if (data.movimientos_por_tipo && Array.isArray(data.movimientos_por_tipo)) {
            data.movimientos_por_tipo.forEach(tipo => {
                totalMovimientos += tipo.cantidad || 0;
            });
        }
        
        console.log('📊 Total movimientos calculados:', totalMovimientos);
        
        const totalMov = document.getElementById('totalMovimientos');
        if (totalMov) {
            totalMov.textContent = totalMovimientos;
        }
        
        // También actualizar en el modal
        const modalMov = document.getElementById('modalMetricMovimientos');
        if (modalMov) {
            modalMov.textContent = totalMovimientos;
        }
    } catch (e) {
        console.error("❌ Error cargando total de movimientos:", e);
    }
}

    mostrarNotificacion(msg, type) {
        console.log(`🔔 Mostrando notificación: ${type} - ${msg}`);
        
        // Usar el nuevo sistema si está disponible
        if (window.notificationManager) {
            const methodName = `show${type.charAt(0).toUpperCase() + type.slice(1)}`;
            if (typeof window.notificationManager[methodName] === 'function') {
                const title = type === 'success' ? '✅ Éxito' : 
                             type === 'danger' ? '❌ Error' : 
                             type === 'warning' ? '⚠️ Advertencia' : 'ℹ️ Información';
                window.notificationManager[methodName](title, msg);
                return;
            }
        }
        
        // Fallback al sistema antiguo
        const div = document.createElement('div');
        div.className = `alert alert-${type} position-fixed`;
        div.style.cssText = 'top: 20px; right: 20px; z-index: 10000; min-width: 300px;';
        div.innerHTML = msg;
        
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
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