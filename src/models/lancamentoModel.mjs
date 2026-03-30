import pool from '../config/database.js';

/**
 * Cria um novo lançamento financeiro com campos criptografados.
 */
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
    RETURNING id, data_vencimento;
  `;

  const values = [
    escritorio_id,        // $1
    tipo,                 // $2
    status || 'PENDENTE', // $3 (Garante um status padrão se vier vazio)
    data_vencimento,      // $4
    valor_encrypted,      // $5
    valor_iv,             // $6
    valor_tag,            // $7
    descricao_encrypted,  // $8
    descricao_iv,         // $9
    descricao_tag         // $10
  ];

  try {
    const res = await pool.query(query, values);
    return res.rows[0];
  } catch (error) {
    console.error("❌ Erro no SQL (createLancamento):", error.message);
    throw error;
  }
};

/**
 * Busca todos os lançamentos de um escritório específico.
 */
export const getLancamentosByEscritorio = async (escritorio_id) => {
  // Validamos se o ID foi enviado para evitar erro de SQL
  if (!escritorio_id) {
    throw new Error("O ID do escritório é obrigatório para a busca.");
  }

  const query = `
    SELECT 
      id, 
      escritorio_id, 
      tipo, 
      status, 
      data_vencimento,
      valor_encrypted, valor_iv, valor_tag,
      descricao_encrypted, descricao_iv, descricao_tag
    FROM lancamentos_financeiros 
    WHERE escritorio_id = $1 
    ORDER BY data_vencimento DESC;
  `;

  try {
    const res = await pool.query(query, [escritorio_id]);
    return res.rows;
  } catch (error) {
    console.error("❌ Erro no SQL (getLancamentosByEscritorio):", error.message);
    throw error;
  }
};