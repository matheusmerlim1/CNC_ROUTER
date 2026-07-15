# CNC Router para Alumínio — Guia Passo a Passo

> Baseado na série **"Router CNC — Revolution Pro 75"** do canal **Atividade Maker** (Rodrigo Conrado), partes 1 a 7, complementado com a experiência do projeto anterior (planilha de custos).
>
> Vídeos de referência:
> 1. [Do Conceito ao Corte: Criando um produto de engenharia](https://www.youtube.com/watch?v=10NfayhldGs)
> 2. [Qual a dor seu produto resolve?](https://www.youtube.com/watch?v=r_6SKHt4Pp0)
> 3. [CNC Router ponto CRÍTICO? (área útil)](https://www.youtube.com/watch?v=yS9i0AT1F6E)
> 4. [Com SOLDA ou SEM SOLDA?](https://www.youtube.com/watch?v=-dg8wSTR2K0)
> 5. [Preencher ou não a ESTRUTURA?](https://www.youtube.com/watch?v=CRXfpKBFb3I)
> 6. [Guias Lineares e Fusos de Esferas](https://www.youtube.com/watch?v=oIMykUTcUtg)
> 7. [DDCS EXPERT com MOTOR EASY SERVO](https://www.youtube.com/watch?v=Vwz0upqX05I)

---

## Passo 0 — Entenda a filosofia do projeto (Partes 1 e 2)

Uma CNC para alumínio **não é uma CNC de madeira adaptada**. A maioria das máquinas é projetada para MDF/madeira/acrílico e "dá um jeito" no alumínio — o resultado é vibração, chatter, ferramenta quebrando e acabamento ruim.

**Regra de ouro da série:** toda decisão do projeto deve responder à pergunta:
> *"Isso ajuda ou atrapalha na usinagem de alumínio com qualidade?"*

O que o alumínio exige da máquina:
- **Rigidez** — estruturas flexíveis viram vibração no alumínio;
- **Precisão** — folga vira marca na peça;
- **Estabilidade dinâmica** — controle de vibração (chatter);
- **Controle** — saber que o movimento comandado realmente aconteceu.

A máquina deve ser projetada **de trás para frente**: primeiro define-se o material mais crítico (alumínio), depois projeta-se a máquina para ele. Se ela usina alumínio bem, usina madeira e plástico com folga.

---

## Passo 1 — Escreva o Formulário de Requisitos Técnicos (Parte 3)

É o **documento mais importante do projeto**. Tudo que for feito depois precisa estar em harmonia com ele. Tópicos:

1. **Objetivo do produto** — o que a máquina é;
2. **Dor que resolve** — ex.: "usinar alumínio com qualidade e consistência";
3. **Aplicação prevista** — materiais, forma de uso;
4. **Requisitos funcionais** — estrutura, repetibilidade, precisão (com números!);
5. **Requisitos mecânicos, de movimentação, elétricos/eletrônicos**;
6. **Requisitos de segurança** — botão de emergência, enclausuramento, fins de curso;
7. **Requisitos de fabricação**;
8. **Requisitos de qualidade e inspeção** — como verificar no final se a máquina entrega o prometido;
9. **Requisitos de custo**;
10. **Requisitos de evolução** — como a máquina poderá ser melhorada;
11. **Restrições conhecidas** — tamanho máximo, peso máximo, orçamento.

---

## Passo 2 — Defina a área útil (Parte 3)

**Área útil não é só tamanho: é alavanca, flexão, vibração, custo e precisão.**

Pontos-chave:
- A **flexão cresce de forma NÃO linear** com o vão livre: um eixo de 400 mm é naturalmente rígido; 700 mm ainda é controlável com bom projeto; a partir de ~1000 mm a flexão dispara, exigindo guias maiores, estrutura muito mais pesada e custo multiplicado.
- O **eixo Z é o ponto mais crítico** da máquina: cada milímetro a mais de curso aumenta a alavanca do spindle. Z alto não gera capacidade, gera instabilidade e vibração.
- Área útil maior = mais fontes de erro somadas (alinhamento, paralelismo, folgas, dilatação) = perda de repetibilidade.
- A pergunta certa não é *"qual a maior máquina que consigo montar?"* e sim **"qual a MENOR máquina que resolve o meu problema?"**

Referência da Revolution Pro 75: **X = 700 mm, Y = 500 mm, Z = 200 mm** — cobre placas de alumínio, flanges e moldes pequenos, que é a esmagadora maioria das peças reais. Peças maiores são caso para centro de usinagem, não para router.

*Comparação com nosso projeto anterior:* a "Mesa 2,5 x 1,5" da planilha antiga é uma área ENORME para alumínio — pelo critério da série, seria uma máquina de madeira/MDF, não de alumínio. Para alumínio, mirar em algo próximo de 700x500.

---

## Passo 3 — Estrutura: aparafusada, sem solda (Parte 4)

- **Solda gera calor → calor gera dilatação → dilatação gera empenamento.** Mesmo com gabaritos, estruturas soldadas quase sempre exigem usinagem corretiva depois. Solda resolve montagem, mas não resolve alinhamento.
- Estrutura **aparafusada** permite ajustar cada plano durante a montagem: esquadro, paralelismo e alinhamento com controle fino. Também permite manutenção, correções e upgrades sem destruir a máquina.
- Materiais da estrutura de referência: **perfis estruturais de alumínio + chapas de aço de até 1/2" (12,7 mm)** cortadas a laser e dobradas.
- Onde a solda é aceitável: **bancada** (mesa de apoio) e **enclausuramento**. Onde NÃO ter solda: a estrutura da máquina em si (o que define a geometria dos eixos).
- A rigidez **vem do projeto**, não da solda.

---

## Passo 4 — Amortecimento: preencher ou não os perfis (Parte 5)

- Objetivo do preenchimento **não é peso, é amortecimento** (dissipar energia de vibração). Areia, concreto e argamassa só adicionam peso — não dissipam vibração e o concreto trinca/desgruda.
- A opção técnica é **epóxi com cargas minerais**: alto coeficiente de amortecimento, adere às paredes internas do perfil, não trinca e mantém estabilidade dimensional.
- Não é preciso encher todos os perfis nem todas as cavidades — na referência, apenas **alguns perfis e somente a cavidade central**.
- Contras a considerar: aumento de peso, **processo irreversível**, custo do material e tempo de cura.
- **Epóxi não corrige projeto ruim — potencializa projeto bom.** Antes de preencher, confirme: estrutura bem dimensionada? alinhamento correto? vibração controlada por geometria?

### Entenda o chatter (vibração regenerativa)
- É a vibração **autoexcitada** que nasce durante o corte: a ferramenta deflete a estrutura → deixa superfície ondulada → na próxima passada a espessura do cavaco varia → a força oscila → a vibração se realimenta.
- **Sintomas:** marcas onduladas/padrão repetitivo na parede usinada, som metálico agudo ("máquina cantando"), quebra de fresa, parafusos se soltando, perda de precisão.
- **Por que é crítico no alumínio:** RPMs altos, forças variando rápido, máquinas leves entram em ressonância fácil, perfil de alumínio tem baixo amortecimento natural.
- **Combate estrutural:** mais rigidez, mais massa, mais amortecimento.
- **Combate no processo:** ajustar RPM e avanço, menor balanço de ferramenta possível, fresa mais curta possível, profundidade de corte adequada, fixação firme da peça (sem balanço).
- **Chatter não é falta de potência do spindle — é falta de controle dinâmico da estrutura.**

---

## Passo 5 — Movimentação: guias lineares e fusos de esferas (Parte 6)

- No alumínio, qualquer erro de movimento aparece: **folga vira marca, vibração vira acabamento ruim**. Movimento ruim limita qualidade, não só velocidade.
- Nada de soluções adaptadas (eixo supported/barra roscada/correia para eixo de corte pesado): **só componentes projetados para precisão**.
- **Guias lineares (trilho + patins): 20 mm em todos os eixos** — o diâmetro/tamanho impacta diretamente na rigidez. Para alumínio, 20 mm é "o mínimo necessário, não exagero".
- **Fusos de esferas (ballscrew) de 20 mm em todos os eixos** — praticamente eliminam backlash:
  - **X e Y: passo 10 mm** (mais velocidade com controle);
  - **Z: passo 5 mm** (mais força, mais resolução e estabilidade);
  - Cada eixo dimensionado para a função que executa.
- Acessórios do sistema: mancais (fixo + flutuante), acoplamentos, suporte de castanha, patins com e sem aba.
- Recomendado: **sistema de lubrificação automática** para patins e castanhas.

*Comparação com nosso projeto anterior:* a planilha antiga usava correia T10 em X/Y e eixo supported (barra cilíndrica) — funciona para madeira, mas pelo critério da série é inadequado para alumínio de qualidade. Fuso de esferas + guia linear quadrada em todos os eixos.

---

## Passo 6 — Controle: controladora, driver e motor (Parte 7)

O controle acontece em 3 níveis: **controladora** (decide o movimento) → **driver** (interpreta o comando) → **motor** (executa).

- **Malha aberta (motor de passo comum): fora do projeto para alumínio.** O motor executa mas ninguém confere → perda de passo, vibração, erro acumulado → peça fora de medida.
- **Malha fechada (motor de passo com encoder / "easy servo"):** mantém a simplicidade de ligação (pulso/direção) e o encoder verifica e corrige o posicionamento. *"Não só movimenta — verifica e valida o movimento."*
- **Controladora de referência: DDCS Expert v2.1** (standalone, não precisa de PC com porta paralela):
  - Pulso/direção em **modo diferencial** (imunidade a ruído);
  - Taxa de **500 kHz** na comunicação com o driver;
  - Controla todos os eixos simultâneos.
- **Motores de referência (NEMA 34 closed loop):**
  - X: 1x 85 kgf.cm | Y: 2x 85 kgf.cm (gantry com dois motores) | Z: 1x 45 kgf.cm;
  - 4 drivers para motor de passo com encoder (1 por motor);
  - **4 fontes de 600 W / 80 V / 7,5 A** (uma por motor);
  - **2 fontes de 24 V / 2,5 A** (uma para a controladora, outra para entradas/saídas);
  - Painel com teclado M3K e **MPG** (manivela eletrônica) para operação.

*Comparação com nosso projeto anterior:* a planilha usava placa Mach3 USB + NEMA 34/23 malha aberta + drivers DM556. A evolução recomendada pela série é controladora standalone (DDCS) + motores closed loop. O Mach3 continua sendo opção mais barata (e já temos a licença/instalador), mas sem verificação de posicionamento.

---

## Passo 7 — Spindle (próximos episódios da série)

A série ainda vai detalhar o spindle (Parte 8+). Diretrizes já estabelecidas:
- Para alumínio, o que manda não é potência bruta, e sim **rigidez e faixa de RPM estável** — chatter não se resolve com spindle maior;
- Opções típicas: spindle refrigerado a água 1,5–2,2 kW com inversor (VFD), pinça ER11/ER16/ER20;
- Manter a ferramenta o mais curta possível e o spindle o mais próximo possível da estrutura (menos alavanca no Z).

*Quando os próximos vídeos da série saírem, atualizar este documento.*

---

## Checklist resumido de decisões

| # | Decisão | Referência Revolution Pro 75 |
|---|---------|------------------------------|
| 1 | Material crítico | Alumínio (projetar para ele) |
| 2 | Documento de requisitos técnicos | Escrever ANTES de comprar qualquer coisa |
| 3 | Área útil | 700 x 500 mm, Z = 200 mm (menor máquina que resolve) |
| 4 | Estrutura | Perfil de alumínio + chapas de aço 1/2", aparafusada, SEM solda (solda só em bancada/enclausuramento) |
| 5 | Amortecimento | Epóxi + carga mineral na cavidade central de alguns perfis (opcional, irreversível) |
| 6 | Guias | Guia linear quadrada 20 mm em todos os eixos |
| 7 | Fusos | Fuso de esferas Ø20 — passo 10 (X/Y), passo 5 (Z) |
| 8 | Motores | NEMA 34 closed loop — 85 kgf.cm (X, 2x Y), 45 kgf.cm (Z) |
| 9 | Drivers | Driver closed loop (pulso/direção diferencial), 1 por motor |
| 10 | Fontes | 4x 600W/80V (motores) + 2x 24V (controladora e I/O) |
| 11 | Controladora | DDCS Expert v2.1 standalone (alternativa: Mach3 + placa USB) |
| 12 | Operação | Teclado M3K + MPG, botão de emergência, fins de curso/sensores indutivos |
| 13 | Lubrificação | Sistema automático para patins e castanhas |

---

## Dicas de compra citadas na série (jul/2026)

- **OBR Automação** — movimentação linear e automação; cupom "Atividade Maker" pelo WhatsApp: até 40% em movimentação linear e até 15% em automação (cupons limitados);
- **Forseti** — perfis de alumínio; cupom `MAKER10` = 10% no site;
- Outros parceiros da série: OCS Laser (corte/dobra de chapas), Código G (medição), Redelease (epóxi/resinas).
