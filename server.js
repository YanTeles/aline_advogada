import express from 'express';
import 'dotenv/config';
import pool from './src/config/database.js';

// Importação dos Serviços que configuraste
import cryptoService from './src/service/cryptoService.js';
import prazoService from './src/service/prazoService.js';
import storageService from './src/service/storageService.js';
import financeiroService from './src/service/financeiroService.js';
import whatsappService from './src/service/whatsappService.js';

const app = express();
app.use(express.json());

// --- 1. TESTE DE CONEXÃO ---
pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error('❌ Erro na base de dados:', err.message);
    else console.log('✅ Base de dados conectada em:', res.rows[0].now);
});

// --- 2. ROTA DE TESTE: CRIPTOGRAFIA (Segurança Jurídica) ---
app.post('/api/teste/seguranca', (req, res) => {
    const { dado } = req.body;
    const enc = cryptoService.encryptField(dado);
    res.json({ original: dado, criptografado: enc });
});

// --- 2.1 ROTA FINANCEIRA: CRUD de lançamentos com criptografia ---
app.post('/api/lancamentos', async (req, res) => {
    try {
        const lancamentoId = await financeiroService.criarLancamento(req.body.escritorioId, req.body);
        return res.status(201).json({ id: lancamentoId });
    } catch (e) {
        console.error('Erro criando lançamento:', e);
        return res.status(500).json({ erro: e.message });
    }
});

app.get('/api/lancamentos/:escritorioId/:ano/:mes', async (req, res) => {
    const { escritorioId, ano, mes } = req.params;
    try {
        const rel = await financeiroService.relatorioFluxoCaixaMensal(escritorioId, Number(ano), Number(mes));
        return res.json(rel);
    } catch (e) {
        console.error('Erro consultando lançamentos:', e);
        return res.status(500).json({ erro: e.message });
    }
});

// --- 3. ROTA DE TESTE: CALCULAR PRAZO (8 dias úteis) ---
app.post('/api/teste/prazo', async (req, res) => {
    const { dataPublicacao, escritorioId } = req.body;
    try {
        const prazo = await prazoService.calcularDataLimite(escritorioId, new Date(dataPublicacao), 8);
        res.json({ publicacao: dataPublicacao, vencimento_recurso: prazo });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// --- 4. ROTA DE TESTE: UPLOAD PARA CLOUDFLARE R2 ---
app.post('/api/teste/upload', async (req, res) => {
    const { escritorioId, processoId, nomeArquivo } = req.body;
    try {
        const dadosUpload = await storageService.gerarUrlUpload(escritorioId, processoId, nomeArquivo, 'application/pdf');
        res.json({ 
            instrucao: "Faça um PUT direto para a url_upload abaixo",
            ...dadosUpload 
        });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// --- 5. ROTAS JURÍDICAS (ADVOGADO) ---
app.post('/api/prazos/recurso', async (req, res) => {
    try {
        const prazo = await prazoService.criarPrazoRecursoOrdinario(req.body);
        return res.status(201).json(prazo);
    } catch (e) {
        console.error('Erro criando prazo:', e);
        return res.status(500).json({ erro: e.message });
    }
});

app.get('/api/prazos/proximos/:escritorioId/:dias', async (req, res) => {
    const { escritorioId, dias } = req.params;
    try {
        const prazos = await prazoService.listarPrazosProximos(escritorioId, Number(dias));
        return res.json(prazos);
    } catch (e) {
        console.error('Erro listando prazos próximos:', e);
        return res.status(500).json({ erro: e.message });
    }
});

app.post('/api/feriados', async (req, res) => {
    const { escritorioId, data, descricao } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO feriados (escritorio_id, data, descricao) VALUES ($1, $2, $3) RETURNING *',
            [escritorioId || null, data, descricao || null]
        );
        return res.status(201).json(rows[0]);
    } catch (e) {
        console.error('Erro criando feriado:', e);
        return res.status(500).json({ erro: e.message });
    }
});

app.get('/api/feriados/:escritorioId', async (req, res) => {
    const { escritorioId } = req.params;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM feriados WHERE escritorio_id = $1 OR escritorio_id IS NULL ORDER BY data ASC',
            [escritorioId]
        );
        return res.json(rows);
    } catch (e) {
        console.error('Erro listando feriados:', e);
        return res.status(500).json({ erro: e.message });
    }
});

app.post('/api/processos', async (req, res) => {
    const { escritorioId, numeroProcesso, cliente, descricao, valorCausa } = req.body;

    try {
        let valorCausaEnc = null;
        if (valorCausa !== undefined && valorCausa !== null) {
            valorCausaEnc = cryptoService.encryptField('valor_causa', valorCausa.toString());
        }

        const { rows } = await pool.query(
            `INSERT INTO processos (escritorio_id, numero_processo, cliente, descricao, valor_causa_encrypted, valor_causa_iv, valor_causa_tag)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                escritorioId,
                numeroProcesso,
                cliente || null,
                descricao || null,
                valorCausaEnc ? valorCausaEnc.valor_causa_encrypted : null,
                valorCausaEnc ? valorCausaEnc.valor_causa_iv : null,
                valorCausaEnc ? valorCausaEnc.valor_causa_tag : null,
            ]
        );

        return res.status(201).json(rows[0]);
    } catch (e) {
        console.error('Erro criando processo:', e);
        return res.status(500).json({ erro: e.message });
    }
});

app.get('/api/processos/:escritorioId', async (req, res) => {
    const { escritorioId } = req.params;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM processos WHERE escritorio_id = $1 ORDER BY numero_processo ASC',
            [escritorioId]
        );
        return res.json(rows);
    } catch (e) {
        console.error('Erro listando processos:', e);
        return res.status(500).json({ erro: e.message });
    }
});

app.post('/api/usuarios', async (req, res) => {
    const { escritorioId, nome, email, telefone, senha } = req.body;
    if (!senha) return res.status(400).json({ erro: 'Senha é obrigatória' });

    try {
        const hash = await cryptoService.hashSenha(senha);
        const { rows } = await pool.query(
            `INSERT INTO usuarios (escritorio_id, nome, email, telefone, senha_hash)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, escritorio_id, nome, email, telefone, criado_em`,
            [escritorioId, nome, email, telefone || null, hash]
        );
        return res.status(201).json(rows[0]);
    } catch (e) {
        console.error('Erro criando usuário:', e);
        return res.status(500).json({ erro: e.message });
    }
});

app.get('/api/usuarios/:escritorioId', async (req, res) => {
    const { escritorioId } = req.params;
    try {
        const { rows } = await pool.query(
            'SELECT id, escritorio_id, nome, email, telefone, criado_em FROM usuarios WHERE escritorio_id = $1 ORDER BY nome ASC',
            [escritorioId]
        );
        return res.json(rows);
    } catch (e) {
        console.error('Erro listando usuários:', e);
        return res.status(500).json({ erro: e.message });
    }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    =============================================
    🚀 ERP JURÍDICO ONLINE - PORTA ${PORT}
    🔒 SEGURANÇA: AES-256-GCM ATIVA
    📂 STORAGE: CLOUDFLARE R2 PRONTO
    ⚖️ WORKFLOW: PRAZOS DE 8 DIAS CONFIGURADOS
    =============================================
    `);
});