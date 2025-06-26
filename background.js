// Conecta-LinkedIn Background Script
class ConnectaLinkedInBackground {
    constructor() {
        this.isRunning = false;
        this.currentConfig = null;
        this.currentTabId = null;
        this.progress = { current: 0, total: 0, currentAction: '' };
        this.stats = { totalSent: 0, todaySent: 0, successRate: 0, lastSession: 0 };
        this.activityLog = [];
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.init();
    }

    init() {
        this.setupMessageListeners();
        this.loadStoredData();
        this.setupDailyReset();
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Indica que a resposta será assíncrona
        });

        // Listener para quando uma aba é fechada
        chrome.tabs.onRemoved.addListener((tabId) => {
            if (tabId === this.currentTabId && this.isRunning) {
                this.stopAutomation('Aba do LinkedIn foi fechada');
            }
        });

        // Listener para mudanças de URL
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (tabId === this.currentTabId && changeInfo.url && this.isRunning) {
                if (!changeInfo.url.includes('linkedin.com')) {
                    this.stopAutomation('Navegou para fora do LinkedIn');
                }
            }
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'startAutomation':
                    await this.startAutomation(message.config, message.tabId);
                    sendResponse({ success: true });
                    break;

                case 'stopAutomation':
                    await this.stopAutomation('Parado pelo usuário');
                    sendResponse({ success: true });
                    break;

                case 'getStatus':
                    sendResponse({
                        isRunning: this.isRunning,
                        progress: this.progress,
                        stats: this.stats
                    });
                    break;

                case 'contentScriptReady':
                    if (this.isRunning && sender.tab.id === this.currentTabId) {
                        await this.sendConfigToContentScript();
                    }
                    sendResponse({ success: true });
                    break;

                case 'updateProgress':
                    this.updateProgress(message.progress);
                    sendResponse({ success: true });
                    break;

                case 'connectionSent':
                    await this.handleConnectionSent(message.data);
                    sendResponse({ success: true });
                    break;

                case 'automationComplete':
                    await this.handleAutomationComplete(message.data);
                    sendResponse({ success: true });
                    break;

                case 'automationError':
                    await this.handleAutomationError(message.error);
                    sendResponse({ success: true });
                    break;

                case 'logActivity':
                    this.logActivity(message.activity);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Ação desconhecida' });
            }
        } catch (error) {
            console.error('Erro no background script:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async startAutomation(config, tabId) {
        if (this.isRunning) {
            throw new Error('Automação já está em execução');
        }

        // Verificar limite diário
        const today = new Date().toDateString();
        const dailyData = await chrome.storage.local.get(['dailyCount', 'lastDate']);
        
        if (dailyData.lastDate === today && dailyData.dailyCount >= config.dailyLimit) {
            throw new Error(`Limite diário de ${config.dailyLimit} conexões atingido`);
        }

        this.isRunning = true;
        this.currentConfig = config;
        this.currentTabId = tabId;
        this.progress = { current: 0, total: config.connectionLimit, currentAction: 'Iniciando...' };
        this.retryCount = 0;

        this.logActivity({
            type: 'start',
            message: `Automação iniciada - Busca: "${config.searchTerm}", Limite: ${config.connectionLimit}`,
            timestamp: new Date().toISOString()
        });

        // Injetar e executar content script
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });

            // Aguardar um pouco para o content script se registrar
            setTimeout(() => {
                this.sendConfigToContentScript();
            }, 1000);

        } catch (error) {
            this.isRunning = false;
            throw new Error(`Erro ao injetar script: ${error.message}`);
        }
    }

    async sendConfigToContentScript() {
        if (!this.isRunning || !this.currentTabId) return;

        try {
            await chrome.tabs.sendMessage(this.currentTabId, {
                action: 'startAutomation',
                config: this.currentConfig
            });
        } catch (error) {
            console.error('Erro ao enviar configuração para content script:', error);
            await this.handleAutomationError(`Erro de comunicação: ${error.message}`);
        }
    }

    async stopAutomation(reason = 'Parado manualmente') {
        if (!this.isRunning) return;

        this.isRunning = false;
        
        if (this.currentTabId) {
            try {
                await chrome.tabs.sendMessage(this.currentTabId, {
                    action: 'stopAutomation'
                });
            } catch (error) {
                // Aba pode ter sido fechada
            }
        }

        this.logActivity({
            type: 'stop',
            message: `Automação parada - ${reason}`,
            timestamp: new Date().toISOString()
        });

        // Notificar popup
        this.notifyPopup('automationComplete', { message: reason });

        this.currentConfig = null;
        this.currentTabId = null;
        this.progress = { current: 0, total: 0, currentAction: '' };
    }

    updateProgress(progressData) {
        this.progress = { ...this.progress, ...progressData };
        
        // Notificar popup
        this.notifyPopup('updateProgress', { progress: this.progress });
    }

    async handleConnectionSent(data) {
        this.progress.current++;
        this.progress.currentAction = `Conexão enviada para ${data.name || 'perfil'}`;
        
        // Atualizar estatísticas
        this.stats.totalSent++;
        this.stats.lastSession++;
        
        // Atualizar contador diário
        const today = new Date().toDateString();
        const dailyData = await chrome.storage.local.get(['dailyCount', 'lastDate']);
        
        let dailyCount = 1;
        if (dailyData.lastDate === today) {
            dailyCount = (dailyData.dailyCount || 0) + 1;
        }
        
        await chrome.storage.local.set({
            dailyCount: dailyCount,
            lastDate: today
        });

        this.stats.todaySent = dailyCount;

        // Salvar estatísticas
        await this.saveStats();

        // Log da atividade
        this.logActivity({
            type: 'connection',
            message: `Conexão enviada para ${data.name || 'perfil'} - ${data.title || ''}`,
            timestamp: new Date().toISOString(),
            data: data
        });

        // Notificar popup
        this.notifyPopup('updateProgress', { progress: this.progress });
        this.notifyPopup('updateStats', { stats: this.stats });

        // Verificar se atingiu o limite
        if (this.progress.current >= this.progress.total) {
            await this.handleAutomationComplete({
                message: `Automação concluída! ${this.progress.current} conexões enviadas.`
            });
        }
    }

    async handleAutomationComplete(data) {
        this.logActivity({
            type: 'complete',
            message: data.message || 'Automação concluída',
            timestamp: new Date().toISOString()
        });

        // Calcular taxa de sucesso da sessão
        const sessionSuccessRate = this.progress.total > 0 ? 
            Math.round((this.progress.current / this.progress.total) * 100) : 0;
        
        this.stats.successRate = sessionSuccessRate;
        await this.saveStats();

        await this.stopAutomation(data.message || 'Automação concluída');
    }

    async handleAutomationError(error) {
        console.error('Erro na automação:', error);
        
        this.retryCount++;
        
        if (this.retryCount <= this.maxRetries) {
            this.logActivity({
                type: 'error',
                message: `Erro (tentativa ${this.retryCount}/${this.maxRetries}): ${error}`,
                timestamp: new Date().toISOString()
            });

            // Tentar novamente após um delay
            setTimeout(() => {
                if (this.isRunning) {
                    this.sendConfigToContentScript();
                }
            }, 5000);
        } else {
            this.logActivity({
                type: 'error',
                message: `Erro fatal após ${this.maxRetries} tentativas: ${error}`,
                timestamp: new Date().toISOString()
            });

            await this.stopAutomation(`Erro: ${error}`);
            this.notifyPopup('automationError', { error: error });
        }
    }

    logActivity(activity) {
        this.activityLog.push(activity);
        
        // Manter apenas os últimos 100 registros
        if (this.activityLog.length > 100) {
            this.activityLog = this.activityLog.slice(-100);
        }

        // Salvar no storage
        chrome.storage.local.set({ activityLog: this.activityLog });

        // Notificar popup se necessário
        this.notifyPopup('addActivity', { activity: activity });
    }

    async notifyPopup(action, data) {
        try {
            await chrome.runtime.sendMessage({ action: action, ...data });
        } catch (error) {
            // Popup pode não estar aberto
        }
    }

    async loadStoredData() {
        try {
            const data = await chrome.storage.local.get(['stats', 'activityLog']);
            
            if (data.stats) {
                this.stats = { ...this.stats, ...data.stats };
            }
            
            if (data.activityLog) {
                this.activityLog = data.activityLog;
            }

            // Resetar contador da sessão
            this.stats.lastSession = 0;
            await this.saveStats();

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }

    async saveStats() {
        try {
            await chrome.storage.local.set({ stats: this.stats });
        } catch (error) {
            console.error('Erro ao salvar estatísticas:', error);
        }
    }

    setupDailyReset() {
        // Verificar se é um novo dia e resetar contador diário
        const checkDailyReset = async () => {
            const today = new Date().toDateString();
            const data = await chrome.storage.local.get(['lastDate', 'dailyCount']);
            
            if (data.lastDate && data.lastDate !== today) {
                // Novo dia, resetar contador
                await chrome.storage.local.set({
                    dailyCount: 0,
                    lastDate: today
                });
                
                this.stats.todaySent = 0;
                await this.saveStats();
            }
        };

        // Verificar a cada hora
        setInterval(checkDailyReset, 60 * 60 * 1000);
        
        // Verificar imediatamente
        checkDailyReset();
    }
}

// Inicializar o background script
const backgroundInstance = new ConnectaLinkedInBackground();

// Manter o service worker ativo
chrome.runtime.onStartup.addListener(() => {
    console.log('Conecta-LinkedIn iniciado');
});

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Conecta-LinkedIn instalado');
        
        // Configurações padrão
        chrome.storage.local.set({
            connectionMessage: 'Olá [NOME], gostaria de me conectar com você para expandir minha rede profissional.',
            connectionLimit: 10,
            timingStrategy: 'moderate',
            dailyLimit: 30,
            enableLogging: true,
            smartPauses: true,
            avoidDuplicates: true
        });
    } else if (details.reason === 'update') {
        console.log('Conecta-LinkedIn atualizado');
    }
});

