class KeyboardManager {
    constructor() {
        this.initialize();
    }

    initialize() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Actualizar texto del helper
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
        
        console.log('⌨️ Keyboard Manager (Flechas)');
    }

    handleKeyDown(e) {
        // No bloquear inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        let status_clave = null;
        let keyName = '';

        // FLECHAS
        if (e.key === 'ArrowUp' || e.key === 'Up') {
            status_clave = 1; // Adelante
            keyName = '↑';
        } else if (e.key === 'ArrowDown' || e.key === 'Down') {
            status_clave = 2; // Atrás
            keyName = '↓';
        } else if (e.key === 'ArrowLeft' || e.key === 'Left') {
            status_clave = 9; // Giro Izquierda
            keyName = '←';
        } else if (e.key === 'ArrowRight' || e.key === 'Right') {
            status_clave = 8; // Giro Derecha
            keyName = '→';
        }
        // TECLAS ESPECIALES
        else if (e.key === ' ' || e.key === 'Spacebar') {
            status_clave = 3; // Detener
            keyName = '␣';
            e.preventDefault();
        } else if (e.key === 'Escape') {
            const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
            helpModal.show();
        } else if (e.key === 'm' || e.key === 'M') {
            const modalBtn = document.getElementById('monitoringBtn');
            if (modalBtn) modalBtn.click();
        } else if (e.key === 'f' || e.key === 'F') {
            if (window.demoManager) window.demoManager.ejecutarCircuitoCuadrado();
        } else if (e.key === 'g' || e.key === 'G') {
            if (window.demoManager) window.demoManager.ejecutarZigZag();
        } else if (e.key === 'r' || e.key === 'R') {
            status_clave = 11; // 360° Izquierda
            keyName = 'R';
        } else if (e.key === 't' || e.key === 'T') {
            status_clave = 10; // 360° Derecha
            keyName = 'T';
        }

        // Ejecutar movimiento si hay uno
        if (status_clave !== null && window.controlManager) {
            window.controlManager.moverCarrito(status_clave);
            
            // Mostrar tecla activa
            this.updateActiveKey(keyName);
            e.preventDefault();
        }
    }

    handleKeyUp(e) {
        // Limpiar display
        setTimeout(() => {
            this.updateActiveKey('-');
        }, 500);
    }

    updateActiveKey(key) {
        const activeKeyDisplay = document.getElementById('activeKeyDisplay');
        if (activeKeyDisplay) {
            const activeKey = activeKeyDisplay.querySelector('.active-key');
            if (activeKey) {
                activeKey.textContent = key;
            }
        }
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.keyboardManager = new KeyboardManager();
});