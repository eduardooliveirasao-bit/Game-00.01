# V94 — Visual Resource Pipeline

Esta versão adiciona uma camada de análise local para os arquivos binários enviados como referência.

## Resultado da inspeção

| Arquivo | Tamanho bruto | Resultado da leitura |
|---|---:|---|
| 16ceadfbd18d8d9042567d31415807c6 | 6.866.807 bytes | zlib → CWS v9 |
| data1 | 47 bytes | ponteiro/manifesto mínimo para /res/16ce... |
| 639334d3d0733ea41ba4dfe84854d932 | 46.960.776 bytes | zlib → FWS v15 |
| 93615f2f2ffc3784aae43c89a924d678 | 46.960.700 bytes | zlib → FWS v15 |
| ffaa4bdc2ecf4d42cc2b3de3f0318f21 | 38.423.977 bytes | zlib → CWS v15 |
| 169ea975050377658b6ee9fb41ebafe4 | 36.987.414 bytes | zlib → CWS v15 |
| 746b5f99fea01d5d84e5327885a87675 | 36.987.266 bytes | zlib → CWS v15 |
| e61045dc757d62aaf444fb9c1886b539 | 36.548.953 bytes | zlib → CWS v15 |
| 3781c586b499550e800868f05ecef893 | 36.548.950 bytes | zlib → CWS v15 |
| 0f34c7536c5d209c2727a1f119b40a11 | 35.052.796 bytes | zlib → CWS v15 |
| 5a5acb07bfd84bb6dcada415893ec841 | 35.052.496 bytes | zlib → CWS v15 |
|

## Como usar o inspetor

```bash
python tools/asa_resource_inspector.py C:/caminho/dos/arquivos
```

Para extrair SWFs decodificados localmente:

```bash
python tools/asa_resource_inspector.py C:/caminho/dos/arquivos --extract-swfs out_refs
```

## Uso dentro do Legend Of Indle

A V94 não copia diretamente assets de outro jogo para dentro do Legend Of Indle. O que foi adaptado:

- estrutura visual de card/prompt;
- fluxo de UI de MMORPG;
- combo meter;
- central Visual Lab;
- pipeline local de análise;
- fundação para converter referências em assets próprios no futuro.

## Próxima evolução sugerida

V95 pode focar em:
- tela de personagem full MMORPG;
- mapa/zonas com UI própria;
- dungeons com cards de entrada;
- mais animações por classe;
- HUD de pets/montarias;
- asset pack próprio do Legend Of Indle.
