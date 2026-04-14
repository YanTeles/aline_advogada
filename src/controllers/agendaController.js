import db from '../config/database.js';
import prazoService from '../service/prazoService.js';
import { v4 as uuidv4 } from 'uuid';

const ESCRITORIO_ID = '550e8400-e29b-41d4-a716-446655440000'; // Mesmo do frontend

/**
 * GET /api/prazos/:escritorioId - Lista prazos próximos (7 dias)
 */
export async function getPrazos(req, res) {
    try {
        const { escritorio_id } = req.params;
        const prazos = await prazoService.listarPrazosProximos(escritorio_id, 7);
        res.json(prazos);
    } catch (error) {
        console.error('Erro listar prazos:', error);
        res.status(500).json({ error: 'Erro ao listar prazos' });
    }
}

/**
 * GET /api/prazos/stats/:escritorioId - Stats para dashboard (prazos hoje)
 */
export async function getPrazosStats(req, res) {
    try {
        const { escritorio_id } = req.params;
        const hoje = new Date().toISOString().slice(0, 10);
        const { rows } = await db.query(
            `SELECT COUNT(*)::int AS prazos_hoje 
             FROM prazos 
             WHERE escritorio_id = $1 AND status = 'PENDENTE' AND data_limite::date = $2::date`,
            [escritorio_id, hoje]
        );
        res.json({ prazos_hoje: rows[0].prazos_hoje });
    } catch (error) {
        console.error('Erro stats prazos:', error);
        res.status(500).json({ error: 'Erro ao buscar stats' });
    }
}

/**
 * POST /api/prazos - Cria novo prazo
 * Body: { data_publicacao: 'YYYY-MM-DD', dias_uteis: 8, descricao: '...', processo_id?: uuid }
 */
export async function postPrazo(req, res) {
    try {
        const { data_publicacao, dias_uteis = 8, descricao, processo_id = uuidv4() } = req.body;
        
        const params = {
            escritorioId: ESCRITORIO_ID,
            processoId: processo_id,
            dataPublicacao: data_publicacao,
            diasUteis: parseInt(dias_uteis),
            descricao: descricao || `Prazo: ${dias_uteis} dias úteis`,
            tipoPrazo: 'PRAZO_PERSONALIZADO',
            responsavelId: null, // Futuro: usuário logado
        };

        const prazo = await prazoService.criarPrazoRecursoOrdinario(params);
        res.json(prazo);
    } catch (error) {
        console.error('Erro criar prazo:', error);
        res.status(500).json({ error: error.message || 'Erro ao criar prazo' });
    }
}

export default { getPrazos, getPrazosStats, postPrazo };

