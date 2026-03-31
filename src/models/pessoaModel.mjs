import pool from '../config/database.js';

export const createPessoa = async (dados) => {
    const { 
        escritorio_id, nome_enc, nome_iv, nome_tag,
        doc_enc, doc_iv, doc_tag, email, telefone, tipo 
    } = dados;

    const query = `
        INSERT INTO pessoas (
            escritorio_id, nome_encrypted, nome_iv, nome_tag,
            cpf_cnpj_encrypted, cpf_cnpj_iv, cpf_cnpj_tag,
            email, telefone, tipo_pessoa
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id;
    `;

    const values = [escritorio_id, nome_enc, nome_iv, nome_tag, doc_enc, doc_iv, doc_tag, email, telefone, tipo];
    const res = await pool.query(query, values);
    return res.rows[0];
};