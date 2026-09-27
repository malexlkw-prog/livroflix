import 'dotenv/config';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import express from 'express';
import cors from 'cors';
import multer from 'multer';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const GITHUB_REPO = process.env.GITHUB_REPO || 'malexlkw-prog/livroflix';
const GITHUB_RELEASE_TAG = process.env.GITHUB_RELEASE_TAG || 'livroflix-pdfs';
const GITHUB_RELEASE_NAME =
  process.env.GITHUB_RELEASE_NAME || 'LIVROFLIX — Catálogo de PDFs';
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'livroflix-b1978';
const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID ||
  'ai-studio-livroflix-6301ff67-f140-45b7-95b7-2395f073ee5b';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'malexlkw@gmail.com')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedGoogleCerts = null;
let cachedGoogleCertsExpiresAt = 0;

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

function sanitizeAsciiSegment(value) {
  const asciiOnly = Array.from(String(value || '').normalize('NFD'))
    .filter((char) => char.charCodeAt(0) <= 127)
    .join('');

  return asciiOnly
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/[.]+/g, '.')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
}

function buildSafePdfFileName(originalName, bookId) {
  const rawName = String(originalName || 'livro.pdf')
    .split('/')
    .pop()
    .split(':')
    .pop();

  const withoutExt = rawName.toLowerCase().endsWith('.pdf')
    ? rawName.slice(0, -4)
    : rawName;

  const safeBase = sanitizeAsciiSegment(withoutExt) || 'documento';

  if (bookId !== undefined && bookId !== null && String(bookId).trim() !== '') {
    const safeBookId = sanitizeAsciiSegment(bookId).replace(/[.]+/g, '-');
    if (safeBookId) {
      if (safeBase.toLowerCase().startsWith(`${safeBookId.toLowerCase()}-`)) {
        return `${safeBase}.pdf`;
      }
      return `${safeBookId}-${safeBase}.pdf`;
    }
  }

  return `${safeBase}.pdf`;
}

function hasValidPdfSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) {
    return false;
  }
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

async function getGooglePublicCerts() {
  const now = Date.now();
  if (cachedGoogleCerts && now < cachedGoogleCertsExpiresAt) {
    return cachedGoogleCerts;
  }

  const resp = await fetch(GOOGLE_CERTS_URL);
  if (!resp.ok) {
    throw new Error('Falha ao obter certificados públicos do Firebase Auth.');
  }

  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  cachedGoogleCerts = await resp.json();
  cachedGoogleCertsExpiresAt = now + maxAgeSeconds * 1000;
  return cachedGoogleCerts;
}

async function verifyFirebaseIdToken(idToken) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!header || header.alg !== 'RS256' || !header.kid || !payload) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  if (
    typeof payload.exp !== 'number' ||
    payload.exp <= nowSeconds ||
    typeof payload.iat !== 'number' ||
    payload.iat > nowSeconds + 300 ||
    payload.aud !== FIREBASE_PROJECT_ID ||
    payload.iss !== expectedIssuer ||
    typeof payload.sub !== 'string' ||
    !payload.sub.trim()
  ) {
    return null;
  }

  const certs = await getGooglePublicCerts();
  const cert = certs ? certs[header.kid] : null;
  if (!cert) {
    return null;
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const signatureBuffer = Buffer.from(signatureB64, 'base64url');
  const isSignatureValid = verifier.verify(cert, signatureBuffer);
  if (!isSignatureValid) {
    return null;
  }

  return payload;
}

async function isFirebaseUserAdmin(tokenPayload, rawIdToken) {
  const email =
    typeof tokenPayload.email === 'string'
      ? tokenPayload.email.trim().toLowerCase()
      : '';

  if (email && tokenPayload.email_verified === true && ADMIN_EMAILS.includes(email)) {
    return true;
  }

  // Fallback: verifica se o documento /users/{uid} no Firestore tem role === 'admin'
  try {
    const firestoreDocUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/${encodeURIComponent(
      FIRESTORE_DATABASE_ID
    )}/documents/users/${encodeURIComponent(tokenPayload.sub)}`;

    const docResp = await fetch(firestoreDocUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${rawIdToken}`,
      },
    });

    if (docResp.ok) {
      const docData = await docResp.json();
      const roleValue = docData?.fields?.role?.stringValue;
      if (roleValue === 'admin') {
        return true;
      }
    }
  } catch {
    // Ignora falha na verificação secundária
  }

  return false;
}

async function requireAdminApiKey(req, res, next) {
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

  // 1. Verifica chave administrativa direta (se configurada no ambiente)
  const configuredKey = process.env.LIVROFLIX_ADMIN_API_KEY;
  if (configuredKey && configuredKey.trim() !== '') {
    const expectedBuffer = Buffer.from(configuredKey.trim(), 'utf8');
    const providedBuffer = Buffer.from(providedToken, 'utf8');

    if (
      expectedBuffer.length === providedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return next();
    }
  }

  // 2. Verifica sessão administrativa por e-mail autorizado (fallback quando popup OAuth do domínio está bloqueado)
  if (providedToken.startsWith('admin-email:')) {
    const adminEmail = providedToken
      .slice('admin-email:'.length)
      .trim()
      .toLowerCase();
    if (adminEmail && ADMIN_EMAILS.includes(adminEmail)) {
      req.adminUser = {
        uid: `admin-${adminEmail}`,
        email: adminEmail,
      };
      return next();
    }
  }

  // 3. Verifica Firebase Authentication ID Token do administrador logado no AdminDashboard
  try {
    const firebasePayload = await verifyFirebaseIdToken(providedToken);
    if (firebasePayload) {
      const isAdmin = await isFirebaseUserAdmin(firebasePayload, providedToken);
      if (isAdmin) {
        req.adminUser = {
          uid: firebasePayload.sub,
          email: firebasePayload.email || '',
        };
        return next();
      }
      return res.status(403).json({
        ok: false,
        error: 'Acesso negado. O usuário autenticado não possui permissão de administrador.',
      });
    }
  } catch {
    // Continua para resposta padrão de acesso negado
  }

  if (!configuredKey || configuredKey.trim() === '') {
    return res.status(403).json({
      ok: false,
      error: 'Acesso negado. Token de autenticação inválido ou expirado.',
    });
  }

  return res.status(403).json({
    ok: false,
    error: 'Acesso negado. Credencial de administração inválida.',
  });
}

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

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'livroflix-api',
  });
});

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'livroflix-b1978';
const FIREBASE_DATABASE_ID =
  process.env.FIREBASE_DATABASE_ID ||
  'ai-studio-livroflix-6301ff67-f140-45b7-95b7-2395f073ee5b';

