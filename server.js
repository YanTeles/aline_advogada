import express from 'express';
import 'dotenv/config';
import pool from './src/config/database.js';

// --- IMPORTAÇÃO DE SERVIÇOS ---
import * as cryptoService from './src/service/cryptoService.mjs';

// --- COMENTADO TEMPORARIAMENTE PARA O SERVIDOR LIGAR ---
// import { postLancamento } from './src/controllers/lancamentoController.js';

// Função temporária para a rota não dar erro enquanto o Controller está com problema
const postLancamento = (req, res) => {
    res.status(200).json({ mensagem: "Servidor online, mas o Controller ainda está sendo ajustado." });
};

const app = express();

// Middlewares
app.use(express.json());
app.use(express.static('public')); 

// --- 1. TESTE DE CONEXÃO COM O BANCO ---
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Erro na base de dados:', err.message);
    } else {
        console.log('✅ Base de dados conectada com sucesso!');
    }
});

// --- 2. ROTAS ATIVAS ---
app.post('/api/lancamentos', postLancamento);

app.get('/api/status', (req, res) => {
    res.json({ 
        mensagem: "Sistema da Dra. Aline está online! ⚖️",
        status: "OK"
    });
});

// --- 3. ROTAS DE SEGURANÇA (Teste) ---
app.post('/api/teste/seguranca', (req, res) => {
    try {
        const { dado } = req.body;
        const enc = cryptoService.encryptField(dado);
        res.json({ original: dado, criptografado: enc });
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});

// --- INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    =============================================
    🚀 ERP JURÍDICO ONLINE - PORTA ${PORT}
    🔒 MÓDULO DE CRIPTOGRAFIA: ATIVO (.MJS)
    📂 PASTA PÚBLICA: /public
    =============================================
    `);
});