# CLAUDE.md — Projeto CNC Router Alumínio

> Documento de handoff. Lê isto inteiro antes de continuar. Descreve o objetivo, o que já
> existe, como o código está organizado e o **estado atual do escopo** (seção 7).
> Idioma do projeto: **português (Brasil)**. Todo texto de interface é em pt-BR.

---

## 1. Quem é o cliente e qual o objetivo

- **Usuário:** Matheus Raposo. Fala português. E-mail de contato: `matheusmerlim@gmail.com`.
  (No Git usa `matheusmerlim@hotmail.com` / usuário GitHub `matheusmerlim1` — ver seção 8.)
- **Objetivo do projeto:** construir uma **CNC router para usinar alumínio**, usando como
  referência técnica a série de vídeos **"Revolution Pro 75"** do canal **Atividade Maker**
  (Rodrigo Conrado), partes 1 a 7. Playlist: `PLQXjHQyol0PJDyd2qNIb8b4Dy96XHSqM5`.
- **Dois entregáveis centrais já existentes:**
  1. Um **documento passo a passo** com os pontos de construção (`CNC Router Aluminio - Passo a Passo.md`).
  2. Uma **tabela/configurador dinâmico** de custos (`Configurador CNC Router.html`) que substitui e
     moderniza a planilha Excel original (`Planilha de custo da cnc router.xlsx`, que era para CNC de MADEIRA).
- **Agora o usuário quer transformar isso numa página de solicitação para clientes** e publicar no GitHub.

---

## 2. Decisões técnicas da série (resumo — detalhes no passo-a-passo .md)

Regra de ouro: cada decisão responde "isso ajuda ou atrapalha a usinar alumínio com qualidade?".

| Tema | Alumínio (Revolution Pro 75) | Madeira (planilha original) |
|------|------------------------------|------------------------------|
| Área útil | **700 × 500 mm** (menor máquina que resolve; flexão cresce não-linear) | maior, ex. 1,5×1 m |
| Estrutura | perfil alumínio + chapa de aço 1/2", **aparafusada, sem solda** | metalon soldado + perfil |
| Amortecimento | epóxi + carga mineral na cavidade central | — |
| Guias | **guia linear HGR20 (20 mm)** em X e Y | eixo supported 20/16 mm |
| Fusos | **fuso de esferas Ø20** (passo 10 X/Y, passo 5 Z) | fuso Ø16 / correia |
| Eixo Z | kit completo apoiado 20 mm + fuso Ø20 (300/400/500 mm) | — |
| Motores | **NEMA 34 closed loop (easy servo)** 8 Nm X/Y, 4,5 Nm Z | NEMA 23/34 malha aberta + DM556 |
| Controle | **DDCS Expert v2.1** standalone | placa Mach3 USB |
| Spindle | 2,2 kW refrigerado a água + inversor | 1 CV TVS-35 |

---

## 3. Arquivos da pasta (`h:\Modelos 3D\cnc router\`)

**ESTRUTURA ATUAL (reestruturada — HTML/CSS/JS separados):**
```
index.html                 landing de solicitação do cliente (2 caminhos + contato)
configurador.html          configurador + custo + 3D + formulário 01-FORM-001 + Excel
formulario-cliente.html    formulário do cliente (linguagem leiga do 01-FORM-001)
assets/css/base.css        tokens de tema (2 temas + data-theme), tipografia IBM Plex, reset
assets/css/index.css       landing (nameplate industrial)
assets/css/configurador.css
assets/css/formulario.css
assets/js/contato.js        config central (e-mail, WhatsApp, EmailJS), envio, toggle de tema
assets/js/index.js          liga botões de contato da landing
assets/js/configurador.js   toda a lógica: BOM, 3D, Excel, envio, formulário
assets/js/formulario.js     salvar/exportar/enviar do formulário do cliente
tests/validar.js             suíte Node: estrutura, 5.400 BOMs, 75 SVGs, Excel e fallback
.gitignore                   proteção contra binários, arquivos grandes e insumos locais
CLAUDE.md                   este arquivo
CNC Router Aluminio - Passo a Passo.md   guia técnico dos 7 vídeos
01-form-001-rt.docx         formulário de requisitos ORIGINAL do vídeo (fonte do embutido)
```
Os dois HTML monolíticos antigos (`Configurador CNC Router.html`, `Formulario do Cliente...html`) foram **removidos** e substituídos pela estrutura acima.

