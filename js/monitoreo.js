class MonitoreoManager {
    constructor() {
        // IP de tu servidor EC2 (backend)
        this.backendUrl = 'http://54.147.92.50:5500';
        this.socket = null;
        
        this.estadoApp = {
            metricas: {},
            alertas: [],
            actividadChart: null,
            vistaGrafico: 'hora', // 'hora' o 'tipo'
            ultimaActualizacion: new Date()
        };

        // Iniciar cuando el DOM esté listo
        document.addEventListener('DOMContentLoaded', () => {
            this.inicializarApp();
        });
    }

    inicializarApp() {
        console.log('🚀 Iniciando Sistema de Monitoreo...');
        
        // 1. Iniciar Gráfico (Vacío al principio)
        this.inicializarGrafico();
        
        // 2. Conectar Socket.IO para actualizaciones en tiempo real
        this.conectarSocket();
        
        // 3. Cargar datos iniciales de la BD inmediatamente
        this.actualizarDatos();
        
        // 4. Polling de respaldo cada 3 segundos
        setInterval(() => this.actualizarDatos(), 3000);
    }

    // ==================== CONEXIÓN SOCKET.IO ====================

    conectarSocket() {
        if (window.io) {
            this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

            this.socket.on('connect', () => {
                console.log('🔌 Monitoreo conectado al Socket');
                this.actualizarEstadoConexion(true);
            });

            this.socket.on('disconnect', () => {
                console.log('❌ Monitoreo desconectado');
                this.actualizarEstadoConexion(false);
            });

            // A. Si ocurre un movimiento nuevo, recargamos la tabla
            this.socket.on('movimiento_agregado', () => {
                this.actualizarDatos();
            });

            // B. Si el Arduino detecta obstáculo, recargamos y mostramos alerta visual
            this.socket.on('alerta_obstaculo', (data) => {
                this.agregarAlertaVisual(data);
                this.actualizarDatos(); 
            });
        }
    }

    // ==================== CARGA DE DATOS (API REST) ====================

    async actualizarDatos() {
        try {
            // 1. HISTORIAL (Tabla Principal)
            const resHist = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const dataHist = await resHist.json();
            
            // 2. Métricas para Gráficas
            const resMetricas = await fetch(`${this.backendUrl}/api/metricas`);
            const dataMetricas = await resMetricas.json();

            // 3. Estado General (KPIs)
            const resEstado = await fetch(`${this.backendUrl}/api/estado-actual`);
            const dataEstado = await resEstado.json();
            
            // 4. Alertas
            const resAlertas = await fetch(`${this.backendUrl}/api/alertas`);
            const dataAlertas = await resAlertas.json();

            // Guardar estado local
            this.estadoApp.metricas = dataMetricas;
            this.estadoApp.ultimaActualizacion = new Date();

            // --- RENDERIZADO DE UI ---
            if (dataHist.success && dataHist.movimientos) {
                this.renderizarTablaHistorial(dataHist.movimientos);
            }
            
            this.actualizarKPIs(dataEstado);
            this.actualizarResumenManiobras(dataMetricas);
            this.actualizarGrafico();
            
            if (dataAlertas.alertas) {
                this.renderizarListaAlertas(dataAlertas.alertas);
            }

        } catch (error) {
            console.error("Error actualizando monitoreo:", error);
        }
    }

    // ==================== RENDERIZADO DE TABLA (10 Movimientos) ====================

    renderizarTablaHistorial(movimientos) {
        const container = document.getElementById('historialMovimientos');
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
            // Formatear fecha
            let hora = "--:--";
            if (mov.fecha_hora) {
                const fechaObj = new Date(mov.fecha_hora);
                hora = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }

            // Estilo de Badge
            let badgeColor = 'bg-secondary';
            let tipoTexto = mov.tipo_ejecucion || 'Manual';
            
            if (tipoTexto === 'manual') badgeColor = 'bg-primary'; 
            if (tipoTexto === 'demo') badgeColor = 'bg-info text-dark'; 
            if (tipoTexto === 'automatica') { badgeColor = 'bg-danger'; tipoTexto = 'Evasión'; } 

            // Icono
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

    // ==================== KPIs y ALERTAS ====================

    actualizarKPIs(data) {
        const setText = (id, val) => { 
            const el = document.getElementById(id); 
            if(el) el.textContent = val; 
        };
        
        setText('metricMovimientos', data.estadisticas?.total_movimientos || 0);
        setText('metricTiempo', (data.estadisticas?.dias_activo || 0) + 'd');
        setText('infoActualizacion', this.estadoApp.ultimaActualizacion.toLocaleTimeString());

        // Estado conexión Robot
        const elEstado = document.getElementById('metricEstado');
        if (elEstado) {
            const conectado = data.estado_ws_arduino === 'Conectado';
            elEstado.innerHTML = conectado 
                ? '<span class="text-success fw-bold"><i class="fas fa-wifi me-2"></i>En Línea</span>' 
                : '<span class="text-danger fw-bold"><i class="fas fa-wifi-slash me-2"></i>Offline</span>';
        }
        
        const infoServidor = document.getElementById('infoServidor');
        if(infoServidor) {
            infoServidor.textContent = 'Conectado';
            infoServidor.className = 'text-success fw-bold';
        }
    }

    actualizarResumenManiobras(data) {
        let c = { adelante: 0, atras: 0, giros: 0, vueltas: 0 };
        
        if (data.movimientos_por_tipo) {
            data.movimientos_por_tipo.forEach(m => {
                const t = m.status_texto.toLowerCase();
                if (t.includes('adelante')) c.adelante += m.cantidad;
                else if (t.includes('atras') || t.includes('atrás')) c.atras += m.cantidad;
                else if (t.includes('giro')) c.giros += m.cantidad;
                else if (t.includes('vuelta')) c.vueltas += m.cantidad;
            });
        }
        
        const setT = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        setT('statAdelante', c.adelante);
        setT('statAtras', c.atras);
        setT('statGiros', c.giros);
        setT('statVueltas', c.vueltas);
    }

    actualizarEstadoConexion(conectado) {
        const el = document.querySelector('.estado-conexion');
        if(el) {
            el.innerHTML = conectado 
                ? '<span class="status-indicator status-online pulse"></span> Conectado'
                : '<span class="status-indicator status-offline"></span> Desconectado';
        }
    }

    renderizarListaAlertas(alertas) {
        const container = document.getElementById('alertasContainer');
        const badge = document.getElementById('metricAlertas');
        const badgeSide = document.getElementById('contadorAlertas');
        
        if(badge) badge.textContent = alertas.length;
        if(badgeSide) badgeSide.textContent = alertas.length;

        if (!container) return;
        if (alertas.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4">Sin alertas recientes</div>';
            return;
        }

        let html = '';
        alertas.forEach(alerta => {
            const fecha = new Date(alerta.fecha_hora || alerta.timestamp).toLocaleTimeString();
            const grave = alerta.status_clave === 1; 
            
            // Mapa de Nombres (Coincide con tu BD)
            const nombres = {
                1: "Obstáculo Frontal",
                2: "Obstáculo Izquierda",
                3: "Obstáculo Derecha",
                4: "Obstáculo Envolvente",
                5: "Retroceso Forzoso"
            };
            const nombreObs = nombres[alerta.status_clave] || alerta.status_texto || "Alerta General";

            html += `
                <div class="alert ${grave ? 'alert-danger' : 'alert-warning'} mb-2 p-2 d-flex justify-content-between align-items-center shadow-sm" style="font-size: 0.85rem; border-left: 4px solid ${grave ? '#ff4444' : '#ffbb33'};">
                    <div>
                        <i class="fas ${grave ? 'fa-radiation-alt' : 'fa-exclamation-triangle'} me-2"></i>
                        <strong>${nombreObs}</strong>
                    </div>
                    <span class="small opacity-75">${fecha}</span>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    agregarAlertaVisual(data) {
        const container = document.getElementById('alertasContainer');
        if (container) {
            if(container.innerText.includes("Sin alertas")) container.innerHTML = "";
            
            const div = document.createElement('div');
            div.className = 'alert alert-danger mb-2 p-2 border-start border-4 border-danger fade show';
            div.innerHTML = `
                <div class="d-flex justify-content-between">
                    <span><i class="fas fa-exclamation-circle me-2"></i><strong>¡NUEVA ALERTA!</strong></span>
                    <small>Ahora</small>
                </div>
                <div class="small mt-1">${data.mensaje}</div>
            `;
            container.prepend(div);
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
                    label: 'Movimientos',
                    data: [],
                    borderColor: '#ff2d95',
                    backgroundColor: 'rgba(255, 45, 149, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: '#fff',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#fff' } },
                    tooltip: { 
                        mode: 'index', 
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#00ffff' 
                    }
                },
                scales: {
                    x: { 
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#aaa' } 
                    },
                    y: { 
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#aaa' }, 
                        beginAtZero: true 
                    }
                }
            }
        });
    }

    actualizarGrafico() {
        const chart = this.estadoApp.actividadChart;
        if (!chart || !this.estadoApp.metricas) return;
        
        const data = this.estadoApp.metricas;
        const isHourly = this.estadoApp.vistaGrafico === 'hora';

        if (isHourly && data.actividad_por_hora) {
            chart.data.labels = data.actividad_por_hora.map(d => `${d.hora}:00`);
            chart.data.datasets[0].data = data.actividad_por_hora.map(d => d.movimientos);
            chart.data.datasets[0].label = 'Movimientos por Hora (24h)';
        } else if (!isHourly && data.movimientos_por_tipo) {
            chart.data.labels = data.movimientos_por_tipo.map(d => d.status_texto);
            chart.data.datasets[0].data = data.movimientos_por_tipo.map(d => d.cantidad);
            chart.data.datasets[0].label = 'Total por Tipo';
        }
        chart.update();
    }

    cambiarVistaGrafico(vista) {
        this.estadoApp.vistaGrafico = vista;
        this.actualizarGrafico();
    }

    async verMetricasAvanzadas() {
        try {
            const res = await fetch(`${this.backendUrl}/api/estadisticas-obstaculos`);
            const data = await res.json();
            
            const container = document.getElementById('metricasContenido');
            if (container && data.obstaculos_por_tipo) {
                container.innerHTML = `
                    <h6 class="mb-3 border-bottom pb-2 border-secondary text-info">Estadísticas de Obstáculos (BD Histórico)</h6>
                    <div class="row g-3">
                        ${data.obstaculos_por_tipo.map(o => `
                            <div class="col-md-6">
                                <div class="p-2 bg-dark border border-secondary rounded d-flex justify-content-between align-items-center">
                                    <span>${o.status_texto}</span>
                                    <span class="badge bg-danger rounded-pill">${o.cantidad} eventos</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <p class="text-muted small mt-4 text-center"><i class="fas fa-info-circle me-1"></i>Datos agregados de los últimos 7 días</p>
                `;
                new bootstrap.Modal(document.getElementById('metricasModal')).show();
            }
        } catch (e) { console.error(e); }
    }
}

window.monitoreoManager = new MonitoreoManager();