/**
 * Keyboard Controller for IoT Car Control
 * Manages keyboard shortcuts and visual feedback
 */

class KeyboardController {
    constructor() {
        this.activeKeys = new Set();
        this.helpVisible = false;
        this.keyMap = {
            // Movement keys
            'w': { action: () => this.triggerButton(1), element: '.btn-up' },
            's': { action: () => this.triggerButton(2), element: '.btn-down' },
            'a': { action: () => this.triggerButton(9), element: '.btn-left' },
            'd': { action: () => this.triggerButton(8), element: '.btn-right' },
            'q': { action: () => this.triggerButton(5), element: '.btn-up-left' },
            'e': { action: () => this.triggerButton(4), element: '.btn-up-right' },
            'z': { action: () => this.triggerButton(7), element: '.btn-down-left' },
            'c': { action: () => this.triggerButton(6), element: '.btn-down-right' },
            
            // Special actions
            ' ': { action: () => this.triggerButton('stop'), element: '.btn-center' },
            'r': { action: () => this.triggerButton(11), element: '.btn-up-left' },
            't': { action: () => this.triggerButton(10), element: '.btn-up-right' },
            
            // Speed control
            '1': { action: () => this.setSpeed(1), element: '#velBaja' },
            '2': { action: () => this.setSpeed(2), element: '#velMedia' },
            '3': { action: () => this.setSpeed(3), element: '#velAlta' },
            
            // Demo sequences
            'f': { action: () => this.triggerDemo('square'), element: '[onclick*="ejecutarCircuitoCuadrado"]' },
            'g': { action: () => this.triggerDemo('zigzag'), element: '[onclick*="ejecutarZigZag"]' },

            // En la sección de keyMap, agrega:
            'm': { action: () => this.openMonitoringModal(), element: '#monitoringBtn' },

            // Y agrega este método:
            openMonitoringModal() {
                const modal = document.getElementById('monitoringModal');
                if (modal) {
                    const bsModal = new bootstrap.Modal(modal);
                    bsModal.show();

                    // Mostrar notificación
                    this.showNotification('Monitoreo', 'Modal de monitoreo abierto');
                }
            },
            
            // Help
            'escape': { action: () => this.toggleHelp() }
        };

        this.init();
    }

    init() {
        // Add event listeners
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Initialize UI
        this.initializeUI();
        
        // Show keyboard helper on first visit
        this.showWelcomeMessage();
    }

