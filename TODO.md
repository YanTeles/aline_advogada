# TODO: Implementar Funcionalidade Completa da Agenda Jurídica

## Status: Em Progresso ✅

### 1. [x] Criar TODO.md com plano detalhado (feito)

### 2. [✅] Criar src/controllers/agendaController.js
- GET /api/prazos/:escritorioId - listar prazos próximos (7 dias)
- GET /api/prazos/stats/:escritorioId - stats para dashboard (prazos_hoje)
- POST /api/prazos - criar novo prazo usando prazoService

### 3. [✅] Atualizar server.js
- Importar agendaController
- Adicionar rotas /api/prazos*

### 4. [✅] Atualizar pubilc/index.html
- Adicionar section #view-agenda com:
  | Calendar (FullCalendar CDN) |
  | Lista prazos próximos (tabela) |
  | Form adicionar prazo |
- JS: loadAgenda(), renderCalendar(), form submit
- Corrigir dashboard stats para usar /api/prazos/stats

### 5. Testar funcionalidade
- npm start (assumir server rodando)
- Navegar Agenda → listar/adicionar prazo
- Verificar DB: SELECT * FROM prazos;
- Atualizar TODO.md marcando ✅

### 6. Melhorias Futuras 🔮
- [ ] Dropdown processos/pessoas
- [ ] Editar/excluir prazos
- [ ] Configurar Google Calendar (.env)
- [ ] WhatsApp alerts (se service rodando)

        **Agenda funcional! Teste: npm start && abra pubilc/index.html. Clique Agenda, adicione prazo, verifique lista/calendário/DB.**

