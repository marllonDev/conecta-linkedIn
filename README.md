# 🔗 Conecta-LinkedIn

Uma extensão inteligente para automação de conexões no LinkedIn com recursos avançados de segurança e personalização.

## ⚠️ Aviso Importante

Esta extensão deve ser usada com responsabilidade e em conformidade com os Termos de Uso do LinkedIn. O uso excessivo ou inadequado pode resultar em restrições ou bloqueio da sua conta.

## 🚀 Funcionalidades

### Principais
- ✅ Automação inteligente de envio de convites de conexão
- ✅ Mensagens personalizadas com placeholders dinâmicos
- ✅ Busca por cargo/função específica
- ✅ Controle de limite de conexões por sessão e diário
- ✅ Pausas humanizadas para evitar detecção
- ✅ Modo de teste para simulação sem envio real

### Recursos Avançados
- 📊 Dashboard com estatísticas detalhadas
- 📝 Log de atividades em tempo real
- 🎯 Filtros inteligentes para evitar perfis duplicados
- ⚙️ Configurações avançadas de timing
- 📈 Taxa de sucesso e métricas de desempenho
- 💾 Exportação de dados em JSON

### Segurança
- 🛡️ Detecção de atividade suspeita na página
- 🔄 Sistema de retry com backoff exponencial
- 🚫 Prevenção de spam com limites inteligentes
- 🎭 Simulação de comportamento humano
- 📋 Blacklist automática de perfis já contatados

## 📦 Instalação

### Método 1: Instalação Manual (Recomendado)

1. **Clone ou baixe este repositório**
   ```bash
   git clone https://github.com/marllonDev/conecta-linkedIn.git
   ```

2. **Abra o Chrome e navegue para as extensões**
   - Digite `chrome://extensions/` na barra de endereços
   - Ou vá em Menu → Mais ferramentas → Extensões

3. **Ative o modo desenvolvedor**
   - Clique no botão "Modo do desenvolvedor" no canto superior direito

4. **Carregue a extensão**
   - Clique em "Carregar sem compactação"
   - Selecione a pasta `conecta-linkedIn` que você baixou

5. **Confirme a instalação**
   - A extensão aparecerá na lista e o ícone será exibido na barra de ferramentas

### Método 2: Arquivo .crx (Futuro)

Em breve estará disponível um arquivo .crx para instalação direta.

## 🎯 Como Usar

### Configuração Inicial

1. **Acesse o LinkedIn**
   - Faça login na sua conta do LinkedIn
   - Navegue para qualquer página do LinkedIn

2. **Abra a extensão**
   - Clique no ícone da extensão na barra de ferramentas
   - A interface do Conecta-LinkedIn será exibida

3. **Configure os parâmetros**
   - **Cargo/Função**: Digite o cargo que deseja buscar (ex: "Recrutador", "Engenheiro de Dados")
   - **Mensagem**: Escreva sua mensagem personalizada (use `[NOME]` para personalização automática)
   - **Limite**: Defina quantas conexões enviar por sessão (máximo 50)
   - **Estratégia**: Escolha o timing (Conservador, Moderado, Agressivo)

### Execução

1. **Modo de Teste (Recomendado para primeira vez)**
   - Marque a opção "Modo de teste"
   - Clique em "Iniciar Automação"
   - A extensão simulará o processo sem enviar convites reais

2. **Execução Real**
   - Desmarque o "Modo de teste"
   - Clique em "Iniciar Automação"
   - Acompanhe o progresso na interface

3. **Monitoramento**
   - Veja o progresso em tempo real
   - Acompanhe as estatísticas na aba "Estatísticas"
   - Pare a qualquer momento clicando em "Parar"

## ⚙️ Configurações Avançadas

### Timing Strategies
- **Conservador**: 3-8 segundos entre ações (mais seguro)
- **Moderado**: 2-5 segundos entre ações (equilibrado)
- **Agressivo**: 1-3 segundos entre ações (mais rápido, maior risco)

### Limites Recomendados
- **Por sessão**: Máximo 20-30 conexões
- **Por dia**: Máximo 50-100 conexões
- **Por semana**: Máximo 500 conexões

### Seletores Personalizados
Para usuários avançados, é possível customizar os seletores CSS usados pela extensão:

```json
{
  "connectButton": "button[aria-label*='Conectar']",
  "sendButton": "button[aria-label*='Enviar']",
  "noteTextarea": "textarea[name='message']"
}
```

## 📊 Estatísticas e Monitoramento

A extensão fornece métricas detalhadas:

- **Total Enviados**: Número total de convites enviados
- **Hoje**: Convites enviados no dia atual
- **Taxa de Sucesso**: Percentual de sucesso da última sessão
- **Última Sessão**: Número de convites da última execução

### Exportação de Dados

Você pode exportar todas as suas estatísticas e logs em formato JSON para análise externa.

## 🛡️ Recursos de Segurança

### Prevenção de Detecção
- Pausas aleatórias entre ações
- Simulação de movimento do mouse
- Detecção de atividade da página
- Variação nos padrões de timing

### Proteção da Conta
- Limites diários automáticos
- Detecção de bloqueios temporários
- Sistema de retry inteligente
- Logs detalhados para auditoria

### Boas Práticas
- Use mensagens personalizadas e relevantes
- Não exceda os limites recomendados
- Monitore regularmente sua taxa de aceitação
- Pause a automação se detectar comportamento suspeito

## 🔧 Solução de Problemas

### Problemas Comuns

**A extensão não encontra o botão "Conectar"**
- Verifique se está na página de resultados de busca de pessoas
- Atualize a página e tente novamente
- Verifique se os seletores personalizados estão corretos

**Mensagens não estão sendo personalizadas**
- Certifique-se de usar `[NOME]` na mensagem
- Verifique se o nome do perfil está sendo detectado corretamente

**A automação para inesperadamente**
- Verifique os logs na aba "Estatísticas"
- Pode ter atingido um limite diário do LinkedIn
- Tente usar uma estratégia de timing mais conservadora

### Logs e Depuração

Para desenvolvedores:
1. Abra as Ferramentas do Desenvolvedor (F12)
2. Vá para a aba "Console"
3. Procure por mensagens com prefixo `[Conecta-LinkedIn]`

## 🤝 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## ⚖️ Disclaimer Legal

Esta extensão é fornecida "como está" sem garantias de qualquer tipo. O uso desta ferramenta é de sua inteira responsabilidade. Os desenvolvedores não se responsabilizam por:

- Bloqueios ou restrições em sua conta do LinkedIn
- Violações dos Termos de Uso do LinkedIn
- Qualquer consequência decorrente do uso inadequado da ferramenta

**Use com responsabilidade e sempre respeite os Termos de Uso do LinkedIn.**

## 📞 Suporte

Para suporte e dúvidas:
- Abra uma issue no GitHub
- Entre em contato através do LinkedIn

---

**Desenvolvido com ❤️ para a comunidade profissional**

