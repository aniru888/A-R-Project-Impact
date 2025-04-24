// main.js - Main entry point for the A&R Project Impact application

// Import configuration and utilities
import config from '/workspaces/A-R-Project-Impact/config.js';
import { Logger, eventBus } from '/workspaces/A-R-Project-Impact/utils.js';
import { uiManager } from '/workspaces/A-R-Project-Impact/domUtils.js';
import { analytics } from '/workspaces/A-R-Project-Impact/analytics.js';

// Import module initializers
import { setupAfforestationCalculator } from '/workspaces/A-R-Project-Impact/forest/forestMain.js';
import { setupWaterCalculator } from '/workspaces/A-R-Project-Impact/water/waterMain.js'; // Enable water module

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
     * Register module initializers
     * @private
     */
    _registerModules() {
        // Register forest calculator if enabled in config
        if (config.get('modules.forest.enabled', true)) {
            // Explicitly initialize the forest event system first
            import('/workspaces/A-R-Project-Impact/forest/forestCalcs.js').then(({ forestEventSystem }) => {
                Logger.info('Ensuring forest event system is initialized');
                if (!forestEventSystem.initialized) {
                    Logger.info('Explicitly initializing forest event system');
                    forestEventSystem.init();
                }
            }).catch(err => Logger.error('Failed to initialize forest event system:', err));
            
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
     * Register a module with the application
     * @param {string} name - Module name
     * @param {Object} moduleInfo - Module information and initializer
     * @private
     */
    _registerModule(name, moduleInfo) {
        try {
            Logger.info(`Registering module: ${name}`);
            
            // Store module info
            this.modules.set(name, moduleInfo);
            
            // Register with UI Manager as a component
            uiManager.registerComponent(moduleInfo.id, {
                init: (options) => {
                    try {
                        Logger.debug(`Initializing module: ${name}`);
                        if (typeof moduleInfo.setup === 'function') {
                            // Initialize the module and get the instance
                            const moduleInstance = moduleInfo.setup({
                                ...options,
                                config: moduleInfo.config
                            });
                            
                            // Store the instance for cleanup later
                            if (moduleInstance) {
                                const module = this.modules.get(name);
                                if (module) {
                                    module.instance = moduleInstance;
                                }
                            }
                            
                            // Track module initialization
                            analytics.trackEvent('module_initialized', {
                                module: name,
                                timestamp: Date.now()
                            });
                            
                            eventBus.emit('module:initialized', { moduleId: name });
                            
                            return moduleInstance;
                        }
                    } catch (error) {
                        Logger.error(`Failed to initialize module: ${name}`, error);
                        console.error(`Failed to initialize module: ${name}`, error);
                        eventBus.emit('module:error', { moduleId: name, error });
                    }
                },
                destroy: () => {
                    // Get the module instance
                    const module = this.modules.get(name);
                    
                    if (module) {
                        // Check if the instance has a cleanup method
                        if (module.instance && typeof module.instance.cleanup === 'function') {
                            Logger.debug(`Cleaning up module: ${name}`);
                            module.instance.cleanup();
                        }
                        
                        // Track module cleanup
                        analytics.trackEvent('module_destroyed', {
                            module: name,
                            timestamp: Date.now()
                        });
                    }
                }
            });
            
            // Track module registration
            analytics.trackEvent('module_registered', {
                module: name,
                timestamp: Date.now()
            });
        } catch (error) {
            Logger.error(`Failed to register module: ${name}`, error);
        }
    }
    
    /**
     * Register global event handlers
     * @private
     */
    _registerEvents() {
        // Listen for module events
        eventBus.on('module:initialized', (data) => {
            Logger.debug(`Module initialized: ${data.moduleId}`);
        });
        
        eventBus.on('module:error', (data) => {
            Logger.error(`Module error: ${data.moduleId}`, data.error);
        });
    }
}

// Create and export application instance
export const app = new AppMain();

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
