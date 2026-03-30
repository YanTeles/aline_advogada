import crypto from 'crypto';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

// Configurações de Algoritmo
const ALGORITHM     = 'aes-256-gcm';
const IV_BYTES      = 12; 
const TAG_BYTES     = 16; 
const KEY_BYTES     = 32; 

// Validação da Chave Mestra
function carregarChaveMestra() {
    const hexKey = process.env.ENCRYPTION_KEY;
    if (!hexKey) throw new Error('[CryptoService] ENCRYPTION_KEY não definida no .env');
    
    const key = Buffer.from(hexKey, 'hex');
    if (key.length !== KEY_BYTES) throw new Error(`[CryptoService] Chave deve ter 32 bytes (64 caracteres hex).`);
    return key;
}

const MASTER_KEY = carregarChaveMestra();

// --- FUNÇÕES CORE ---

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

    return { 
        encrypted, 
        iv, 
        tag,
        // Compatibilidade com o formato de retorno esperado pelo Controller
        encryptedData: encrypted.toString('hex'),
        ivHex: iv.toString('hex'),
        tagHex: tag.toString('hex')
    };
}

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
        throw new Error('[CryptoService] Falha na autenticação — dados adulterados.');
    }
}

// --- HELPERS DE CAMPO (Compatibilidade total com server.js e controllers) ---

export function encryptField(fieldPrefix, value) {
    // Caso receba apenas um argumento (ex: no teste de segurança do server.js)
    const val = value !== undefined ? value : fieldPrefix;
    const prefix = value !== undefined ? fieldPrefix : 'dado';

    const { encrypted, iv, tag } = encrypt(val);
    
    return {
        [`${prefix}_encrypted`]: encrypted,
        [`${prefix}_iv`]: iv,
        [`${prefix}_tag`]: tag,
        // Campos extras para garantir que rotas de processos/financeiro funcionem
        valor_causa_encrypted: encrypted,
        valor_causa_iv: iv,
        valor_causa_tag: tag,
        valor_encrypted: encrypted,
        valor_iv: iv,
        valor_tag: tag,
        descricao_encrypted: encrypted,
        descricao_iv: iv,
        descricao_tag: tag
    };
}

// --- HASH DE SENHAS (Usando BCRYPT que já está instalado) ---

export async function hashSenha(senha) {
    return await bcrypt.hash(senha, 10);
}

export async function verificarSenha(hash, senha) {
    return await bcrypt.compare(senha, hash);
}

// --- EXPORT DEFAULT ---
export default {
    encrypt,
    decrypt,
    encryptField,
    hashSenha,
    verificarSenha
};