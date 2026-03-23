import { 
    PutObjectCommand, 
    GetObjectCommand, 
    DeleteObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3Client from '../config/storage.js';
import { v4 as uuidv4 } from 'uuid';

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

/**
 * Faz o upload de um arquivo para o bucket R2.
 * * @param {Object} file - Objeto de arquivo do Multer (file.buffer, file.originalname, etc)
 * @param {string} folder - Pasta destino dentro do bucket (ex: 'peticoes', 'documentos-clientes')
 * @returns {Promise<Object>} Dados do arquivo salvo (key, nome)
 */
export async function uploadArquivo(file, folder = 'geral') {
    if (!file || !file.buffer) {
        throw new Error('[StorageService] Nenhum conteúdo de arquivo fornecido.');
    }

    // Gera um nome único mantendo a extensão original para evitar sobreposição
    const extensao = file.originalname.split('.').pop();
    const key = `${folder}/${uuidv4()}.${extensao}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype, // Importante para o navegador abrir o PDF corretamente
    });

    await s3Client.send(command);

    return {
        key, // Salve esta KEY no seu banco de dados na tabela de processos
        nome_original: file.originalname,
        tamanho: file.size
    };
}

/**
 * Gera um link temporário assinado para visualização.
 * Como advogada, a Aline precisa que os documentos sejam privados.
 * Este link expira em 1 hora (3600 segundos).
 * * @param {string} key - A chave (caminho) do arquivo salva no banco.
 * @returns {Promise<string>} URL temporária para o Front-end.
 */
export async function obterLinkTemporario(key) {
    if (!key) return null;

    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    // Gera a URL assinada. Se alguém tentar acessar após 1h, o link falha.
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Exclui um arquivo permanentemente do R2.
 * * @param {string} key - Chave do arquivo no bucket.
 */
export async function excluirArquivo(key) {
    if (!key) return;

    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    return await s3Client.send(command);
}

export default {
    uploadArquivo,
    obterLinkTemporario,
    excluirArquivo
};