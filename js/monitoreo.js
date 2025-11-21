class MonitoreoManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500';
        this.socket = null;
        this.chart = null;

        this.estadoApp = {
            metricas: {},
            vistaGrafico: 'hora',
            ultimaActualizacion: new Date()
        };

        document.addEventListener('DOMContentLoaded', () => {
            this.init();
        });
    }

    init() {
        console.log('🚀 Iniciando MonitoreoManager...');
        this.inicializarGrafico();
        this.conectarSocket();
        this.actualizarDatos();
        setInterval(() => this.actualizarDatos(), 3000);
    }

    // ==================== CONEXIÓN REAL-TIME ====================

    conectarSocket() {
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

        this.socket.on('connect', () => {
            const el = document.querySelector('.estado-conexion');
            if (el) el.innerHTML = '<span class="status-indicator status-online pulse"></span> Conectado';
        });

        this.socket.on('disconnect', () => {
            const el = document.querySelector('.estado-conexion');
            if (el) el.innerHTML = '<span class="status-indicator status-offline"></span> Desconectado';
        });

        this.socket.on('movimiento_agregado', () => this.actualizarDatos());
        this.socket.on('alerta_obstaculo', (d) => {
            this.agregarAlertaVisual(d);
            this.actualizarDatos();
        });
    }

    // ==================== CARGA DE DATOS - USANDO TUS ENDPOINTS ====================

    async actualizarDatos() {
        try {
            // 1. HISTORIAL - usando /api/ultimos-10-movimientos
            await this.cargarHistorialMovimientos();

            // 2. ALERTAS - usando /api/alertas
            await this.cargarAlertas();

            // 3. ESTADO GENERAL - usando /api/estado-actual
            await this.cargarEstadoActual();

            // 4. MÉTRICAS - usando /api/metricas
            await this.cargarMetricas();

            // 5. RESUMEN MANIOBRAS - usando /api/resumen-maniobras
            await this.cargarResumenManiobras();

            this.estadoApp.ultimaActualizacion = new Date();
            const infoUpd = document.getElementById('infoActualizacion');
            if (infoUpd) infoUpd.textContent = this.estadoApp.ultimaActualizacion.toLocaleTimeString();

        } catch (e) { 
            console.error("Error polling monitoreo:", e); 
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
            this.actualizarEstadoWS(dataEstado.estado_ws_arduino === 'Conectado');
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
            
            const set = (id, v) => { 
                const e = document.getElementById(id); 
                if (e) e.textContent = v; 
            };
            
            set('statAdelante', data.adelante || 0);
            set('statAtras', data.atras || 0);
            set('statGiros', data.giros || 0);
            set('statVueltas', data.vueltas || 0);
            
        } catch (e) {
            console.error("Error cargando resumen maniobras:", e);
        }
    }

    // ==================== TABLA DE HISTORIAL ====================

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

    // ==================== ALERTAS ====================

    renderizarListaAlertas(alertas) {
        const container = document.getElementById('alertasContainer');
        const counters = [document.getElementById('contadorAlertas'), document.getElementById('metricAlertas')];

        counters.forEach(c => { if (c) c.textContent = alertas ? alertas.length : 0; });

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

    agregarAlertaVisual(data) {
        const container = document.getElementById('alertasContainer');
        if (container) {
            if (container.innerText.includes("Sin alertas")) container.innerHTML = "";

            const mapa = { 1: "Adelante", 2: "Adelante-Izquierda", 3: "Adelante-Derecha", 5: "Retrocede" };
            const txt = mapa[data.tipo_obstaculo] || "Obstáculo";

            const div = document.createElement('div');
            div.className = 'alert alert-danger mb-2 p-2 border-start border-4 border-danger fade show';
            div.innerHTML = `<strong>¡NUEVO: ${txt}!</strong> <small class="float-end">Ahora</small>`;
            container.prepend(div);
        }
    }

    // ==================== KPIs y GRÁFICOS ====================

    actualizarKPIs(data) {
        const set = (id, v) => { 
            const el = document.getElementById(id); 
            if (el) el.textContent = v; 
        };
        
        set('metricMovimientos', data.estadisticas?.total_movimientos || 0);
        
        // QUITADO: Tiempo activo
        // set('metricTiempo', (data.estadisticas?.dias_activo || 0) + 'd');

        const elSt = document.getElementById('metricEstado');
        if (elSt) {
            const on = data.estado_ws_arduino === 'Conectado';
            elSt.innerHTML = on ? 
                '<span class="text-success fw-bold">En Línea</span>' : 
                '<span class="text-danger fw-bold">Offline</span>';
        }
    }

    actualizarEstadoWS(conectado) {
        const el = document.getElementById('metricEstadoDetailed');
        if (el) {
            el.innerHTML = conectado ? 
                '<span class="text-success fw-bold">Conectado</span>' : 
                '<span class="text-danger fw-bold">Desconectado</span>';
        }
    }

    actualizarResumen(data) {
        // Esta función ya no es necesaria ya que usamos /api/resumen-maniobras
        // Se mantiene por compatibilidad pero no hace nada
    }

    inicializarGrafico() {
        const ctx = document.getElementById('actividadChart');
        if (!ctx) return;
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: [], 
                datasets: [{ 
                    label: 'Actividad', 
                    data: [], 
                    borderColor: '#ff2d95', 
                    tension: 0.4, 
                    fill: true, 
                    backgroundColor: 'rgba(255,45,149,0.1)' 
                }] 
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { 
                        grid: { color: 'rgba(255,255,255,0.1)' }, 
                        ticks: { color: '#aaa' } 
                    },
                    y: { 
                        grid: { color: 'rgba(255,255,255,0.1)' }, 
                        ticks: { color: '#aaa' } 
                    }
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
        } else if (!isHourly && d.movimientos_por_tipo) {
            this.chart.data.labels = d.movimientos_por_tipo.map(x => x.status_texto);
            this.chart.data.datasets[0].data = d.movimientos_por_tipo.map(x => x.cantidad);
        }
        this.chart.update();
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
                div.innerHTML = '<ul class="list-group">' +
                    data.obstaculos_por_tipo.map(o => `
                        <li class="list-group-item bg-dark text-white d-flex justify-content-between border-secondary">
                            <span>${o.status_texto}</span>
                            <span class="badge bg-danger rounded-pill">${o.cantidad}</span>
                        </li>`).join('') + '</ul>';
                new bootstrap.Modal(document.getElementById('metricasModal')).show();
            }
        } catch (e) { 
            console.error("Error cargando métricas avanzadas:", e);
        }
    }
}

window.monitoreoManager = new MonitoreoManager();