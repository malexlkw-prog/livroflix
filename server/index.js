import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import multer from 'multer';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Variáveis de ambiente da integração com GitHub Releases (sem segredos fixos no código)
const GITHUB_REPO = process.env.GITHUB_REPO || 'malexlkw-prog/livroflix';
const GITHUB_RELEASE_TAG = process.env.GITHUB_RELEASE_TAG || 'livroflix-pdfs';
const GITHUB_RELEASE_NAME =
  process.env.GITHUB_RELEASE_NAME || 'LIVROFLIX — Catálogo de PDFs';
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // Limite máximo de 50 MB

// Configuração de CORS para permitir requisições do frontend LIVROFLIX
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : '*';

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));

// Configuração do Multer usando memoryStorage, limite de 50 MB e validação de PDF
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PDF_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const isMimePdf = file.mimetype === 'application/pdf';
    const isExtPdf = String(file.originalname || '')
      .toLowerCase()
      .endsWith('.pdf');

    if (!isMimePdf || !isExtPdf) {
      const error = new Error(
        'Arquivo inválido. Apenas arquivos PDF (.pdf) com MIME type application/pdf são permitidos.'
      );
      error.status = 400;
      return cb(error);
    }

    cb(null, true);
  },
});

/**
 * Gera um nome de arquivo seguro, sem path traversal, caracteres perigosos ou espaços problemáticos.
 * Se bookId existir, inclui o bookId como parte do nome do arquivo.
 */
function buildSafePdfFileName(originalName, bookId) {
  const baseNameWithoutDirs = String(originalName || 'livro.pdf')
    .replace(/^.*[\\/]/, '') // Remove qualquer tentativa de path traversal
    .replace(/\.pdf$/i, ''); // Remove a extensão temporariamente para sanitizar o nome base

  const safeBase = baseNameWithoutDirs
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-zA-Z0-9._-]+/g, '-') // Substitui espaços e caracteres especiais por hífen
    .replace(/\.+/g, '.') // Evita múltiplos pontos seguidos (..)
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  const finalBase = safeBase || 'documento';

  if (bookId !== undefined && bookId !== null && String(bookId).trim() !== '') {
    const safeBookId = String(bookId)
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (safeBookId) {
      if (finalBase.toLowerCase().startsWith(`${safeBookId.toLowerCase()}-`)) {
        return `${finalBase}.pdf`;
      }
      return `${safeBookId}-${finalBase}.pdf`;
    }
  }

  return `${finalBase}.pdf`;
}

/**
 * Verifica a assinatura real do arquivo (magic bytes), que deve começar com %PDF-
 */
function hasValidPdfSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) {
    return false;
  }
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

/**
 * Middleware de autenticação administrativa via Authorization: Bearer <LIVROFLIX_ADMIN_API_KEY>
 */
function requireAdminApiKey(req, res, next) {
  const configuredKey = process.env.LIVROFLIX_ADMIN_API_KEY;

  if (!configuredKey || configuredKey.trim() === '') {
    return res.status(503).json({
      ok: false,
      error:
        'Serviço de upload indisponível: LIVROFLIX_ADMIN_API_KEY não está configurada no servidor.',
    });
  }

  const authHeader = req.headers.authorization;
  if (
    !authHeader ||
    typeof authHeader !== 'string' ||
    !authHeader.startsWith('Bearer ')
  ) {
    return res.status(401).json({
      ok: false,
      error: 'Não autorizado. Header Authorization Bearer ausente.',
    });
  }

  const providedToken = authHeader.slice('Bearer '.length).trim();
  if (!providedToken) {
    return res.status(401).json({
      ok: false,
      error: 'Não autorizado. Token Bearer vazio.',
    });
  }

  const expectedBuffer = Buffer.from(configuredKey.trim(), 'utf8');
  const providedBuffer = Buffer.from(providedToken, 'utf8');

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return res.status(403).json({
      ok: false,
      error: 'Acesso negado. Chave de administração inválida.',
    });
  }

  next();
}

/**
 * Extrai uma mensagem segura de erro da resposta do GitHub sem expor tokens ou segredos
 */
async function parseGitHubErrorMessage(response, fallbackContext) {
  try {
    const data = await response.json();
    if (data && typeof data.message === 'string') {
      return `${fallbackContext} (GitHub HTTP ${response.status}: ${data.message})`;
    }
  } catch {
    // Ignora erro de parse JSON
  }
  return `${fallbackContext} (GitHub HTTP ${response.status}).`;
}

/**
 * Procura um Release com a tag GITHUB_RELEASE_TAG ou cria o Release caso não exista
 */