**Design system (impeccable):** identidade "usinagem/alumínio anodizado" — neutros grafite com
viés azul-frio, acento *blueprint blue*, verde/âmbar/vermelho só para estado. Fontes **IBM Plex**
(Sans Condensed / Sans / Mono, via Google Fonts com fallback de sistema). Dois temas com toggle
(`#temaBtn`, tokens `data-theme`). Numerais monoespaçados/tabulares em preços e dimensões.
As páginas passam pelo `impeccable detect` (0 anti-padrões nas 3, após correções de contraste,
hierarquia tipográfica, transições transform, headings e impressão). Ver seção 10.

**Insumos / não necessariamente versionar:**
- `Planilha de custo da cnc router.xlsx` — planilha ORIGINAL (CNC madeira). 3 abas: "Mesa Vander", "Mesa 2,5 x 1,5", "Mesa 0.5x0.5 esqueleto". Base dos preços e da estrutura de mão de obra.
- `garrafa.pdf`, `text.txt` (vazio) — ignorar.
- `githubguia.md` — guia pessoal do Matheus p/ Git/GitHub. **NÃO versionar** (está no .gitignore recomendado). Contém o fluxo de commit/push, criação de repo via API e GitHub Pages.
- `Mach3Version3.043 (1).exe`, `RnRMotion_x86 (1).zip` — softwares CNC. **NÃO versionar** (binários grandes).
- `drive-download-20240705T144013Z-001.zip` (~437 MB) — **NUNCA versionar** (>100 MB, GitHub rejeita).

---

## 4. Como o `configurador.html` funciona (arquitetura atual)

O HTML carrega `assets/js/contato.js` e `assets/js/configurador.js`. Peças principais da lógica:

- **`state`** — objeto persistido em `localStorage["cncCfg"]`:
  `{mat, x, y, z, trans, motor, perfil}`. Default: alumínio, 700×500, Z 400, fuso, closed34, p4040r.
- **`overrides`** (`localStorage["cncOverrides"]`) — edições do usuário por item: `{ [id]: {qty, price, link, store} }`.
- **`excluded`** (`localStorage["cncExcluded"]`) — itens desligados da soma: `{ [id]: true }`.
- **Modelos de dados:** `PERFIS` (4 perfis de alumínio), `MOTORS` (3 motorizações, cada uma
  arrasta seus itens de motor+driver+fonte), `KITZ` (kit eixo Z por comprimento), tabelas de preço
  de fuso por comprimento (`fusoAlu`/`fusoMad`).
- **`buildBOM()`** — retorna array de linhas `{id, cat, item, det, qty, unit, price, est, chk, store, link}`
  a partir do `state`. Categorias: Estrutura, Guias lineares, Eixo Z, Transmissão, Motores/drivers/fontes,
  Controle, Spindle, Elétrica e segurança, Mão de obra e frete.
- **`draw3D()`** — desenha um SVG isométrico da máquina (mesa + pórtico + Z + spindle) que se ajusta a X/Y/Z,
  com setas cotadas (X vermelho, Y verde, Z azul). Projeção iso simples; testado sem NaN.
- **`render()`** — monta as opções (botões), notas, avisos (`warns`), a tabela (com toggles incluir/excluir,
  edição inline de qtd/preço, botão ✎ para trocar link/loja) e chama `draw3D()`.
- **`exportExcel()`** — gera **SpreadsheetML (XML do Excel)** com 2 abas:
  "Custo CNC" (com FÓRMULAS vivas: subtotal `=IF(incluir=1; qtd*preço;0)`, subtotais por categoria `=SUM(...)`,
  total geral somando os subtotais) e "Configuração e Requisitos". Prefixado com BOM U+FEFF. Baixa `.xls`.
  **Já testado abrindo no Excel real (COM) — total confere com a tela.**
- **Formulário 01-FORM-001** — 14 seções em `<details>` com campos `data-rk`, salvos em `localStorage["cncReq"]`.
  Mostra progresso %, status de segurança (X/5) e de aprovação. Área útil e custo-alvo são preenchidos
  automaticamente a partir do `state`/total.

### Mão de obra — implementado
- Linha `id:"maoobra"`: `unit:"h"`, preço-base de **R$ 70/h** e **60 h** para 700×500 mm.
- As horas escalam por `(X + Y) / 1200`; por exemplo, 1500×1000 mm resulta em **125 h**.
- Quantidade e preço continuam editáveis na tabela e são refletidos nas fórmulas do Excel.

---

## 5. `formulario-cliente.html`

