import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

// No seu src/config/database.js, mude a linha da connectionString para:
const pool = new Pool({
  connectionString: "postgresql://postgres:1234@127.0.0.1:5432/aline_advogada",
});

export default pool;