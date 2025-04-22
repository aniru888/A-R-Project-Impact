// main.js - Main entry point for the A&R Project Impact application

// Import configuration and utilities
import config from './config.js';
import { Logger, eventBus } from './utils.js';
import { uiManager } from './domUtils.js';
import { analytics } from './analytics.js';

// Import module initializers
import { setupAfforestationCalculator } from './forest/forestMain.js';
import { initForestDOM } from './forest/forestDOM.js'; // Import directly for explicit initialization
import { setupWaterCalculator } from './water/waterMain.js'; // Enable water module

/**
 * Application main class
 */
class AppMain {
    constructor() {
        this.modules = new Map();
        this.isInitialized = false;
        
        // Register event handlers
        this._registerEvents();
    }
    
    /**
     * Initialize the application
     */
    init() {
        if (this.isInitialized) {
            Logger.warn('Application is already initialized');
            return;
        }
        
        // Initialize configuration
        config.initialize();
        
        Logger.info(`Starting ${config.get('app.name')} v${config.get('app.version')}`);
        
        // Register service worker for offline support
        this._registerServiceWorker();
        
        // Initialize UI components
        uiManager.init();
        
        // Explicitly initialize forest DOM
        this._initializeForestDOM();
        
        // Register available modules
        this._registerModules();
        
        // Initialize all components
        uiManager.initAllComponents();
        
        this.isInitialized = true;
        
        // Emit application ready event
        eventBus.emit('app:ready', { timestamp: Date.now() });
        
        Logger.info('Application initialization complete');
    }
    
    /**
     * Register the service worker for offline support
     * @private
     */
    _registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        Logger.info('Service Worker registered with scope:', registration.scope);
                        
                        // Set up background sync for analytics if supported
                        if ('sync' in registration) {
                            eventBus.on('analytics:offline', () => {
                                registration.sync.register('analytics-sync')
                                    .then(() => Logger.debug('Background sync registered for analytics'))
                                    .catch(err => Logger.error('Background sync registration failed:', err));
                            });
                        }
                        
                        // Update offline status when service worker state changes
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New service worker available
                                    eventBus.emit('app:update-available');
                                    this._showUpdateNotification();
                                }
                            });
                        });
                    })
                    .catch(error => {
                        Logger.error('Service Worker registration failed:', error);
                    });
                
                // Check network status and set up listeners
                this._setupOfflineDetection();
            });
        } else {
            Logger.warn('Service Workers not supported in this browser');
        }
    }
    
    /**
     * Set up offline detection
     * @private
     */
    _setupOfflineDetection() {
        // Initial check
        this._updateOnlineStatus();
        
        // Add event listeners for online/offline
        window.addEventListener('online', this._updateOnlineStatus.bind(this));
        window.addEventListener('offline', this._updateOnlineStatus.bind(this));
    }
    
    /**
     * Update application state based on network status
     * @private
     */
    _updateOnlineStatus() {
        const isOnline = navigator.onLine;
        
        document.body.classList.toggle('is-offline', !isOnline);
        
        if (!isOnline) {
            Logger.info('Application is offline');
            eventBus.emit('app:offline');
            
            // Show offline notification
            uiManager.showNotification({
                type: 'info',
                message: 'You are currently offline. Some features may be limited.',
                duration: 5000
            });
        } else {
            Logger.info('Application is online');
            eventBus.emit('app:online');
        }
    }
    
    /**
     * Show notification when a new version is available
     * @private
     */
    _showUpdateNotification() {
        uiManager.showNotification({
            type: 'info',
            message: 'A new version is available. Refresh to update.',
            duration: 0, // Don't auto-hide
            actions: [
                {
                    label: 'Refresh',
                    callback: () => window.location.reload()
                },
                {
                    label: 'Later',
                    callback: () => {} // Just dismiss
                }
            ]
        });
    }
    
    /**
     * Initialize Forest DOM separately to ensure it's available for forestMain
     * @private
     */
    _initializeForestDOM() {
        try {
            Logger.info('Initializing Forest DOM module directly');
            initForestDOM({ setupEventListeners: false }); // Don't set up event listeners here, let forestMain do it
        } catch (error) {
            Logger.error('Error initializing Forest DOM module:', error);
            console.error('Failed to initialize Forest DOM:', error);
        }
    }
    
    /**
     * Register module initializers
     * @private
     */
    _registerModules() {
        // Register forest calculator if enabled in config
        if (config.get('modules.forest.enabled', true)) {
            this._registerModule('forest', {
                id: 'afforestationCalculator',
                setup: setupAfforestationCalculator,
                config: config.loadModuleConfig('forest')
            });
        }
        
        // Register water calculator if enabled in config
        if (config.get('modules.water.enabled', true)) {
            this._registerModule('water', {
                id: 'waterCalculator',
                setup: setupWaterCalculator,
                config: config.loadModuleConfig('water')
            });
        }
    }
    
    /**
     * Register a single module with the UI manager
     * @param {string} name - Module name
     * @param {Object} module - Module definition
     * @private
     */
    _registerModule(name, module) {
        this.modules.set(name, module);
        
        // Register with UI manager
        uiManager.registerComponent(module.id, () => {
            try {
                Logger.debug(`Setting up module: ${name}`);
                module.setup(module.config);
                eventBus.emit(`module:ready`, { module: name });
            } catch (error) {
                Logger.error(`Error setting up module: ${name}`, error);
                
                // Show error in UI
                const errorDiv = document.getElementById(`errorMessage${name.charAt(0).toUpperCase() + name.slice(1)}`);
                if (errorDiv) {
                    errorDiv.textContent = `Failed to initialize the ${name} calculator. Please refresh the page.`;
                    errorDiv.classList.remove('hidden');
                }
                
                // Emit error event
                eventBus.emit('module:error', { module: name, error });
            }
        });
    }
    
    /**
     * Register global event handlers
     * @private
     */
    _registerEvents() {
        // Example: Handle window errors
        window.addEventListener('error', (event) => {
            Logger.error('Unhandled error:', event.error);
            eventBus.emit('app:error', { error: event.error });
        });
        
        // Handle promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            Logger.error('Unhandled promise rejection:', event.reason);
            eventBus.emit('app:error', { error: event.reason });
        });
    }
}

// Create and export application instance
export const app = new AppMain();

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
