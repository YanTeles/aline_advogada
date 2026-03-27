import express from 'express';
import 'dotenv/config';
import pool from './src/config/database.js';

// --- IMPORTAÇÃO DE CONTROLLERS (Nova Estrutura) ---
import { postLancamento } from './src/controllers/lancamentoController.js';

// --- IMPORTAÇÃO DE SERVIÇOS (Existentes) ---
import * as cryptoService from './src/service/cryptoService.js';
import prazoService from './src/service/prazoService.js';
import storageService from './src/service/storageService.js';
import whatsappService from './src/service/whatsappService.js';

const app = express();
app.use(express.json());

// Servir arquivos estáticos (Para o Front-end que vamos criar)
app.use(express.static('public'));

// --- 1. TESTE DE CONEXÃO COM O BANCO ---
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Erro na base de dados:', err.message);
    } else {
        console.log('✅ Base de dados conectada em:', res.rows[0].now);
    }
});

// --- 2. ROTAS FINANCEIRAS ---
// Usando o controller que você criou para manter o código limpo
app.post('/api/lancamentos', postLancamento);

// Rota de consulta (Mantenha se você já tiver a lógica no financeiroService)
app.get('/api/lancamentos/:escritorioId/:ano/:mes', async (req, res) => {
    const { escritorioId, ano, mes } = req.params;
    try {
        // Se você apagou o financeiroService, precisaremos criar um Controller para isso depois
        const rel = await financeiroService.relatorioFluxoCaixaMensal(escritorioId, Number(ano), Number(mes));
        return res.json(rel);
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});

// --- 3. ROTAS DE SEGURANÇA E UTILITÁRIOS ---
app.post('/api/teste/seguranca', (req, res) => {
    const { dado } = req.body;
    const enc = cryptoService.encryptField(dado);
    res.json({ original: dado, criptografado: enc });
});

app.post('/api/teste/prazo', async (req, res) => {
    const { dataPublicacao, escritorioId } = req.body;
    try {
        const prazo = await prazoService.calcularDataLimite(escritorioId, new Date(dataPublicacao), 8);
        res.json({ publicacao: dataPublicacao, vencimento_recurso: prazo });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// --- 4. ROTAS DE PROCESSOS E USUÁRIOS ---
app.post('/api/processos', async (req, res) => {
    const { escritorioId, numeroProcesso, cliente, descricao, valorCausa } = req.body;
    try {
        let valorCausaEnc = null;
        if (valorCausa) {
            valorCausaEnc = cryptoService.encryptField('valor_causa', valorCausa.toString());
        }
        const { rows } = await pool.query(
            `INSERT INTO processos (escritorio_id, numero_processo, cliente, descricao, valor_causa_encrypted, valor_causa_iv, valor_causa_tag)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [escritorioId, numeroProcesso, cliente, descricao, 
             valorCausaEnc?.valor_causa_encrypted, valorCausaEnc?.valor_causa_iv, valorCausaEnc?.valor_causa_tag]
        );
        res.status(201).json(rows[0]);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.post('/api/usuarios', async (req, res) => {
    const { escritorioId, nome, email, senha } = req.body;
    try {
        const hash = await cryptoService.hashSenha(senha);
        const { rows } = await pool.query(
            `INSERT INTO usuarios (escritorio_id, nome, email, senha_hash) VALUES ($1, $2, $3, $4) RETURNING id, nome`,
            [escritorioId, nome, email, hash]
        );
        res.status(201).json(rows[0]);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// --- INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    =============================================
    🚀 ERP JURÍDICO ONLINE - PORTA ${PORT}
    🔒 SEGURANÇA: AES-256-GCM ATIVA
    ⚖️ SISTEMA DA DRA. ALINE PRONTO
    =============================================
    `);
});