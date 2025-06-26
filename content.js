// Conecta-LinkedIn Content Script
(function() {
    'use strict';
    
    // Verificar se já foi inicializado para evitar declaração duplicada
    if (window.conectaLinkedInContent) {
        console.log('ConnectaLinkedInContent já foi inicializado');
        return;
    }

    class ConnectaLinkedInContent {
        constructor() {
            this.isRunning = false;
            this.config = null;
            this.currentIndex = 0;
            this.processedProfiles = new Set();
            this.searchResults = [];
            this.retryCount = 0;
            this.maxRetries = 3;
            
            // Seletores CSS para diferentes elementos do LinkedIn
            this.selectors = {
                searchBox: 'input[placeholder*="Pesquisar"], input[aria-label*="Pesquisar"]',
                searchButton: 'button[aria-label*="Pesquisar"], button[type="submit"]',
                connectButton: 'button[aria-label*="Connect"], button[aria-label*="Conectar"]',
                sendButton: 'button[aria-label*="Enviar"], button[data-control-name*="send"]',
                noteTextarea: 'textarea[name="message"], textarea[aria-label*="mensagem"]',
                profileName: ".entity-result__title-text a span[aria-hidden=\"true\"]",
                profileTitle: ".entity-result__primary-subtitle",
                searchResults: ".search-results-container li",
                nextButton: 'button[aria-label*="Próxima"], button[aria-label*="Next"]',
                peopleFilter: 'button[aria-label*="Pessoas"], button[aria-label*="People"]',
                dismissButton: 'button[aria-label*="Dispensar"], button[aria-label*="Dismiss"]'
            };

            this.timingStrategies = {
                conservative: { min: 3000, max: 8000 },
                moderate: { min: 2000, max: 5000 },
                aggressive: { min: 1000, max: 3000 }
            };

            this.init();
        }

        init() {
            this.setupMessageListeners();
            this.loadProcessedProfiles();
            
            // Notificar que o content script está pronto
            chrome.runtime.sendMessage({ action: 'contentScriptReady' });
        }

        setupMessageListeners() {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleMessage(message, sender, sendResponse);
                return true;
            });
        }

        async handleMessage(message, sender, sendResponse) {
            try {
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
                console.error('Erro no content script:', error);
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

            // Mesclar seletores personalizados
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
                await this.waitForElement(this.selectors.searchResults, 10000);

                // Aplicar filtro de pessoas se necessário
                await this.applyPeopleFilter();

                // Coletar resultados da busca
                await this.collectSearchResults();

                // Iniciar processamento dos perfis
                await this.processProfiles();

            } catch (error) {
                throw new Error(`Erro na busca: ${error.message}`);
            }
        }

        async applyPeopleFilter() {
            try {
                const peopleFilter = document.querySelector(this.selectors.peopleFilter);
                if (peopleFilter && !peopleFilter.classList.contains('active')) {
                    await this.clickElement(peopleFilter);
                    await this.randomDelay();
                }
            } catch (error) {
                console.warn('Não foi possível aplicar filtro de pessoas:', error);
            }
        }

        async collectSearchResults() {
            this.searchResults = [];
            
            // Debug: verificar se encontra elementos
            console.log('Procurando por elementos com seletor:', this.selectors.searchResults);
            const resultElements = document.querySelectorAll(this.selectors.searchResults);
            console.log('Elementos encontrados:', resultElements.length);
            
            // Se não encontrar com o seletor principal, tentar alternativas
            if (resultElements.length === 0) {
                const alternativeSelectors = [
                    'li[data-chameleon-result-urn]',
                    '.search-results-container > ul > li',
                    '.search-results-container li',
                    'div[data-chameleon-result-urn]',
                    '.entity-result'
                ];
                
                for (const altSelector of alternativeSelectors) {
                    const altElements = document.querySelectorAll(altSelector);
                    console.log(`Seletor alternativo ${altSelector}: ${altElements.length} elementos`);
                    if (altElements.length > 0) {
                        this.selectors.searchResults = altSelector;
                        break;
                    }
                }
            }
            
            // Tentar novamente com o seletor atualizado
            const finalElements = document.querySelectorAll(this.selectors.searchResults);
            console.log('Elementos finais encontrados:', finalElements.length);
            
            for (const element of finalElements) {
                try {
                    const profileData = this.extractProfileData(element);
                    if (profileData && this.shouldProcessProfile(profileData)) {
                        this.searchResults.push(profileData);
                    }
                } catch (error) {
                    console.warn('Erro ao extrair dados do perfil:', error);
                }
            }

            this.logActivity(`Encontrados ${this.searchResults.length} perfis para processar`);
            
            if (this.searchResults.length === 0) {
                throw new Error('Nenhum perfil encontrado para conectar');
            }
        }

        extractProfileData(element) {
            try {
                // Tentar múltiplos seletores para o nome
                const nameSelectors = [
                    '.entity-result__title-text a span[aria-hidden="true"]',
                    '.entity-result__title-text a',
                    'a[href*="/in/"] span[aria-hidden="true"]',
                    'a[href*="/in/"]',
                    '.search-result__result-link',
                    'h3 a span',
                    'h3 a'
                ];
                
                let nameElement = null;
                for (const selector of nameSelectors) {
                    nameElement = element.querySelector(selector);
                    if (nameElement) break;
                }
                
                // Tentar múltiplos seletores para o botão conectar
                const connectSelectors = [
                    'button[aria-label*="Connect"]',
                    'button[aria-label*="Conectar"]',
                    'button:contains("Connect")',
                    'button:contains("Conectar")',
                    'button[data-control-name*="connect"]'
                ];
                
                let connectButton = null;
                for (const selector of connectSelectors) {
                    connectButton = element.querySelector(selector);
                    if (connectButton) break;
                }
                
                // Se não encontrou com seletores, procurar por texto
                if (!connectButton) {
                    const buttons = element.querySelectorAll('button');
                    for (const btn of buttons) {
                        const text = btn.textContent.trim().toLowerCase();
                        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                        if (text.includes('connect') || text.includes('conectar') || 
                            ariaLabel.includes('connect') || ariaLabel.includes('conectar')) {
                            connectButton = btn;
                            break;
                        }
                    }
                }
                
                const titleElement = element.querySelector(this.selectors.profileTitle) ||
                                   element.querySelector('.entity-result__primary-subtitle');
                
                const profileLink = element.querySelector('a[href*="/in/"]');

                console.log('Dados extraídos:', {
                    nameElement: nameElement ? nameElement.textContent.trim() : 'não encontrado',
                    connectButton: connectButton ? 'encontrado' : 'não encontrado',
                    profileLink: profileLink ? profileLink.href : 'não encontrado'
                });

                if (!nameElement || !connectButton) {
                    return null;
                }

                const name = nameElement.textContent.trim();
                const title = titleElement ? titleElement.textContent.trim() : '';
                const profileUrl = profileLink ? profileLink.href : '';

                return {
                    name,
                    title,
                    profileUrl,
                    element,
                    connectButton
                };
            } catch (error) {
                console.warn('Erro ao extrair dados do perfil:', error);
                return null;
            }
        }

        shouldProcessProfile(profileData) {
            // Verificar se já foi processado
            if (this.config.avoidDuplicates && this.processedProfiles.has(profileData.profileUrl)) {
                return false;
            }

            // Verificar se o botão de conectar está disponível
            if (!profileData.connectButton || profileData.connectButton.disabled) {
                return false;
            }

            // Verificar se não é um perfil premium ou patrocinado
            const isPremium = profileData.element.querySelector('[data-test-icon="premium-icon"]');
            const isSponsored = profileData.element.textContent.includes('Patrocinado');
            
            if (isPremium || isSponsored) {
                return false;
            }

            return true;
        }

        async processProfiles() {
            for (let i = 0; i < Math.min(this.searchResults.length, this.config.connectionLimit); i++) {
                if (!this.isRunning) break;

                const profile = this.searchResults[i];
                this.currentIndex = i + 1;

                try {
                    await this.sendConnectionRequest(profile);
                    
                    // Atualizar progresso
                    chrome.runtime.sendMessage({
                        action: 'updateProgress',
                        progress: {
                            current: this.currentIndex,
                            total: Math.min(this.searchResults.length, this.config.connectionLimit),
                            currentAction: `Processando ${profile.name}`
                        }
                    });

                    // Marcar como processado
                    this.processedProfiles.add(profile.profileUrl);
                    this.saveProcessedProfiles();

                    // Pausa entre conexões
                    await this.smartDelay();

                } catch (error) {
                    console.error(`Erro ao processar perfil ${profile.name}:`, error);
                    this.logActivity(`Erro ao conectar com ${profile.name}: ${error.message}`);
                    
                    // Continuar com o próximo perfil
                    continue;
                }
            }

            // Automação concluída
            chrome.runtime.sendMessage({
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
                await this.randomDelay(500, 1000);

                // Clicar no botão conectar
                await this.clickElement(profile.connectButton);
                await this.randomDelay(1000, 2000);

                // Verificar se apareceu modal de nota
                const noteButton = document.querySelector(this.selectors.noteButton);
                if (noteButton) {
                    await this.clickElement(noteButton);
                    await this.randomDelay(500, 1000);

                    // Preencher mensagem personalizada
                    const noteTextarea = document.querySelector(this.selectors.noteTextarea);
                    if (noteTextarea) {
                        const personalizedMessage = this.personalizeMessage(this.config.connectionMessage, profile.name);
                        await this.typeText(noteTextarea, personalizedMessage);
                        await this.randomDelay(500, 1000);
                    }
                }

                // Clicar em enviar
                const sendButton = document.querySelector(this.selectors.sendButton);
                if (sendButton) {
                    if (!this.config.testMode) {
                        await this.clickElement(sendButton);
                        await this.randomDelay(1000, 2000);
                    }

                    // Notificar sucesso
                    chrome.runtime.sendMessage({
                        action: 'connectionSent',
                        data: {
                            name: profile.name,
                            title: profile.title,
                            profileUrl: profile.profileUrl,
                            testMode: this.config.testMode
                        }
                    });

                    this.logActivity(`${this.config.testMode ? '[TESTE] ' : ''}Convite enviado para ${profile.name}`);
                } else {
                    throw new Error('Botão de enviar não encontrado');
                }

                // Fechar qualquer modal que possa ter ficado aberto
                await this.dismissModals();

            } catch (error) {
                // Tentar fechar modais em caso de erro
                await this.dismissModals();
                throw error;
            }
        }

        personalizeMessage(message, name) {
            return message.replace(/\[NOME\]/g, name.split(' ')[0]);
        }

        async dismissModals() {
            try {
                const dismissButtons = document.querySelectorAll(this.selectors.dismissButton);
                for (const button of dismissButtons) {
                    if (button.offsetParent !== null) { // Verificar se está visível
                        await this.clickElement(button);
                        await this.randomDelay(300, 500);
                    }
                }
            } catch (error) {
                // Ignorar erros ao fechar modais
            }
        }

        async clickElement(element) {
            if (!element) {
                throw new Error('Elemento não encontrado');
            }

            // Simular movimento do mouse
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
                await this.randomDelay(100, 300);
            }

            // Clicar no elemento
            element.click();
        }

        async typeText(element, text) {
            if (!element) {
                throw new Error('Campo de texto não encontrado');
            }

            // Limpar campo
            element.value = '';
            element.focus();

            // Simular digitação humana
            for (const char of text) {
                element.value += char;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                
                if (this.config.smartPauses) {
                    await this.randomDelay(50, 150);
                }
            }

            element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        async waitForElement(selector, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }

                // Verificar se document.body existe antes de usar MutationObserver
                if (!document.body) {
                    // Aguardar document.body estar disponível
                    const bodyObserver = new MutationObserver(() => {
                        if (document.body) {
                            bodyObserver.disconnect();
                            // Agora procurar pelo elemento
                            this.waitForElement(selector, timeout).then(resolve).catch(reject);
                        }
                    });
                    
                    bodyObserver.observe(document.documentElement, {
                        childList: true,
                        subtree: true
                    });
                    
                    setTimeout(() => {
                        bodyObserver.disconnect();
                        reject(new Error(`Document.body não encontrado após ${timeout}ms`));
                    }, timeout);
                    return;
                }

                const observer = new MutationObserver(() => {
                    const element = document.querySelector(selector);
                    if (element) {
                        observer.disconnect();
                        resolve(element);
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`Elemento ${selector} não encontrado após ${timeout}ms`));
                }, timeout);
            });
        }

        async randomDelay(min = null, max = null) {
            const strategy = this.timingStrategies[this.config.timingStrategy] || this.timingStrategies.moderate;
            const minDelay = min || strategy.min;
            const maxDelay = max || strategy.max;
            
            const delay = Math.random() * (maxDelay - minDelay) + minDelay;
            return new Promise(resolve => setTimeout(resolve, delay));
        }

        async smartDelay() {
            // Delay base baseado na estratégia
            await this.randomDelay();

            // Delay adicional se detectar atividade suspeita
            if (this.config.smartPauses) {
                const isPageBusy = document.querySelector('.loading, .spinner, [aria-busy="true"]');
                if (isPageBusy) {
                    await this.randomDelay(2000, 5000);
                }

                // Verificar se há muitas requisições de rede
                const performanceEntries = performance.getEntriesByType('navigation');
                if (performanceEntries.length > 0) {
                    const lastEntry = performanceEntries[performanceEntries.length - 1];
                    if (lastEntry.loadEventEnd - lastEntry.loadEventStart > 3000) {
                        await this.randomDelay(1000, 3000);
                    }
                }
            }
        }

        handleError(error) {
            console.error('Erro na automação:', error);
            
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
                
                chrome.runtime.sendMessage({
                    action: 'automationError',
                    data: {
                        message: `Erro na automação: ${error.message}`
                    }
                });
            }
        }

        logActivity(message) {
            console.log(`[ConnectaLinkedIn] ${message}`);
            
            chrome.runtime.sendMessage({
                action: 'logActivity',
                data: {
                    message,
                    timestamp: new Date().toISOString(),
                    type: 'info'
                }
            });
        }

        loadProcessedProfiles() {
            try {
                const stored = localStorage.getItem('conecta-linkedin-processed');
                if (stored) {
                    const data = JSON.parse(stored);
                    this.processedProfiles = new Set(data);
                }
            } catch (error) {
                console.warn('Erro ao carregar perfis processados:', error);
            }
        }

        saveProcessedProfiles() {
            try {
                const data = Array.from(this.processedProfiles);
                localStorage.setItem('conecta-linkedin-processed', JSON.stringify(data));
            } catch (error) {
                console.warn('Erro ao salvar perfis processados:', error);
            }
        }
    }

    // Aguardar o DOM estar pronto antes de inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.conectaLinkedInContent = new ConnectaLinkedInContent();
        });
    } else {
        // DOM já está pronto
        window.conectaLinkedInContent = new ConnectaLinkedInContent();
    }

})();

