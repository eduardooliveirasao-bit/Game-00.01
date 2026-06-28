# V95 Combat Visibility Fix

## Problema relatado
O personagem parecia parado e os inimigos não apareciam, dando a sensação de estar batendo em algo invisível.

## Causa provável
A implementação anterior usava pseudo-rig por recortes verticais do mesmo PNG. Essa técnica pode funcionar com imagens preparadas, mas é insegura quando cada asset tem composição diferente.

## Correção
- Herói e monstro passam a usar sprite inteiro como renderização principal.
- O VFXManager continua fazendo dash, impacto, hit-stop, shake, slash, projétil, magia e partículas.
- O cliente ganhou um Battle Director visual para dar movimento contínuo mesmo entre eventos do servidor.
- Os inimigos possuem fallback procedural, então nunca ficam invisíveis se o asset não carregar.

## Resultado
- Inimigo sempre visível.
- Herói ataca visualmente com frequência.
- Monstro reage/ataca visualmente.
- Mais clareza de alvo graças ao anel de target.
