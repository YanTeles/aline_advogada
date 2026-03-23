import axios from 'axios';
import db from '../config/database.js';

// Configurações da Evolution API (Configurar no .env)
const BASE_URL = process.env.EVOLUTION_API_URL; 
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

/**
 * Envia uma mensagem de texto simples via WhatsApp.
 */
async function enviarMensagem(telefone, mensagem) {
    try {
        // 1. Limpa o número e garante o DDI 55 (Brasil) se não houver
        let numeroLimpo = telefone.replace(/\D/g, '');
        if (numeroLimpo.length <= 11) {
            numeroLimpo = `55${numeroLimpo}`;
        }
        
        const response = await axios.post(
            `${BASE_URL}/message/sendText/${INSTANCE}`,
            { 
                number: numeroLimpo, 
                options: { delay: 1200, presence: 'composing' },
                textMessage: { text: mensagem } 
            },
            { headers: { apikey: API_KEY } }
        );
        return response.data;
    } catch (error) {
        console.error('❌ [WhatsApp] Erro no envio:', error.response?.data || error.message);
        // Não lançamos erro aqui para não travar o fluxo principal do sistema
        return null; 
    }
}

/**
 * Envia um alerta de prazo jurídico formatado.
 */
async function enviarAlertaPrazo(dados) {
    const { 
        escritorioId, 
        processoId, 
        data_limite, // Vem do banco como snake_case
        tipo_prazo, 
        responsavel_id,
        mensagemAdicional = '' // Recebe os detalhes de feriados/recesso
    } = dados;

    try {
        // 1. Busca dados do responsável
        const { rows: userRows } = await db.query(
            'SELECT nome, telefone FROM usuarios WHERE id = $1 AND escritorio_id = $2',
            [responsavel_id, escritorioId]
        );

        if (!userRows.length || !userRows[0].telefone) {
            console.warn(`⚠️ [WhatsApp] Responsável ${responsavel_id} sem telefone ou não encontrado.`);
            return;
        }

        // 2. Busca número do processo
        const { rows: procRows } = await db.query(
            'SELECT numero_processo FROM processos WHERE id = $1 AND escritorio_id = $2',
            [processoId, escritorioId]
        );

        const numeroProcesso = procRows[0]?.numero_processo || 'Não identificado';
        
        // 3. Formatação da Data (Garante que a data do banco seja tratada corretamente)
        const dataFormatada = new Date(data_limite).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

        // 4. Montagem do Template
        const mensagem = 
            `⚖️ *ALERTA DE PRAZO JURÍDICO*\n\n` +
            `Olá, *${userRows[0].nome}*!\n` +
            `Um novo prazo de *${tipo_prazo}* foi gerado.\n\n` +
            `📍 *Processo:* ${numeroProcesso}\n` +
            `📅 *Vencimento:* ${dataFormatada}\n` +
            `${mensagemAdicional}\n\n` +
            `_Por favor, valide as informações no seu painel._`;

        return await enviarMensagem(userRows[0].telefone, mensagem);
    } catch (err) {
        console.error('❌ [WhatsApp] Erro ao processar alerta:', err.message);
    }
}

export default { enviarMensagem, enviarAlertaPrazo };