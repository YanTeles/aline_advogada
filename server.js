import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import pool from './src/config/database.js';

// --- 1. IMPORTAÇÃO DE CONTROLLERS ---
import { postLancamento, getLancamentos } from './src/controllers/lancamentoController.js';

// --- 2. IMPORTAÇÃO DE SERVIÇOS ---
import * as cryptoService from './src/service/cryptoService.mjs';

const app = express();

// --- 3. MIDDLEWARES ---
app.use(cors()); 
app.use(express.json());
app.use(express.static('public')); 

// --- 4. TESTE DE CONEXÃO COM O BANCO ---
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Erro na base de dados:', err.message);
    } else {
        console.log('✅ Base de dados conectada com sucesso!');
    }
});

// --- 5. ROTAS ATIVAS ---

/**
 * @route   GET /api/dashboard/stats/:escritorio_id
 * @desc    Busca números resumidos para os Cards do Dashboard
 */
app.get('/api/dashboard/stats/:escritorio_id', async (req, res) => {
    try {
        const { escritorio_id } = req.params;

        const queryStats = `
            SELECT
                (SELECT COUNT(*) FROM lancamentos_financeiros WHERE escritorio_id = $1) AS processos_ativos,
                COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE escritorio_id = $1 AND tipo = 'RECEITA'), 0) AS receitas_mes,
                COALESCE((SELECT SUM(valor) FROM lancamentos_financeiros WHERE escritorio_id = $1 AND tipo = 'DESPESA'), 0) AS despesas_mes,
                (SELECT COUNT(*) FROM lancamentos_financeiros WHERE escritorio_id = $1 AND data_vencimento::date = CURRENT_DATE) AS prazos_hoje
        `;

        const resultado = await pool.query(queryStats, [escritorio_id]);
        const stats = resultado.rows[0] || {};

        res.json({
            processos_ativos: Number(stats.processos_ativos || 0),
            receitas_mes: parseFloat(stats.receitas_mes || 0).toFixed(2),
            despesas_mes: parseFloat(stats.despesas_mes || 0).toFixed(2),
            prazos_hoje: Number(stats.prazos_hoje || 0)
        });
    } catch (error) {
        console.error("Erro ao buscar stats:", error);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// Rota de Cadastro (POST)
app.post('/api/lancamentos', postLancamento);

// Rota de Listagem e Descriptografia (GET)
app.get('/api/lancamentos/:escritorio_id', getLancamentos);

// Rota de Status do Sistema
app.get('/api/status', (req, res) => {
    res.json({ 
        mensagem: "Sistema da Dra. Aline está online! ⚖️",
        status: "OK"
    });
});

// Rota de Teste de Segurança
app.post('/api/teste/seguranca', (req, res) => {
    try {
        const { dado } = req.body;
        if (!dado) return res.status(400).json({ erro: "Envie um 'dado' no corpo da requisição." });
        
        const enc = cryptoService.encryptField(dado);
        res.json({ original: dado, resultado: enc });
    } catch (e) {
        console.error("Erro no teste de segurança:", e);
        res.status(500).json({ erro: e.message });
    }
});

// --- 6. INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    =============================================
    🚀 ERP JURÍDICO ONLINE - PORTA ${PORT}
    🔒 MÓDULO DE CRIPTOGRAFIA: ATIVO (.MJS)
    📊 ROTA DE ESTATÍSTICAS: ATIVA
    ⚖️ TUDO PRONTO PARA O USO DA DRA. ALINE
    =============================================
    `);
});