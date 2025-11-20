class MonitoreoManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500';
        this.estadoApp = {
            conectado: true,
            websocketConectado: false,
            metricas: {},
            alertas: [],
            estadoArduino: null,
            actividadChart: null,
            vistaGrafico: 'hora',
            ultimaActualizacion: new Date()
        };

        this.inicializarApp();
    }

    inicializarApp() {
        this.registrarManejadorWebSocket();
        this.actualizarEstadoConexion(true);
        this.actualizarDatos();
        this.inicializarGrafico();
        
        console.log('MonitoreoManager inicializado (HTTP + WebSockets)');
    }

    registrarManejadorWebSocket() {
        // Registrar este manager para recibir mensajes WebSocket del controlManager
        if (window.controlManager) {
            // Sobrescribir el manejador de mensajes para incluir monitoreo
            const manejadorOriginal = window.controlManager.manejarMensajeWebSocket;
            window.controlManager.manejarMensajeWebSocket = (mensaje) => {
                // Manejar mensajes de monitoreo
                if (mensaje.tipo && (mensaje.tipo === 'estado_arduino' || mensaje.tipo === 'obstaculo_detectado')) {
                    this.manejarMensajeMonitoreo(mensaje);
                } else {
                    // Llamar al manejador original para otros mensajes
                    if (manejadorOriginal) {
                        manejadorOriginal.call(window.controlManager, mensaje);
                    }
                }
            };
        }
    }

    manejarMensajeMonitoreo(mensaje) {
        console.log('Mensaje monitoreo recibido:', mensaje);
        
        switch(mensaje.tipo) {
            case 'estado_arduino':
                this.actualizarEstadoArduinoTiempoReal(mensaje.data);
                break;
                
            case 'obstaculo_detectado':
                this.agregarAlertaTiempoReal(mensaje);
                break;
                
            case 'movimiento_ejecutado':
                this.registrarMovimientoTiempoReal(mensaje);
                break;
        }
        
        this.estadoApp.ultimaActualizacion = new Date();
        this.actualizarTimestamp();
    }

    actualizarEstadoArduinoTiempoReal(datosArduino) {
        this.estadoApp.estadoArduino = datosArduino;
        
        // Actualizar métricas en tiempo real
        this.actualizarMetricasTiempoReal(datosArduino);
        
        // Actualizar gráfico si está en vista en tiempo real
        if (this.estadoApp.vistaGrafico === 'tiempo_real') {
            this.actualizarGraficoTiempoReal(datosArduino);
        }
    }

    agregarAlertaTiempoReal(alertaData) {
        const alerta = {
            tipo: 'obstaculo',
            distancia: alertaData.distancia,
            timestamp: new Date().toISOString(),
            severidad: alertaData.distancia < 15 ? 'alta' : 'media',
            mensaje: `Obstáculo detectado a ${alertaData.distancia}cm`
        };
        
        this.agregarAlerta(alerta);
        
        // Actualizar contadores en tiempo real
        this.actualizarMetricasRapidas();
    }

    registrarMovimientoTiempoReal(movimientoData) {
        // Podemos usar esta información para actualizar estadísticas en tiempo real
        console.log('Movimiento registrado en tiempo real:', movimientoData);
        
        // Actualizar timestamp de última actividad
        this.estadoApp.ultimaActualizacion = new Date();
        this.actualizarTimestamp();
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    async actualizarDatos() {
        try {
            // Cargar estado actual
            const estadoResponse = await fetch(`${this.backendUrl}/api/estado-actual`);
            const estadoData = await estadoResponse.json();
            
            // Cargar métricas
            const metricasResponse = await fetch(`${this.backendUrl}/api/metricas`);
            const metricasData = await metricasResponse.json();
            
            // Cargar alertas
            const alertasResponse = await fetch(`${this.backendUrl}/api/alertas`);
            const alertasData = await alertasResponse.json();
            
            this.estadoApp.metricas = metricasData;
            this.estadoApp.alertas = alertasData.alertas || [];
            this.estadoApp.ultimaActualizacion = new Date();
            
            this.actualizarInterfaz(estadoData, metricasData);
            this.actualizarGrafico();
            this.actualizarTimestamp();
            
        } catch (error) {
            console.error('Error actualizando datos:', error);
            this.actualizarEstadoConexion(false);
        }
    }

    actualizarInterfaz(estadoData, metricasData) {
        // Actualizar métricas principales
        const metricEstado = document.getElementById('metricEstado');
        const metricMovimientos = document.getElementById('metricMovimientos');
        const metricAlertas = document.getElementById('metricAlertas');
        const metricTiempo = document.getElementById('metricTiempo');
        
        if (metricEstado) metricEstado.textContent = 'Activo';
        if (metricMovimientos) metricMovimientos.textContent = estadoData.estadisticas?.total_movimientos || '0';
        if (metricAlertas) metricAlertas.textContent = this.estadoApp.alertas.length;
        if (metricTiempo) metricTiempo.textContent = `${estadoData.estadisticas?.dias_activo || 0}d`;
        
        // Actualizar información de WebSocket si está disponible
        if (estadoData.websocket_clients !== undefined) {
            this.actualizarInfoWebSocket(estadoData.websocket_clients);
        }
        
        // Actualizar estadísticas de movimientos
        this.actualizarEstadisticasMovimientos(metricasData);
        
        // Actualizar información del sistema
        const infoServidor = document.getElementById('infoServidor');
        if (infoServidor) {
            const modo = window.controlManager && window.controlManager.estadoApp.websocketConectado ? 'WebSocket' : 'HTTP';
            infoServidor.textContent = `Conectado (${modo})`;
        }
        
        // Actualizar contador de alertas
        const contadorAlertas = document.getElementById('contadorAlertas');
        if (contadorAlertas) contadorAlertas.textContent = this.estadoApp.alertas.length;
    }

    actualizarMetricasTiempoReal(datosArduino) {
        // Actualizar información en tiempo real del Arduino
        const containerEstado = document.getElementById('estadoArduinoTiempoReal');
        if (containerEstado && datosArduino) {
            containerEstado.innerHTML = `
                <div class="row small g-2">
                    <div class="col-6">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-ruler-vertical me-2 text-info"></i>
                            <div>
                                <div class="fw-bold">${datosArduino.distancia}cm</div>
                                <small class="text-muted">Distancia</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-signal me-2 text-success"></i>
                            <div>
                                <div class="fw-bold">${datosArduino.rssi}dBm</div>
                                <small class="text-muted">Señal WiFi</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-play-circle me-2 text-warning"></i>
                            <div>
                                <div class="fw-bold">${datosArduino.status_actual}</div>
                                <small class="text-muted">Estado</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-bolt me-2 ${datosArduino.movimiento_activo ? 'text-success' : 'text-muted'}"></i>
                            <div>
                                <div class="fw-bold">${datosArduino.movimiento_activo ? 'Activo' : 'Inactivo'}</div>
                                <small class="text-muted">Movimiento</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    actualizarEstadisticasMovimientos(metricasData) {
        let adelante = 0, atras = 0, giros = 0, vueltas = 0;
        
        if (metricasData.movimientos_por_tipo) {
            metricasData.movimientos_por_tipo.forEach(mov => {
                if (mov.status_texto.includes('Adelante')) adelante += mov.cantidad;
                else if (mov.status_texto.includes('Atrás')) atras += mov.cantidad;
                else if (mov.status_texto.includes('Giro')) giros += mov.cantidad;
                else if (mov.status_texto.includes('Vuelta')) vueltas += mov.cantidad;
            });
        }
        
        const statAdelante = document.getElementById('statAdelante');
        const statAtras = document.getElementById('statAtras');
        const statGiros = document.getElementById('statGiros');
        const statVueltas = document.getElementById('statVueltas');
        
        if (statAdelante) statAdelante.textContent = adelante;
        if (statAtras) statAtras.textContent = atras;
        if (statGiros) statGiros.textContent = giros;
        if (statVueltas) statVueltas.textContent = vueltas;
    }

    agregarAlerta(alertaData) {
        this.estadoApp.alertas.unshift(alertaData);
        if (this.estadoApp.alertas.length > 10) {
            this.estadoApp.alertas = this.estadoApp.alertas.slice(0, 10);
        }
        this.actualizarListaAlertas();
    }

    actualizarListaAlertas() {
        const container = document.getElementById('alertasContainer');
        if (!container) return;
        
        if (this.estadoApp.alertas.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-bell-slash fa-2x mb-2"></i><br>
                    No hay alertas recientes
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        this.estadoApp.alertas.forEach((alerta, index) => {
            const alertaItem = document.createElement('div');
            alertaItem.className = `alert-item ${alerta.severidad === 'alta' ? 'danger' : 'warning'} mb-2 p-2 rounded`;
            alertaItem.style.background = alerta.severidad === 'alta' ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255, 149, 0, 0.1)';
            alertaItem.style.border = alerta.severidad === 'alta' ? '1px solid rgba(255, 68, 68, 0.3)' : '1px solid rgba(255, 149, 0, 0.3)';
            
            const fecha = new Date(alerta.timestamp);
            alertaItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <strong>
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${alerta.tipo === 'obstaculo' ? 'Obstáculo Detectado' : 'Alerta del Sistema'}
                        </strong>
                        <br>
                        <small class="text-muted">${alerta.mensaje}</small>
                    </div>
                    <div class="text-end ms-2">
                        <small class="text-muted">${fecha.toLocaleTimeString()}</small>
                        <br>
                        <span class="badge" style="background: ${alerta.severidad === 'alta' ? '#ff4444' : '#ff9500'};">
                            ${alerta.severidad}
                        </span>
                    </div>
                </div>
            `;
            container.appendChild(alertaItem);
        });
    }

    actualizarMetricasRapidas() {
        // Actualización rápida sin recargar todo
        const metricAlertas = document.getElementById('metricAlertas');
        const contadorAlertas = document.getElementById('contadorAlertas');
        
        if (metricAlertas) metricAlertas.textContent = this.estadoApp.alertas.length;
        if (contadorAlertas) contadorAlertas.textContent = this.estadoApp.alertas.length;
        
        this.actualizarTimestamp();
    }

    actualizarTimestamp() {
        const infoActualizacion = document.getElementById('infoActualizacion');
        if (infoActualizacion) {
            infoActualizacion.textContent = this.estadoApp.ultimaActualizacion.toLocaleTimeString();
        }
    }

    actualizarInfoWebSocket(clientesConectados) {
        const badge = document.getElementById('estadoWebSocketMonitoreo');
        if (badge) {
            const websocketActivo = window.controlManager && window.controlManager.estadoApp.websocketConectado;
            if (websocketActivo) {
                badge.innerHTML = `<i class="fas fa-plug me-1"></i>WebSocket (${clientesConectados})`;
                badge.style.background = '#00ff88';
            } else {
                badge.innerHTML = '<i class="fas fa-unplug me-1"></i>HTTP';
                badge.style.background = '#ff9500';
            }
        }
    }

    // ==================== GRÁFICOS ====================

    inicializarGrafico() {
        const ctx = document.getElementById('actividadChart');
        if (!ctx) return;
        
        this.estadoApp.actividadChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Movimientos por Hora',
                    data: [],
                    borderColor: '#ff2d95',
                    backgroundColor: 'rgba(255, 45, 149, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff'
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#b0b0b0' }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#b0b0b0' }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                }
            }
        });
    }

    actualizarGrafico() {
        if (!this.estadoApp.actividadChart) return;

        if (this.estadoApp.vistaGrafico === 'hora') {
            // Datos de ejemplo por hora (en producción usarías datos reales)
            const horas = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
            const movimientos = [5, 8, 12, 7, 15, 9];
            
            this.estadoApp.actividadChart.data.labels = horas;
            this.estadoApp.actividadChart.data.datasets[0].data = movimientos;
            this.estadoApp.actividadChart.data.datasets[0].label = 'Movimientos por Hora';
        } else if (this.estadoApp.vistaGrafico === 'tiempo_real') {
            // Datos en tiempo real - simular con datos aleatorios
            const ahora = new Date();
            const labels = Array.from({length: 10}, (_, i) => {
                const tiempo = new Date(ahora.getTime() - (9 - i) * 60000);
                return tiempo.toLocaleTimeString('es-ES', { minute: '2-digit', second: '2-digit' });
            });
            
            const datos = Array.from({length: 10}, () => Math.floor(Math.random() * 5));
            
            this.estadoApp.actividadChart.data.labels = labels;
            this.estadoApp.actividadChart.data.datasets[0].data = datos;
            this.estadoApp.actividadChart.data.datasets[0].label = 'Actividad en Tiempo Real';
        } else {
            // Datos por tipo de movimiento
            if (this.estadoApp.metricas.movimientos_por_tipo) {
                const tipos = this.estadoApp.metricas.movimientos_por_tipo.map(m => m.status_texto);
                const cantidades = this.estadoApp.metricas.movimientos_por_tipo.map(m => m.cantidad);
                
                this.estadoApp.actividadChart.data.labels = tipos;
                this.estadoApp.actividadChart.data.datasets[0].data = cantidades;
                this.estadoApp.actividadChart.data.datasets[0].label = 'Movimientos por Tipo';
            }
        }
        
        this.estadoApp.actividadChart.update();
    }

    actualizarGraficoTiempoReal(datosArduino) {
        if (!this.estadoApp.actividadChart || this.estadoApp.vistaGrafico !== 'tiempo_real') return;
        
        // Aquí podrías actualizar el gráfico con datos en tiempo real del Arduino
        // Por ejemplo, podrías mostrar la distancia del sensor en tiempo real
        console.log('Actualizando gráfico tiempo real con:', datosArduino);
    }

    cambiarVistaGrafico(vista) {
        this.estadoApp.vistaGrafico = vista;
        this.actualizarGrafico();
        
        // Mostrar u ocultar sección de tiempo real según la vista
        const seccionTiempoReal = document.getElementById('seccionTiempoReal');
        if (seccionTiempoReal) {
            seccionTiempoReal.style.display = vista === 'tiempo_real' ? 'block' : 'none';
        }
    }

    // ==================== FUNCIONES UTILITARIAS ====================

    actualizarEstadoConexion(conectado) {
        this.estadoApp.conectado = conectado;
        const estadoElement = document.querySelector('.estado-conexion');
        const indicator = estadoElement?.querySelector('.status-indicator');
        const infoEstado = document.getElementById('infoEstado');
        
        if (!estadoElement) return;
        
        if (conectado) {
            const modo = window.controlManager && window.controlManager.estadoApp.websocketConectado ? 'WebSocket' : 'HTTP';
            indicator.className = 'status-indicator status-online pulse';
            estadoElement.innerHTML = `<span class="status-indicator status-online pulse"></span>Conectado al servidor (${modo})`;
            if (infoEstado) {
                infoEstado.innerHTML = `<i class="fas fa-wifi me-1"></i>Online (${modo})`;
                infoEstado.style.background = '#00ff88';
            }
        } else {
            indicator.className = 'status-indicator status-offline';
            estadoElement.innerHTML = '<span class="status-indicator status-offline"></span>Desconectado del servidor';
            if (infoEstado) {
                infoEstado.innerHTML = '<i class="fas fa-wifi-slash me-1"></i>Offline';
                infoEstado.style.background = '#ff4444';
            }
        }
    }

    async verMetricasAvanzadas() {
        try {
            const response = await fetch(`${this.backendUrl}/api/estadisticas-obstaculos`);
            const data = await response.json();
            
            const contenido = document.getElementById('metricasContenido');
            if (contenido) {
                contenido.innerHTML = `
                    <div class="row">
                        <div class="col-md-6">
                            <h6>Obstáculos por Tipo</h6>
                            <div class="list-group">
                                ${data.obstaculos_por_tipo ? data.obstaculos_por_tipo.map(obs => `
                                    <div class="list-group-item d-flex justify-content-between align-items-center" 
                                         style="background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1);">
                                        <span>${obs.status_texto}</span>
                                        <span class="badge" style="background: var(--accent-pink);">${obs.cantidad}</span>
                                    </div>
                                `).join('') : '<p class="text-muted">No hay datos</p>'}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <h6>Tasa de Resolución</h6>
                            <div class="list-group">
                                ${data.obstaculos_por_tipo ? data.obstaculos_por_tipo.map(obs => `
                                    <div class="list-list-group-item d-flex justify-content-between align-items-center" 
                                         style="background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1);">
                                        <span>${obs.status_texto}</span>
                                        <span class="badge" style="background: var(--accent-cyan);">
                                            ${Math.round(obs.tasa_resolucion * 100)}%
                                        </span>
                                    </div>
                                `).join('') : '<p class="text-muted">No hay datos</p>'}
                            </div>
                        </div>
                    </div>
                `;
            }
            
            const metricasModal = new bootstrap.Modal(document.getElementById('metricasModal'));
            metricasModal.show();
        } catch (error) {
            console.error('Error cargando métricas avanzadas:', error);
            this.mostrarNotificacion('Error cargando métricas avanzadas', 'danger');
        }
    }

    mostrarNotificacion(mensaje, tipo) {
        const toast = document.createElement('div');
        const bgColor = tipo === 'success' ? '#00ff88' : 
                       tipo === 'warning' ? '#ff9500' : 
                       tipo === 'danger' ? '#ff4444' : '#8a2be2';
        
        toast.className = `alert alert-dismissible fade show position-fixed`;
        toast.style.cssText = `
            top: 20px; 
            right: 20px; 
            z-index: 1050; 
            min-width: 300px;
            background: ${bgColor}15;
            backdrop-filter: blur(10px);
            border: 1px solid ${bgColor}30;
            color: white;
        `;
        toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${tipo === 'success' ? 'check' : tipo === 'warning' ? 'exclamation-triangle' : 'info'}-circle me-2" 
                   style="color: ${bgColor};"></i>
                <div>${mensaje}</div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 4000);
    }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.monitoreoManager = new MonitoreoManager();
    
    // Actualizar datos cada 5 segundos (solo para datos HTTP)
    setInterval(() => {
        monitoreoManager.actualizarDatos();
    }, 5000);
    
    console.log('Sistema de Monitoreo inicializado (HTTP + WebSockets)');
});