// Conecta-LinkedIn Popup Script
class ConnectaLinkedInPopup {
    constructor() {
        this.isRunning = false;
        this.currentStats = {
            totalSent: 0,
            todaySent: 0,
            successRate: 0,
            lastSession: 0
        };
        
        this.init();
    }

    async init() {
        await this.loadStoredData();
        this.setupEventListeners();
        this.setupTabs();
        this.updateUI();
        this.updateStats();
        this.checkStatus();
    }

    setupEventListeners() {
        // Botões principais
        document.getElementById('startBtn').addEventListener('click', () => this.startAutomation());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopAutomation());
        
        // Botões de configuração
        document.getElementById('resetBtn').addEventListener('click', () => this.resetSettings());
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearData());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        
        // Preview da mensagem
        document.getElementById('connectionMessage').addEventListener('input', () => this.updateMessagePreview());
        
        // Validação de campos
        document.getElementById('connectionLimit').addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value > 50) {
                e.target.value = 50;
                this.showNotification('Limite máximo de 50 conexões por sessão', 'warning');
            }
        });

        document.getElementById('dailyLimit').addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value > 100) {
                e.target.value = 100;
                this.showNotification('Limite máximo de 100 conexões por dia', 'warning');
            }
        });

        // Auto-save das configurações
        const inputs = ['searchTerm', 'connectionMessage', 'connectionLimit', 'timingStrategy', 'dailyLimit'];
        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.saveSettings());
            }
        });

        const checkboxes = ['testMode', 'enableLogging', 'smartPauses', 'avoidDuplicates'];
        checkboxes.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.saveSettings());
            }
        });
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // Remove active class from all tabs
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab
                button.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
            });
        });
    }

    async loadStoredData() {
        try {
            const data = await chrome.storage.local.get([
                'searchTerm', 'connectionMessage', 'connectionLimit', 'timingStrategy',
                'dailyLimit', 'testMode', 'enableLogging', 'smartPauses', 'avoidDuplicates',
                'customSelectors', 'stats', 'activityLog'
            ]);

            // Carregar configurações
            if (data.searchTerm) document.getElementById('searchTerm').value = data.searchTerm;
            if (data.connectionMessage) document.getElementById('connectionMessage').value = data.connectionMessage;
            if (data.connectionLimit) document.getElementById('connectionLimit').value = data.connectionLimit;
            if (data.timingStrategy) document.getElementById('timingStrategy').value = data.timingStrategy;
            if (data.dailyLimit) document.getElementById('dailyLimit').value = data.dailyLimit;
            if (data.customSelectors) document.getElementById('customSelectors').value = data.customSelectors;

            // Carregar checkboxes
            document.getElementById('testMode').checked = data.testMode || false;
            document.getElementById('enableLogging').checked = data.enableLogging !== false;
            document.getElementById('smartPauses').checked = data.smartPauses !== false;
            document.getElementById('avoidDuplicates').checked = data.avoidDuplicates !== false;

            // Carregar estatísticas
            if (data.stats) {
                this.currentStats = { ...this.currentStats, ...data.stats };
            }

            // Carregar log de atividades
            if (data.activityLog) {
                this.updateActivityLog(data.activityLog);
            }

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }

    async saveSettings() {
        try {
            const settings = {
                searchTerm: document.getElementById('searchTerm').value,
                connectionMessage: document.getElementById('connectionMessage').value,
                connectionLimit: parseInt(document.getElementById('connectionLimit').value),
                timingStrategy: document.getElementById('timingStrategy').value,
                dailyLimit: parseInt(document.getElementById('dailyLimit').value),
                testMode: document.getElementById('testMode').checked,
                enableLogging: document.getElementById('enableLogging').checked,
                smartPauses: document.getElementById('smartPauses').checked,
                avoidDuplicates: document.getElementById('avoidDuplicates').checked,
                customSelectors: document.getElementById('customSelectors').value
            };

            await chrome.storage.local.set(settings);
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
        }
    }

    updateMessagePreview() {
        const message = document.getElementById('connectionMessage').value;
        const preview = document.getElementById('messagePreview');
        
        if (message.includes('[NOME]')) {
            const previewText = message.replace('[NOME]', 'João Silva');
            preview.textContent = `Preview: ${previewText}`;
            preview.classList.add('show');
        } else {
            preview.classList.remove('show');
        }
    }

    async startAutomation() {
        if (!this.validateInputs()) return;

        try {
            // Verificar se estamos na página do LinkedIn
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('linkedin.com')) {
                this.showNotification('Por favor, navegue para o LinkedIn primeiro', 'error');
                return;
            }

            // Verificar limite diário
            const today = new Date().toDateString();
            const dailyData = await chrome.storage.local.get(['dailyCount', 'lastDate']);
            const dailyLimit = parseInt(document.getElementById('dailyLimit').value);
            
            if (dailyData.lastDate === today && dailyData.dailyCount >= dailyLimit) {
                this.showNotification(`Limite diário de ${dailyLimit} conexões atingido`, 'warning');
                return;
            }

            this.isRunning = true;
            this.updateUI();

            const config = await this.getConfiguration();
            
            // Enviar configuração para o background script
            await chrome.runtime.sendMessage({
                action: 'startAutomation',
                config: config,
                tabId: tab.id
            });

            this.showNotification('Automação iniciada com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao iniciar automação:', error);
            this.showNotification('Erro ao iniciar automação', 'error');
            this.isRunning = false;
            this.updateUI();
        }
    }

    async stopAutomation() {
        try {
            await chrome.runtime.sendMessage({ action: 'stopAutomation' });
            this.isRunning = false;
            this.updateUI();
            this.showNotification('Automação interrompida', 'info');
        } catch (error) {
            console.error('Erro ao parar automação:', error);
        }
    }

    validateInputs() {
        const searchTerm = document.getElementById('searchTerm').value.trim();
        const connectionMessage = document.getElementById('connectionMessage').value.trim();
        const connectionLimit = parseInt(document.getElementById('connectionLimit').value);

        if (!searchTerm) {
            this.showNotification('Por favor, insira um cargo/função para buscar', 'error');
            return false;
        }

        if (!connectionMessage) {
            this.showNotification('Por favor, insira uma mensagem de conexão', 'error');
            return false;
        }

        if (connectionLimit < 1 || connectionLimit > 50) {
            this.showNotification('Limite de conexões deve ser entre 1 e 50', 'error');
            return false;
        }

        return true;
    }

    async getConfiguration() {
        return {
            searchTerm: document.getElementById('searchTerm').value.trim(),
            connectionMessage: document.getElementById('connectionMessage').value.trim(),
            connectionLimit: parseInt(document.getElementById('connectionLimit').value),
            timingStrategy: document.getElementById('timingStrategy').value,
            testMode: document.getElementById('testMode').checked,
            enableLogging: document.getElementById('enableLogging').checked,
            smartPauses: document.getElementById('smartPauses').checked,
            avoidDuplicates: document.getElementById('avoidDuplicates').checked,
            customSelectors: this.parseCustomSelectors()
        };
    }

    parseCustomSelectors() {
        try {
            const customSelectorsText = document.getElementById('customSelectors').value.trim();
            return customSelectorsText ? JSON.parse(customSelectorsText) : {};
        } catch (error) {
            console.warn('Seletores personalizados inválidos:', error);
            return {};
        }
    }

    updateUI() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusDot = statusIndicator.querySelector('.status-dot');
        const statusText = statusIndicator.querySelector('.status-text');
        const progressSection = document.getElementById('progressSection');

        if (this.isRunning) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'flex';
            statusDot.classList.add('active');
            statusText.textContent = 'Ativo';
            progressSection.style.display = 'block';
        } else {
            startBtn.style.display = 'flex';
            stopBtn.style.display = 'none';
            statusDot.classList.remove('active');
            statusText.textContent = 'Inativo';
            progressSection.style.display = 'none';
        }
    }

    async checkStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            if (response && response.isRunning !== undefined) {
                this.isRunning = response.isRunning;
                this.updateUI();
                
                if (response.progress) {
                    this.updateProgress(response.progress);
                }
            }
        } catch (error) {
            // Background script pode não estar disponível ainda
        }
    }

    updateProgress(progress) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const currentAction = document.getElementById('currentAction');

        const percentage = (progress.current / progress.total) * 100;
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${progress.current} de ${progress.total} conexões enviadas`;
        
        if (progress.currentAction) {
            currentAction.textContent = progress.currentAction;
        }
    }

    updateStats() {
        document.getElementById('totalSent').textContent = this.currentStats.totalSent;
        document.getElementById('todaySent').textContent = this.currentStats.todaySent;
        document.getElementById('successRate').textContent = `${this.currentStats.successRate}%`;
        document.getElementById('lastSession').textContent = this.currentStats.lastSession;
    }

    updateActivityLog(activities) {
        const activityList = document.getElementById('activityList');
        activityList.innerHTML = '';

        if (!activities || activities.length === 0) {
            activityList.innerHTML = '<div class="activity-item"><span class="activity-time">Nenhuma atividade ainda</span></div>';
            return;
        }

        activities.slice(-10).reverse().forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <span class="activity-time">${new Date(activity.timestamp).toLocaleString()}</span>
                <div>${activity.message}</div>
            `;
            activityList.appendChild(item);
        });
    }

    async resetSettings() {
        if (confirm('Tem certeza que deseja resetar todas as configurações?')) {
            await chrome.storage.local.clear();
            location.reload();
        }
    }

    async clearData() {
        if (confirm('Tem certeza que deseja limpar todos os dados e estatísticas?')) {
            await chrome.storage.local.remove(['stats', 'activityLog', 'dailyCount', 'lastDate']);
            this.currentStats = { totalSent: 0, todaySent: 0, successRate: 0, lastSession: 0 };
            this.updateStats();
            this.updateActivityLog([]);
            this.showNotification('Dados limpos com sucesso', 'success');
        }
    }

    async exportData() {
        try {
            const data = await chrome.storage.local.get(['stats', 'activityLog']);
            const exportData = {
                stats: data.stats || this.currentStats,
                activityLog: data.activityLog || [],
                exportDate: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `conecta-linkedin-dados-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.showNotification('Dados exportados com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao exportar dados:', error);
            this.showNotification('Erro ao exportar dados', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Estilos inline para a notificação
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 16px',
            borderRadius: '6px',
            color: 'white',
            fontWeight: '500',
            fontSize: '14px',
            zIndex: '10000',
            maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });

        // Cores baseadas no tipo
        const colors = {
            success: '#2ed573',
            error: '#ff4757',
            warning: '#ffa502',
            info: '#3742fa'
        };
        notification.style.background = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Animação de entrada
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remover após 3 segundos
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Escutar mensagens do background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateProgress') {
        if (window.popupInstance) {
            window.popupInstance.updateProgress(message.progress);
        }
    } else if (message.action === 'updateStats') {
        if (window.popupInstance) {
            window.popupInstance.currentStats = { ...window.popupInstance.currentStats, ...message.stats };
            window.popupInstance.updateStats();
        }
    } else if (message.action === 'addActivity') {
        if (window.popupInstance) {
            // Atualizar log de atividades
        }
    } else if (message.action === 'automationComplete') {
        if (window.popupInstance) {
            window.popupInstance.isRunning = false;
            window.popupInstance.updateUI();
            window.popupInstance.showNotification(message.message || 'Automação concluída', 'success');
        }
    } else if (message.action === 'automationError') {
        if (window.popupInstance) {
            window.popupInstance.isRunning = false;
            window.popupInstance.updateUI();
            window.popupInstance.showNotification(message.error || 'Erro na automação', 'error');
        }
    }
});

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.popupInstance = new ConnectaLinkedInPopup();
});

