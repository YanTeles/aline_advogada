import db from '../config/database.js';
import { decrypt, encryptField, sanitizeRows } from './cryptoService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Gera relatório de fluxo de caixa para um mês/ano.
 * Melhoria: Filtro por intervalo (melhor performance de índice) e precisão decimal.
 */
export async function relatorioFluxoCaixaMensal(escritorioId, ano, mes) {
    // Calculando o primeiro e último dia do mês para a query
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];

    const query = `
        SELECT 
            id, tipo, status, data_vencimento, data_pagamento,
            valor_encrypted, valor_iv, valor_tag,
            descricao_encrypted, descricao_iv, descricao_tag
         FROM lancamentos_financeiros
         WHERE escritorio_id = $1
           AND (
               (data_pagamento BETWEEN $2 AND $3)
               OR
               (status IN ('EM_ABERTO', 'VENCIDO') AND data_vencimento BETWEEN $2 AND $3)
           )
         ORDER BY data_vencimento ASC;
    `;

    const { rows } = await db.query(query, [escritorioId, dataInicio, dataFim]);

    // Usando seu helper sanitizeRows para descriptografar tudo de uma vez
    const lancamentos = sanitizeRows(rows, ['valor', 'descricao']);

    // Cálculo com tratamento de precisão decimal
    let totalReceitas = 0;
    let totalDespesas = 0;

    lancamentos.forEach(l => {
        const valorNumerico = parseFloat(l.valor) || 0;
        
        if (l.status === 'PAGO') {
            if (l.tipo === 'RECEITA') {
                totalReceitas += valorNumerico;
            } else if (l.tipo === 'DESPESA') {
                totalDespesas += valorNumerico;
            }
        }
    });

    return {
        mes: parseInt(mes),
        ano: parseInt(ano),
        resumo: {
            receitas: totalReceitas.toFixed(2),
            despesas: totalDespesas.toFixed(2),
            saldo: (totalReceitas - totalDespesas).toFixed(2)
        },
        lancamentos
    };
}

/**
 * Cria um novo lançamento financeiro com dados criptografados.
 * CORREÇÃO: Passando o prefixo correto para o encryptField.
 */
export async function criarLancamento(escritorioId, dados) {
    const { tipo, status, valor, descricao, data_vencimento } = dados;

    // Garantindo que o valor seja uma string formatada (ex: "1500.00")
    const valorString = parseFloat(valor).toFixed(2);

    // CORREÇÃO CRÍTICA: Passando prefixo + valor conforme definido no cryptoService
    const v = encryptField('valor', valorString);
    const d = encryptField('descricao', descricao);

    const query = `
        INSERT INTO lancamentos_financeiros (
            id, escritorio_id, tipo, status, data_vencimento,
            valor_encrypted, valor_iv, valor_tag,
            descricao_encrypted, descricao_iv, descricao_tag
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id;
    `;

    const values = [
        uuidv4(), 
        escritorioId, 
        tipo, 
        status, 
        data_vencimento,
        v.valor_encrypted, v.valor_iv, v.valor_tag,
        d.descricao_encrypted, d.descricao_iv, d.descricao_tag
    ];

    const { rows } = await db.query(query, values);
    return rows[0].id;
}

export default { relatorioFluxoCaixaMensal, criarLancamento };