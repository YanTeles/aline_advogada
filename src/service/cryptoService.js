// =============================================================================
// src/services/cryptoService.js
// Serviço de Criptografia - ERP Jurídico
// =============================================================================
// Algoritmo: AES-256-GCM (autenticado — detecta adulteração)
// Chave:      256 bits derivada de variável de ambiente
// IV:         96 bits aleatório por operação (nunca reutilize IV)
// Auth Tag:   128 bits (padrão GCM — valida integridade no decrypt)
//
// Campos sensíveis protegidos:
//   - CPF / CNPJ de contatos
//   - Valores financeiros
//   - Descrições de lançamentos e movimentações
//   - Tokens OAuth (access_token, refresh_token)
//   - Valor da causa de processos
// =============================================================================
// Estrutura no banco (3 colunas BYTEA por campo):
//   campo_encrypted  → ciphertext
//   campo_iv         → initialization vector (96 bits)
//   campo_tag        → authentication tag (128 bits)
// =============================================================================

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const ALGORITHM     = 'aes-256-gcm';
const IV_BYTES      = 12;   // 96 bits — tamanho ideal para GCM
const TAG_BYTES     = 16;   // 128 bits — padrão GCM
const KEY_BYTES     = 32;   // 256 bits

/**
 * Carrega e valida a chave mestra de criptografia do ambiente.
 *
 * Configure no .env:
 *   ENCRYPTION_KEY=<64 caracteres hexadecimais = 32 bytes>
 *
 * Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function carregarChaveMestra() {
    const hexKey = process.env.ENCRYPTION_KEY;

    if (!hexKey) {
        throw new Error('[CryptoService] ENCRYPTION_KEY não definida no ambiente.');
    }

    if (hexKey.length !== KEY_BYTES * 2) {
        throw new Error(
            `[CryptoService] ENCRYPTION_KEY deve ter ${KEY_BYTES * 2} caracteres hex (${KEY_BYTES} bytes).`
        );
    }

    const key = Buffer.from(hexKey, 'hex');

    if (key.length !== KEY_BYTES) {
        throw new Error('[CryptoService] ENCRYPTION_KEY inválida — conversão hex falhou.');
    }

    return key;
}

// Chave carregada uma única vez na inicialização do módulo
const MASTER_KEY = carregarChaveMestra();

// ---------------------------------------------------------------------------
// Funções core: encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Criptografa um valor string usando AES-256-GCM.
 *
 * @param {string} plaintext - Valor em texto claro
 * @returns {{ encrypted: Buffer, iv: Buffer, tag: Buffer }}
 *
 * @example
 * const { encrypted, iv, tag } = encrypt('123.456.789-00');
 * // Salvar os três Buffers como BYTEA no PostgreSQL
 */
export function encrypt(plaintext) {
    if (plaintext === null || plaintext === undefined) {
        return { encrypted: null, iv: null, tag: null };
    }

    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv, {
        authTagLength: TAG_BYTES,
    });

    const encrypted = Buffer.concat([
        cipher.update(String(plaintext), 'utf8'),
        cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return { encrypted, iv, tag };
}

/**
 * Descriptografa um valor usando AES-256-GCM.
 * Lança erro se o Auth Tag não for válido (dados adulterados).
 *
 * @param {Buffer} encrypted  - Ciphertext (coluna campo_encrypted)
 * @param {Buffer} iv         - IV (coluna campo_iv)
 * @param {Buffer} tag        - Auth Tag (coluna campo_tag)
 * @returns {string|null} Texto original ou null se inputs forem nulos
 *
 * @throws {Error} Se a autenticação GCM falhar (dados corrompidos/adulterados)
 */
export function decrypt(encrypted, iv, tag) {
    if (!encrypted || !iv || !tag) return null;

    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv, {
        authTagLength: TAG_BYTES,
    });

    decipher.setAuthTag(tag);

    try {
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    } catch {
        throw new Error(
            '[CryptoService] Falha na autenticação GCM — dados possivelmente adulterados.'
        );
    }
}

// ---------------------------------------------------------------------------
// Helpers para integração com PostgreSQL (pg / node-postgres)
// ---------------------------------------------------------------------------

/**
 * Prepara um campo criptografado para INSERT/UPDATE no banco.
 * Retorna um objeto com as 3 propriedades prontas para bind de parâmetros.
 *
 * @param {string} fieldPrefix - Prefixo do campo (ex: 'cpf_cnpj', 'valor', 'descricao')
 * @param {string} value       - Valor a criptografar
 * @returns {Object} { `${fieldPrefix}_encrypted`, `${fieldPrefix}_iv`, `${fieldPrefix}_tag` }
 *
 * @example
 * const campos = encryptField('cpf_cnpj', '123.456.789-00');
 * // { cpf_cnpj_encrypted: Buffer, cpf_cnpj_iv: Buffer, cpf_cnpj_tag: Buffer }
 * await db.query(
 *   'INSERT INTO contatos (cpf_cnpj_encrypted, cpf_cnpj_iv, cpf_cnpj_tag) VALUES ($1,$2,$3)',
 *   [campos.cpf_cnpj_encrypted, campos.cpf_cnpj_iv, campos.cpf_cnpj_tag]
 * );
 */
export function encryptField(fieldPrefix, value) {
    const { encrypted, iv, tag } = encrypt(value);
    return {
        [`${fieldPrefix}_encrypted`]: encrypted,
        [`${fieldPrefix}_iv`]:        iv,
        [`${fieldPrefix}_tag`]:       tag,
    };
}