    initializeUI() {
        // Create active key display if it doesn't exist
        if (!document.getElementById('activeKeyDisplay')) {
            const display = document.createElement('div');
            display.id = 'activeKeyDisplay';
            display.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 10px;
                border-radius: 10px;
                z-index: 1000;
                text-align: center;
                border: 1px solid var(--accent-cyan);
                box-shadow: 0 0 20px rgba(0,255,255,0.3);
            `;
            display.innerHTML = `
                <div class="active-key">-</div>
                <small class="text-muted">Press any control key</small>
            `;
            document.body.appendChild(display);
        }

        // Initialize keyboard helper
        const helper = document.querySelector('.keyboard-helper');
        if (helper) {
            helper.style.display = 'none';
        }
    }

    handleKeyDown(e) {
        const key = e.key.toLowerCase();
        const keyConfig = this.keyMap[key] || this.keyMap[e.code.toLowerCase()];

        // Prevent default for control keys
        if (keyConfig && !['escape', 'f5', 'tab'].includes(key)) {
            e.preventDefault();
        }

        // Add to active keys
        this.activeKeys.add(key);
        
        // Update active key display
        this.updateActiveKeyDisplay(key.toUpperCase());

        // Execute action
        if (keyConfig) {
            keyConfig.action();
            
            // Visual feedback
            if (keyConfig.element) {
                this.highlightElement(keyConfig.element, key);
            }
        }

        // Update UI
        this.updateActiveKeysUI();
    }

    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        this.activeKeys.delete(key);
        
        // Remove visual feedback
        this.removeHighlight(key);
        
        // Update UI
        this.updateActiveKeysUI();
    }

    triggerButton(movementId) {
        if (movementId === 'stop') {
            if (window.controlManager && window.controlManager.detenerCarrito) {
                window.controlManager.detenerCarrito();
            }
        } else if (window.controlManager && window.controlManager.moverCarrito) {
            window.controlManager.moverCarrito(movementId);
        }
        
        // Show key press animation
        this.showKeyPressAnimation(movementId);
    }

    setSpeed(level) {
        const speedMap = {
            1: '#velBaja',
            2: '#velMedia',
            3: '#velAlta'
        };
        
        const selector = speedMap[level];
        if (selector) {
            const element = document.querySelector(selector);
            if (element) {
                element.click();
                this.showSpeedChangeAnimation(level);
            }
        }
    }

    triggerDemo(type) {
        if (type === 'square' && window.demoManager && window.demoManager.ejecutarCircuitoCuadrado) {
            window.demoManager.ejecutarCircuitoCuadrado();
        } else if (type === 'zigzag' && window.demoManager && window.demoManager.ejecutarZigZag) {
            window.demoManager.ejecutarZigZag();
        }
    }

    toggleHelp() {
        const helper = document.querySelector('.keyboard-helper');
        const modal = document.getElementById('helpModal');
        
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.toggle();
        } else if (helper) {
            this.helpVisible = !this.helpVisible;
            helper.style.display = this.helpVisible ? 'block' : 'none';
            
            if (this.helpVisible) {
                helper.classList.add('animate__fadeInDown');
                helper.classList.remove('animate__fadeOutUp');
            } else {
                helper.classList.add('animate__fadeOutUp');
                helper.classList.remove('animate__fadeInDown');
            }
        }
    }

    highlightElement(selector, key) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            element.classList.add('key-active');
            element.classList.add('animate__pulse');
            
            // Add key indicator
            const keyIndicator = document.createElement('div');
            keyIndicator.className = 'key-indicator';
            keyIndicator.textContent = key.toUpperCase();
            keyIndicator.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: var(--accent-cyan);
                color: black;
                font-size: 0.7rem;
                font-weight: bold;
                padding: 2px 5px;
                border-radius: 4px;
                z-index: 10;
            `;
            element.style.position = 'relative';
            element.appendChild(keyIndicator);
        });
    }

    removeHighlight(key) {
        const keyConfig = this.keyMap[key];
        if (keyConfig && keyConfig.element) {
            const elements = document.querySelectorAll(keyConfig.element);
            elements.forEach(element => {
                element.classList.remove('key-active');
                element.classList.remove('animate__pulse');
                
                // Remove key indicator
                const indicator = element.querySelector('.key-indicator');
                if (indicator) {
                    indicator.remove();
                }
            });
        }
    }

    updateActiveKeyDisplay(key) {
        const display = document.querySelector('.active-key') || document.getElementById('activeKeyDisplay')?.querySelector('.active-key');
        if (display) {
            display.textContent = key;
            display.classList.add('animate__animated', 'animate__bounce');
            
            setTimeout(() => {
                display.classList.remove('animate__animated', 'animate__bounce');
            }, 300);
        }
    }

    updateActiveKeysUI() {
        const display = document.getElementById('teclasActivas');
        if (display) {
            if (this.activeKeys.size > 0) {
                const keys = Array.from(this.activeKeys).map(k => k.toUpperCase()).join(' + ');
                display.textContent = keys;
                display.classList.add('bg-success');
            } else {
                display.textContent = 'ESC para ayuda';
                display.classList.remove('bg-success');
            }
        }
    }

    showKeyPressAnimation(movementId) {
        const movementNames = {
            1: 'ARRIBA', 2: 'ABAJO', 3: 'DETENER',
            4: 'ARRIBA-DER', 5: 'ARRIBA-IZQ', 6: 'ABAJO-DER',
            7: 'ABAJO-IZQ', 8: 'DERECHA', 9: 'IZQUIERDA',
            10: '360° DER', 11: '360° IZQ'
        };
        
        const name = movementNames[movementId] || 'MOVIMIENTO';
        
        // Create floating notification
        const notification = document.createElement('div');
        notification.className = 'key-notification';
        notification.textContent = name;
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: var(--accent-cyan);
            padding: 20px 40px;
            border-radius: 15px;
            font-size: 1.5rem;
            font-weight: bold;
            z-index: 10000;
            opacity: 0;
            pointer-events: none;
            border: 2px solid var(--accent-cyan);
            box-shadow: 0 0 30px rgba(0,255,255,0.5);
        `;
        
        document.body.appendChild(notification);
        
        // Animate
        notification.animate([
            { opacity: 0, transform: 'translate(-50%, -50%) scale(0.5)' },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1.2)' },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
            { opacity: 0, transform: 'translate(-50%, -50%) scale(0.5)' }
        ], {
            duration: 1000,
            easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        });
        
        // Remove after animation
        setTimeout(() => notification.remove(), 1000);
    }

    showSpeedChangeAnimation(level) {
        const speedNames = {
            1: 'LENTA',
            2: 'MEDIA', 
            3: 'TURBO'
        };
        
        const name = speedNames[level] || 'VELOCIDAD';
        const colors = {
            1: '#28a745',
            2: '#ffc107',
            3: '#dc3545'
        };
        
        // Create speed change notification
        const notification = document.createElement('div');
        notification.className = 'speed-notification';
        notification.innerHTML = `
            <i class="fas fa-tachometer-alt"></i>
            <div>${name}</div>
        `;
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            color: ${colors[level] || 'white'};
            padding: 15px;
            border-radius: 10px;
            font-size: 1.2rem;
            font-weight: bold;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 10px;
            border: 2px solid ${colors[level] || 'white'};
            box-shadow: 0 0 20px ${colors[level] || 'white'}40;
        `;
        
        document.body.appendChild(notification);
        
        // Animate
        notification.animate([
            { transform: 'translateX(100px)', opacity: 0 },
            { transform: 'translateX(0)', opacity: 1 },
            { transform: 'translateX(0)', opacity: 1 },
            { transform: 'translateX(100px)', opacity: 0 }
        ], {
            duration: 2000,
            easing: 'ease-in-out'
        });
        
        // Remove after animation
        setTimeout(() => notification.remove(), 2000);
    }

    showWelcomeMessage() {
        // Only show on first visit to control page
        if (!sessionStorage.getItem('keyboardHelpShown')) {
            setTimeout(() => {
                this.toggleHelp();
                sessionStorage.setItem('keyboardHelpShown', 'true');
            }, 1000);
        }
    }

    // Public method to show help programmatically
    showHelp() {
        this.toggleHelp();
    }

    // Public method to get active keys
    getActiveKeys() {
        return Array.from(this.activeKeys);
    }
}

// Initialize keyboard controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.keyboardController = new KeyboardController();
    
    // Add help button if not exists
    if (!document.querySelector('.keyboard-help-btn')) {
        const helpBtn = document.createElement('button');
        helpBtn.className = 'keyboard-help-btn btn btn-info btn-sm position-fixed';
        helpBtn.style.cssText = `
            bottom: 20px;
            left: 20px;
            z-index: 1000;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        `;
        helpBtn.innerHTML = '<i class="fas fa-keyboard"></i>';
        helpBtn.title = 'Mostrar controles de teclado';
        helpBtn.onclick = () => keyboardController.showHelp();
        
        document.body.appendChild(helpBtn);
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyboardController;
}