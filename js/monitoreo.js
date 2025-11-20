class MonitoreoManager {
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500'; // Tu IP
        this.estadoApp = {
            metricas: {},
            alertas: [],
            actividadChart: null,
            vistaGrafico: 'hora',
            ultimaActualizacion: new Date()
        };

        this.inicializarApp();
    }

    inicializarApp() {
        this.inicializarGrafico();
        this.actualizarDatos();
        
        // Actualizar periódicamente cada 3 segundos
        setInterval(() => this.actualizarDatos(), 3000);

        // Intentar conectar con los eventos del socket global si existe
        this.conectarSocketGlobal();
        
        console.log('✅ MonitoreoManager inicializado');
    }

    conectarSocketGlobal() {
        // Esperar a que controlManager inicie el socket para no abrir otro
        const checkSocket = setInterval(() => {
            if (window.controlManager && window.controlManager.socket) {
                clearInterval(checkSocket);
                const socket = window.controlManager.socket;
                
                // Escuchar nuevos movimientos para actualizar la tabla al instante
                socket.on('movimiento_agregado', () => this.actualizarDatos());
                
                // Escuchar alertas
                socket.on('alerta_obstaculo', (data) => {
                    this.agregarAlerta({
                        tipo: 'obstaculo',
                        mensaje: data.mensaje,
                        severidad: 'alta',
                        timestamp: data.timestamp
                    });
                    this.actualizarMetricasRapidas();
                });

                console.log('🔌 Monitoreo sincronizado con Socket.IO');
            }
        }, 1000);
    }

    // ==================== ACTUALIZACIÓN DE DATOS ====================

    async actualizarDatos() {
        try {
            // 1. Estado General
            const resEstado = await fetch(`${this.backendUrl}/api/estado-actual`);
            const dataEstado = await resEstado.json();

            // 2. Métricas para Gráficas
            const resMetricas = await fetch(`${this.backendUrl}/api/metricas`);
            const dataMetricas = await resMetricas.json();

            // 3. 🔥 HISTORIAL (Lo que pediste)
            const resHistorial = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const dataHistorial = await resHistorial.json();

            // 4. Alertas
            const resAlertas = await fetch(`${this.backendUrl}/api/alertas`);
            const dataAlertas = await resAlertas.json();

            // Guardar estado
            this.estadoApp.metricas = dataMetricas;
            this.estadoApp.ultimaActualizacion = new Date();

            // Renderizar UI
            this.actualizarInterfaz(dataEstado);
            this.actualizarEstadisticas(dataMetricas);
            this.renderizarTablaHistorial(dataHistorial.movimientos); // <--- AQUÍ ESTÁ LA TABLA
            
            if (dataAlertas.alertas && dataAlertas.alertas.length > 0) {
                this.renderizarAlertas(dataAlertas.alertas);
            }

            this.actualizarGrafico();

        } catch (error) {
            console.error("Error actualizando monitoreo:", error);
        }
    }

    // ==================== RENDERIZADO DE TABLA HISTORIAL ====================

    renderizarTablaHistorial(movimientos) {
        const container = document.getElementById('historialMovimientos');
        if (!container) return;

        if (!movimientos || movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4">Sin movimientos recientes</div>';
            return;
        }

        // Crear estructura de tabla limpia
        let html = `
            <div class="table-responsive">
                <table class="table table-borderless text-white mb-0" style="font-size: 0.9rem;">
                    <thead>
                        <tr class="text-muted border-bottom border-secondary">
                            <th>Acción</th>
                            <th>Tipo</th>
                            <th>Duración</th>
                            <th class="text-end">Hora</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        movimientos.forEach(mov => {
            const fecha = new Date(mov.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            // Estilos según tipo
            const badgeClass = mov.tipo_ejecucion === 'manual' ? 'bg-primary' : 
                               mov.tipo_ejecucion === 'automatica' ? 'bg-danger' : 'bg-info';
            
            // Icono según movimiento
            let icono = 'fa-arrow-right';
            const st = mov.status_texto.toLowerCase();
            if(st.includes('adelante')) icono = 'fa-arrow-up';
            else if(st.includes('atrás') || st.includes('atras')) icono = 'fa-arrow-down';
            else if(st.includes('detener')) icono = 'fa-stop';
            else if(st.includes('giro') || st.includes('vuelta')) icono = 'fa-sync';

            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td>
                        <i class="fas ${icono} me-2" style="color: var(--accent-cyan); width: 20px;"></i>
                        ${mov.status_texto}
                    </td>
                    <td><span class="badge ${badgeClass} bg-opacity-75" style="font-size: 0.7rem;">${mov.tipo_ejecucion}</span></td>
                    <td>${mov.duracion_segundos}s</td>
                    <td class="text-end text-muted">${fecha}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    // ==================== OTRAS ACTUALIZACIONES UI ====================

    actualizarInterfaz(data) {
        // Actualizar tarjetas superiores
        const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };

        setText('metricMovimientos', data.estadisticas?.total_movimientos || 0);
        setText('metricTiempo', (data.estadisticas?.dias_activo || 0) + 'd');
        
        // Estado conexión Robot
        const elEstado = document.getElementById('metricEstado');
        if (elEstado) {
            const conectado = data.estado_ws_arduino === 'Conectado';
            elEstado.innerHTML = conectado 
                ? '<span class="text-success"><i class="fas fa-wifi me-2"></i>Online</span>'
                : '<span class="text-danger"><i class="fas fa-wifi-slash me-2"></i>Offline</span>';
        }

        // Info Footer
        setText('infoActualizacion', this.estadoApp.ultimaActualizacion.toLocaleTimeString());
        const infoServidor = document.getElementById('infoServidor');
        if(infoServidor) infoServidor.textContent = 'Conectado';
    }

    actualizarEstadisticas(data) {
        // Contadores específicos
        let counts = { adelante: 0, atras: 0, giros: 0, vueltas: 0 };
        
        if (data.movimientos_por_tipo) {
            data.movimientos_por_tipo.forEach(m => {
                const txt = m.status_texto.toLowerCase();
                if (txt.includes('adelante')) counts.adelante += m.cantidad;
                else if (txt.includes('atras') || txt.includes('atrás')) counts.atras += m.cantidad;
                else if (txt.includes('giro')) counts.giros += m.cantidad;
                else if (txt.includes('vuelta')) counts.vueltas += m.cantidad;
            });
        }

        const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        setText('statAdelante', counts.adelante);
        setText('statAtras', counts.atras);
        setText('statGiros', counts.giros);
        setText('statVueltas', counts.vueltas);
    }

    renderizarAlertas(alertas) {
        const container = document.getElementById('alertasContainer');
        if (!container) return;

        if (alertas.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4">Sin alertas recientes</div>';
            return;
        }

        // Actualizar contador badge
        const badge = document.getElementById('contadorAlertas');
        if(badge) badge.textContent = alertas.length;

        let html = '';
        alertas.forEach(alerta => {
            const fecha = new Date(alerta.fecha_hora || alerta.timestamp).toLocaleTimeString();
            const esGrave = alerta.status_clave === 1; // Asumiendo 1 es obstáculo frontal grave

            html += `
                <div class="alert-item mb-2 p-2 rounded border-start border-4 ${esGrave ? 'border-danger bg-danger bg-opacity-10' : 'border-warning bg-warning bg-opacity-10'}">
                    <div class="d-flex justify-content-between">
                        <strong><i class="fas fa-exclamation-triangle me-2"></i>${alerta.status_texto || 'Alerta'}</strong>
                        <small class="opacity-75">${fecha}</small>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
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
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#ffffff' } }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#b0b0b0' } },
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#b0b0b0' } }
                }
            }
        });
    }

    actualizarGrafico() {
        const chart = this.estadoApp.actividadChart;
        if (!chart || !this.estadoApp.metricas) return;

        const data = this.estadoApp.metricas;
        
        if (this.estadoApp.vistaGrafico === 'hora' && data.actividad_por_hora) {
            chart.data.labels = data.actividad_por_hora.map(d => `${d.hora}:00`);
            chart.data.datasets[0].data = data.actividad_por_hora.map(d => d.movimientos);
            chart.data.datasets[0].label = 'Actividad por Hora';
        } else if (this.estadoApp.vistaGrafico === 'tipo' && data.movimientos_por_tipo) {
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

    // Métricas Avanzadas (Modal)
    async verMetricasAvanzadas() {
        try {
            const res = await fetch(`${this.backendUrl}/api/estadisticas-obstaculos`);
            const data = await res.json();
            
            const div = document.getElementById('metricasContenido');
            if(div && data.obstaculos_por_tipo) {
                div.innerHTML = `
                    <h6 class="mb-3">Desglose de Obstáculos</h6>
                    <ul class="list-group">
                        ${data.obstaculos_por_tipo.map(o => `
                            <li class="list-group-item d-flex justify-content-between align-items-center bg-dark text-white">
                                ${o.status_texto}
                                <span class="badge bg-primary rounded-pill">${o.cantidad}</span>
                            </li>
                        `).join('')}
                    </ul>
                `;
                new bootstrap.Modal(document.getElementById('metricasModal')).show();
            }
        } catch(e) { console.error(e); }
    }
}

window.monitoreoManager = new MonitoreoManager();