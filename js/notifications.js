/**
 * Notification Manager - FRONTEND ONLY
 * Muestra notificaciones en tiempo real basadas en eventos WebSocket
 */

class NotificationManager {
    constructor() {
        this.container = null;
        this.socket = null;
        this.initContainer();
        
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
        
        console.log('🔔 NotificationManager inicializado');
    }

    initContainer() {
        // Crear contenedor de notificaciones si no existe
        if (!document.getElementById('notification-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
            console.log('📦 Contenedor de notificaciones creado');
        } else {
            this.container = document.getElementById('notification-container');
        }
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
        // Crear elemento de notificación
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} animate__animated animate__fadeInRight`;
        
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
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Agregar al contenedor (al inicio)
        if (this.container.firstChild) {
            this.container.insertBefore(notification, this.container.firstChild);
        } else {
            this.container.appendChild(notification);
        }
        
        // Botón para cerrar
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.style.animation = 'fadeOut 0.5s forwards';
            setTimeout(() => notification.remove(), 500);
        });
        
        // Limitar a 5 notificaciones máximo
        const notifications = this.container.querySelectorAll('.notification');
        if (notifications.length > 5) {
            notifications[notifications.length - 1].remove();
        }
        
        // Remover automáticamente después de 5 segundos
        setTimeout(() => {
            if (notification.parentNode === this.container) {
                notification.style.animation = 'fadeOut 0.5s forwards';
                setTimeout(() => {
                    if (notification.parentNode === this.container) {
                        notification.remove();
                    }
                }, 500);
            }
        }, 5000);
    }
}

// Instancia global - solo se crea una vez
if (!window.notificationManager) {
    window.notificationManager = new NotificationManager();
}

// Función helper global
function showNotification(type, title, message) {
    if (window.notificationManager) {
        window.notificationManager[`show${type.charAt(0).toUpperCase() + type.slice(1)}`](title, message);
    }
}