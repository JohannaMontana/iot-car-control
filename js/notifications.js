/**
 * Notification Manager - FRONTEND ONLY
 * Muestra notificaciones en tiempo real basadas en eventos WebSocket
 */

class NotificationManager {
    constructor() {
        this.container = null;
        this.socket = null;
        this.initContainer();
        this.initSocketListeners();
        
        // Diccionario de movimientos
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

    initContainer() {
        // Crear contenedor de notificaciones si no existe
        if (!document.getElementById('notification-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('notification-container');
        }
    }

    initSocketListeners() {
        // Obtener el socket del controlManager si existe
        if (window.controlManager && window.controlManager.socket) {
            this.socket = window.controlManager.socket;
            this.setupSocketEvents();
        } else {
            // Esperar a que se cargue el controlManager
            setTimeout(() => {
                if (window.controlManager && window.controlManager.socket) {
                    this.socket = window.controlManager.socket;
                    this.setupSocketEvents();
                }
            }, 1000);
        }
    }

    setupSocketEvents() {
        if (!this.socket) return;

        // 1. Cuando se agrega un movimiento (respuesta del backend)
        this.socket.on('movimiento_agregado', (data) => {
            const movimiento = this.movimientosDict[data.status_clave] || `Movimiento ${data.status_clave}`;
            this.showSuccess(
                '✅ Movimiento Ejecutado',
                `${movimiento} enviado correctamente`
            );
        });

        // 2. Alertas de obstáculos
        this.socket.on('alerta_obstaculo', (data) => {
            const tipos = {
                1: 'Obstáculo frontal',
                2: 'Obstáculo lateral izquierdo', 
                3: 'Obstáculo lateral derecho',
                4: 'Obstáculo trasero',
                5: 'Obstáculo múltiple'
            };
            const tipo = tipos[data.tipo_obstaculo] || 'Obstáculo detectado';
            
            this.showDanger(
                '⚠️ ¡Alerta de Obstáculo!',
                `${tipo} a ${data.distancia || '?'}cm`
            );
        });

        // 3. Progreso de demos
        this.socket.on('demo_progreso', (data) => {
            this.showInfo(
                `↻ Demo Progreso (${data.movimiento_actual}/${data.total_movimientos})`,
                `Ejecutando: ${data.nombre_movimiento}`
            );
        });

        // 4. Demo completada
        this.socket.on('demo_completada', (data) => {
            this.showSuccess(
                '🎉 Demo Completada',
                `"${data.nombre}" finalizada exitosamente`
            );
        });

        // 5. Demo creada
        this.socket.on('demo_creada', (data) => {
            this.showSuccess(
                '📁 Demo Creada',
                `"${data.nombre}" guardada correctamente`
            );
        });

        // 6. Demo eliminada
        this.socket.on('demo_eliminada', () => {
            this.showWarning(
                '🗑️ Demo Eliminada',
                'Secuencia eliminada del sistema'
            );
        });

        // 7. Evento de conexión
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

    // Métodos para mostrar diferentes tipos de notificaciones
    showSuccess(title, message) {
        this.showNotification('success', title, message);
    }

    showInfo(title, message) {
        this.showNotification('info', title, message);
    }

    showWarning(title, message) {
        this.showNotification('warning', title, message);
    }

    showDanger(title, message) {
        this.showNotification('danger', title, message);
    }

    showNotification(type, title, message) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Icono según tipo
        let icon = 'fa-check-circle';
        if (type === 'danger') icon = 'fa-exclamation-triangle';
        if (type === 'warning') icon = 'fa-exclamation-circle';
        if (type === 'info') icon = 'fa-info-circle';
        
        const timestamp = new Date().toLocaleTimeString('es-MX', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
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
        
        // Limitar a 5 notificaciones máximo
        const notifications = this.container.querySelectorAll('.notification');
        if (notifications.length > 5) {
            notifications[0].remove();
        }
        
        // Remover después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode === this.container) {
                notification.style.animation = 'fadeOut 0.5s forwards';
                setTimeout(() => {
                    if (notification.parentNode === this.container) {
                        notification.remove();
                    }
                }, 500);
            }
        }, 3000);
        
        // Efecto de sonido opcional (solo para alertas importantes)
        if (type === 'danger') {
            this.playNotificationSound();
        }
    }

    playNotificationSound() {
        try {
            // Crear un tono de notificación simple
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log('AudioContext no soportado');
        }
    }

    // Métodos públicos para usar desde otros archivos
    movimientoEjecutado(statusClave) {
        const movimiento = this.movimientosDict[statusClave] || `Movimiento ${statusClave}`;
        this.showSuccess(
            '🚀 Movimiento Enviado',
            `${movimiento} se está ejecutando...`
        );
    }

    movimientoFallido(statusClave, error) {
        const movimiento = this.movimientosDict[statusClave] || `Movimiento ${statusClave}`;
        this.showDanger(
            '❌ Error en Movimiento',
            `${movimiento} - ${error || 'Error de conexión'}`
        );
    }

    demoIniciada(nombre, pasos) {
        this.showInfo(
            '🚀 Demo Iniciada',
            `"${nombre}" (${pasos} pasos) en ejecución`
        );
    }

    demoFallida(nombre, error) {
        this.showDanger(
            '❌ Error en Demo',
            `"${nombre}" - ${error || 'Error desconocido'}`
        );
    }
}

// Instancia global
const notificationManager = new NotificationManager();

// Función helper para usar desde otros archivos
function showNotification(type, title, message) {
    if (notificationManager && typeof notificationManager[`show${type.charAt(0).toUpperCase() + type.slice(1)}`] === 'function') {
        notificationManager[`show${type.charAt(0).toUpperCase() + type.slice(1)}`](title, message);
    }
}