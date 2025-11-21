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

        document.addEventListener('DOMContentLoaded', () => this.inicializarApp());
    }

    inicializarApp() {
        this.inicializarGrafico();
        this.conectarSocket();
        this.actualizarDatos();
        
        // Actualizar datos completos cada 3 segundos
        setInterval(() => this.actualizarDatos(), 3000);
    }

    conectarSocket() {
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });
        
        this.socket.on('connect', () => {
            const el = document.querySelector('.estado-conexion');
            if(el) el.innerHTML = '<span class="status-indicator status-online pulse"></span> Conectado';
        });
        
        this.socket.on('disconnect', () => {
            const el = document.querySelector('.estado-conexion');
            if(el) el.innerHTML = '<span class="status-indicator status-offline"></span> Desconectado';
        });

        // Recargar al recibir eventos
        this.socket.on('movimiento_agregado', () => this.actualizarDatos());
        
        this.socket.on('alerta_obstaculo', (data) => {
            this.agregarAlertaVisual(data);
            this.actualizarDatos(); // Para que salga en el historial de alertas
        });
    }

    async actualizarDatos() {
        try {
            // 1. Historial 10 Movimientos
            const resHist = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const dataHist = await resHist.json();
            if(dataHist.success) this.renderizarTablaHistorial(dataHist.movimientos);

            // 2. Alertas
            const resAlert = await fetch(`${this.backendUrl}/api/alertas`);
            const dataAlert = await resAlert.json();
            this.renderizarListaAlertas(dataAlert.alertas);

            // 3. Estado General
            const resEstado = await fetch(`${this.backendUrl}/api/estado-actual`);
            const dataEstado = await resEstado.json();
            this.actualizarKPIs(dataEstado);

            // 4. Métricas Gráfico
            const resMet = await fetch(`${this.backendUrl}/api/metricas`);
            const dataMet = await resMet.json();
            this.estadoApp.metricas = dataMet;
            this.actualizarGrafico();
            this.actualizarResumen(dataMet);

            this.estadoApp.ultimaActualizacion = new Date();
            const infoUpd = document.getElementById('infoActualizacion');
            if(infoUpd) infoUpd.textContent = this.estadoApp.ultimaActualizacion.toLocaleTimeString();

        } catch(e) { console.error("Error polling:", e); }
    }

    // --- TABLA DE HISTORIAL (10) ---
    renderizarTablaHistorial(movimientos) {
        const container = document.getElementById('historialMovimientos');
        if(!container) return;

        if(!movimientos || movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4">Sin movimientos recientes</div>';
            return;
        }

        let html = `
            <div class="table-responsive">
            <table class="table table-dark table-sm table-hover mb-0 align-middle">
                <thead>
                    <tr class="text-secondary">
                        <th>Acción</th>
                        <th>Tipo</th>
                        <th>Dur</th>
                        <th class="text-end">Hora</th>
                    </tr>
                </thead>
                <tbody>
        `;

        movimientos.forEach(m => {
            const hora = m.fecha_hora ? new Date(m.fecha_hora).toLocaleTimeString() : '-';
            
            // Colores según tipo
            let badge = 'bg-primary';
            let tipo = m.tipo_ejecucion || 'Manual';
            if (tipo === 'automatica') badge = 'bg-danger'; // Evasión de obstáculo
            if (tipo === 'demo') badge = 'bg-info text-dark';

            html += `
                <tr>
                    <td><strong class="text-white">${m.status_texto}</strong></td>
                    <td><span class="badge ${badge} rounded-pill" style="font-size: 0.7rem;">${tipo}</span></td>
                    <td class="text-muted small">${m.duracion_segundos}s</td>
                    <td class="text-end text-white-50 small">${hora}</td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // --- ALERTAS CON TEXTO CORRECTO ---
    renderizarListaAlertas(alertas) {
        const container = document.getElementById('alertasContainer');
        const counter = document.getElementById('contadorAlertas');
        const kpiAlert = document.getElementById('metricAlertas');

        if(counter) counter.textContent = alertas ? alertas.length : 0;
        if(kpiAlert) kpiAlert.textContent = alertas ? alertas.length : 0;
        
        if(!container) return;
        if(!alertas || alertas.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4">Sin alertas</div>';
            return;
        }

        // MAPEO SEGÚN TU BD
        const mapaObstaculos = {
            1: "Adelante",
            2: "Adelante-Izquierda",
            3: "Adelante-Derecha",
            4: "Adelante-Izq-Der",
            5: "Retrocede"
        };

        let html = '';
        alertas.forEach(a => {
            const fecha = a.fecha_hora ? new Date(a.fecha_hora).toLocaleTimeString() : '';
            const nombre = mapaObstaculos[a.status_clave] || a.status_texto || "Obstáculo";
            const grave = a.status_clave === 1; // Frontal es más grave

            html += `
                <div class="alert ${grave ? 'alert-danger' : 'alert-warning'} mb-2 p-2 small shadow-sm">
                    <div class="d-flex justify-content-between">
                        <strong><i class="fas fa-exclamation-triangle me-1"></i>${nombre}</strong>
                        <span>${fecha}</span>
                    </div>
                    <div class="opacity-75 mt-1">${a.mensaje || 'Detección automática'}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    agregarAlertaVisual(data) {
        // Popup rápido en la lista
        const container = document.getElementById('alertasContainer');
        if(container) {
            const mapa = { 1: "Adelante", 2: "Adelante-Izquierda", 3: "Adelante-Derecha" };
            const txt = mapa[data.tipo_obstaculo] || "Obstáculo";
            
            const div = document.createElement('div');
            div.className = 'alert alert-danger mb-2 p-2 border-start border-4 border-danger fade show';
            div.innerHTML = `<strong>NUEVO: ${txt}</strong><br><small>${data.mensaje}</small>`;
            container.prepend(div);
        }
    }

    // --- KPI & GRAFICO ---

    actualizarKPIs(data) {
        const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
        set('metricMovimientos', data.estadisticas?.total_movimientos || 0);
        set('metricTiempo', (data.estadisticas?.dias_activo || 0) + 'd');
        
        const st = document.getElementById('metricEstado');
        const stDet = document.getElementById('metricEstadoDetailed');
        const online = data.estado_ws_arduino === 'Conectado';
        const htmlSt = online ? '<span class="text-success">En Línea</span>' : '<span class="text-danger">Offline</span>';
        
        if(st) st.innerHTML = htmlSt;
        if(stDet) stDet.innerHTML = htmlSt;
    }

    actualizarResumen(data) {
        let c = { ad:0, at:0, gi:0, vu:0 };
        if(data.movimientos_por_tipo) {
            data.movimientos_por_tipo.forEach(m => {
                const t = m.status_texto.toLowerCase();
                if(t.includes('adelante')) c.ad += m.cantidad;
                else if(t.includes('atras')) c.at += m.cantidad;
                else if(t.includes('giro')) c.gi += m.cantidad;
                else if(t.includes('vuelta')) c.vu += m.cantidad;
            });
        }
        const set = (id, v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
        set('statAdelante', c.ad); set('statAtras', c.at); set('statGiros', c.gi); set('statVueltas', c.vu);
    }

    inicializarGrafico() {
        const ctx = document.getElementById('actividadChart');
        if(!ctx) return;
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Movimientos', data: [], borderColor: '#ff2d95', tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    actualizarGrafico() {
        if(!this.chart || !this.estadoApp.metricas) return;
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
        // Modal de datos históricos
        try {
            const res = await fetch(`${this.backendUrl}/api/estadisticas-obstaculos`);
            const data = await res.json();
            const div = document.getElementById('metricasContenido');
            if(div && data.obstaculos_por_tipo) {
                div.innerHTML = '<ul class="list-group">' + 
                    data.obstaculos_por_tipo.map(o => `<li class="list-group-item bg-dark text-white d-flex justify-content-between"><span>${o.status_texto}</span><span class="badge bg-danger">${o.cantidad}</span></li>`).join('') + 
                    '</ul>';
                new bootstrap.Modal(document.getElementById('metricasModal')).show();
            }
        } catch(e){}
    }
}

window.monitoreoManager = new MonitoreoManager();