async function fetchFirestoreDocument(collectionName, docId, bearerToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIREBASE_PROJECT_ID
  )}/databases/${encodeURIComponent(
    FIREBASE_DATABASE_ID
  )}/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(
    docId
  )}`;
  const headers = {
    Accept: 'application/json',
  };
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  const resp = await fetch(url, { method: 'GET', headers });
  if (!resp.ok) {
    return null;
  }
  return await resp.json();
}

app.get('/api/premium/download-book', async (req, res) => {
  try {
    const bookId = String(req.query.bookId || '').trim();
    const uid = String(req.query.uid || '').trim();
    const authHeader = String(req.headers.authorization || '').trim();
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if (!bookId || !uid) {
      return res.status(400).json({
        ok: false,
        error: 'Parâmetros de livro ou usuário ausentes.',
      });
    }

    // 1. Verificar assinatura Premium do usuário no Firestore (users/{uid} ou public_profiles/{uid})
    let isPremiumVerified = false;
    const userDoc = await fetchFirestoreDocument('users', uid, bearerToken);
    if (userDoc?.fields?.premium?.booleanValue === true) {
      isPremiumVerified = true;
    } else {
      const publicProfileDoc = await fetchFirestoreDocument(
        'public_profiles',
        uid,
        ''
      );
      if (publicProfileDoc?.fields?.premium?.booleanValue === true) {
        isPremiumVerified = true;
      }
    }

    if (!isPremiumVerified) {
      return res.status(403).json({
        ok: false,
        error:
          'Este recurso é exclusivo para assinantes LIVROFLIX Premium.',
      });
    }

    // 2. Verificar disponibilidade e permissão de download do livro no Firestore
    const bookDoc = await fetchFirestoreDocument('books', bookId, '');
    const fields = bookDoc?.fields;
    if (!fields) {
      return res.status(404).json({
        ok: false,
        error: 'Livro não encontrado no catálogo.',
      });
    }

    const status = fields.status?.stringValue || 'ativo';
    const allowDownload =
      fields.allowDownload?.booleanValue !== undefined
        ? fields.allowDownload.booleanValue
        : true;

    if (status !== 'ativo' || allowDownload === false) {
      return res.status(403).json({
        ok: false,
        error: 'Este livro não possui permissão para download.',
      });
    }

    const nestedPdfUrl =
      fields.readingOptions?.mapValue?.fields?.pdf?.mapValue?.fields?.url
        ?.stringValue || '';
    const directPdfUrl = fields.pdfUrl?.stringValue || '';
    const targetUrl = (nestedPdfUrl || directPdfUrl).trim();

    if (!targetUrl) {
      return res.status(404).json({
        ok: false,
        error: 'Este livro não possui arquivo PDF disponível para download.',
      });
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return res.status(400).json({
        ok: false,
        error: 'URL do arquivo PDF inválida.',
      });
    }

    const isAllowedHost =
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'github.com' ||
        parsed.hostname.endsWith('.githubusercontent.com'));

    if (!isAllowedHost) {
      return res.status(400).json({
        ok: false,
        error: 'Origem não autorizada para download de PDF.',
      });
    }

    const upstreamHeaders = {
      'User-Agent': 'livroflix-api-premium-downloader',
      Accept: 'application/pdf,application/octet-stream,*/*',
    };

    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: upstreamHeaders,
    });

    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status || 502).json({
        ok: false,
        error: `Falha ao obter o arquivo PDF para download (HTTP ${upstream.status}).`,
      });
    }

    const bookTitle = fields.titulo?.stringValue || bookId || 'livro';
    const sanitizedTitle = bookTitle
      .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '')
      .trim();
    const safeDownloadName = `${sanitizedTitle || 'livro'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(safeDownloadName)}"`
    );
    res.setHeader('Cache-Control', 'private, no-store');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Erro interno ao processar o download Premium.',
    });
  }
});

app.get('/api/github/pdf-stream', async (req, res) => {
  try {
    const targetUrl = String(req.query.url || '').trim();
    if (!targetUrl) {
      return res.status(400).json({
        ok: false,
        error: 'Parâmetro url ausente.',
      });
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return res.status(400).json({
        ok: false,
        error: 'URL inválida.',
      });
    }

    const isAllowedHost =
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'github.com' ||
        parsed.hostname.endsWith('.githubusercontent.com'));

    if (!isAllowedHost) {
      return res.status(400).json({
        ok: false,
        error: 'Origem não autorizada para leitura de PDF.',
      });
    }

    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'livroflix-api-pdf-reader',
        Accept: 'application/pdf,application/octet-stream,*/*',
      },
    });

    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status || 502).json({
        ok: false,
        error: `Falha ao obter o PDF remoto (HTTP ${upstream.status}).`,
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Erro interno ao transmitir o PDF.',
    });
  }
});

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

      const release = await getOrCreateRelease(token);

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

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
});

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
