import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Remova ou comente totalmente o bloco SSL abaixo:
  /* ssl: {
    rejectUnauthorized: false
  } */
});

export default pool;