Versão do 01-FORM-001 em linguagem de cliente. 10 seções: dados de contato, produto desejado,
dor que resolve, uso/materiais, tamanhos/quantidades, elétrica, **segurança (NR-12)**, prazo/orçamento,
restrições/referências, confirmação com assinatura. Botões: Imprimir/PDF, Exportar .txt, Limpar.
Campos `data-rk` + `data-l` (rótulo p/ exportação). Salva em `localStorage["clienteReq"]`.

---

## 6. Testes locais

Rodar na raiz do projeto:

```powershell
node tests/validar.js
```

A suíte persistente valida:
- **buildBOM**: percorrer TODAS as combinações de `mat × trans × motor × perfil × x × y × z`
  e garantir `total > 0` e finito, e que todo item comprável tem `link`. (Já passou: 5.400 combinações.)
- **draw3D**: gerar o SVG para todos os X/Y/Z e garantir que não há `NaN` e que há polígonos. (Passou.)
- **exportExcel**: gerar o XML, checar `<Row>`/`<Cell>` balanceados, fórmulas no formato esperado,
  presença de "TOTAL GERAL" e da 2ª aba, e BOM U+FEFF. (Passou; validado no Excel via COM: total confere.)
- **Sintaxe JS** dos quatro arquivos, referências de assets e `data-rk` sem duplicatas.
- **Fallback de envio**: baixa o anexo antes de abrir o `mailto`.

Última execução: **15/07/2026, passou integralmente**.

---

## 7. ESTADO DO ESCOPO

1. **[FEITO primeiro] Este `CLAUDE.md`.**

2. **[FEITO] Página `index.html` (landing de solicitação para o cliente).**
   - Ponto de entrada do cliente. Dois caminhos claros: (a) abrir o **Configurador** (montar a CNC e ver preço),
     (b) abrir o **Formulário do Cliente** (fazer a solicitação/briefing).
   - Incluir **canais de contato do Matheus** para dúvidas / seguir com o projeto:
     e-mail `matheusmerlim@gmail.com` e WhatsApp (número a confirmar com o usuário — deixar placeholder claro
     `<!-- TODO: WhatsApp -->` se não fornecido). Pode incluir link mailto e wa.me.
   - Botão **"Enviar solicitação"** (ver item 4).

3. **[FEITO] Reestruturar as páginas separando HTML / CSS / JS.** Estrutura implementada:
   ```
   index.html
   configurador.html                 (renomear "Configurador CNC Router.html")
   formulario-cliente.html           (renomear "Formulario do Cliente - Requisitos do Produto.html")
   assets/css/base.css               (variáveis de tema + reset + componentes compartilhados)
   assets/css/configurador.css
   assets/css/formulario.css
   assets/css/index.css
   assets/js/configurador.js         (todo o <script> atual do configurador)
   assets/js/formulario.js
   assets/js/contato.js              (config central: e-mail, whatsapp, envio de solicitação)
   ```
   - Extrair o CSS `:root`/tema para `base.css` (é idêntico entre as páginas) e importar em todas.
   - Manter os nomes de arquivo antigos como referência OU deletar após confirmar que os novos funcionam
     (o Git registra o rename). Atualizar os links entre páginas.
   - **Reexecutar todos os testes** após a separação (o JS externo deve ser testável do mesmo jeito).

