import { google } from 'googleapis';
import db from '../config/database.js';

// Configurações do Google vindas do seu .env
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

/**
 * Cria um evento na agenda do Google do advogado.
 * Requer que o advogado tenha feito login com Google previamente.
 */
export async function criarEventoPrazo(escritorioId, usuarioId, dadosPrazo) {
    // 1. Busca os tokens do usuário no banco (tokens devem estar criptografados)
    const { rows } = await db.query(
        'SELECT google_refresh_token FROM usuarios WHERE id = $1 AND escritorio_id = $2',
        [usuarioId, escritorioId]
    );

    if (!rows.length || !rows[0].google_refresh_token) {
        console.log('Usuário não possui integração com Google Calendar ativa.');
        return null;
    }

    // 2. Configura as credenciais
    oauth2Client.setCredentials({
        refresh_token: rows[0].google_refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const dataLimite = new Date(dadosPrazo.dataLimite);
    
    // Define o evento para o dia todo ou um horário específico
    const event = {
        summary: `⚖️ PRAZO: ${dadosPrazo.titulo}`,
        description: `Processo: ${dadosPrazo.numeroProcesso}\nTipo: ${dadosPrazo.tipo}\nGerado automaticamente pelo ERP Jurídico.`,
        start: {
            date: dataLimite.toISOString().split('T')[0], // Evento de dia inteiro
        },
        end: {
            date: dataLimite.toISOString().split('T')[0],
        },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'popup', minutes: 24 * 60 }, // Alerta 1 dia antes
                { method: 'email', minutes: 24 * 60 },
            ],
        },
    };

    try {
        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });
        return response.data.id;
    } catch (error) {
        console.error('Erro ao criar evento no Google Calendar:', error);
        return null;
    }
}

export default { criarEventoPrazo };