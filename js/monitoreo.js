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
        this.inicializarGrafico();
        this.conectarSocket();
        this.actualizarDatos();
        
        // Actualizar cada 3 segundos para mantener sync con la BD
        setInterval(() => this.actualizarDatos(), 3000);
    }

    conectarSocket() {
        // Conexión independiente para la página de monitoreo
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });
        
        this.socket.on('connect', () => {
            const el = document.querySelector('.estado-conexion');
            if(el) el.innerHTML = '<span class="status-indicator status-online pulse"></span> Conectado';
        });

        this.socket.on('disconnect', () => {
            const el = document.querySelector('.estado-conexion');
            if(el) el.innerHTML = '<span class="status-indicator status-offline"></span> Desconectado';
        });

        // Recargar tablas al instante si hay eventos
        this.socket.on('movimiento_agregado', () => this.actualizarDatos());
        
        this.socket.on('alerta_obstaculo', (data) => {
            this.agregarAlertaVisual(data);
            this.actualizarDatos(); 
        });
    }

    async actualizarDatos() {
        try {
            // 1. HISTORIAL (Tabla 10)
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

            // 4. MÉTRICAS GRÁFICO
            const resMet = await fetch(`${this.backendUrl}/api/metricas`);
            const dataMet = await resMet.json();
            this.estadoApp.metricas = dataMet;
            this.actualizarGrafico();
            this.actualizarResumen(dataMet);

            // Timestamp Update
            this.estadoApp.ultimaActualizacion = new Date();
            const infoUpd = document.getElementById('infoActualizacion');
            if(infoUpd) infoUpd.textContent = this.estadoApp.ultimaActualizacion.toLocaleTimeString();

        } catch(e) { console.error("Error polling monitoreo:", e); }
    }

    // ==================== TABLA PRINCIPAL ====================

    renderizarTablaHistorial(movimientos) {
        const container = document.getElementById('historialMovimientos');
        if (!container) return;

        if (!movimientos || movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-5"><i class="fas fa-box-open fa-2x mb-2"></i><br>Sin datos en BD</div>';
            return;
        }

        let html = `
            <div class="table-responsive">
            <table class="table table-dark table-sm table-hover mb-0 align-middle" style="background: transparent;">
                <thead>
                    <tr class="text-secondary" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <th>Acción</th>
                        <th>Tipo</th>
                        <th>Duración</th>
                        <th class="text-end">Hora</th>
                    </tr>
                </thead>
                <tbody>
        `;

        movimientos.forEach(m => {
            let hora = "-";
            if (m.fecha_hora) {
                const d = new Date(m.fecha_hora);
                if(!isNaN(d.getTime())) hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
            
            // Badges de color
            let badge = 'bg-secondary';
            let tipo = m.tipo_ejecucion || 'manual';
            if (tipo === 'manual') badge = 'bg-primary';
            if (tipo === 'automatica') badge = 'bg-danger'; // Evasión
            if (tipo === 'demo') badge = 'bg-info text-dark';

            html += `
                <tr>
                    <td><strong class="text-white">${m.status_texto}</strong></td>
                    <td><span class="badge ${badge} rounded-pill" style="font-size: 0.7rem;">${tipo.toUpperCase()}</span></td>
                    <td class="text-white-50 small">${m.duracion_segundos}s</td>
                    <td class="text-end text-muted small font-monospace">${hora}</td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // ==================== ALERTAS Y MAPEO ====================

    renderizarListaAlertas(alertas) {
        const container = document.getElementById('alertasContainer');
        const counters = [document.getElementById('contadorAlertas'), document.getElementById('metricAlertas')];
        
        // Actualizar contadores
        counters.forEach(c => { if(c) c.textContent = alertas ? alertas.length : 0; });

        if (!container) return;
        if (!alertas || alertas.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4">Sin alertas</div>';
            return;
        }

        // MAPEO DE TEXTOS SEGÚN TU BD
        const mapaBD = {
            1: "Adelante",
            2: "Adelante-Izquierda",
            3: "Adelante-Derecha",
            4: "Adelante-Izquierda-Derecha",
            5: "Retrocede"
        };

        let html = '';
        alertas.forEach(a => {
            const fecha = a.fecha_hora ? new Date(a.fecha_hora).toLocaleTimeString() : '';
            // Obtener nombre legible o fallback
            const nombreObstaculo = mapaBD[a.status_clave] || a.status_texto || "Desconocido";
            const esFrontal = a.status_clave === 1;

            html += `
                <div class="alert ${esFrontal ? 'alert-danger' : 'alert-warning'} mb-2 p-2 small shadow-sm d-flex justify-content-between align-items-center">
                    <div>
                        <i class="fas ${esFrontal ? 'fa-radiation' : 'fa-exclamation-triangle'} me-2"></i>
                        <strong>${nombreObstaculo}</strong>
                        <div class="text-white-50" style="font-size: 0.75rem;">${a.mensaje || 'Detección automática'}</div>
                    </div>
                    <span class="text-white-50">${fecha}</span>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    agregarAlertaVisual(data) {
        // Popup temporal en la lista
        const container = document.getElementById('alertasContainer');
        if(container) {
            if(container.innerText.includes("Sin alertas")) container.innerHTML = "";
            
            const mapaBD = { 1: "Adelante", 2: "Adelante-Izquierda", 3: "Adelante-Derecha", 5: "Retrocede" };
            const txt = mapaBD[data.tipo_obstaculo] || "Obstáculo";

            const div = document.createElement('div');
            div.className = 'alert alert-danger mb-2 p-2 border-start border-4 border-danger fade show';
            div.innerHTML = `<strong>¡NUEVO: ${txt}!</strong> <small class="float-end">Ahora</small><br><small>${data.mensaje}</small>`;
            container.prepend(div);
        }
    }

    // ==================== EXTRAS ====================

    actualizarKPIs(data) {
        const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
        set('metricMovimientos', data.estadisticas?.total_movimientos || 0);
        set('metricTiempo', (data.estadisticas?.dias_activo || 0) + 'd');
        
        const elSt = document.getElementById('metricEstado');
        if(elSt) {
            const on = data.estado_ws_arduino === 'Conectado';
            elSt.innerHTML = on ? '<span class="text-success">En Línea</span>' : '<span class="text-danger">Offline</span>';
        }
        
        const serv = document.getElementById('infoServidor');
        if(serv) { serv.textContent = 'Conectado'; serv.className = 'text-success fw-bold'; }
    }

    actualizarResumen(data) {
        let c = {ad:0, at:0, gi:0, vu:0};
        if(data.movimientos_por_tipo) {
            data.movimientos_por_tipo.forEach(m => {
                const t = m.status_texto.toLowerCase();
                if(t.includes('adelante')) c.ad += m.cantidad;
                else if(t.includes('atras') || t.includes('atrás')) c.at += m.cantidad;
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
            data: { labels:[], datasets:[{label:'Actividad', data:[], borderColor:'#ff2d95', tension:0.4, fill:true, backgroundColor:'rgba(255,45,149,0.1)'}] },
            options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{color:'#333'}}, y:{grid:{color:'#333'}}} }
        });
    }

    actualizarGrafico() {
        if(!this.chart || !this.estadoApp.metricas) return;
        const d = this.estadoApp.metricas;
        const isHourly = this.estadoApp.vistaGrafico === 'hora';
        
        if(isHourly && d.actividad_por_hora) {
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
            if(div && data.obstaculos_por_tipo) {
                div.innerHTML = '<ul class="list-group">' + 
                    data.obstaculos_por_tipo.map(o => `
                        <li class="list-group-item bg-dark text-white d-flex justify-content-between border-secondary">
                            <span>${o.status_texto}</span>
                            <span class="badge bg-danger rounded-pill">${o.cantidad}</span>
                        </li>`).join('') + '</ul>';
                new bootstrap.Modal(document.getElementById('metricasModal')).show();
            }
        } catch(e){}
    }
}

window.monitoreoManager = new MonitoreoManager();