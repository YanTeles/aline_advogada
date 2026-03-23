import { 
    S3Client, 
    PutObjectCommand, 
    GetObjectCommand, 
    DeleteObjectCommand 
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// Configuração do Cliente R2 (Cloudflare)
const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET = process.env.R2_BUCKET_NAME;

/**
 * Gera uma chave única para o arquivo no storage para evitar sobreposição
 */
const gerarR2Key = (escritorioId, processoId, nomeOriginal) => {
    const timestamp = Date.now();
    return `${escritorioId}/${processoId}/${timestamp}-${nomeOriginal}`;
};

/**
 * Gera URL para o Frontend fazer upload direto para o R2 (Segurança e Performance)
 */
export async function gerarUrlUpload(escritorioId, processoId, nomeOriginal, contentType) {
    const key = gerarR2Key(escritorioId, processoId, nomeOriginal);

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
    });

    // A URL expira em 15 minutos (900 segundos)
    const url = await getSignedUrl(r2Client, command, { expiresIn: 900 });

    return {
        url_upload: url,
        key_arquivo: key
    };
}

/**
 * Gera URL temporária para visualização/download de um documento
 */
export async function obterUrlArquivo(escritorioId, arquivoId) {
    // Busca a chave do arquivo no banco de dados
    const { rows } = await db.query(
        'SELECT nome_r2 FROM arquivos WHERE id = $1 AND escritorio_id = $2',
        [arquivoId, escritorioId]
    );

    if (!rows.length) throw new Error('Arquivo não encontrado no sistema.');

    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: rows[0].nome_r2,
    });

    // URL de visualização expira em 1 hora
    return await getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

/**
 * Remove o arquivo do Cloudflare R2 e o registo do banco de dados
 */
export async function eliminarArquivo(escritorioId, arquivoId) {
    const { rows } = await db.query(
        'SELECT nome_r2 FROM arquivos WHERE id = $1 AND escritorio_id = $2',
        [arquivoId, escritorioId]
    );

    if (rows.length > 0) {
        // 1. Remove do Cloudflare
        await r2Client.send(new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: rows[0].nome_r2
        }));

        // 2. Remove do Banco
        await db.query('DELETE FROM arquivos WHERE id = $1', [arquivoId]);
    }
    
    return { sucesso: true };
}

export default { gerarUrlUpload, obterUrlArquivo, eliminarArquivo };