4. **[FEITO COM CONFIGURAÇÃO EXTERNA PENDENTE] Botão "Enviar solicitação" + envio.**
   - **Limitação real:** página estática (file:// ou GitHub Pages) **não envia e-mail com anexo sozinha**.
     Não existe backend. Caminhos possíveis, em ordem de preferatibilidade:
     - **EmailJS** (serviço client-side): permite enviar e-mail com o corpo (dados do formulário) e,
       com upload, anexos até ~50 KB no plano free — o .xls do configurador cabe (~30 KB). Requer criar
       conta EmailJS e uma `service_id`/`template_id`/`public_key`. Documentar como TODO e deixar a
       integração pronta atrás de uma config em `contato.js` (`EMAILJS = {...}`), com fallback mailto.
     - **Fallback sem conta:** ao clicar em "Enviar solicitação", (a) dispara o download do .xls e do
       .txt do formulário, e (b) abre `mailto:matheusmerlim@gmail.com` com assunto e corpo preenchidos,
       instruindo o cliente a anexar os arquivos baixados. Honesto sobre a limitação.
   - Na **exportação do Excel do configurador**: além de baixar, oferecer "enviar para o e-mail do Matheus"
     pelo mesmo mecanismo (EmailJS se configurado; senão mailto + download).
   - **Confirmar com o usuário** qual e-mail é o destino final e se ele topa criar conta EmailJS
     (necessário para anexo automático). Sem isso, entregar o fallback mailto.

5. **[FEITO] Mão de obra 60 h** — aplicada no `buildBOM`, na tela e no Excel.

6. **FORA DO ESCOPO POR ORDEM DO USUÁRIO:** não executar Git, commit ou push.

Única configuração funcional pendente: preencher `templateId` e `publicKey` do EmailJS em
`assets/js/contato.js`. Enquanto estiverem vazios, o fallback testado baixa o arquivo e abre o e-mail.

---

## 8. GitHub — dados e fluxo (de `githubguia.md`)

- **Config Git:** `user.name = matheusmerlim1`, `user.email = matheusmerlim@hotmail.com`.
- **Auth:** token pessoal (PAT) — **não está no arquivo**; fica no Windows Credential Manager
  (`git:https://github.com`) após o 1º push, ou o Windows pede no push. Se 401:
  `cmdkey /delete:git:https://github.com` e tentar de novo. Escopo necessário: `repo` (e `workflow`).
- **Este diretório ainda NÃO é repositório git** (`git init` necessário).
- **`.gitignore` obrigatório antes do 1º commit** — mínimo:
  ```
  *.pdf
  *.exe
  *.zip
  githubguia.md
  githubGuia.md
  node_modules/
  Thumbs.db
  .DS_Store
  *.xlsx        # opcional: a planilha original é insumo, não entregável
  ```
- **Fluxo:**
  ```bash
  cd "h:/Modelos 3D/cnc router"
  git init
  # criar .gitignore primeiro!
  git add index.html configurador.html formulario-cliente.html assets CLAUDE.md \
          "CNC Router Aluminio - Passo a Passo.md"
  git status                       # conferir que nenhum binário/segredo entrou
  git commit -m "feat: configurador CNC + formulário do cliente + landing de solicitação"
  # criar repo via API (token) OU no site; depois:
  git remote add origin https://github.com/matheusmerlim1/<repo>.git
  git branch -M main
  git push -u origin main
  ```
- **Commits (Claude Code):** terminar a mensagem com
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Só commitar/pushar quando o usuário pedir** (ele pediu). Confirmar o nome do repositório com ele.
- Opcional: ativar **GitHub Pages** (branch main, root) para o cliente acessar a landing por URL —
  ver githubguia seção 6. URL ficaria `https://matheusmerlim1.github.io/<repo>`.

---

## 9. impeccable (ferramenta de design instalada)

O usuário usa o **impeccable** (npm, `impeccable.style`) — skills de design + detector de anti-padrões
para agentes de IA. Instalado globalmente em `~/.claude/skills/impeccable` e `~/.agents` (via
`npx impeccable install`). Rodar requer **permissão/aprovação** (o classificador de modo automático
barra `npx impeccable`; o usuário aprova em modo manual ou adiciona regra de Bash no settings).

- **Listar skills:** `npx impeccable help` (comandos: /impeccable, /polish, /critique, /audit, /craft,
  /shape, /typeset, /layout, /colorize, /harden, /distill, /bolder, /quieter, etc — slash-commands no harness).
- **Detectar anti-padrões:** `npx impeccable detect <arquivos/dir/URL>` (`--json`, `--scope type,layout`).
  Já usado para remodelar as páginas. Waivers legítimos ficam em comentários inline no arquivo:
  `<!-- impeccable-disable numbered-section-markers -- motivo -->` (usado no configurador para os
  números de etapa e a numeração oficial do 01-FORM-001).
- As skills viram slash-commands após instalar; podem exigir reiniciar o Claude Code para aparecerem
  na lista de skills. Para o polimento final, rodar `/impeccable` ou `/polish` quando disponível.

## 10. Convenções e cuidados

- Manter **preços "verificados"** (`chk:true`) vs **estimativas** (`est:true`) distintos na UI e no Excel.
  Mercado Livre bloqueia scraping (403) — links do ML apontam para a BUSCA, não anúncios individuais.
  Quando o usuário mandar um link/preço confirmado, fixar como verificado.
- Preços conferidos em 14/07/2026 (ver rodapé do configurador). Datas em pt-BR.
- Todo estado do usuário vive em `localStorage` — não quebrar as chaves existentes
  (`cncCfg`, `cncOverrides`, `cncExcluded`, `cncReq`, `clienteReq`) para não perder o que ele já preencheu.
- Não subir binários grandes nem `githubguia.md` (contém fluxo pessoal).
