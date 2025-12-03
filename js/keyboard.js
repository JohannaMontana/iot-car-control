// Clase KeyboardManager - Gestiona controles por teclado para el robot
class KeyboardManager {
    constructor() {
        this.initialize(); // Inicializa inmediatamente al crear instancia
    }

    // Método de inicialización principal
    initialize() {
        // Agrega event listeners para teclas presionadas y liberadas
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Actualizar texto del helper (instrucciones de teclado)
        const keyboardHelper = document.querySelector('.keyboard-shortcuts');
        if (keyboardHelper) {
            // Crea HTML con iconos y etiquetas <kbd> para teclas
            keyboardHelper.innerHTML = `
                <span class="shortcut-key"><i class="fas fa-keyboard"></i> Controles: </span>
                <span class="shortcut-item"><kbd>FLECHAS</kbd> Movimiento</span>
                <span class="shortcut-item"><kbd>ESPACIO</kbd> Detener</span>
                <span class="shortcut-item"><kbd>M</kbd> Monitoreo</span>
                <span class="shortcut-item"><kbd>ESC</kbd> Ayuda</span>
            `;
        }
        
        console.log('⌨️ Keyboard Manager (Flechas) inicializado');
    }

    // Maneja evento cuando se presiona una tecla
    handleKeyDown(e) {
        // No procesar si el foco está en inputs o textareas
        // Esto evita interferir con entrada de texto del usuario
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        let status_clave = null;  // ID del movimiento a ejecutar
        let keyName = '';         // Símbolo para mostrar en UI

        // ==========================================
        // 1. FLECHAS - CONTROLES PRINCIPALES
        // ==========================================
        if (e.key === 'ArrowUp' || e.key === 'Up') {
            status_clave = 1;  // Adelante
            keyName = '↑';
        } else if (e.key === 'ArrowDown' || e.key === 'Down') {
            status_clave = 2;  // Atrás
            keyName = '↓';
        } else if (e.key === 'ArrowLeft' || e.key === 'Left') {
            status_clave = 9;  // Giro Izquierda (90°)
            keyName = '←';
        } else if (e.key === 'ArrowRight' || e.key === 'Right') {
            status_clave = 8;  // Giro Derecha (90°)
            keyName = '→';
        }
        // ==========================================
        // 2. TECLAS ESPECIALES - FUNCIONES ADICIONALES
        // ==========================================
        else if (e.key === ' ' || e.key === 'Spacebar') {
            status_clave = 3;  // Detener (emergencia)
            keyName = '␣';    // Símbolo de espacio
            e.preventDefault(); // Previene scroll de página
        } else if (e.key === 'Escape') {
            // Abre modal de ayuda
            const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
            helpModal.show();
            return; // No necesita status_clave
        } else if (e.key === 'm' || e.key === 'M') {
            // Simula clic en botón de monitoreo
            const modalBtn = document.getElementById('monitoringBtn');
            if (modalBtn) modalBtn.click();
            return;
        } else if (e.key === 'f' || e.key === 'F') {
            // Ejecuta demo predefinida: Circuito Cuadrado
            if (window.demoManager) window.demoManager.ejecutarCircuitoCuadrado();
            return;
        } else if (e.key === 'g' || e.key === 'G') {
            // Ejecuta demo predefinida: Zig-Zag
            if (window.demoManager) window.demoManager.ejecutarZigZag();
            return;
        } else if (e.key === 'r' || e.key === 'R') {
            status_clave = 11; // Giro 360° Izquierda
            keyName = 'R';
        } else if (e.key === 't' || e.key === 'T') {
            status_clave = 10; // Giro 360° Derecha
            keyName = 'T';
        }

        // ==========================================
        // 3. EJECUTAR MOVIMIENTO SI HAY UNO DEFINIDO
        // ==========================================
        if (status_clave !== null && window.controlManager) {
            // Llama al controlManager para enviar comando al backend
            window.controlManager.moverCarrito(status_clave);
            
            // Muestra visualmente qué tecla está activa
            this.updateActiveKey(keyName);
            
            // Previene comportamiento por defecto del navegador
            // (como scroll con flechas)
            e.preventDefault();
        }
    }

    // Maneja evento cuando se libera una tecla
    handleKeyUp(e) {
        // Limpiar display después de 500ms (medio segundo)
        // Esto da tiempo para ver la tecla presionada
        setTimeout(() => {
            this.updateActiveKey('-'); // Guión indica "ninguna tecla activa"
        }, 500);
    }

    // Actualiza la pantalla que muestra la tecla activa
    updateActiveKey(key) {
        const activeKeyDisplay = document.getElementById('activeKeyDisplay');
        if (activeKeyDisplay) {
            // Busca el elemento que muestra la tecla activa
            const activeKey = activeKeyDisplay.querySelector('.active-key');
            if (activeKey) {
                activeKey.textContent = key; // Cambia el texto
            }
        }
    }
}

// Inicializar cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    // Crea una instancia global accesible desde toda la aplicación
    window.keyboardManager = new KeyboardManager();
});