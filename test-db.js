// test-db.js
// Substitua qualquer 'require' por estes imports:
import 'dotenv/config'; 
import db from './src/config/database.js';
import { encrypt, decrypt } from './src/services/cryptoService.js';

// O restante do código permanece igual...

async function testarSistema() {
    console.log('🚀 Iniciando teste de banco e criptografia...');

    try {
        // 1. Teste de Conexão Simples
        const resTime = await db.query('SELECT NOW()');
        console.log('✅ Conexão com Postgres: OK (Hora no banco: ' + resTime.rows[0].now + ')');

        // 2. Teste de Criptografia + Insert
        const valorOriginal = "5000.00";
        const descOriginal = "Honorários da Dra. Aline";
        const v = encryptField('valor', valorOriginal);
        const d = encryptField('descricao', descOriginal);

        const insertQuery = `
            INSERT INTO lancamentos_financeiros (
                escritorio_id, tipo, status, data_vencimento,
                valor_encrypted, valor_iv, valor_tag,
                descricao_encrypted, descricao_iv, descricao_tag
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id;
        `;

        const values = [
            '00000000-0000-0000-0000-000000000000', // UUID fictício para teste
            'RECEITA', 'PAGO', '2026-03-25',
            v.valor_encrypted, v.valor_iv, v.valor_tag,
            d.descricao_encrypted, d.descricao_iv, d.descricao_tag
        ];

        const { rows } = await db.query(insertQuery, values);
        const novoId = rows[0].id;
        console.log('✅ Insert com Criptografia: OK (ID gerado: ' + novoId + ')');

        // 3. Teste de Select + Decriptografia
        const { rows: busca } = await db.query('SELECT * FROM lancamentos_financeiros WHERE id = $1', [novoId]);
        const formatado = sanitizeRow(busca[0], ['valor', 'descricao']);

        if (formatado.valor === valorOriginal && formatado.descricao === descOriginal) {
            console.log('✅ Decriptografia e Integridade: OK');
            console.log('📊 Resultado esperado:', { valor: valorOriginal, desc: descOriginal });
            console.log('📊 Resultado do banco:', { valor: formatado.valor, desc: formatado.descricao });
        } else {
            console.error('❌ Erro na integridade dos dados!');
        }

        // Limpeza (Opcional: deletar o teste)
        await db.query('DELETE FROM lancamentos_financeiros WHERE id = $1', [novoId]);
        console.log('🧹 Limpeza de teste: OK');

    } catch (err) {
        console.error('❌ FALHA NO TESTE:', err);
    } finally {
        process.exit();
    }
}

testarSistema();