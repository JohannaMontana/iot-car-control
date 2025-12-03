/**
 * Notification Manager - FRONTEND ONLY
 * Muestra notificaciones en tiempo real basadas en eventos WebSocket
 */

class NotificationManager {
    // Constructor: inicializa propiedades y configuración básica
    constructor() {
        this.container = null;        // Contenedor DOM para notificaciones
        this.socket = null;           // Referencia al socket WebSocket
        
        // Inicializar componentes
        this.initContainer();         // Crear contenedor en DOM
        this.initSocketListeners();   // Configurar listeners de socket
        
        // Diccionario para mapear códigos de movimiento a nombres legibles
        this.movimientosDict = {
            1: "Adelante",
            2: "Atrás", 
            3: "Detener",
            4: "Adelante-Derecha",
            5: "Adelante-Izquierda",
            6: "Atrás-Derecha",
            7: "Atrás-Izquierda",
            8: "Giro Derecha",
            9: "Giro Izquierda",
            10: "Vuelta 360° Derecha",
            11: "Vuelta 360° Izquierda"
        };
    }

    // Crear e inicializar el contenedor de notificaciones en el DOM
    initContainer() {
        // Si no existe el contenedor, crearlo
        if (!document.getElementById('notification-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);  // Agregar al body
        } else {
            // Si ya existe, obtener referencia
            this.container = document.getElementById('notification-container');
        }
    }

    // Configurar listeners para eventos del socket WebSocket
    initSocketListeners() {
        // Si controlManager existe y tiene socket, usarlo
        if (window.controlManager && window.controlManager.socket) {
            this.socket = window.controlManager.socket;
            this.setupSocketEvents();  // Configurar eventos
        } else {
            // Si no existe, esperar 1 segundo e intentar nuevamente
            setTimeout(() => {
                if (window.controlManager && window.controlManager.socket) {
                    this.socket = window.controlManager.socket;
                    this.setupSocketEvents();
                }
            }, 1000);
        }
    }

    // Configurar todos los eventos del socket WebSocket
    setupSocketEvents() {
        if (!this.socket) return;  // Salir si no hay socket

        // 1. Evento cuando se agrega un movimiento
        this.socket.on('movimiento_agregado', (data) => {
            const movimiento = this.movimientosDict[data.status_clave] || `Movimiento ${data.status_clave}`;
            this.showSuccess(
                '✅ Movimiento Ejecutado',
                `${movimiento} enviado correctamente`
            );
        });

        // 2. Evento de alerta de obstáculo
        this.socket.on('alerta_obstaculo', (data) => {
            const tipos = {
                1: 'Obstáculo Adelante',
                2: 'Obstáculo Adelante-Izquierda',
                3: 'Obstáculo Adelante-Derecha',
                4: 'Obstáculo Adelante-Izquierda-Derecha',
                5: 'Obstáculo Retrocede'
            };
            const tipo = tipos[data.tipo_obstaculo] || 'Obstáculo detectado';
            
            this.showDanger(
                '⚠️ ¡Alerta de Obstáculo!',
                `${tipo} a ${data.distancia || '?'}cm`
            );
        });

        // 3. Evento de progreso de demo
        this.socket.on('demo_progreso', (data) => {
            this.showInfo(
                `↻ Demo Progreso (${data.movimiento_actual}/${data.total_movimientos})`,
                `Ejecutando: ${data.nombre_movimiento}`
            );
        });

        // 4. Evento cuando se completa una demo
        this.socket.on('demo_completada', (data) => {
            this.showSuccess(
                '🎉 Demo Completada',
                `"${data.nombre}" finalizada exitosamente`
            );
        });

        // 5. Evento cuando se crea una demo
        this.socket.on('demo_creada', (data) => {
            this.showSuccess(
                '📁 Demo Creada',
                `"${data.nombre}" guardada correctamente`
            );
        });

        // 6. Evento cuando se elimina una demo
        this.socket.on('demo_eliminada', () => {
            this.showWarning(
                '🗑️ Demo Eliminada',
                'Secuencia eliminada del sistema'
            );
        });

        // 7. Evento de conexión exitosa
        this.socket.on('connect', () => {
            this.showSuccess(
                '🔗 Conectado',
                'Conexión WebSocket establecida con el servidor'
            );
        });

        // 8. Evento de desconexión
        this.socket.on('disconnect', () => {
            this.showWarning(
                '🔌 Desconectado',
                'Conexión WebSocket perdida'
            );
        });
    }

    // Métodos auxiliares para mostrar diferentes tipos de notificaciones

    // Mostrar notificación de éxito
    showSuccess(title, message) {
        this.showNotification('success', title, message);
    }

    // Mostrar notificación informativa
    showInfo(title, message) {
        this.showNotification('info', title, message);
    }

    // Mostrar notificación de advertencia
    showWarning(title, message) {
        this.showNotification('warning', title, message);
    }

    // Mostrar notificación de peligro/error
    showDanger(title, message) {
        this.showNotification('danger', title, message);
    }

    // Método principal para mostrar notificaciones en el DOM
    showNotification(type, title, message) {
        // Crear elemento de notificación
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Determinar icono según tipo
        let icon = 'fa-check-circle';
        if (type === 'danger') icon = 'fa-exclamation-triangle';
        if (type === 'warning') icon = 'fa-exclamation-circle';
        if (type === 'info') icon = 'fa-info-circle';
        
        // Generar timestamp formateado
        const timestamp = new Date().toLocaleTimeString('es-MX', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Estructura HTML de la notificación
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
                <div class="notification-time">${timestamp}</div>
            </div>
            <div class="notification-progress"></div>
        `;
        
        // Agregar al contenedor
        this.container.appendChild(notification);
        
        // Limitar a máximo 5 notificaciones visibles
        const notifications = this.container.querySelectorAll('.notification');
        if (notifications.length > 5) {
            notifications[0].remove();  // Eliminar la más antigua
        }
        
        // Auto-eliminar notificación después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode === this.container) {
                notification.style.animation = 'fadeOut 0.5s forwards';  // Animación de salida
                setTimeout(() => {
                    if (notification.parentNode === this.container) {
                        notification.remove();  // Eliminar del DOM
                    }
                }, 500);
            }
        }, 3000);
        
        // Reproducir sonido solo para alertas importantes (danger)
        if (type === 'danger') {
            this.playNotificationSound();
        }
    }

    // Reproducir sonido de notificación usando Web Audio API
    playNotificationSound() {
        try {
            // Crear contexto de audio
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();  // Generador de onda
            const gainNode = audioContext.createGain();         // Control de volumen
            
            // Conectar componentes
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Configurar sonido
            oscillator.frequency.value = 800;  // Frecuencia en Hz
            oscillator.type = 'sine';          // Tipo de onda (senoidal)
            
            // Configurar envelope (ataque/decaimiento)
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            // Iniciar y detener sonido
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log('AudioContext no soportado');  // Fallback silencioso
        }
    }

    // ========== MÉTODOS PÚBLICOS PARA USO DESDE OTROS ARCHIVOS ==========

    // Notificar movimiento ejecutado exitosamente
    movimientoEjecutado(statusClave) {
        const movimiento = this.movimientosDict[statusClave] || `Movimiento ${statusClave}`;
        this.showSuccess(
            '🚀 Movimiento Enviado',
            `${movimiento} se está ejecutando...`
        );
    }

    // Notificar movimiento fallido
    movimientoFallido(statusClave, error) {
        const movimiento = this.movimientosDict[statusClave] || `Movimiento ${statusClave}`;
        this.showDanger(
            '❌ Error en Movimiento',
            `${movimiento} - ${error || 'Error de conexión'}`
        );
    }

    // Notificar inicio de demo
    demoIniciada(nombre, pasos) {
        this.showInfo(
            '🚀 Demo Iniciada',
            `"${nombre}" (${pasos} pasos) en ejecución`
        );
    }

    // Notificar demo fallida
    demoFallida(nombre, error) {
        this.showDanger(
            '❌ Error en Demo',
            `"${nombre}" - ${error || 'Error desconocido'}`
        );
    }
}

// Crear instancia global accesible desde cualquier parte
const notificationManager = new NotificationManager();

// Función helper global para mostrar notificaciones
function showNotification(type, title, message) {
    // Verificar que notificationManager y el método existan
    if (notificationManager && typeof notificationManager[`show${type.charAt(0).toUpperCase() + type.slice(1)}`] === 'function') {
        // Llamar al método correspondiente (showSuccess, showInfo, etc.)
        notificationManager[`show${type.charAt(0).toUpperCase() + type.slice(1)}`](title, message);
    }
}