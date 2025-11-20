class MonitoreoManager {
    constructor() {
        // Asegúrate que sea la IP de tu EC2
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
        // 1. Iniciar Gráfico (Vacío al principio)
        this.inicializarGrafico();
        
        // 2. Conectar Socket.IO para tiempo real
        this.inicializarSocketIO();
        
        // 3. Cargar datos iniciales de la BD
        this.actualizarDatos();
        
        // 4. Polling de respaldo cada 3 segundos (para mantener sync)
        setInterval(() => this.actualizarDatos(), 3000);

        console.log('✅ MonitoreoManager inicializado');
    }

    // ==================== CONEXIÓN REAL-TIME ====================

    inicializarSocketIO() {
        console.log('🔌 Conectando Socket.IO en Monitoreo...');
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

        this.socket.on('connect', () => {
            document.querySelector('.estado-conexion').innerHTML = 
                '<span class="status-indicator status-online pulse"></span> Conectado';
        });

        this.socket.on('disconnect', () => {
            document.querySelector('.estado-conexion').innerHTML = 
                '<span class="status-indicator status-offline"></span> Desconectado';
        });

        // Si ocurre un movimiento, actualizamos la tabla inmediatamente
        this.socket.on('movimiento_agregado', () => {
            this.actualizarDatos();
        });

        // Si ocurre una alerta de obstáculo, la mostramos
        this.socket.on('alerta_obstaculo', (data) => {
            this.agregarAlertaVisual(data);
            this.actualizarDatos(); // Recargar lista de alertas
        });
    }

    // ==================== CARGA DE DATOS (API REST) ====================

    async actualizarDatos() {
        try {
            // A. Obtener Historial (La tabla de 10 movimientos)
            const resHist = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const dataHist = await resHist.json();
            
            // B. Obtener Métricas Generales
            const resMetricas = await fetch(`${this.backendUrl}/api/metricas`);
            const dataMetricas = await resMetricas.json();

            // C. Obtener Estado General (KPIs)
            const resEstado = await fetch(`${this.backendUrl}/api/estado-actual`);
            const dataEstado = await resEstado.json();
            
            // D. Obtener Alertas
            const resAlertas = await fetch(`${this.backendUrl}/api/alertas`);
            const dataAlertas = await resAlertas.json();

            // Actualizar Estado Local
            this.estadoApp.metricas = dataMetricas;
            this.estadoApp.ultimaActualizacion = new Date();

            // Renderizar UI
            if (dataHist.success) this.renderizarTablaHistorial(dataHist.movimientos);
            this.actualizarKPIs(dataEstado);
            this.actualizarGrafico();
            if (dataAlertas.alertas) this.renderizarListaAlertas(dataAlertas.alertas);
            this.actualizarResumenManiobras(dataMetricas);

        } catch (error) {
            console.error("Error actualizando monitoreo:", error);
        }
    }

    // ==================== RENDERIZADO DE TABLA (Tu requerimiento principal) ====================

    renderizarTablaHistorial(movimientos) {
        const container = document.getElementById('historialMovimientos');
        if (!container) return;

        if (!movimientos || movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-5">Sin movimientos registrados</div>';
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-dark table-hover table-sm mb-0" style="background: transparent;">
                    <thead>
                        <tr class="text-muted" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <th><i class="fas fa-bolt me-1"></i>Acción</th>
                            <th>Tipo</th>
                            <th>Duración</th>
                            <th class="text-end">Hora</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        movimientos.forEach(mov => {
            // Formatear fecha
            const fechaObj = new Date(mov.fecha_hora);
            const hora = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            // Estilo según tipo
            let badgeColor = 'bg-secondary';
            if (mov.tipo_ejecucion === 'manual') badgeColor = 'bg-primary'; // Azul
            if (mov.tipo_ejecucion === 'demo') badgeColor = 'bg-info text-dark'; // Cyan
            if (mov.tipo_ejecucion === 'automatica') badgeColor = 'bg-danger'; // Rojo (Evasión)

            // Icono según texto
            let icon = 'fa-arrow-right';
            const txt = (mov.status_texto || '').toLowerCase();
            if (txt.includes('adelante')) icon = 'fa-arrow-up';
            else if (txt.includes('atras') || txt.includes('atrás')) icon = 'fa-arrow-down';
            else if (txt.includes('giro') || txt.includes('vuelta')) icon = 'fa-sync';
            else if (txt.includes('detener')) icon = 'fa-stop-circle';

            html += `
                <tr>
                    <td>
                        <span style="color: var(--accent-cyan); width: 20px; display:inline-block; text-align:center;">
                            <i class="fas ${icon}"></i>
                        </span> 
                        ${mov.status_texto}
                    </td>
                    <td><span class="badge ${badgeColor}" style="font-size: 0.7rem;">${mov.tipo_ejecucion}</span></td>
                    <td class="text-white-50">${mov.duracion_segundos}s</td>
                    <td class="text-end text-muted small">${hora}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // ==================== KPIs y ALERTAS ====================

    actualizarKPIs(data) {
        const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        
        setText('metricMovimientos', data.estadisticas?.total_movimientos || 0);
        setText('metricTiempo', (data.estadisticas?.dias_activo || 1) + 'd');
        setText('infoActualizacion', this.estadoApp.ultimaActualizacion.toLocaleTimeString());

        // Estado conexión Robot (Viene del backend)
        const elEstado = document.getElementById('metricEstado');
        if (elEstado) {
            const conectado = data.estado_ws_arduino === 'Conectado';
            elEstado.innerHTML = conectado 
                ? '<span class="text-success fw-bold">En Línea</span>' 
                : '<span class="text-danger fw-bold">Offline</span>';
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
            container.innerHTML = '<div class="text-center text-muted py-4">Sin alertas</div>';
            return;
        }

        let html = '';
        alertas.forEach(alerta => {
            const fecha = new Date(alerta.fecha_hora || alerta.timestamp).toLocaleTimeString();
            // Detectar si es grave (status 1 = obstaculo frontal)
            const grave = alerta.status_clave === 1; 
            const color = grave ? 'danger' : 'warning';
            const icono = grave ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';

            html += `
                <div class="alert alert-${color} mb-2 p-2 d-flex justify-content-between align-items-center" style="font-size: 0.85rem;">
                    <div>
                        <i class="fas ${icono} me-2"></i>
                        <strong>${alerta.status_texto || 'Obstáculo'}</strong>
                        <div class="small opacity-75">${alerta.mensaje || 'Detectado por sensor'}</div>
                    </div>
                    <span class="small">${fecha}</span>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    agregarAlertaVisual(data) {
        // Solo para efecto visual inmediato si llega por socket
        // La lista real se recarga con actualizarDatos()
        const container = document.getElementById('alertasContainer');
        if (container) {
            const div = document.createElement('div');
            div.className = 'alert alert-danger mb-2 p-2 border-3 border-start border-danger fade show';
            div.innerHTML = `<strong>¡NUEVA ALERTA!</strong> ${data.mensaje} <small class="float-end">Ahora</small>`;
            container.prepend(div);
        }
    }

    actualizarResumenManiobras(data) {
        // Contadores inferiores
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

    // ==================== GRÁFICO CHART.JS ====================

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
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#fff' } } },
                scales: {
                    x: { grid: { color: '#333' }, ticks: { color: '#aaa' } },
                    y: { grid: { color: '#333' }, ticks: { color: '#aaa' }, beginAtZero: true }
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
            chart.data.datasets[0].label = 'Movimientos por Hora';
        } else if (!isHourly && data.movimientos_por_tipo) {
            chart.data.labels = data.movimientos_por_tipo.map(d => d.status_texto);
            chart.data.datasets[0].data = data.movimientos_por_tipo.map(d => d.cantidad);
            chart.data.datasets[0].label = 'Movimientos por Tipo';
        }
        chart.update();
    }

    cambiarVistaGrafico(vista) {
        this.estadoApp.vistaGrafico = vista;
        this.actualizarGrafico();
    }

    // Modal de Métricas Avanzadas de BD
    async verMetricasAvanzadas() {
        try {
            const res = await fetch(`${this.backendUrl}/api/estadisticas-obstaculos`);
            const data = await res.json();
            
            const container = document.getElementById('metricasContenido');
            if (container && data.obstaculos_por_tipo) {
                container.innerHTML = `
                    <h6 class="mb-3 border-bottom pb-2 border-secondary">Estadísticas de Obstáculos (BD)</h6>
                    <ul class="list-group">
                        ${data.obstaculos_por_tipo.map(o => `
                            <li class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between align-items-center">
                                <span>${o.status_texto}</span>
                                <span class="badge bg-danger rounded-pill">${o.cantidad} eventos</span>
                            </li>
                        `).join('')}
                    </ul>
                    <p class="text-muted small mt-3 text-center">Datos históricos de los últimos 7 días</p>
                `;
                new bootstrap.Modal(document.getElementById('metricasModal')).show();
            }
        } catch (e) { console.error(e); }
    }
}

window.monitoreoManager = new MonitoreoManager();