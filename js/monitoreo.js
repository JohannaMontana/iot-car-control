class MonitoreoManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500';
        this.estadoApp = {
            conectado: true,
            metricas: {},
            alertas: [],
            actividadChart: null,
            vistaGrafico: 'hora',
            ultimaActualizacion: new Date()
        };

        this.inicializarApp();
    }

    inicializarApp() {
        // 1. Iniciar gráficos y datos base (HTTP)
        this.inicializarGrafico();
        this.actualizarDatos();

        // 2. Esperar a que controlManager conecte el Socket.IO para escuchar eventos
        this.esperarSocketIO();

        console.log('✅ MonitoreoManager inicializado (Integrado con Socket.IO)');
    }

    esperarSocketIO() {
        // Revisar cada 500ms si controlManager ya conectó el socket
        const checkSocket = setInterval(() => {
            if (window.controlManager && window.controlManager.socket) {
                clearInterval(checkSocket);
                this.configurarListenersSocket(window.controlManager.socket);
            }
        }, 500);
    }

    configurarListenersSocket(socket) {
        console.log('🔌 Monitoreo conectado al Socket de ControlManager');

        // Escuchar alertas de obstáculos en tiempo real
        socket.on('alerta_obstaculo', (data) => {
            this.agregarAlerta({
                tipo: 'obstaculo',
                mensaje: data.mensaje,
                severidad: data.severidad,
                timestamp: data.timestamp
            });
            this.actualizarMetricasRapidas();
        });

        // Escuchar nuevos movimientos para actualizar gráficas al instante
        socket.on('movimiento_agregado', () => {
            // Cuando hay movimiento, forzamos actualización de datos
            this.actualizarDatos();
        });

        // Escuchar cambios de conexión del robot
        socket.on('estado_actualizado', () => {
            this.actualizarDatos();
        });
    }

    // ==================== FUNCIONES PRINCIPALES (HTTP) ====================

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
            
            // Solo actualizamos alertas si no vinieron vacías (para no borrar las de tiempo real)
            if (alertasData.alertas && alertasData.alertas.length > 0) {
                this.estadoApp.alertas = alertasData.alertas;
            }
            
            this.estadoApp.ultimaActualizacion = new Date();
            
            this.actualizarInterfaz(estadoData, metricasData);
            this.actualizarGrafico();
            this.actualizarTimestamp();
            
        } catch (error) {
            console.error('Error actualizando datos de monitoreo:', error);
            this.actualizarEstadoConexion(false);
        }
    }

    actualizarInterfaz(estadoData, metricasData) {
        // Actualizar métricas principales
        const metricEstado = document.getElementById('metricEstado');
        const metricMovimientos = document.getElementById('metricMovimientos');
        const metricAlertas = document.getElementById('metricAlertas');
        const metricTiempo = document.getElementById('metricTiempo');
        
        // Estado del Robot (Basado en la conexión WS del Backend)
        if (metricEstado) {
            const robotConectado = estadoData.estado_ws_arduino === 'Conectado';
            metricEstado.textContent = robotConectado ? 'En Línea' : 'Desconectado';
            metricEstado.className = robotConectado ? 'h2 mb-0 text-success' : 'h2 mb-0 text-danger';
        }

        if (metricMovimientos) metricMovimientos.textContent = estadoData.estadisticas?.total_movimientos || '0';
        if (metricAlertas) metricAlertas.textContent = this.estadoApp.alertas.length;
        if (metricTiempo) metricTiempo.textContent = `${estadoData.estadisticas?.dias_activo || 0}d`;
        
        // Actualizar estadísticas de movimientos
        this.actualizarEstadisticasMovimientos(metricasData);
        
        // Actualizar información del sistema
        const infoServidor = document.getElementById('infoServidor');
        if (infoServidor) {
            const modo = window.controlManager && window.controlManager.estadoApp.conectado ? 'Socket.IO' : 'HTTP';
            infoServidor.textContent = `Conectado (${modo})`;
        }
        
        // Actualizar contador de alertas
        const contadorAlertas = document.getElementById('contadorAlertas');
        if (contadorAlertas) contadorAlertas.textContent = this.estadoApp.alertas.length;
    }

    actualizarEstadisticasMovimientos(metricasData) {
        let adelante = 0, atras = 0, giros = 0, vueltas = 0;
        
        if (metricasData.movimientos_por_tipo) {
            metricasData.movimientos_por_tipo.forEach(mov => {
                const texto = mov.status_texto || '';
                if (texto.includes('Adelante')) adelante += mov.cantidad;
                else if (texto.includes('Atrás') || texto.includes('Atras')) atras += mov.cantidad;
                else if (texto.includes('Giro')) giros += mov.cantidad;
                else if (texto.includes('Vuelta')) vueltas += mov.cantidad;
            });
        }
        
        const updateText = (id, val) => {
            const el = document.getElementById(id);
            if(el) el.textContent = val;
        };

        updateText('statAdelante', adelante);
        updateText('statAtras', atras);
        updateText('statGiros', giros);
        updateText('statVueltas', vueltas);
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
        this.estadoApp.alertas.forEach((alerta) => {
            const alertaItem = document.createElement('div');
            const severidad = alerta.severidad || 'media';
            const esAlta = severidad === 'alta';
            
            alertaItem.className = `alert-item mb-2 p-2 rounded`;
            alertaItem.style.background = esAlta ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255, 149, 0, 0.1)';
            alertaItem.style.borderLeft = esAlta ? '4px solid #ff4444' : '4px solid #ff9500';
            
            const fecha = alerta.timestamp ? new Date(alerta.timestamp) : new Date();
            
            alertaItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1 ps-2">
                        <strong>
                            <i class="fas fa-exclamation-triangle me-2 ${esAlta ? 'text-danger' : 'text-warning'}"></i>
                            ${alerta.tipo === 'obstaculo' ? 'Obstáculo' : 'Alerta'}
                        </strong>
                        <br>
                        <small class="text-muted">${alerta.mensaje}</small>
                    </div>
                    <div class="text-end ms-2">
                        <small class="text-muted" style="font-size: 0.7rem">${fecha.toLocaleTimeString()}</small>
                    </div>
                </div>
            `;
            container.appendChild(alertaItem);
        });
    }

    actualizarMetricasRapidas() {
        const metricAlertas = document.getElementById('metricAlertas');
        const contadorAlertas = document.getElementById('contadorAlertas');
        
        const total = this.estadoApp.alertas.length;
        if (metricAlertas) metricAlertas.textContent = total;
        if (contadorAlertas) contadorAlertas.textContent = total;
        
        this.actualizarTimestamp();
    }

    actualizarTimestamp() {
        const infoActualizacion = document.getElementById('infoActualizacion');
        if (infoActualizacion) {
            infoActualizacion.textContent = this.estadoApp.ultimaActualizacion.toLocaleTimeString();
        }
    }

    actualizarEstadoConexion(conectado) {
        const infoEstado = document.getElementById('infoEstado');
        if (infoEstado) {
            if (conectado) {
                infoEstado.innerHTML = `<i class="fas fa-wifi me-1"></i>Online`;
                infoEstado.className = 'badge bg-success';
            } else {
                infoEstado.innerHTML = '<i class="fas fa-wifi-slash me-1"></i>Offline';
                infoEstado.className = 'badge bg-danger';
            }
        }
    }

    // ==================== GRÁFICOS (Chart.js) ====================

    inicializarGrafico() {
        const ctx = document.getElementById('actividadChart');
        if (!ctx) return;
        
        this.estadoApp.actividadChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Movimientos',
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
                    legend: { labels: { color: '#ffffff' } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#b0b0b0' } },
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#b0b0b0' } }
                }
            }
        });
    }

    actualizarGrafico() {
        if (!this.estadoApp.actividadChart) return;
        const chart = this.estadoApp.actividadChart;

        if (this.estadoApp.vistaGrafico === 'hora') {
            // Usar datos reales de metricas si existen, sino ejemplo
            if (this.estadoApp.metricas.actividad_por_hora) {
                const datos = this.estadoApp.metricas.actividad_por_hora;
                chart.data.labels = datos.map(d => `${d.hora}:00`);
                chart.data.datasets[0].data = datos.map(d => d.movimientos);
                chart.data.datasets[0].label = 'Movimientos por Hora (Últimas 24h)';
            }
        } else {
            // Vista por Tipo
            if (this.estadoApp.metricas.movimientos_por_tipo) {
                const datos = this.estadoApp.metricas.movimientos_por_tipo;
                chart.data.labels = datos.map(m => m.status_texto);
                chart.data.datasets[0].data = datos.map(m => m.cantidad);
                chart.data.datasets[0].label = 'Total por Tipo';
            }
        }
        chart.update();
    }

    cambiarVistaGrafico(vista) {
        this.estadoApp.vistaGrafico = vista;
        this.actualizarGrafico();
    }

    // ==================== MÉTRICAS AVANZADAS (Modal) ====================
    
    async verMetricasAvanzadas() {
        try {
            const response = await fetch(`${this.backendUrl}/api/estadisticas-obstaculos`);
            const data = await response.json();
            
            const contenido = document.getElementById('metricasContenido');
            if (contenido) {
                const items = data.obstaculos_por_tipo || [];
                contenido.innerHTML = `
                    <div class="row">
                        <div class="col-12">
                            <h6 class="border-bottom pb-2">Resumen de Obstáculos</h6>
                            ${items.length > 0 ? `
                            <div class="list-group">
                                ${items.map(obs => `
                                    <div class="list-group-item d-flex justify-content-between align-items-center bg-dark text-white border-secondary">
                                        <span>${obs.status_texto}</span>
                                        <span class="badge bg-danger rounded-pill">${obs.cantidad}</span>
                                    </div>
                                `).join('')}
                            </div>` : '<p class="text-muted text-center mt-3">Sin datos de obstáculos aún.</p>'}
                        </div>
                    </div>
                `;
            }
            
            const metricasModal = new bootstrap.Modal(document.getElementById('metricasModal'));
            metricasModal.show();
        } catch (error) {
            console.error(error);
            if(window.controlManager) window.controlManager.mostrarNotificacion('Error cargando métricas', 'danger');
        }
    }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.monitoreoManager = new MonitoreoManager();
    
    // Respaldo: Actualizar datos completos cada 5 segundos
    setInterval(() => {
        monitoreoManager.actualizarDatos();
    }, 5000);
    
    console.log('📊 Sistema de Monitoreo inicializado');
});