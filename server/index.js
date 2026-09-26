import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Configuração de CORS para permitir requisições do frontend LIVROFLIX
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : '*';

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));

// Rota de verificação de saúde do serviço (Health Check)
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'livroflix-api',
  });
});

// Rota não encontrada (404)
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// Middleware global de tratamento básico de erros
app.use((err, _req, res, _next) => {
  console.error('[livroflix-api] Erro interno:', err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    ok: false,
    error: err.message || 'Erro interno no servidor LIVROFLIX API.',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[livroflix-api] Servidor rodando na porta ${PORT}`);
});
