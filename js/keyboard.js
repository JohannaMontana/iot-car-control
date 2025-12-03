/**
 * Keyboard Manager - VERSIÓN CON FLECHAS
 * Usa flechas direccionales y espacio en lugar de WASD
 */

class KeyboardManager {
    constructor() {
        this.activeKeyDisplay = document.getElementById('activeKeyDisplay');
        this.initialize();
    }

    initialize() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        console.log('⌨️ Keyboard Manager inicializado (Flechas + Espacio)');
    }

    handleKeyDown(e) {
        // Solo procesar si no estamos en un input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        const key = e.key.toUpperCase();
        let status_clave = null;

        switch(key) {
            case 'ARROWUP':
            case 'UP':
                status_clave = 1; // Adelante
                this.updateActiveKey('↑');
                break;
            case 'ARROWDOWN':
            case 'DOWN':
                status_clave = 2; // Atrás
                this.updateActiveKey('↓');
                break;
            case 'ARROWLEFT':
            case 'LEFT':
                status_clave = 9; // Giro Izquierda
                this.updateActiveKey('←');
                break;
            case 'ARROWRIGHT':
            case 'RIGHT':
                status_clave = 8; // Giro Derecha
                this.updateActiveKey('→');
                break;
            case ' ':
            case 'SPACE':
                status_clave = 3; // Detener
                this.updateActiveKey('␣');
                e.preventDefault(); // Evitar scroll de página
                break;
            case 'M':
                // Abrir modal de monitoreo
                const modalBtn = document.getElementById('monitoringBtn');
                if (modalBtn) modalBtn.click();
                break;
            case 'ESCAPE':
                // Mostrar ayuda
                const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
                helpModal.show();
                break;
            case 'F':
                // Demo cuadrado
                if (window.demoManager) window.demoManager.ejecutarCircuitoCuadrado();
                break;
            case 'G':
                // Demo zig-zag
                if (window.demoManager) window.demoManager.ejecutarZigZag();
                break;
            case 'R':
                status_clave = 11; // 360° Izquierda
                this.updateActiveKey('R');
                break;
            case 'T':
                status_clave = 10; // 360° Derecha
                this.updateActiveKey('T');
                break;
        }

        if (status_clave !== null && window.controlManager) {
            window.controlManager.moverCarrito(status_clave);
            e.preventDefault();
        }
    }

    handleKeyUp(e) {
        // Limpiar display después de 500ms
        setTimeout(() => {
            if (this.activeKeyDisplay) {
                const activeKey = this.activeKeyDisplay.querySelector('.active-key');
                if (activeKey && activeKey.textContent !== '-') {
                    this.updateActiveKey('-');
                }
            }
        }, 500);
    }

    updateActiveKey(key) {
        if (this.activeKeyDisplay) {
            const activeKey = this.activeKeyDisplay.querySelector('.active-key');
            if (activeKey) {
                activeKey.textContent = key;
                
                // Efecto visual
                activeKey.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    activeKey.style.transform = 'scale(1)';
                }, 100);
            }
        }
    }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    window.keyboardManager = new KeyboardManager();
    
    // Actualizar el texto de ayuda en el modal
    const updateHelpModal = () => {
        const helpGrid = document.querySelector('.key-help-grid');
        if (helpGrid) {
            helpGrid.innerHTML = `
                <div><kbd>↑</kbd> <span>Arriba</span></div>
                <div><kbd>↓</kbd> <span>Abajo</span></div>
                <div><kbd>←</kbd> <span>Izquierda</span></div>
                <div><kbd>→</kbd> <span>Derecha</span></div>
                <div><kbd>ESPACIO</kbd> <span>Detener</span></div>
                <div><kbd>R</kbd> <span>360° Izquierda</span></div>
                <div><kbd>T</kbd> <span>360° Derecha</span></div>
                <div><kbd>F</kbd> <span>Demo Cuadrado</span></div>
                <div><kbd>G</kbd> <span>Demo Zig-Zag</span></div>
                <div><kbd>M</kbd> <span>Abrir Monitoreo</span></div>
                <div><kbd>ESC</kbd> <span>Ver esta ayuda</span></div>
            `;
        }
    };
    
    // Actualizar cuando se abre el modal
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.addEventListener('show.bs.modal', updateHelpModal);
    }
    
    // Actualizar texto del helper flotante
    const keyboardHelper = document.querySelector('.keyboard-shortcuts');
    if (keyboardHelper) {
        keyboardHelper.innerHTML = `
            <span class="shortcut-key"><i class="fas fa-keyboard"></i> Controles: </span>
            <span class="shortcut-item"><kbd>FLECHAS</kbd> Movimiento</span>
            <span class="shortcut-item"><kbd>ESPACIO</kbd> Detener</span>
            <span class="shortcut-item"><kbd>M</kbd> Monitoreo</span>
            <span class="shortcut-item"><kbd>ESC</kbd> Ayuda</span>
        `;
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyboardController;
}