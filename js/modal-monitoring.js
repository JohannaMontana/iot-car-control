/**
 * Monitoring Manager for Modal
 * Handles all monitoring functionality within the modal
 */

class ModalMonitoringManager {
    // Constructor de la clase - inicializa propiedades principales
    constructor() {
        this.backendUrl = 'http://54.147.92.50:5500';  // URL del servidor backend
        this.socket = null;                            // Instancia de socket para WebSocket
        this.chart = null;                             // Instancia del gráfico Chart.js
        this.estadoApp = {                             // Estado interno de la aplicación
            metricas: {},                              // Métricas cargadas del servidor
            vistaGrafico: 'hora',                      // Vista actual del gráfico (hora/tipo)
            ultimaActualizacion: new Date()            // Última vez que se actualizaron los datos
        };

        this.init();  // Inicializar el manager
    }

    // Método de inicialización principal
    init() {
        console.log('🚀 Iniciando ModalMonitoringManager...');
        this.inicializarGrafico();     // Crear el gráfico inicial
        this.conectarSocket();         // Conectar al servidor WebSocket

        // Configurar eventos para cuando el modal se abre/cierra
        const modal = document.getElementById('monitoringModal');
        if (modal) {
            // Cuando el modal se muestra: actualizar datos y empezar refresco automático
            modal.addEventListener('shown.bs.modal', () => {
                this.actualizarDatos();
                this.startAutoRefresh();
            });

            // Cuando el modal se oculta: detener refresco automático
            modal.addEventListener('hidden.bs.modal', () => {
                this.stopAutoRefresh();
            });
        }
    }

