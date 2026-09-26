import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';

function pdfStreamProxyPlugin(): Plugin {
  const handlePdfStream = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ) => {
    if (!req.url || !req.url.startsWith('/api/github/pdf-stream')) {
      return next();
    }

    try {
      const reqUrl = new URL(req.url, 'http://localhost');
      const targetUrl = (reqUrl.searchParams.get('url') || '').trim();

      if (!targetUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: 'Parâmetro url ausente.' }));
        return;
      }

      const parsed = new URL(targetUrl);
      const isAllowedHost =
        parsed.protocol === 'https:' &&
        (parsed.hostname === 'github.com' ||
          parsed.hostname.endsWith('.githubusercontent.com'));

      if (!isAllowedHost) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            ok: false,
            error: 'URL não permitida para leitura de PDF.',
          })
        );
        return;
      }

      const upstream = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'livroflix-pdf-reader',
          Accept: 'application/pdf,application/octet-stream,*/*',
        },
      });

      if (!upstream.ok || !upstream.body) {
        res.statusCode = upstream.status || 502;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            ok: false,
            error: `Falha ao carregar PDF remoto (HTTP ${upstream.status}).`,
          })
        );
        return;
      }

      res.statusCode = 200;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const contentLength = upstream.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      Readable.fromWeb(upstream.body as never).pipe(res);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Erro ao transmitir o PDF.',
        })
      );
    }
  };

  return {
    name: 'livroflix-pdf-stream-proxy',
    configureServer(server) {
      server.middlewares.use(handlePdfStream);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handlePdfStream);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pdfStreamProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

