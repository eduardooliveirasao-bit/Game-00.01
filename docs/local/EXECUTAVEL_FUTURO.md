# Caminho para virar executável

Agora que o projeto não está limitado ao Render, o caminho futuro recomendado é:

1. Manter Node.js + Canvas como base.
2. Trocar JSON simples por SQLite local quando o volume crescer.
3. Criar um launcher local que inicia o servidor e abre a janela.
4. Empacotar com Electron ou Tauri.
5. Gerar instalador Windows.

A versão V92 já inclui START_LOCAL_WINDOWS.bat como primeiro passo.
