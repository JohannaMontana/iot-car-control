class MonitoreoManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500';
        this.estadoApp = {
            conectado: false,
            metricas: {},
            alertas: [],
            actividadChart: null,
            vistaGrafico: 'hora'
        };

        this.inicializarSocket();
    }

    inicializarSocket() {
        socketManager.on('connected', () => {
            this.actualizarEstadoConexion(true);
            this.actualizarDatos();
        });

        socketManager.on('disconnected', () => {
            this.actualizarEstadoConexion(false);
        });

        socketManager.on('movimiento', (data) => {
            console.log('📈 Nuevo movimiento registrado:', data);
            this.actualizarMetricasRapidas();
        });

        socketManager.on('alerta', (data) => {
            console.log('🚨 Nueva alerta:', data);
            this.agregarAlerta(data);
            this.actualizarMetricasRapidas();
        });

        // Conectar WebSocket
        socketManager.connect();
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
            
            this.actualizarInterfaz(estadoData, metricasData);
            this.actualizarGrafico();
            
        } catch (error) {
            console.error('Error actualizando datos:', error);
            this.actualizarEstadoConexion(false);
        }
    }

    actualizarInterfaz(estadoData, metricasData) {
        // Actualizar métricas principales
        document.getElementById('metricEstado').textContent = 'Activo';
        document.getElementById('metricMovimientos').textContent = estadoData.estadisticas?.total_movimientos || '0';
        document.getElementById('metricAlertas').textContent = this.estadoApp.alertas.length;
        document.getElementById('metricTiempo').textContent = `${estadoData.estadisticas?.dias_activo || 0}h`;
        
        // Actualizar estadísticas de movimientos
        this.actualizarEstadisticasMovimientos(metricasData);
        
        // Actualizar información del sistema
        document.getElementById('infoActualizacion').textContent = new Date().toLocaleTimeString();
        document.getElementById('infoServidor').textContent = 'Conectado';
        
        // Actualizar contador de alertas
        document.getElementById('contadorAlertas').textContent = this.estadoApp.alertas.length;
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
        
        document.getElementById('statAdelante').textContent = adelante;
        document.getElementById('statAtras').textContent = atras;
        document.getElementById('statGiros').textContent = giros;
        document.getElementById('statVueltas').textContent = vueltas;
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
            alertaItem.className = `alert-item ${alerta.severidad === 'alta' ? 'danger' : 'warning'}`;
            
            const fecha = new Date(alerta.timestamp);
            alertaItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong>
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Obstáculo ${alerta.tipo_obstaculo}
                        </strong>
                        <br>
                        <small class="text-muted">${alerta.mensaje}</small>
                    </div>
                    <div class="text-end">
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
        document.getElementById('metricAlertas').textContent = this.estadoApp.alertas.length;
        document.getElementById('contadorAlertas').textContent = this.estadoApp.alertas.length;
        document.getElementById('infoActualizacion').textContent = new Date().toLocaleTimeString();
    }

    // ==================== GRÁFICOS ====================

    inicializarGrafico() {
        const ctx = document.getElementById('actividadChart').getContext('2d');
        this.estadoApp.actividadChart = new Chart(ctx, {
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

    cambiarVistaGrafico(vista) {
        this.estadoApp.vistaGrafico = vista;
        this.actualizarGrafico();
    }

    // ==================== FUNCIONES UTILITARIAS ====================

    actualizarEstadoConexion(conectado) {
        this.estadoApp.conectado = conectado;
        const estadoElement = document.querySelector('.estado-conexion');
        const indicator = estadoElement.querySelector('.status-indicator');
        const infoEstado = document.getElementById('infoEstado');
        
        if (conectado) {
            indicator.className = 'status-indicator status-online pulse';
            estadoElement.innerHTML = '<span class="status-indicator status-online pulse"></span>Conectado al servidor';
            infoEstado.innerHTML = '<i class="fas fa-wifi me-1"></i>Online';
            infoEstado.style.background = '#00ff88';
        } else {
            indicator.className = 'status-indicator status-offline';
            estadoElement.innerHTML = '<span class="status-indicator status-offline"></span>Desconectado del servidor';
            infoEstado.innerHTML = '<i class="fas fa-wifi-slash me-1"></i>Offline';
            infoEstado.style.background = '#ff4444';
        }
    }

    async verMetricasAvanzadas() {
        try {
            const response = await fetch(`${this.backendUrl}/api/estadisticas-obstaculos`);
            const data = await response.json();
            
            const contenido = document.getElementById('metricasContenido');
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
                                <div class="list-group-item d-flex justify-content-between align-items-center" 
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
            
            new bootstrap.Modal(document.getElementById('metricasModal')).show();
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
    monitoreoManager.inicializarGrafico();
    
    // Actualizar datos cada 5 segundos
    setInterval(() => {
        monitoreoManager.actualizarDatos();
    }, 5000);
    
    console.log('📊 Sistema de Monitoreo inicializado');
});