    // Iniciar el refresco automático de datos
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);  // Limpiar intervalo previo si existe
        }
        // Actualizar datos cada 3 segundos (3000ms)
        this.refreshInterval = setInterval(() => this.actualizarDatos(), 3000);
    }

    // Detener el refresco automático
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);  // Detener el intervalo
            this.refreshInterval = null;          // Limpiar la referencia
        }
    }

    // Conectar al servidor WebSocket
    conectarSocket() {
        // Crear conexión socket.io con el backend
        this.socket = io(this.backendUrl, { transports: ['websocket', 'polling'] });

        // Evento cuando se conecta exitosamente
        this.socket.on('connect', () => {
            console.log('📡 Conectado al servidor WebSocket desde modal');
        });

        // Cuando se agrega un nuevo movimiento: actualizar datos
        this.socket.on('movimiento_agregado', () => this.actualizarDatos());
        
        // Cuando hay una alerta de obstáculo: forzar actualización de alertas
        this.socket.on('alerta_obstaculo', () => {
            console.log('🚨 Evento alerta_obstaculo recibido en modal');
            this.cargarAlertas();  // Cargar alertas inmediatamente
        });
    }

    // Actualizar todos los datos del modal
    async actualizarDatos() {
        try {
            // Ejecutar todas las cargas de datos en paralelo
            await Promise.all([
                this.cargarHistorialMovimientos(),  // Historial de movimientos
                this.cargarAlertas(),               // Alertas de obstáculos
                this.cargarEstadoActual(),          // Estado actual del sistema
                this.cargarMetricas(),              // Métricas para gráficos
                this.cargarResumenManiobras()       // Resumen de maniobras
            ]);

            // Actualizar timestamp de última actualización
            this.estadoApp.ultimaActualizacion = new Date();
            const infoUpd = document.getElementById('modalInfoActualizacion');
            if (infoUpd) {
                // Mostrar hora de última actualización
                infoUpd.textContent = this.estadoApp.ultimaActualizacion.toLocaleTimeString();
            }

        } catch (e) {
            console.error("Error actualizando datos del modal:", e);
        }
    }

    // Cargar historial de los últimos 10 movimientos
    async cargarHistorialMovimientos() {
        try {
            const resHist = await fetch(`${this.backendUrl}/api/ultimos-10-movimientos`);
            const dataHist = await resHist.json();
            if (dataHist.success && dataHist.movimientos) {
                this.renderizarTablaHistorial(dataHist.movimientos);  // Renderizar tabla
            }
        } catch (e) {
            console.error("Error cargando historial:", e);
        }
    }

    // Cargar alertas de obstáculos
    async cargarAlertas() {
        try {
            console.log('🔔 Cargando alertas desde API...');
            const resAlert = await fetch(`${this.backendUrl}/api/alertas`);
            const dataAlert = await resAlert.json();

            console.log('📊 Respuesta API /alertas:', dataAlert);

            // Manejar diferentes formatos de respuesta de la API
            let alertas = [];

            if (Array.isArray(dataAlert)) {
                // Caso 1: La respuesta es directamente un array
                alertas = dataAlert;
                console.log('✅ Alertas como array directo:', alertas.length);
            } else if (dataAlert && Array.isArray(dataAlert.alertas)) {
                // Caso 2: La respuesta tiene propiedad .alertas
                alertas = dataAlert.alertas;
                console.log('✅ Alertas en propiedad .alertas:', alertas.length);
            } else if (dataAlert && dataAlert.alertas === undefined) {
                // Caso 3: Respuesta inesperada (objeto sin .alertas)
                console.warn('⚠️ Respuesta inesperada, asumiendo estructura:', dataAlert);
                if (typeof dataAlert === 'object') {
                    alertas = [dataAlert];  // Convertir objeto único a array
                }
            }

            console.log(`📈 Total alertas procesadas: ${alertas.length}`);

            if (alertas.length > 0) {
                console.log('📋 Primeras 2 alertas:', alertas.slice(0, 2));
            }

            // Actualizar contadores en la interfaz
            this.actualizarContadoresAlertas(alertas.length);

            // Renderizar lista de alertas
            this.renderizarListaAlertas(alertas);

        } catch (e) {
            console.error("❌ Error cargando alertas:", e);
            this.actualizarContadoresAlertas(0);  // Poner contador en 0 si hay error
        }
    }

    // Actualizar todos los contadores de alertas en la interfaz
    actualizarContadoresAlertas(count) {
        console.log(`🔄 Actualizando contador de alertas: ${count}`);

        // 1. Actualizar KPI en el modal
        const modalMetricAlertas = document.getElementById('modalMetricAlertas');
        if (modalMetricAlertas) {
            modalMetricAlertas.textContent = count;
            console.log(`✅ modalMetricAlertas = ${count}`);
        }

        // 2. Actualizar badge (insignia) del modal
        const modalContadorAlertas = document.getElementById('modalContadorAlertas');
        if (modalContadorAlertas) {
            modalContadorAlertas.textContent = count;
            // Mostrar/ocultar badge según si hay alertas
            modalContadorAlertas.style.display = count > 0 ? 'inline-block' : 'none';
            console.log(`✅ modalContadorAlertas = ${count}`);
        }

        // 3. Actualizar panel principal (si existe)
        const totalAlertas = document.getElementById('totalAlertas');
        if (totalAlertas) {
            totalAlertas.textContent = count;
            console.log(`✅ totalAlertas = ${count}`);
        }
    }

    // Cargar estado actual del sistema
    async cargarEstadoActual() {
        try {
            const resEstado = await fetch(`${this.backendUrl}/api/estado-actual`);
            const dataEstado = await resEstado.json();

            // Actualizar contador de movimientos
            const modalMetricMovimientos = document.getElementById('modalMetricMovimientos');
            if (modalMetricMovimientos && dataEstado.estadisticas) {
                modalMetricMovimientos.textContent = dataEstado.estadisticas.total_movimientos || 0;
            }

            // Actualizar estado de conexión (online/offline)
            const modalMetricEstado = document.getElementById('modalMetricEstado');
            if (modalMetricEstado) {
                const on = dataEstado.estado_ws_arduino === 'Conectado';
                modalMetricEstado.innerHTML = on ?
                    '<span class="text-success fw-bold">En Línea</span>' :
                    '<span class="text-danger fw-bold">Offline</span>';
            }

        } catch (e) {
            console.error("Error cargando estado:", e);
        }
    }

    // Cargar métricas para el gráfico
    async cargarMetricas() {
        try {
            const resMet = await fetch(`${this.backendUrl}/api/metricas`);
            const dataMet = await resMet.json();
            this.estadoApp.metricas = dataMet;  // Guardar métricas en estado
            this.actualizarGrafico();           // Actualizar gráfico con nuevas métricas
        } catch (e) {
            console.error("Error cargando métricas:", e);
        }
    }

    // Cargar resumen de maniobras
    async cargarResumenManiobras() {
        try {
            const res = await fetch(`${this.backendUrl}/api/resumen-maniobras`);
            const data = await res.json();
            this.actualizarQuickStats(data);  // Actualizar estadísticas rápidas
        } catch (e) {
            console.error("Error cargando resumen maniobras:", e);
        }
    }

    // Renderizar tabla de historial de movimientos
    renderizarTablaHistorial(movimientos) {
        const container = document.getElementById('modalHistorialMovimientos');
        if (!container) return;

        // Si no hay movimientos, mostrar mensaje
        if (!movimientos || movimientos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-5"><i class="fas fa-box-open fa-2x mb-2"></i><br>Sin movimientos registrados</div>';
            return;
        }

        // Construir HTML de la tabla
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

        // Iterar sobre cada movimiento
        movimientos.forEach(mov => {
            // Formatear hora del movimiento
            let hora = "--:--";
            if (mov.fecha_hora) {
                const fechaObj = new Date(mov.fecha_hora);
                hora = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }

            // Determinar color del badge según tipo
            let badgeColor = 'bg-secondary';
            let tipoTexto = mov.tipo_ejecucion || 'Manual';

            if (tipoTexto === 'manual') badgeColor = 'bg-primary';
            if (tipoTexto === 'demo') badgeColor = 'bg-info text-dark';
            if (tipoTexto === 'automatica') { 
                badgeColor = 'bg-danger'; 
                tipoTexto = 'Evasión'; 
            }

            // Determinar icono según tipo de movimiento
            let icon = 'fa-circle';
            const txt = (mov.status_texto || '').toLowerCase();

            if (txt.includes('adelante')) icon = 'fa-arrow-up';
            else if (txt.includes('atras') || txt.includes('atrás')) icon = 'fa-arrow-down';
            else if (txt.includes('giro')) icon = 'fa-sync';
            else if (txt.includes('vuelta')) icon = 'fa-share';
            else if (txt.includes('detener')) icon = 'fa-stop-circle';

            // Agregar fila a la tabla
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
        <td class="text-end text-white small" style="font-family: monospace;">${hora}</td>
    </tr>
`;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;  // Insertar tabla en el DOM
    }

    // Renderizar lista de alertas
    renderizarListaAlertas(alertas) {
        const container = document.getElementById('modalAlertasContainer');
        if (!container) return;

        // Si no hay alertas, mostrar mensaje
        if (!alertas || alertas.length === 0) {
            container.innerHTML = '<div class="text-center text-white-50 py-4"><i class="fas fa-check-circle me-2"></i>Sin alertas de obstáculos</div>';
            return;
        }

        // Mapeo de códigos de obstáculo a nombres legibles
        const mapaBD = {
            1: "Adelante",
            2: "Adelante-Izquierda",
            3: "Adelante-Derecha",
            4: "Adelante-Izquierda-Derecha",
            5: "Retrocede"
        };

        let html = '';
        // Iterar sobre cada alerta
        alertas.forEach((a, index) => {
            // Formatear fecha de la alerta
            let fecha = '';
            if (a.fecha_hora) {
                try {
                    if (typeof a.fecha_hora === 'string') {
                        const dateStr = a.fecha_hora.includes('Z') ? a.fecha_hora : a.fecha_hora + 'Z';
                        const d = new Date(dateStr);
                        if (!isNaN(d.getTime())) {
                            fecha = d.toLocaleTimeString('es-MX', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                            });
                        }
                    }
                } catch (e) {
                    fecha = '--:--';
                }
            }

            // Obtener nombre del obstáculo
            const nombre = mapaBD[a.status_clave] || a.status_texto || `Alerta ${index + 1}`;
            // Determinar si es alerta grave (adelante o retrocede)
            const grave = (a.status_clave === 1 || a.status_clave === 5);

            // Construir elemento de alerta
            html += `
                <div class="alert ${grave ? 'alert-danger' : 'alert-warning'} mb-2 p-2 small shadow-sm d-flex justify-content-between align-items-center border-0" 
                     style="background: ${grave ? 'rgba(220,53,69,0.2)' : 'rgba(255,193,7,0.2)'}; color: white;">
                    <div>
                        <i class="fas ${grave ? 'fa-radiation' : 'fa-exclamation-triangle'} me-2"></i>
                        <strong>${nombre}</strong>
                        <div style="opacity: 0.8; font-size: 0.75rem;">${a.mensaje || 'Detección automática'}</div>
                    </div>
                    <span class="text-white-50" style="font-size: 0.7rem;">${fecha || '--:--'}</span>
                </div>
            `;
        });
        container.innerHTML = html;  // Insertar alertas en el DOM
    }

    // Actualizar estadísticas rápidas (placeholder)
    actualizarQuickStats(data) {
        console.log('📊 Datos resumen:', data);
    }

    // Inicializar gráfico Chart.js
    inicializarGrafico() {
        const ctx = document.getElementById('modalActividadChart');
        if (!ctx) return;

        // Destruir gráfico anterior si existe
        if (this.chart) {
            this.chart.destroy();
        }

        // Crear nuevo gráfico de línea
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],  // Etiquetas del eje X
                datasets: [{  // Dataset principal
                    label: 'Actividad',
                    data: [],  // Datos del eje Y
                    borderColor: '#ff2d95',
                    backgroundColor: 'rgba(255, 45, 149, 0.1)',
                    tension: 0.4,        // Suavizado de línea
                    fill: true,          // Relleno bajo la línea
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
                        display: false  // Ocultar leyenda
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
                            beginAtZero: true  // Empezar eje Y en 0
                        }
                    }
                },
                animation: {
                    duration: 1000,        // Duración de animación
                    easing: 'easeOutQuart' // Tipo de easing
                }
            }
        });
    }

    // Actualizar gráfico con datos cargados
    actualizarGrafico() {
        if (!this.chart || !this.estadoApp.metricas) return;
        const d = this.estadoApp.metricas;
        const isHourly = this.estadoApp.vistaGrafico === 'hora';

        // Configurar datos según vista actual (hora o tipo)
        if (isHourly && d.actividad_por_hora) {
            this.chart.data.labels = d.actividad_por_hora.map(x => `${x.hora}:00`);
            this.chart.data.datasets[0].data = d.actividad_por_hora.map(x => x.movimientos);
            this.chart.data.datasets[0].label = 'Actividad por Hora';
        } else if (!isHourly && d.movimientos_por_tipo) {
            this.chart.data.labels = d.movimientos_por_tipo.map(x => x.status_texto);
            this.chart.data.datasets[0].data = d.movimientos_por_tipo.map(x => x.cantidad);
            this.chart.data.datasets[0].label = 'Movimientos por Tipo';
        }

        this.chart.update('none');  // Actualizar gráfico sin animación
    }

    // Cambiar vista del gráfico (hora/tipo)
    cambiarVistaGrafico(v) {
        this.estadoApp.vistaGrafico = v;  // Actualizar estado
        this.actualizarGrafico();         // Actualizar gráfico
    }
}

// Inicializar cuando el DOM está completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    window.modalMonitoringManager = new ModalMonitoringManager();
});