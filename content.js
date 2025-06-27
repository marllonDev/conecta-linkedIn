// Conecta-LinkedIn Content Script - Versão Corrigida
(function() {
    'use strict';
    
    // Verificar se já foi inicializado
    if (window.conectaLinkedInInitialized) {
        console.log('[ConnectaLinkedIn] Já inicializado, ignorando...');
        return;
    }
    
    window.conectaLinkedInInitialized = true;

    class ConnectaLinkedInContent {
        constructor() {
            this.isRunning = false;
            this.config = null;
            this.currentIndex = 0;
            this.processedProfiles = new Set();
            this.searchResults = [];
            this.retryCount = 0;
            this.maxRetries = 3;
            
            // Seletores CSS baseados na inspeção real da página
            this.selectors = {
                // Seletores principais (baseados na inspeção)
                searchResults: "div[data-chameleon-result-urn]",
                profileName: "a[href*=\"/in/\"] span[aria-hidden=\"true\"]",
                profileTitle: ".t-14.t-black--light.t-normal",
                connectButton: "button[aria-label*=\"Invite\"][aria-label*=\"to connect\"]",
                sendButton: "button[aria-label*=\"Send\"], button[data-control-name*=\"send\"]",
                noteTextarea: "textarea[name=\"message\"], textarea[aria-label*=\"message\"]",
                searchBox: "input[placeholder*=\"Search\"]",
                searchButton: "button[type=\"submit\"]",
                peopleFilter: "button:contains(\"People\")",
                dismissButton: "button[aria-label*=\"Dismiss\"]",
                nextButton: "button[aria-label*=\"Next\"]",
                profileLink: "a[href*=\"/in/\"]",
                
                // Seletores alternativos para fallback
                alternativeSearchResults: [
                    "div[data-chameleon-result-urn]",
                    "li.GnKqjMvvMlITuGwjOvqTOMlFIUdVzAbE",
                    ".search-results-container ul li",
                    "ul[role=\"list\"] li"
                ],
                alternativeProfileName: [
                    "a[href*=\"/in/\"] span[aria-hidden=\"true\"]",
                    "span[dir=\"ltr\"] span[aria-hidden=\"true\"]",
                    "a[href*=\"/in/\"]"
                ],
                alternativeConnectButton: [
                    "button[aria-label*=\"Invite\"][aria-label*=\"to connect\"]",
                    "button:contains(\"Connect\")",
                    "button[aria-label*=\"Connect\"]",
                    "button[data-control-name*=\"connect\"]"
                ]
            };

            this.timingStrategies = {
                conservative: { min: 3000, max: 8000 },
                moderate: { min: 2000, max: 5000 },
                aggressive: { min: 1000, max: 3000 }
            };

            this.init();
        }

        init() {
            console.log('[ConnectaLinkedIn] Inicializando content script...');
            this.setupMessageListeners();
            this.loadProcessedProfiles();
            
            // Notificar que o content script está pronto
            try {
                chrome.runtime.sendMessage({ action: 'contentScriptReady' });
            } catch (error) {
                console.warn('[ConnectaLinkedIn] Erro ao enviar mensagem de inicialização:', error);
            }
        }

        setupMessageListeners() {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleMessage(message, sender, sendResponse);
                return true; // Manter o canal aberto para resposta assíncrona
            });
        }

        async handleMessage(message, sender, sendResponse) {
            try {
                console.log('[ConnectaLinkedIn] Mensagem recebida:', message.action);
                
                switch (message.action) {
                    case 'startAutomation':
                        await this.startAutomation(message.config);
                        sendResponse({ success: true });
                        break;

                    case 'stopAutomation':
                        this.stopAutomation();
                        sendResponse({ success: true });
                        break;

                    default:
                        sendResponse({ success: false, error: 'Ação desconhecida' });
                }
            } catch (error) {
                console.error('[ConnectaLinkedIn] Erro no content script:', error);
                sendResponse({ success: false, error: error.message });
            }
        }

        async startAutomation(config) {
            if (this.isRunning) {
                throw new Error('Automação já está em execução');
            }

            this.isRunning = true;
            this.config = config;
            this.currentIndex = 0;
            this.retryCount = 0;

            // Mesclar seletores personalizados se fornecidos
            if (config.customSelectors) {
                this.selectors = { ...this.selectors, ...config.customSelectors };
            }

            this.logActivity('Iniciando automação...');

            try {
                // Verificar se estamos na página correta
                if (!this.isLinkedInPage()) {
                    throw new Error('Não está na página do LinkedIn');
                }

                // Iniciar o processo de busca
                await this.performSearch();

            } catch (error) {
                this.handleError(error);
            }
        }

        stopAutomation() {
            this.isRunning = false;
            this.config = null;
            this.logActivity('Automação interrompida');
        }

        isLinkedInPage() {
            return window.location.hostname.includes('linkedin.com');
        }

        async performSearch() {
            this.logActivity(`Buscando por: "${this.config.searchTerm}"`);
            
            try {
                // Navegar para a página de busca se não estivermos lá
                if (!window.location.pathname.includes('/search/')) {
                    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(this.config.searchTerm)}`;
                    window.location.href = searchUrl;
                    return;
                }

                // Aguardar a página carregar
                await this.waitForPageLoad();

                // Coletar resultados da busca
                await this.collectSearchResults();

                // Iniciar processamento dos perfis
                await this.processProfiles();

            } catch (error) {
                throw new Error(`Erro na busca: ${error.message}`);
            }
        }

        async waitForPageLoad() {
            // Aguardar elementos principais estarem disponíveis
            const maxWait = 10000;
            const startTime = Date.now();
            
            while (Date.now() - startTime < maxWait) {
                // Tentar encontrar resultados com qualquer um dos seletores
                for (const selector of this.selectors.alternativeSearchResults) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        console.log(`[ConnectaLinkedIn] Encontrados ${elements.length} elementos com seletor: ${selector}`);
                        this.selectors.searchResults = selector; // Atualizar seletor principal
                        return;
                    }
                }
                
                await this.delay(500);
            }
            
            throw new Error('Página não carregou completamente ou não há resultados');
        }

        async collectSearchResults() {
            this.searchResults = [];
            
            console.log(`[ConnectaLinkedIn] Coletando resultados com seletor: ${this.selectors.searchResults}`);
            const resultElements = document.querySelectorAll(this.selectors.searchResults);
            console.log(`[ConnectaLinkedIn] Elementos encontrados: ${resultElements.length}`);
            
            if (resultElements.length === 0) {
                throw new Error('Nenhum resultado de busca encontrado na página');
            }
            
            for (const element of resultElements) {
                try {
                    const profileData = this.extractProfileData(element);
                    if (profileData && this.shouldProcessProfile(profileData)) {
                        this.searchResults.push(profileData);
                        console.log(`[ConnectaLinkedIn] Perfil adicionado: ${profileData.name}`);
                    }
                } catch (error) {
                    console.warn('[ConnectaLinkedIn] Erro ao extrair dados do perfil:', error);
                }
            }

            this.logActivity(`Encontrados ${this.searchResults.length} perfis para processar`);
            
            if (this.searchResults.length === 0) {
                throw new Error('Nenhum perfil encontrado para conectar');
            }
        }

        extractProfileData(element) {
            try {
                console.log('[ConnectaLinkedIn] Extraindo dados do elemento:', element);
                
                // Procurar nome do perfil com seletores alternativos
                let nameElement = null;
                let name = '';
                
                for (const selector of this.selectors.alternativeProfileName) {
                    nameElement = element.querySelector(selector);
                    if (nameElement) {
                        name = nameElement.textContent.trim();
                        // Filtrar nomes válidos (não deve ser "Status is offline" etc.)
                        if (name && !name.includes('Status is') && !name.includes('View') && name.length > 2) {
                            console.log(`[ConnectaLinkedIn] Nome encontrado com ${selector}: "${name}"`);
                            break;
                        }
                    }
                }
                
                // Procurar botão Connect com seletores alternativos
                let connectButton = null;
                
                for (const selector of this.selectors.alternativeConnectButton) {
                    if (selector.includes(':contains')) {
                        // Para seletores :contains, procurar manualmente
                        const buttons = element.querySelectorAll('button');
                        for (const btn of buttons) {
                            const text = btn.textContent.trim().toLowerCase();
                            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                            if (text.includes('connect') || ariaLabel.includes('connect') || ariaLabel.includes('invite')) {
                                connectButton = btn;
                                console.log(`[ConnectaLinkedIn] Botão Connect encontrado: "${btn.textContent.trim()}" | aria-label: "${btn.getAttribute('aria-label')}"`);
                                break;
                            }
                        }
                    } else {
                        connectButton = element.querySelector(selector);
                    }
                    
                    if (connectButton) {
                        console.log(`[ConnectaLinkedIn] Botão Connect encontrado com ${selector}`);
                        break;
                    }
                }
                
                // Procurar título/cargo
                const titleElement = element.querySelector(this.selectors.profileTitle) ||
                                   element.querySelector('.t-14') ||
                                   element.querySelector('[data-anonymize="job-title"]');
                
                const title = titleElement ? titleElement.textContent.trim() : '';
                
                // Procurar link do perfil
                const profileLink = element.querySelector('a[href*="/in/"]');
                const profileUrl = profileLink ? profileLink.href : '';

                console.log('[ConnectaLinkedIn] Dados extraídos:', {
                    name: name || 'NÃO ENCONTRADO',
                    title: title || 'NÃO ENCONTRADO',
                    connectButton: connectButton ? 'ENCONTRADO' : 'NÃO ENCONTRADO',
                    profileUrl: profileUrl || 'NÃO ENCONTRADO'
                });

                if (!name || !connectButton) {
                    console.warn('[ConnectaLinkedIn] Perfil ignorado - dados insuficientes');
                    return null;
                }

                return {
                    name,
                    title,
                    profileUrl,
                    element,
                    connectButton
                };
            } catch (error) {
                console.error('[ConnectaLinkedIn] Erro ao extrair dados do perfil:', error);
                return null;
            }
        }

        shouldProcessProfile(profileData) {
            // Verificar se já foi processado
            if (this.config.avoidDuplicates && this.processedProfiles.has(profileData.profileUrl)) {
                console.log(`[ConnectaLinkedIn] Perfil ${profileData.name} já foi processado`);
                return false;
            }

            // Verificar se o botão de conectar está disponível
            if (!profileData.connectButton || profileData.connectButton.disabled) {
                console.log(`[ConnectaLinkedIn] Botão Connect não disponível para ${profileData.name}`);
                return false;
            }

            // Verificar se não é um perfil premium ou patrocinado
            const isPremium = profileData.element.querySelector('[data-test-icon="premium-icon"]');
            const isSponsored = profileData.element.textContent.includes('Patrocinado') || 
                              profileData.element.textContent.includes('Sponsored');
            
            if (isPremium || isSponsored) {
                console.log(`[ConnectaLinkedIn] Perfil ${profileData.name} é premium/patrocinado - ignorando`);
                return false;
            }

            return true;
        }

        async processProfiles() {
            const totalToProcess = Math.min(this.searchResults.length, this.config.connectionLimit);
            
            for (let i = 0; i < totalToProcess; i++) {
                if (!this.isRunning) break;

                const profile = this.searchResults[i];
                this.currentIndex = i + 1;

                try {
                    await this.sendConnectionRequest(profile);
                    
                    // Atualizar progresso
                    this.sendMessage({
                        action: 'updateProgress',
                        progress: {
                            current: this.currentIndex,
                            total: totalToProcess,
                            currentAction: `Processando ${profile.name}`
                        }
                    });

                    // Marcar como processado
                    this.processedProfiles.add(profile.profileUrl);
                    this.saveProcessedProfiles();

                    // Pausa entre conexões
                    await this.smartDelay();

                } catch (error) {
                    console.error(`[ConnectaLinkedIn] Erro ao processar perfil ${profile.name}:`, error);
                    this.logActivity(`Erro ao conectar com ${profile.name}: ${error.message}`);
                    
                    // Continuar com o próximo perfil
                    continue;
                }
            }

            // Automação concluída
            this.sendMessage({
                action: 'automationComplete',
                data: {
                    message: `Automação concluída! ${this.currentIndex} conexões processadas.`
                }
            });
        }

        async sendConnectionRequest(profile) {
            this.logActivity(`Enviando convite para ${profile.name}`);

            try {
                // Scroll para o elemento se necessário
                profile.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.delay(500);

                // Clicar no botão conectar
                if (!this.config.testMode) {
                    await this.clickElement(profile.connectButton);
                    await this.delay(1000);

                    // Verificar se apareceu modal de nota
                    await this.handleConnectionModal(profile);
                }

                // Notificar sucesso
                this.sendMessage({
                    action: 'connectionSent',
                    data: {
                        name: profile.name,
                        title: profile.title,
                        profileUrl: profile.profileUrl,
                        testMode: this.config.testMode
                    }
                });

                this.logActivity(`${this.config.testMode ? '[TESTE] ' : ''}Convite enviado para ${profile.name}`);

            } catch (error) {
                // Tentar fechar modais em caso de erro
                await this.dismissModals();
                throw error;
            }
        }

        async handleConnectionModal(profile) {
            // Aguardar modal aparecer
            await this.delay(1000);
            
            // Procurar por textarea de mensagem
            const noteTextarea = document.querySelector(this.selectors.noteTextarea);
            if (noteTextarea && this.config.connectionMessage) {
                const personalizedMessage = this.personalizeMessage(this.config.connectionMessage, profile.name);
                await this.typeText(noteTextarea, personalizedMessage);
                await this.delay(500);
            }

            // Procurar botão de enviar
            const sendButton = document.querySelector(this.selectors.sendButton) ||
                              document.querySelector('button[aria-label*="Send"]') ||
                              document.querySelector('button:contains("Send")');
            
            if (sendButton) {
                await this.clickElement(sendButton);
                await this.delay(1000);
            } else {
                console.warn('[ConnectaLinkedIn] Botão Send não encontrado');
            }

            // Fechar qualquer modal que possa ter ficado aberto
            await this.dismissModals();
        }

        personalizeMessage(message, name) {
            const firstName = name.split(' ')[0];
            return message.replace(/\[NOME\]/g, firstName);
        }

        async dismissModals() {
            try {
                const dismissSelectors = [
                    'button[aria-label*="Dismiss"]',
                    'button[aria-label*="Close"]',
                    'button[data-control-name*="overlay.close"]',
                    '.artdeco-modal__dismiss'
                ];
                
                for (const selector of dismissSelectors) {
                    const buttons = document.querySelectorAll(selector);
                    for (const button of buttons) {
                        if (button.offsetParent !== null) { // Verificar se está visível
                            await this.clickElement(button);
                            await this.delay(300);
                        }
                    }
                }
            } catch (error) {
                // Ignorar erros ao fechar modais
            }
        }

        async clickElement(element) {
            if (!element) {
                throw new Error('Elemento não encontrado para clique');
            }

            console.log(`[ConnectaLinkedIn] Clicando em: ${element.tagName} - "${element.textContent.trim()}"`);

            // Simular movimento do mouse se configurado
            if (this.config.smartPauses) {
                const rect = element.getBoundingClientRect();
                const event = new MouseEvent('mouseover', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                element.dispatchEvent(event);
                await this.delay(100);
            }

            // Clicar no elemento
            element.click();
        }

        async typeText(element, text) {
            if (!element) {
                throw new Error('Campo de texto não encontrado');
            }

            console.log(`[ConnectaLinkedIn] Digitando texto: "${text}"`);

            // Limpar campo
            element.value = '';
            element.focus();

            // Simular digitação humana
            for (const char of text) {
                element.value += char;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                
                if (this.config.smartPauses) {
                    await this.delay(50);
                }
            }

            element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        async delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async smartDelay() {
            const strategy = this.timingStrategies[this.config.timingStrategy] || this.timingStrategies.moderate;
            const delay = Math.random() * (strategy.max - strategy.min) + strategy.min;
            
            console.log(`[ConnectaLinkedIn] Aguardando ${Math.round(delay)}ms`);
            await this.delay(delay);

            // Delay adicional se detectar atividade suspeita
            if (this.config.smartPauses) {
                const isPageBusy = document.querySelector('.loading, .spinner, [aria-busy="true"]');
                if (isPageBusy) {
                    console.log('[ConnectaLinkedIn] Página ocupada, aguardando mais tempo...');
                    await this.delay(2000);
                }
            }
        }

        handleError(error) {
            console.error('[ConnectaLinkedIn] Erro na automação:', error);
            
            this.retryCount++;
            
            if (this.retryCount <= this.maxRetries) {
                this.logActivity(`Erro (tentativa ${this.retryCount}/${this.maxRetries}): ${error.message}`);
                
                // Tentar novamente após um delay
                setTimeout(() => {
                    if (this.isRunning) {
                        this.performSearch();
                    }
                }, 5000);
            } else {
                this.logActivity(`Erro máximo de tentativas atingido: ${error.message}`);
                this.stopAutomation();
                
                this.sendMessage({
                    action: 'automationError',
                    data: {
                        message: `Erro na automação: ${error.message}`
                    }
                });
            }
        }

        logActivity(message) {
            console.log(`[ConnectaLinkedIn] ${message}`);
            
            this.sendMessage({
                action: 'logActivity',
                data: {
                    message,
                    timestamp: new Date().toISOString(),
                    type: 'info'
                }
            });
        }

        sendMessage(message) {
            try {
                chrome.runtime.sendMessage(message);
            } catch (error) {
                console.warn('[ConnectaLinkedIn] Erro ao enviar mensagem:', error);
            }
        }

        loadProcessedProfiles() {
            try {
                const stored = localStorage.getItem('conecta-linkedin-processed');
                if (stored) {
                    const data = JSON.parse(stored);
                    this.processedProfiles = new Set(data);
                    console.log(`[ConnectaLinkedIn] Carregados ${data.length} perfis processados`);
                }
            } catch (error) {
                console.warn('[ConnectaLinkedIn] Erro ao carregar perfis processados:', error);
            }
        }

        saveProcessedProfiles() {
            try {
                const data = Array.from(this.processedProfiles);
                localStorage.setItem('conecta-linkedin-processed', JSON.stringify(data));
            } catch (error) {
                console.warn('[ConnectaLinkedIn] Erro ao salvar perfis processados:', error);
            }
        }
    }

    // Aguardar o DOM estar pronto antes de inicializar
    function initializeWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                window.conectaLinkedInContent = new ConnectaLinkedInContent();
            });
        } else {
            // DOM já está pronto
            window.conectaLinkedInContent = new ConnectaLinkedInContent();
        }
    }

    // Inicializar
    initializeWhenReady();

})();

