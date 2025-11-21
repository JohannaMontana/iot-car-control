class MonitoreoManager {
    constructor() {
        // Asegúrate de que esta IP sea la de tu servidor EC2
        this.backendUrl = 'http://54.147.92.50:5500';
        this.socket = null;
        this.chart = null;

        this.estadoApp = {
            metricas: {},
            vistaGrafico: 'hora', // 'hora' o 'tipo'
            ultimaActualizacion: new Date()
        };

        // Inicializar cuando el DOM esté listo
        document.addEventListener('DOMContentLoaded', () => {
            this.init();
        });
    }

    init() {
        console.log('🚀 Iniciando MonitoreoManager...');
        this.inicializarGrafico();
        this.conectarSocket();

        // Carga inicial de datos
        this.actualizarDatos();

        // Polling de respaldo cada 3 segundos
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

        // Si hay movimiento nuevo, actualizar tablas inmediatamente
        this.socket.on('movimiento_agregado', () => this.actualizarDatos());

        // Si hay alerta, mostrarla y actualizar lista
        this.socket.on('alerta_obstaculo', (d) => {
            this.agregarAlertaVisual(d);
            this.actualizarDatos();
        });
    }

    // ==================== CARGA DE DATOS ====================

    async actualizarDatos() {
        try {
            // 1. HISTORIAL (Tabla de 10)
            const resHist = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const dataHist = await resHist.json();
            if (dataHist.success && dataHist.movimientos) {
                this.renderizarTablaHistorial(dataHist.movimientos);
            }

            // 2. ALERTAS
            const resAlert = await fetch(`${this.backendUrl}/api/alertas`);
            const dataAlert = await resAlert.json();
            if (dataAlert.alertas) {
                this.renderizarListaAlertas(dataAlert.alertas);
            }

            // 3. ESTADO GENERAL (KPIs)
            const resEstado = await fetch(`${this.backendUrl}/api/estado-actual`);
            const dataEstado = await resEstado.json();
            this.actualizarKPIs(dataEstado);

            // 4. MÉTRICAS (Gráfico)
            const resMet = await fetch(`${this.backendUrl}/api/metricas`);
            const dataMet = await resMet.json();
            this.estadoApp.metricas = dataMet;
            this.actualizarGrafico();
            this.actualizarResumen(dataMet);

            // Actualizar timestamp footer
            this.estadoApp.ultimaActualizacion = new Date();
            const infoUpd = document.getElementById('infoActualizacion');
            if (infoUpd) infoUpd.textContent = this.estadoApp.ultimaActualizacion.toLocaleTimeString();

        } catch (e) { console.error("Error polling monitoreo:", e); }
    }

    // ==================== TABLA DE HISTORIAL (CORREGIDA VISUALMENTE) ====================

  // === TABLA DE HISTORIAL (CORREGIDA VISUALMENTE) ===
    renderizarTablaHistorial(movimientos) {
        const container = document.getElementById('historialMovimientos');
        if (!container) return;

        if (!movimientos || movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-white-50 py-4">Sin datos en BD</div>';
            return;
        }

        // Estilos forzados para texto blanco
        let html = `
            <div class="table-responsive">
            <table class="table table-hover table-sm mb-0 align-middle" style="background: transparent; color: white;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.3); color: #ccc;">
                        <th class="text-white">Acción</th>
                        <th class="text-white">Tipo</th>
                        <th class="text-white">Duración</th>
                        <th class="text-end text-white">Hora</th>
                    </tr>
                </thead>
                <tbody>
        `;

        movimientos.forEach(m => {
            // Formateo seguro de hora
            let hora = '-';
            if(m.fecha_hora) {
                const rawDate = m.fecha_hora.endsWith('Z') ? m.fecha_hora : m.fecha_hora + 'Z';
                const d = new Date(rawDate);
                if(!isNaN(d.getTime())) {
                    hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                }
            }

            let badgeClass = 'bg-primary';
            let tipo = m.tipo_ejecucion || 'Manual';
            if (tipo === 'automatica') badgeClass = 'bg-danger'; 
            if (tipo === 'demo') badgeClass = 'bg-info text-dark';

            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <td class="text-white fw-bold">${m.status_texto}</td>
                    <td><span class="badge ${badgeClass} rounded-pill" style="font-size:0.7rem">${tipo.toUpperCase()}</span></td>
                    <td class="text-white-50 small">${m.duracion_segundos}s</td>
                    <td class="text-end text-white-50 small font-monospace">${hora}</td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // ==================== ALERTAS (TEXTOS CORRECTOS) ====================

    renderizarListaAlertas(alertas) {
        const container = document.getElementById('alertasContainer');
        const counters = [document.getElementById('contadorAlertas'), document.getElementById('metricAlertas')];

        counters.forEach(c => { if (c) c.textContent = alertas ? alertas.length : 0; });

        if (!container) return;
        if (!alertas || alertas.length === 0) {
            container.innerHTML = '<div class="text-center text-white-50 py-4">Sin alertas</div>';
            return;
        }

        // MAPEO EXACTO SEGÚN TU BD
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
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('metricMovimientos', data.estadisticas?.total_movimientos || 0);
        set('metricTiempo', (data.estadisticas?.dias_activo || 0) + 'd');

        const elSt = document.getElementById('metricEstado');
        if (elSt) {
            const on = data.estado_ws_arduino === 'Conectado';
            elSt.innerHTML = on ? '<span class="text-success fw-bold">En Línea</span>' : '<span class="text-danger fw-bold">Offline</span>';
        }
    }

    actualizarResumen(data) {
        let c = { ad: 0, at: 0, gi: 0, vu: 0 };
        if (data.movimientos_por_tipo) {
            data.movimientos_por_tipo.forEach(m => {
                const t = m.status_texto.toLowerCase();
                if (t.includes('adelante')) c.ad += m.cantidad;
                else if (t.includes('atras') || t.includes('atrás')) c.at += m.cantidad;
                else if (t.includes('giro')) c.gi += m.cantidad;
                else if (t.includes('vuelta')) c.vu += m.cantidad;
            });
        }
        const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        set('statAdelante', c.ad); set('statAtras', c.at); set('statGiros', c.gi); set('statVueltas', c.vu);
    }

    inicializarGrafico() {
        const ctx = document.getElementById('actividadChart');
        if (!ctx) return;
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Actividad', data: [], borderColor: '#ff2d95', tension: 0.4, fill: true, backgroundColor: 'rgba(255,45,149,0.1)' }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#aaa' } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#aaa' } }
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

    cambiarVistaGrafico(v) { this.estadoApp.vistaGrafico = v; this.actualizarGrafico(); }

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
        } catch (e) { }
    }
}

window.monitoreoManager = new MonitoreoManager();