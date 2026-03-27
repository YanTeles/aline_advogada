import pool from '../config/database.js';

export const createLancamento = async (dados) => {
  const { 
    escritorio_id, tipo, status, data_vencimento, 
    valor_encrypted, valor_iv, valor_tag,
    descricao_encrypted, descricao_iv, descricao_tag 
  } = dados;

  const query = `
    INSERT INTO lancamentos_financeiros (
      escritorio_id, tipo, status, data_vencimento, 
      valor_encrypted, valor_iv, valor_tag,
      descricao_encrypted, descricao_iv, descricao_tag
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id;
  `;

  const values = [
    escritorio_id, tipo, status, data_vencimento, 
    valor_encrypted, valor_iv, valor_tag,
    descricao_encrypted, descricao_iv, descricao_tag
  ];

  const res = await pool.query(query, values);
  return res.rows[0];
};