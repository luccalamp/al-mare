# Pipeline de otimizacao de imagens

Implementado em `lib/server/imageOptimization.ts`.

## Entradas aceitas

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/avif`

HEIC/HEIF e bloqueado com a mensagem:

`Esta foto está em HEIC/HEIF. Envie em JPG, PNG ou WebP.`

## Limites

- Tamanho maximo por imagem: 20 MB no upload novo.
- Limite de processamento: 48 megapixels.
- Metadados/EXIF nao sao preservados.
- Orientacao e corrigida por `rotate()`.

## Saidas

Imagem principal:

- Formato preferencial: AVIF.
- Fallback: WebP.
- Largura maxima: 2000 px.
- Qualidade AVIF: 62.
- Qualidade WebP fallback: 78.

Thumbnail:

- Formato preferencial: AVIF.
- Fallback: WebP.
- Largura maxima: 480 px.
- Qualidade AVIF: 50.
- Qualidade WebP fallback: 70.

## Metadata salva em `client_photos`

- `storage_bucket`
- `storage_path`
- `optimized_storage_path`
- `thumbnail_storage_path`
- `mime_type`
- `original_mime_type`
- `tamanho_original_bytes`
- `tamanho_otimizado_bytes`
- `largura`
- `altura`
- `formato_final`
- `original_storage_provider`
- `migration_status`

Na listagem, a galeria usa `thumbnail_url`. Na visualizacao/abertura, usa `url` assinado da imagem otimizada.