/**
 * Descriptografa um campo a partir de uma row do banco.
 *
 * @param {Object} row         - Row retornada pelo pg
 * @param {string} fieldPrefix - Prefixo do campo (ex: 'cpf_cnpj', 'valor')
 * @returns {string|null}
 *
 * @example
 * const cpf = decryptField(row, 'cpf_cnpj'); // '123.456.789-00'
 */
export function decryptField(row, fieldPrefix) {
    return decrypt(
        row[`${fieldPrefix}_encrypted`],
        row[`${fieldPrefix}_iv`],
        row[`${fieldPrefix}_tag`]
    );
}

// ---------------------------------------------------------------------------
// Helper: sanitizar rows completas do banco
// ---------------------------------------------------------------------------

/**
 * Remove colunas _encrypted/_iv/_tag e substitui pelos valores descriptografados.
 * Use antes de retornar dados pela API.
 *
 * @param {Object}   row           - Row bruta do banco
 * @param {string[]} fieldPrefixes - Lista de prefixos a descriptografar
 * @returns {Object} Row sanitizada (sem colunas de criptografia)
 *
 * @example
 * const contato = sanitizeRow(row, ['cpf_cnpj']);
 * // contato.cpf_cnpj = '123.456.789-00'
 * // Sem cpf_cnpj_encrypted, cpf_cnpj_iv, cpf_cnpj_tag
 */
export function sanitizeRow(row, fieldPrefixes) {
    if (!row) return null;

    const result = { ...row };

    for (const prefix of fieldPrefixes) {
        result[prefix] = decryptField(row, prefix);
        delete result[`${prefix}_encrypted`];
        delete result[`${prefix}_iv`];
        delete result[`${prefix}_tag`];
    }

    return result;
}

/**
 * Sanitiza um array de rows.
 *
 * @param {Object[]} rows
 * @param {string[]} fieldPrefixes
 * @returns {Object[]}
 */
export function sanitizeRows(rows, fieldPrefixes) {
    return rows.map((row) => sanitizeRow(row, fieldPrefixes));
}

// ---------------------------------------------------------------------------
// Hashing de senhas (Argon2id)
// ---------------------------------------------------------------------------
// Instale: npm install argon2
// Docs: https://github.com/ranisalt/node-argon2

/**
 * Gera hash Argon2id de uma senha.
 *
 * @param {string} senha
 * @returns {Promise<string>} Hash para armazenar no banco
 */
export async function hashSenha(senha) {
    const argon2 = await import('argon2');
    return argon2.hash(senha, {
        type:        argon2.argon2id,
        memoryCost:  65536,  // 64 MB
        timeCost:    3,      // 3 iterações
        parallelism: 4,
    });
}

/**
 * Verifica senha contra hash Argon2id.
 *
 * @param {string} hash   - Hash armazenado no banco
 * @param {string} senha  - Senha fornecida pelo usuário
 * @returns {Promise<boolean>}
 */
export async function verificarSenha(hash, senha) {
    const argon2 = await import('argon2');
    return argon2.verify(hash, senha);
}

// ---------------------------------------------------------------------------
// Utilitário: geração de chave (uso no setup)
// ---------------------------------------------------------------------------

/**
 * Gera uma nova ENCRYPTION_KEY de 32 bytes aleatórios.
 * Execute uma vez e salve no .env. Nunca altere em produção.
 *
 * @returns {string} 64 caracteres hexadecimais
 */
export function gerarChaveMestra() {
    return crypto.randomBytes(KEY_BYTES).toString('hex');
}

// ---------------------------------------------------------------------------
// Exemplos de uso (remova em produção)
// ---------------------------------------------------------------------------
//
// INSERINDO um contato com CPF criptografado:
// -------------------------------------------
// import { encryptField } from './cryptoService.js';
//
// const cpfFields = encryptField('cpf_cnpj', '123.456.789-00');
//
// await db.query(
//   `INSERT INTO contatos
//    (id, escritorio_id, categoria, nome, cpf_cnpj_encrypted, cpf_cnpj_iv, cpf_cnpj_tag)
//    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
//   [uuidv4(), escritorioId, 'cliente', 'João Silva',
//    cpfFields.cpf_cnpj_encrypted,
//    cpfFields.cpf_cnpj_iv,
//    cpfFields.cpf_cnpj_tag]
// );
//
// LENDO e descriptografando:
// --------------------------
// import { sanitizeRow } from './cryptoService.js';
//
// const { rows } = await db.query('SELECT * FROM contatos WHERE id = $1', [id]);
// const contato = sanitizeRow(rows[0], ['cpf_cnpj']);
// console.log(contato.cpf_cnpj); // '123.456.789-00'
//
// LANÇAMENTO FINANCEIRO (valor + descrição):
// ------------------------------------------
// const valorFields = encryptField('valor', '1500.00');
// const descFields  = encryptField('descricao', 'Honorários advocatícios');
//
// await db.query(
//   `INSERT INTO lancamentos_financeiros
//    (id, escritorio_id, tipo, status,
//     valor_encrypted, valor_iv, valor_tag,
//     descricao_encrypted, descricao_iv, descricao_tag,
//     data_vencimento)
//    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
//   [uuidv4(), escritorioId, 'RECEITA', 'EM_ABERTO',
//    valorFields.valor_encrypted, valorFields.valor_iv, valorFields.valor_tag,
//    descFields.descricao_encrypted, descFields.descricao_iv, descFields.descricao_tag,
//    '2025-12-31']
// );

export default {
    encrypt,
    decrypt,
    encryptField,
    decryptField,
    sanitizeRow,
    sanitizeRows,
    hashSenha,
    verificarSenha,
    gerarChaveMestra,
};
