/**
 * Monitoring Manager for Modal
 * Handles all monitoring functionality within the modal
 */

class ModalMonitoringManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500';
        this.socket = null;
        this.chart = null;
        this.estadoApp = {
            metricas: {},
            vistaGrafico: 'hora',
            ultimaActualizacion: new Date()
        };

        this.init();
    }

    init() {
        console.log('🚀 Iniciando ModalMonitoringManager...');
        this.inicializarGrafico();
        this.conectarSocket();
        
        // Actualizar datos cuando se abre el modal
        const modal = document.getElementById('monitoringModal');
        if (modal) {
            modal.addEventListener('shown.bs.modal', () => {
                this.actualizarDatos();
                this.startAutoRefresh();
            });
            
            modal.addEventListener('hidden.bs.modal', () => {
                this.stopAutoRefresh();
            });
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.refreshInterval = setInterval(() => this.actualizarDatos(), 3000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    conectarSocket() {
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

        this.socket.on('connect', () => {
            console.log('📡 Conectado al servidor WebSocket desde modal');
        });

        this.socket.on('movimiento_agregado', () => this.actualizarDatos());
        this.socket.on('alerta_obstaculo', () => this.actualizarDatos());
    }

    async actualizarDatos() {
        try {
            await Promise.all([
                this.cargarHistorialMovimientos(),
                this.cargarAlertas(),
                this.cargarEstadoActual(),
                this.cargarMetricas(),
                this.cargarResumenManiobras()
            ]);

            this.estadoApp.ultimaActualizacion = new Date();
            const infoUpd = document.getElementById('modalInfoActualizacion');
            if (infoUpd) infoUpd.textContent = this.estadoApp.ultimaActualizacion.toLocaleTimeString();

            // Actualizar también las estadísticas rápidas en el panel principal
            this.actualizarQuickStats();

        } catch (e) { 
            console.error("Error actualizando datos del modal:", e); 
        }
    }

    async cargarHistorialMovimientos() {
        try {
            const resHist = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const dataHist = await resHist.json();
            if (dataHist.success && dataHist.movimientos) {
                this.renderizarTablaHistorial(dataHist.movimientos);
            }
        } catch (e) {
            console.error("Error cargando historial:", e);
        }
    }

    async cargarAlertas() {
        try {
            const resAlert = await fetch(`${this.backendUrl}/api/alertas`);
            const dataAlert = await resAlert.json();
            if (dataAlert.alertas) {
                this.renderizarListaAlertas(dataAlert.alertas);
            }
        } catch (e) {
            console.error("Error cargando alertas:", e);
        }
    }

    async cargarEstadoActual() {
        try {
            const resEstado = await fetch(`${this.backendUrl}/api/estado-actual`);
            const dataEstado = await resEstado.json();
            this.actualizarKPIs(dataEstado);
        } catch (e) {
            console.error("Error cargando estado:", e);
        }
    }

    async cargarMetricas() {
        try {
            const resMet = await fetch(`${this.backendUrl}/api/metricas`);
            const dataMet = await resMet.json();
            this.estadoApp.metricas = dataMet;
            this.actualizarGrafico();
        } catch (e) {
            console.error("Error cargando métricas:", e);
        }
    }

    async cargarResumenManiobras() {
        try {
            const res = await fetch(`${this.backendUrl}/api/resumen-maniobras`);
            const data = await res.json();
            
            // Actualizar estadísticas rápidas
            this.actualizarQuickStats(data);
            
        } catch (e) {
            console.error("Error cargando resumen maniobras:", e);
        }
    }

    renderizarTablaHistorial(movimientos) {
        const container = document.getElementById('modalHistorialMovimientos');
        if (!container) return;

        if (!movimientos || movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-5"><i class="fas fa-box-open fa-2x mb-2"></i><br>Sin movimientos registrados</div>';
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-dark table-hover table-sm mb-0 align-middle" style="background: transparent;">
                    <thead>
                        <tr class="text-secondary" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <th scope="col"><i class="fas fa-bolt me-2"></i>Acción</th>
                            <th scope="col">Tipo</th>
                            <th scope="col">Duración</th>
                            <th scope="col" class="text-end">Hora</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        movimientos.forEach(mov => {
            let hora = "--:--";
            if (mov.fecha_hora) {
                const fechaObj = new Date(mov.fecha_hora);
                hora = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }

            let badgeColor = 'bg-secondary';
            let tipoTexto = mov.tipo_ejecucion || 'Manual';
            
            if (tipoTexto === 'manual') badgeColor = 'bg-primary';
            if (tipoTexto === 'demo') badgeColor = 'bg-info text-dark';
            if (tipoTexto === 'automatica') { badgeColor = 'bg-danger'; tipoTexto = 'Evasión'; }

            let icon = 'fa-circle';
            const txt = (mov.status_texto || '').toLowerCase();
            
            if (txt.includes('adelante')) icon = 'fa-arrow-up';
            else if (txt.includes('atras') || txt.includes('atrás')) icon = 'fa-arrow-down';
            else if (txt.includes('giro')) icon = 'fa-sync';
            else if (txt.includes('vuelta')) icon = 'fa-share';
            else if (txt.includes('detener')) icon = 'fa-stop-circle';

            html += `
                <tr>
                    <td>
                        <span style="color: var(--accent-cyan); width: 25px; display:inline-block; text-align:center;">
                            <i class="fas ${icon}"></i>
                        </span> 
                        <span class="text-white fw-bold">${mov.status_texto}</span>
                    </td>
                    <td>
                        <span class="badge ${badgeColor} rounded-pill" style="font-size: 0.7rem; font-weight: normal;">
                            ${tipoTexto.toUpperCase()}
                        </span>
                    </td>
                    <td class="text-white-50">${mov.duracion_segundos}s</td>
                    <td class="text-end text-muted small" style="font-family: monospace;">${hora}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    renderizarListaAlertas(alertas) {
        const container = document.getElementById('modalAlertasContainer');
        const counter = document.getElementById('modalContadorAlertas');

        if (counter) counter.textContent = alertas ? alertas.length : 0;

        if (!container) return;
        if (!alertas || alertas.length === 0) {
            container.innerHTML = '<div class="text-center text-white-50 py-4">Sin alertas</div>';
            return;
        }

        const mapaBD = {
            1: "Adelante",
            2: "Adelante-Izquierda",
            3: "Adelante-Derecha",
            4: "Adelante-Izquierda-Derecha",
            5: "Retrocede"
        };

        let html = '';
        alertas.forEach(a => {
            let fecha = '';
            if (a.fecha_hora) {
                const raw = a.fecha_hora.endsWith('Z') ? a.fecha_hora : a.fecha_hora + 'Z';
                const d = new Date(raw);
                if (!isNaN(d.getTime())) fecha = d.toLocaleTimeString();
            }

            const nombre = mapaBD[a.status_clave] || a.status_texto || "Desconocido";
            const grave = (a.status_clave === 1 || a.status_clave === 5);

            html += `
                <div class="alert ${grave ? 'alert-danger' : 'alert-warning'} mb-2 p-2 small shadow-sm d-flex justify-content-between align-items-center border-0" style="background: ${grave ? 'rgba(220,53,69,0.2)' : 'rgba(255,193,7,0.2)'}; color: white;">
                    <div>
                        <i class="fas ${grave ? 'fa-radiation' : 'fa-exclamation-triangle'} me-2"></i>
                        <strong>${nombre}</strong>
                        <div style="opacity: 0.8; font-size: 0.75rem;">${a.mensaje || 'Detección automática'}</div>
                    </div>
                    <span class="text-white-50" style="font-size: 0.7rem;">${fecha}</span>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    actualizarKPIs(data) {
        const set = (id, v) => { 
            const el = document.getElementById(id); 
            if (el) el.textContent = v; 
        };
        
        set('modalMetricMovimientos', data.estadisticas?.total_movimientos || 0);
        set('modalMetricAlertas', data.estadisticas?.alertas_activas || 0);

        const elSt = document.getElementById('modalMetricEstado');
        if (elSt) {
            const on = data.estado_ws_arduino === 'Conectado';
            elSt.innerHTML = on ? 
                '<span class="text-success fw-bold">En Línea</span>' : 
                '<span class="text-danger fw-bold">Offline</span>';
        }

        const elDet = document.getElementById('modalMetricEstadoDetailed');
        if (elDet) {
            const on = data.estado_ws_arduino === 'Conectado';
            elDet.innerHTML = on ? 
                '<span class="text-success fw-bold">Conectado</span>' : 
                '<span class="text-danger fw-bold">Desconectado</span>';
        }

        // Actualizar también en el panel principal
        this.actualizarQuickStats(data);
    }

    actualizarQuickStats(data) {
        // Actualizar estadísticas rápidas en el panel principal
        const setQuick = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.textContent = v;
        };

        if (data) {
            setQuick('quickMovimientos', data.estadisticas?.total_movimientos || 0);
            setQuick('quickAlertas', data.estadisticas?.alertas_activas || 0);
            
            const onlineStatus = data.estado_ws_arduino === 'Conectado' ? 
                '<span class="text-success">✓</span>' : 
                '<span class="text-danger">✗</span>';
            setQuick('quickOnline', onlineStatus);
        }
    }

    inicializarGrafico() {
        const ctx = document.getElementById('modalActividadChart');
        if (!ctx) return;
        
        // Destruir gráfico anterior si existe
        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: [], 
                datasets: [{ 
                    label: 'Actividad', 
                    data: [], 
                    borderColor: '#ff2d95', 
                    backgroundColor: 'rgba(255, 45, 149, 0.1)',
                    tension: 0.4, 
                    fill: true,
                    borderWidth: 2,
                    pointBackgroundColor: '#ff2d95',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }] 
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        display: false 
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#ff2d95',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: { 
                        grid: { 
                            color: 'rgba(255,255,255,0.1)',
                            borderColor: 'rgba(255,255,255,0.1)'
                        }, 
                        ticks: { 
                            color: '#aaa',
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: { 
                        grid: { 
                            color: 'rgba(255,255,255,0.1)',
                            borderColor: 'rgba(255,255,255,0.1)'
                        }, 
                        ticks: { 
                            color: '#aaa',
                            font: {
                                size: 11
                            },
                            beginAtZero: true
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    actualizarGrafico() {
        if (!this.chart || !this.estadoApp.metricas) return;
        const d = this.estadoApp.metricas;
        const isHourly = this.estadoApp.vistaGrafico === 'hora';

        if (isHourly && d.actividad_por_hora) {
            this.chart.data.labels = d.actividad_por_hora.map(x => `${x.hora}:00`);
            this.chart.data.datasets[0].data = d.actividad_por_hora.map(x => x.movimientos);
            this.chart.data.datasets[0].label = 'Actividad por Hora';
        } else if (!isHourly && d.movimientos_por_tipo) {
            this.chart.data.labels = d.movimientos_por_tipo.map(x => x.status_texto);
            this.chart.data.datasets[0].data = d.movimientos_por_tipo.map(x => x.cantidad);
            this.chart.data.datasets[0].label = 'Movimientos por Tipo';
        }
        
        this.chart.update('none');
    }

    cambiarVistaGrafico(v) { 
        this.estadoApp.vistaGrafico = v; 
        this.actualizarGrafico(); 
    }

    async verMetricasAvanzadas() {
        try {
            const res = await fetch(`${this.backendUrl}/api/estadisticas-obstaculos`);
            const data = await res.json();
            const div = document.getElementById('metricasContenido');
            if (div && data.obstaculos_por_tipo) {
                div.innerHTML = '<div class="row">' +
                    data.obstaculos_por_tipo.map(o => `
                        <div class="col-md-6 mb-3">
                            <div class="metric-card p-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>${o.status_texto}</span>
                                    <span class="badge bg-danger fs-6">${o.cantidad}</span>
                                </div>
                                <div class="progress mt-2" style="height: 8px;">
                                    <div class="progress-bar bg-danger" style="width: ${Math.min(o.cantidad * 10, 100)}%"></div>
                                </div>
                            </div>
                        </div>`).join('') + '</div>';
                
                // Mostrar el modal
                const metricasModal = new bootstrap.Modal(document.getElementById('metricasModal'));
                metricasModal.show();
            }
        } catch (e) { 
            console.error("Error cargando métricas avanzadas:", e);
            alert('Error al cargar las métricas avanzadas');
        }
    }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    window.modalMonitoringManager = new ModalMonitoringManager();
});