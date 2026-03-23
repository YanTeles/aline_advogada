import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import whatsappService from './whatsappService.js';
import calendarService from './calendarService.js';

// ---------------------------------------------------------------------------
// Helpers Internos
// ---------------------------------------------------------------------------

const isFinalDeSemana = (date) => {
    const dia = date.getUTCDay(); 
    return dia === 0 || dia === 6; // 0 = Domingo, 6 = Sábado
};

const toISODate = (date) => date.toISOString().slice(0, 10);

/**
 * Verifica se a data cai no Recesso Forense (20 de Dezembro a 20 de Janeiro)
 * Conforme Art. 220 do CPC/2015.
 */
const isRecessoForense = (date) => {
    const mes = date.getUTCMonth() + 1; // Jan = 1
    const dia = date.getUTCDate();
    return (mes === 12 && dia >= 20) || (mes === 1 && dia <= 20);
};

async function carregarFeriados(escritorioId, dataInicio, dataFim) {
    const { rows } = await db.query(
        `SELECT data::TEXT FROM feriados
         WHERE (escritorio_id IS NULL OR escritorio_id = $1)
           AND data BETWEEN $2 AND $3`,
        [escritorioId, toISODate(dataInicio), toISODate(dataFim)]
    );
    return new Set(rows.map(r => r.data));
}

// ---------------------------------------------------------------------------
// Lógica de Cálculo
// ---------------------------------------------------------------------------

export async function calcularPrazoUteis(dataPublicacao, escritorioId, diasUteis = 8) {
    if (!dataPublicacao || !escritorioId) throw new Error('Parâmetros obrigatórios ausentes.');

    // Normaliza para o início do dia em UTC para evitar bugs de fuso horário
    const dataBase = typeof dataPublicacao === 'string' ? dataPublicacao.split('T')[0] : toISODate(dataPublicacao);
    const atual = new Date(`${dataBase}T00:00:00Z`);

    // Busca feriados com margem de segurança (dias úteis * 3 + recesso)
    const dataFimBusca = new Date(atual);
    dataFimBusca.setUTCDate(dataFimBusca.getUTCDate() + (diasUteis * 3) + 31);
    const feriados = await carregarFeriados(escritorioId, atual, dataFimBusca);

    let diasContados = 0;
    const feriadosEncontrados = [];

    // REGRA JURÍDICA: A contagem exclui o dia do começo e começa no dia ÚTIL seguinte
    atual.setUTCDate(atual.getUTCDate() + 1);

    let travaSeguranca = 0;
    while (diasContados < diasUteis && travaSeguranca < 365) {
        travaSeguranca++;
        const dateStr = toISODate(atual);
        const ehFDS = isFinalDeSemana(atual);
        const ehFeriado = feriados.has(dateStr);
        const ehRecesso = isRecessoForense(atual);

        if (!ehFDS && !ehFeriado && !ehRecesso) {
            diasContados++;
        } else if (ehFeriado || ehRecesso) {
            feriadosEncontrados.push(`${dateStr}${ehRecesso ? ' (Recesso)' : ''}`);
        }

        // Só avança se ainda não completou os dias úteis necessários
        if (diasContados < diasUteis) {
            atual.setUTCDate(atual.getUTCDate() + 1);
        }
    }

    // Garante que o dia final não seja um "dia morto" (FDS ou Feriado inesperado)
    while (isFinalDeSemana(atual) || feriados.has(toISODate(atual)) || isRecessoForense(atual)) {
        atual.setUTCDate(atual.getUTCDate() + 1);
    }

    return {
        dataLimite: atual,
        feriadosEncontrados: [...new Set(feriadosEncontrados)]
    };
}

// ---------------------------------------------------------------------------
// Persistência e Alertas
// ---------------------------------------------------------------------------

export async function criarPrazoRecursoOrdinario(params) {
    const {
        escritorioId, processoId, dataPublicacao, responsavelId = null,
        criadoPor = null, alertaWhatsapp = true, alertaCalendar = true,
        diasUteis = 8, tipoPrazo = 'RECURSO_ORDINARIO',
        descricao = 'Prazo para Recurso Ordinário'
    } = params;

    const { dataLimite, feriadosEncontrados } = await calcularPrazoUteis(dataPublicacao, escritorioId, diasUteis);

    const { rows } = await db.query(
        `INSERT INTO prazos (
            id, escritorio_id, processo_id, tipo_prazo, descricao,
            data_publicacao, data_limite, dias_uteis, status,
            responsavel_id, alerta_whatsapp, alerta_calendar, criado_por
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDENTE', $9, $10, $11, $12)
        RETURNING *`,
        [
            uuidv4(), escritorioId, processoId, tipoPrazo, descricao,
            dataPublicacao, toISODate(dataLimite), diasUteis,
            responsavelId, alertaWhatsapp, alertaCalendar, criadoPor
        ]
    );

    const prazo = rows[0];

    // Dispara alertas em background
    agendarAlertas(prazo, feriadosEncontrados).catch(err => 
        console.error('[PrazoService] Erro alertas:', err.message)
    );

    return { ...prazo, dataLimiteFormatada: dataLimite.toLocaleDateString('pt-BR') };
}

async function agendarAlertas(prazo, feriadosEncontrados) {
    const tasks = [];
    const infoFeriados = feriadosEncontrados.length > 0 
        ? `\nObservação: Dias pulados (Feriados/Recesso): ${feriadosEncontrados.join(', ')}` 
        : '';

    if (prazo.alerta_whatsapp) {
        tasks.push(whatsappService.enviarAlertaPrazo({
            ...prazo,
            mensagemAdicional: infoFeriados
        }));
    }

    if (prazo.alerta_calendar) {
        tasks.push(calendarService.criarEvento({
            escritorioId: prazo.escritorio_id,
            titulo: `[PRAZO] ${prazo.tipo_prazo}`,
            dataInicio: prazo.data_limite,
            descricao: `${prazo.descricao}${infoFeriados}`
        }));
    }

    await Promise.allSettled(tasks);
}

// ---------------------------------------------------------------------------
// Gestão de Status
// ---------------------------------------------------------------------------

export async function listarPrazosProximos(escritorioId, dias = 5) {
    const { rows } = await db.query(
        `SELECT p.*, pr.numero_processo, u.nome AS responsavel_nome
         FROM prazos p
         LEFT JOIN processos pr ON pr.id = p.processo_id
         LEFT JOIN usuarios u ON u.id = p.responsavel_id
         WHERE p.escritorio_id = $1 AND p.status = 'PENDENTE'
           AND p.data_limite BETWEEN CURRENT_DATE AND CURRENT_DATE + $2
         ORDER BY p.data_limite ASC`,
        [escritorioId, dias]
    );
    return rows;
}

export async function marcarPrazosVencidos(escritorioId) {
    const { rowCount } = await db.query(
        `UPDATE prazos SET status = 'PERDIDO', atualizado_em = NOW()
         WHERE escritorio_id = $1 AND status = 'PENDENTE' AND data_limite < CURRENT_DATE`,
        [escritorioId]
    );
    return rowCount;
}

export default { 
    calcularPrazoUteis, 
    criarPrazoRecursoOrdinario, 
    listarPrazosProximos, 
    marcarPrazosVencidos 
};