async function getOrCreateRelease(githubToken) {
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'livroflix-api',
  };

  const getUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${encodeURIComponent(
    GITHUB_RELEASE_TAG
  )}`;

  const getResp = await fetch(getUrl, {
    method: 'GET',
    headers,
  });

  if (getResp.ok) {
    return await getResp.json();
  }

  if (getResp.status !== 404) {
    const message = await parseGitHubErrorMessage(
      getResp,
      `Falha ao consultar a Release "${GITHUB_RELEASE_TAG}"`
    );
    const error = new Error(message);
    error.status = 502;
    throw error;
  }

  // Se não existir (404), cria a Release dedicada
  const createUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
  const createResp = await fetch(createUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tag_name: GITHUB_RELEASE_TAG,
      name: GITHUB_RELEASE_NAME,
      body: 'Release dedicada ao armazenamento dos arquivos PDF do catálogo LIVROFLIX.',
      draft: false,
      prerelease: false,
    }),
  });

  if (!createResp.ok) {
    const message = await parseGitHubErrorMessage(
      createResp,
      `Falha ao criar a Release "${GITHUB_RELEASE_TAG}"`
    );
    const error = new Error(message);
    error.status = 502;
    throw error;
  }

  return await createResp.json();
}

// ============================================================================
// ROTAS DA API
// ============================================================================

// Rota de verificação de saúde do serviço (Health Check)
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'livroflix-api',
  });
});

// Rota protegida para receber um PDF e enviá-lo para o GitHub Releases
app.post(
  '/api/github/upload-pdf',
  requireAdminApiKey,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const githubToken = process.env.GITHUB_TOKEN;
      if (!githubToken || githubToken.trim() === '') {
        return res.status(503).json({
          ok: false,
          error:
            'Serviço de upload indisponível: GITHUB_TOKEN não está configurado no servidor.',
        });
      }

      const file = req.file;
      if (!file || !file.buffer) {
        return res.status(400).json({
          ok: false,
          error:
            'Nenhum arquivo enviado. Envie um arquivo PDF no campo multipart "file".',
        });
      }

      // Verifica a assinatura real do arquivo (%PDF-)
      if (!hasValidPdfSignature(file.buffer)) {
        return res.status(400).json({
          ok: false,
          error:
            'Arquivo inválido. O conteúdo do arquivo não possui assinatura PDF (%PDF-) válida.',
        });
      }

      const bookId = req.body?.bookId;
      const safeFileName = buildSafePdfFileName(file.originalname, bookId);
      const token = githubToken.trim();

      // 1. Procura ou cria a Release com a tag definida em GITHUB_RELEASE_TAG
      const release = await getOrCreateRelease(token);

      // 2. Procura no Release um asset com o mesmo nome e, se existir, apaga antes de enviar o novo
      const existingAsset = Array.isArray(release.assets)
        ? release.assets.find((asset) => asset.name === safeFileName)
        : null;

      if (existingAsset && existingAsset.id) {
        const deleteUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${existingAsset.id}`;
        const deleteResp = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'livroflix-api',
          },
        });

        if (!deleteResp.ok && deleteResp.status !== 404) {
          const message = await parseGitHubErrorMessage(
            deleteResp,
            `Falha ao remover asset anterior "${safeFileName}"`
          );
          return res.status(502).json({
            ok: false,
            error: message,
          });
        }
      }

      // 3. Envia o novo PDF para uploads.github.com
      const uploadUrl = `https://uploads.github.com/repos/${GITHUB_REPO}/releases/${
        release.id
      }/assets?name=${encodeURIComponent(safeFileName)}`;

      const uploadResp = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'livroflix-api',
          'Content-Type': 'application/pdf',
          'Content-Length': String(file.buffer.length),
        },
        body: file.buffer,
      });

      if (!uploadResp.ok) {
        const message = await parseGitHubErrorMessage(
          uploadResp,
          'Falha ao enviar o PDF para o GitHub Releases'
        );
        return res.status(502).json({
          ok: false,
          error: message,
        });
      }

      const uploadedAsset = await uploadResp.json();

      return res.status(200).json({
        ok: true,
        pdfUrl: uploadedAsset.browser_download_url,
        assetId: uploadedAsset.id,
        assetName: uploadedAsset.name || safeFileName,
        releaseId: release.id,
        releaseTag: release.tag_name || GITHUB_RELEASE_TAG,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Rota não encontrada (404)
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// Middleware global de tratamento de erros
app.use((err, _req, res, _next) => {
  console.error('[livroflix-api] Erro interno:', err.message || 'Erro desconhecido');

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        ok: false,
        error: 'O arquivo PDF excede o limite máximo permitido de 50 MB.',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        ok: false,
        error:
          'Campo de arquivo inválido. Envie apenas um único PDF no campo multipart "file".',
      });
    }
    return res.status(400).json({
      ok: false,
      error: `Erro no upload multipart: ${err.message}`,
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    ok: false,
    error: err.message || 'Erro interno no servidor LIVROFLIX API.',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[livroflix-api] Servidor rodando na porta ${PORT}`);
});
