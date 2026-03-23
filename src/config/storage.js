import { S3Client } from '@aws-sdk/client-s3';

// Variáveis extraídas do seu .env
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

/**
 * Cliente S3 configurado para o Cloudflare R2.
 * O R2 usa a região 'auto' e o endpoint baseado no seu ID de conta.
 */
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

export default s3Client;