// Configuración global
const BACKEND_URL = 'https://corsproxy.io/?' + encodeURIComponent('http://54.147.92.50:5500')

class SocketHandler {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.eventCallbacks = {};
    }

    connect() {
        this.socket = io(BACKEND_URL);
        
        this.socket.on('connect', () => {
            console.log('✅ Conectado al servidor');
            this.connected = true;
            this.emitEvent('connected');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Desconectado del servidor');
            this.connected = false;
            this.emitEvent('disconnected');
        });

        this.socket.on('movimiento_agregado', (data) => {
            this.emitEvent('movimiento', data);
        });

        this.socket.on('alerta_obstaculo', (data) => {
            this.emitEvent('alerta', data);
        });

        this.socket.on('demo_ejecutada', (data) => {
            this.emitEvent('demoEjecutada', data);
        });

        this.socket.on('demo_creada', (data) => {
            this.emitEvent('demoCreada', data);
        });

        this.socket.on('demo_eliminada', (data) => {
            this.emitEvent('demoEliminada', data);
        });
    }

    on(event, callback) {
        if (!this.eventCallbacks[event]) {
            this.eventCallbacks[event] = [];
        }
        this.eventCallbacks[event].push(callback);
    }

    emitEvent(event, data) {
        if (this.eventCallbacks[event]) {
            this.eventCallbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error en callback ${event}:`, error);
                }
            });
        }
    }

    emit(event, data) {
        if (this.socket && this.connected) {
            this.socket.emit(event, data);
        }
    }

    isConnected() {
        return this.connected;
    }
}

// Instancia global
const socketManager = new SocketHandler();