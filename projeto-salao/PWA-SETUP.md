# PWA - Al'maré Saúde Capilar

## Configuração de Progressive Web App

O app agora está configurado como PWA. Quando o usuário adicionar à tela de início no iPhone, ele se comportará como um aplicativo nativo.

### Arquivos criados:

- `public/manifest.json` - Configuração do PWA
- `public/icons/icon-192.png` - Ícone 192x192
- `public/icons/icon-512.png` - Ícone 512x512
- `public/icons/apple-touch-icon.png` - Ícone iOS 180x180

### Meta tags adicionadas:

- `apple-mobile-web-app-capable` - Habilita modo standalone
- `apple-mobile-web-app-status-bar-style` - Status bar translúcida
- `apple-mobile-web-app-title` - Nome curto "Al'maré"
- `theme-color` - Cor #8c5a2d (brand accent)

### Como testar no iPhone:

1. Abrir o site no Safari
2. Tocar no botão "Compartilhar" (ícone de quadrado com seta)
3. Selecionar "Adicionar à Tela de Início"
4. O app aparecerá como um ícone na home screen
5. Ao abrir, funcionará como app nativo (sem barra de endereço)

### Notas:

- Os ícones atuais são cópias do logo-al.png
- Para produção, recomenda-se criar ícones otimizados com fundo sólido
- O modo standalone remove a UI do navegador
- Safe areas do iPhone são respeitadas
