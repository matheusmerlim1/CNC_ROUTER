/* configurador.js — lógica do configurador (dados, BOM, desenho 3D, Excel, envio)
   Requer contato.js carregado antes (CONTATO, enviarSolicitacao, baixarBlob). */
"use strict";
const fmt = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const LENS = [500,700,1000,1500,2000];
const ML = q => "https://lista.mercadolivre.com.br/"+q;
const state = Object.assign({mat:"aluminio", x:700, y:500, z:400, trans:"fuso", motor:"closed34", perfil:"p4040r", modo:"cliente"},
  JSON.parse(localStorage.getItem("cncCfg")||"{}"));
/* Dois modos. "cliente": recebe a máquina montada, então a mão de obra faz parte do orçamento e não é editável.
   "montador": monta por conta própria, então controla as horas e o valor/hora. Isto é conveniência de uso,
   não trava de segurança: qualquer pessoa pode alternar o modo. */
const MODOS = {
  cliente:{ label:"Quero receber montada", note:"A mão de obra de montagem, ajuste e teste entra no orçamento com o nosso valor. Todo o resto você ajusta à vontade." },
  montador:{ label:"Vou montar eu mesmo", note:"Você controla as horas e o valor/hora da montagem — edite a linha de mão de obra como qualquer outro item, ou tire ela do total." }
};
const ZLENS=[300,400,500];
// Kit eixo Z completo: guias apoiadas 20 mm + fuso de esferas Ø20 + chapas (500 mm verificado pelo usuário no ML)
const KITZ={300:{p:1200,est:true},400:{p:1350,est:true},500:{p:1500,est:false}};
const KITZ_LINK="https://www.mercadolivre.com.br/kit-eixo-z-apoiado-20mm-x-500mm-fuso-de-esferas-20mm-pcs/up/MLBU1717261359";
// Mão de obra: base 60 h para a máquina de referência 700×500; escala proporcional ao (X+Y)
const MO_HORAS_BASE=60, MO_REF=1200, MO_RS_H=70;
let overrides = JSON.parse(localStorage.getItem("cncOverrides")||"{}");
let excluded  = JSON.parse(localStorage.getItem("cncExcluded")||"{}");
/* Itens acrescentados pelo usuário, por categoria: {categoria:[{id,item,det,qty,unit,price,store,link}]}.
   As edições deles passam pelo mesmo `overrides` dos itens de fábrica — aqui fica só o registro de criação. */
let extras = JSON.parse(localStorage.getItem("cncExtras")||"{}");
const salvaExtras = () => localStorage.setItem("cncExtras",JSON.stringify(extras));
const salvaOverrides = () => localStorage.setItem("cncOverrides",JSON.stringify(overrides));

/* Unidades de comprimento: trocar entre elas converte quantidade e preço e preserva o subtotal.
   5,8 m x R$174/m  ->  5800 mm x R$0,174/mm. É o que permite cotar guia linear a R$/mm. */
const FATOR_COMPRIMENTO = {m:1, cm:0.01, mm:0.001};
/* Converte quantidade e preço entre unidades de comprimento preservando o subtotal.
   Devolve null quando a troca não é conversível (ex.: pç -> kit), aí é só trocar o rótulo. */
function converteUnidade(qty, price, de, para){
  const fa=FATOR_COMPRIMENTO[de], fn=FATOR_COMPRIMENTO[para];
  if(!fa || !fn || de===para) return null;
  const k=fa/fn;                                    // m -> mm: 1/0,001 = 1000
  return { qty:+(qty*k).toFixed(4), price:+(price/k).toFixed(6) };
}
const UNIDADES = ["pç","kit","cj","m","cm","mm","h","vb","lic","par","barra","jogo"];
const escAttr = s => String(s==null?"":s)
  .replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

const byLen = (tab,len) => tab[len];

/* ---------- PERFIS DE ALUMÍNIO ---------- */
const PERFIS = {
  p4040b:{label:"40x40 básico canal 8",price:135,store:"Forseti (cupom MAKER10)",link:"https://loja.forsetisolucoes.com.br/perfil-estrutural-em-aluminio-40x40-basico-canal-8-t-slot-tslot",
    nota:"O mais barato — ok para CNC leve de madeira com correia. Face de 40 mm serve de apoio para guia supported; justo para guia linear 20 mm."},
  p4040r:{label:"40x40 reforçado",price:174,store:"5F Systems / Forseti",link:"https://www.5fsystems.com.br/perfil-estrutural-em-aluminio-40x40-reforcado",
    nota:"Paredes mais grossas: melhor rigidez para guia linear 20 mm e fuso de esferas em vãos de até ~1 m."},
  p4080:{label:"40x80 reforçado",price:285,est:true,store:"Forseti / 5F Systems",link:"https://loja.forsetisolucoes.com.br/perfis-estruturais-em-aluminio",
    nota:"Recomendado nas longarinas do X a partir de 1,5 m: dobra a altura da seção justamente onde a flexão mais cresce."},
  p8080:{label:"80x80 pesado",price:430,est:true,store:"Forseti / 5F Systems",link:"https://loja.forsetisolucoes.com.br/perfis-estruturais-em-aluminio",
    nota:"Máxima rigidez em perfil: para máquina de alumínio de 1,5 a 2 m ou pórtico pesado. As cavidades grandes são ideais para preenchimento com epóxi."},
};
// metragem: 2 longarinas X + 2 reforços X + 3 travessas Y + 1 travessa do pórtico (Y) + 1 m colunas/extras
const perfilMetros = (xm,ym) => ({ m:+(4*xm + 4*ym + 1).toFixed(1),
  breakdown:`2×${xm} m laterais X + 2×${xm} m reforço X + 3×${ym} m travessas Y + 1×${ym} m pórtico + 1 m colunas/extras` });

/* ---------- MOTORIZAÇÃO: motor + driver + fonte acoplados ---------- */
const MOTORS = {
  closed34:{
    label:"NEMA 34 closed loop (easy servo)",
    note:"Malha fechada: o encoder confere e corrige o posicionamento. É o recomendado para alumínio. Driver incluso no kit; fonte de 60 V dimensionada por motor.",
    items:[
      {id:"motXY",item:"Kit easy servo NEMA 34 8,0 Nm (82 kgf.cm) + driver HSS86 + cabo encoder 15 m",det:"2× eixo X (um por lado) + 1× eixo Y — malha fechada",qty:3,unit:"kit",price:1153,chk:true,store:"TECMAF (R$1.095 no Pix, em estoque)",link:"https://loja.tecmaf.com.br/motores-de-passo-e-componentes-cnc/motor-de-passo/motor-de-passo-com-encoder-8-0-nm-easy-servo-driver"},
      {id:"motZ",item:"Kit easy servo NEMA 34 4,5 Nm (45 kgf.cm) + driver HBS86H + cabo encoder",det:"Eixo Z — malha fechada",qty:1,unit:"kit",price:1194,chk:true,store:"TECMAF / OceanTech",link:"https://loja.tecmaf.com.br/motores-de-passo-e-componentes-cnc/motor-de-passo/motor-de-passo-com-encoder-4-5-nm-easy-servo-driver"},
      {id:"fonteM",item:"Fonte chaveada 60 V / 600 W — 1 por motor",det:"Driver HSS86 aceita 30–110 VDC / 20–80 VAC; uma fonte por motor",qty:4,unit:"pç",price:420,est:true,store:"OBR / Mercado Livre",link:ML("fonte-chaveada-60v-600w")},
    ]},
  open34:{
    label:"NEMA 34 malha aberta + driver 7,2 A",
    note:"Mais barato, torque alto, mas sem verificação de posicionamento — perda de passo não é detectada. Aceitável para madeira; não indicado para alumínio.",
    items:[
      {id:"motXY",item:"Motor NEMA 34 85 kgf.cm + driver 7,2 A (avulsos)",det:"2× eixo X + 1× eixo Y — kit TECMAF indisponível; soma dos avulsos (motor R$377 + driver R$370)",qty:3,unit:"cj",price:747,est:true,store:"TECMAF / Mercado Livre",link:ML("motor-de-passo-nema-34-85kgf-driver")},
      {id:"motZ",item:"Kit motor NEMA 23 31 kgf.cm + driver DM556",det:"Eixo Z",qty:1,unit:"kit",price:369,chk:true,store:"OceanTech (R$350 no Pix, em estoque)",link:"https://oceantech-automation.com.br/produtos/motor-de-passo-31kgf-nema-23-driver-dm556/"},
      {id:"fonteM",item:"Fonte chaveada 48 V / 500 W — 1 para cada 2 motores",det:"Driver aceita 24–80 VDC; NEMA 34 pede 48 V+ para ter torque em velocidade",qty:2,unit:"pç",price:280,est:true,store:"Mercado Livre",link:ML("fonte-chaveada-48v-500w")},
    ]},
  open23:{
    label:"NEMA 23 malha aberta + DM556",
    note:"Opção econômica — só para madeira e MDF em máquinas leves. Torque limitado para pórtico pesado ou eixos de 2 m.",
    items:[
      {id:"motXY",item:"Kit motor NEMA 23 31 kgf.cm + driver DM556",det:"2× eixo X + 1× eixo Y",qty:3,unit:"kit",price:369,chk:true,store:"OceanTech (R$350 no Pix, em estoque)",link:"https://oceantech-automation.com.br/produtos/motor-de-passo-31kgf-nema-23-driver-dm556/"},
      {id:"motZ",item:"Kit motor NEMA 23 23 kgf.cm + driver DM556",det:"Eixo Z",qty:1,unit:"kit",price:259,chk:true,store:"OceanTech",link:"https://oceantech-automation.com.br/produtos/motor-de-passo-23kgf-nema-23-driver-dm556/"},
      {id:"fonteM",item:"Fonte chaveada 36 V / 350 W — 1 para cada 2 motores",det:"DM556 aceita 20–50 VDC",qty:2,unit:"pç",price:180,est:true,store:"Mercado Livre",link:ML("fonte-chaveada-36v-350w")},
    ]},
};

function buildBOM(){
  const {mat,x,y,trans,motor} = state;
  const xm = x/1000, ym = y/1000;
  const rows = [];
  const add = r => rows.push(r);

  /* ---------- ESTRUTURA ---------- */
  const pf = PERFIS[state.perfil], pm = perfilMetros(xm,ym);
  add({id:"perfil",cat:"Estrutura",item:`Perfil estrutural alumínio ${pf.label}`,det:`Metragem acompanha a mesa: ${pm.breakdown}`,qty:pm.m,unit:"m",price:pf.price,est:pf.est,chk:!pf.est,store:pf.store,link:pf.link});
  if(mat==="aluminio"){
    add({id:"chapas",cat:"Estrutura",item:"Chapas de aço até 1/2\" — corte laser + dobra",det:"Laterais do pórtico, base do Z e reforços",qty:1,unit:"vb",price:Math.round(1500+400*(xm+ym-2)),est:true,store:"OCS Laser / serralheria local",link:"https://ocslaser.com.br"});
    add({id:"epoxi",cat:"Estrutura",item:"Epóxi + carga mineral (amortecimento)",det:"Preencher só a cavidade central de alguns perfis — irreversível (desligue a chave se não quiser)",qty:1,unit:"kit",price:Math.round(400+150*(xm+ym-2)),est:true,store:"Redelease",link:"https://www.redelease.com.br"});
    add({id:"fixacao",cat:"Estrutura",item:"Porcas martelo T, parafusos allen, cantoneiras",det:"Fixação dos perfis (canal 8)",qty:1,unit:"vb",price:700,est:true,store:"Mercado Livre",link:ML("porca-martelo-m6-canal-8")});
  } else {
    add({id:"metalon",cat:"Estrutura",item:"Metalon + solda da bancada",det:"Base soldada (tubo 30x30 / 100x50) — solda só na bancada",qty:1,unit:"vb",price:Math.round(800+250*(xm+ym-2)),est:true,store:"Serralheria local"});
    add({id:"fixacao",cat:"Estrutura",item:"Porcas martelo T, parafusos allen, cantoneiras",det:"Fixação dos perfis (canal 8)",qty:1,unit:"vb",price:450,est:true,store:"Mercado Livre",link:ML("porca-martelo-m6-canal-8")});
    add({id:"usinagem",cat:"Estrutura",item:"Serviço de usinagem (suportes, abas)",det:"Suporte do motor Z e abas laterais",qty:1,unit:"vb",price:400,est:true,store:"WF Ferramentaria"});
  }

  /* ---------- GUIAS ---------- */
  if(mat==="aluminio"){
    const mGuia = 2*xm + 2*ym;
    add({id:"hgr20",cat:"Guias lineares",item:"Guia linear HGR20 (20 mm)",det:"Eixos X e Y — 2 trilhos por eixo, o mínimo para alumínio. O Z já vem completo no kit próprio",qty:+mGuia.toFixed(1),unit:"m",price:170,chk:true,store:"TECMAF (R$0,17/mm)",link:"https://loja.tecmaf.com.br/guia-linear-hgr20-20mm"});
    add({id:"hgh20",cat:"Guias lineares",item:"Patins HGH20CA (sem aba)",det:"4 por eixo (X e Y)",qty:8,unit:"pç",price:85,est:true,store:"Forseti / Mercado Livre",link:ML("patins-hgh20ca")});
  } else {
    add({id:"sbrX",cat:"Guias lineares",item:"Kit 2 eixos supported 20 mm + 4 pillow blocks (X)",det:`Eixo longitudinal ${x} mm — kit de 500 mm cotado a R$367,60`,qty:1,unit:"kit",price:byLen({500:368,700:450,1000:550,1500:700,2000:849},x),est:x!==500,store:"Mercado Livre",link:ML("kit-2-eixo-linear-supported-20mm-"+x+"mm-pillow-block")});
    add({id:"sbrY",cat:"Guias lineares",item:"Kit 2 eixos supported 16 mm + 4 pillow blocks (Y)",det:`Travessa do pórtico ${y} mm`,qty:1,unit:"kit",price:byLen({500:320,700:400,1000:480,1500:570,2000:680},y),est:true,store:"Mercado Livre",link:ML("kit-2-eixo-linear-supported-16mm-"+y+"mm-pillow-block")});
  }
  /* ---------- EIXO Z (profundidade) ---------- */
  const kz=KITZ[state.z];
  add({id:"kitZ",cat:"Eixo Z (profundidade)",item:`Kit eixo Z completo apoiado 20 mm × ${state.z} mm + fuso de esferas Ø20`,det:`Guias + fuso + chapas prontos — curso útil ≈ ${state.z-150} a ${state.z-100} mm. Preço do kit de 500 mm confirmado no anúncio`,qty:1,unit:"kit",price:kz.p,est:kz.est,chk:!kz.est,store:"Mercado Livre (PCS)",link:KITZ_LINK});

  /* ---------- TRANSMISSÃO ---------- */
  const fusoAlu = {500:400,700:460,1000:550,1500:750,2000:950};
  const fusoMad = {500:350,700:420,1000:500,1500:630,2000:770};
  if(trans==="fuso"){
    const tab = mat==="aluminio"?fusoAlu:fusoMad;
    const nome = mat==="aluminio"?"SFU2010 (Ø20, passo 10)":"SFU1605 (Ø16, passo 5)";
    const slug = mat==="aluminio"?"fuso-esferas-sfu2010":"fuso-esferas-sfu1605";
    add({id:"fusoX",cat:"Transmissão",item:`Fuso de esferas ${nome} — eixo X`,det:`${x} mm + mancais BK/BF + suporte de castanha (2 lados do pórtico)`,qty:2,unit:"kit",price:byLen(tab,x),est:true,store:"OceanTech / OBR / Mercado Livre",link:ML(slug+"-"+x+"mm-mancais")});
    add({id:"fusoY",cat:"Transmissão",item:`Fuso de esferas ${nome} — eixo Y`,det:`${y} mm + mancais BK/BF + suporte de castanha`,qty:1,unit:"kit",price:byLen(tab,y),est:true,store:"OceanTech / OBR / Mercado Livre",link:ML(slug+"-"+y+"mm-mancais")});
    add({id:"acopl",cat:"Transmissão",item:"Acoplamento flexível motor–fuso",det:"1 por fuso (confira os diâmetros: eixo do motor × ponta do fuso)",qty:3,unit:"pç",price:69,est:true,store:"Mercado Livre",link:ML("acoplamento-flexivel-14mm-10mm")});
  } else if(trans==="correia"){
    const mCorreia = 2*(xm+0.5)+(ym+0.5);
    add({id:"correia",cat:"Transmissão",item:"Correia sincronizadora T10 15 mm PU/aço",det:`2 lados do X + Y (${mCorreia.toFixed(1)} m)`,qty:+mCorreia.toFixed(1),unit:"m",price:25,est:true,store:"Tratoraço",link:"https://www.tratoraco.com.br/correias-acessorios-e-ferramentas/correias-sincronizadoras/correia-sincronizadora-pu-aco/correia-sincronizadora-t10-15mm-pu-aco"});
    add({id:"polias",cat:"Transmissão",item:"Polias T10 + rolamentos 6200 + tensores",det:"2 polias motoras X, 1 Y, rolamentos-guia",qty:1,unit:"vb",price:400,est:true,store:"Mercado Livre",link:ML("polia-t10-15mm")});
  } else {
    const mCrem = 2*xm + ym;
    add({id:"crem",cat:"Transmissão",item:"Cremalheira helicoidal módulo 1,5",det:`2 lados do X + Y (${mCrem.toFixed(1)} m)`,qty:+mCrem.toFixed(1),unit:"m",price:220,est:true,store:"TECMAF / Pacol / Usicorp",link:"https://loja.tecmaf.com.br/cremalheira-helicoidal-modulo-15-barra-2-metros"});
    add({id:"pinhao",cat:"Transmissão",item:"Pinhão helicoidal + suporte tensionador",det:"1 por motor (X esq., X dir., Y)",qty:3,unit:"pç",price:180,est:true,store:"Mercado Livre",link:ML("pinhao-cremalheira-modulo-1-5-cnc")});
    add({id:"redutor",cat:"Transmissão",item:"Redução (planetária ou correia) p/ pinhão",det:"Cremalheira exige redução p/ ter resolução e torque",qty:3,unit:"pç",price:450,est:true,store:"Mercado Livre",link:ML("redutor-planetario-nema-34")});
  }
  if(mat==="aluminio" && trans==="fuso"){
    add({id:"lubri",cat:"Transmissão",item:"Sistema de lubrificação automática",det:"Patins e castanhas — opcional",qty:1,unit:"kit",price:600,est:true,store:"OBR Automação",link:"https://www.obr.com.br"});
  }

  /* ---------- MOTORES, DRIVERS E FONTES (acoplados à escolha) ---------- */
  MOTORS[motor].items.forEach(it=>add(Object.assign({cat:"Motores, drivers e fontes"},it)));
  add({id:"f24ctrl",cat:"Motores, drivers e fontes",item:"Fonte 24 V / 2,5 A",det:mat==="aluminio"?"1 para a controladora + 1 para as entradas e saídas":"Alimentação da placa controladora",qty:mat==="aluminio"?2:1,unit:"pç",price:112,est:true,store:"Mercado Livre",link:ML("fonte-chaveada-24v-2a")});

  /* ---------- CONTROLE ---------- */
  if(mat==="aluminio"){
    add({id:"ddcs",cat:"Controle",item:"Controladora DDCS Expert v2.1 (standalone) + teclado M3K + MPG",det:"Pulso/direção diferencial, 500 kHz, dispensa PC. Nacional R$5.840 sob encomenda; importada ~R$2.500-3.000",qty:1,unit:"kit",price:5840,chk:true,store:"MachCNC / OBR / importado",link:"https://machcnc.com.br/loja/produto/comando-cnc-ddcs-v1-1-expert-standalone/"});
  } else {
    add({id:"mach3",cat:"Controle",item:"Placa controladora Mach3 USB 4 eixos (RnR Eco Motion)",det:"Precisa de um PC com o Mach3 instalado",qty:1,unit:"pç",price:167,store:"TECMAF Automação",link:"https://automacao.tecmaf.com.br/placa-controladora-cnc-para-mach3-4-eixos-usb/"});
    add({id:"mach3lic",cat:"Controle",item:"Licença Mach3 (US$ 200)",det:"Newfangled Solutions",qty:1,unit:"lic",price:1100,est:true,store:"machsupport.com",link:"https://www.machsupport.com/software/mach3/"});
    add({id:"pc",cat:"Controle",item:"PC / notebook usado p/ rodar o Mach3",det:"Desligue a chave se já tiver",qty:1,unit:"pç",price:800,est:true,store:"Mercado Livre",link:ML("notebook-usado")});
  }

  /* ---------- SPINDLE ---------- */
  if(mat==="aluminio"){
    add({id:"sp22",cat:"Spindle",item:"Spindle 2,2 kW (3 CV) refrigerado a água, pinça ER20",det:"24.000 rpm, 220 V — só o motor (inversor à parte)",qty:1,unit:"pç",price:1919,chk:true,store:"CNC Motion (R$1.890 no Pix, 5 dias úteis)",link:"https://www.cncmotion.com.br/motor-spindle-3-cv"});
    add({id:"vfd22",cat:"Spindle",item:"Inversor de frequência 2,2 kW 220 V",det:"Comanda o spindle (0–400 Hz)",qty:1,unit:"pç",price:650,est:true,store:"Mercado Livre",link:ML("inversor-de-frequencia-2.2kw-220v")});
    add({id:"bomba",cat:"Spindle",item:"Bomba d'água + mangueiras + reservatório",det:"Refrigeração do spindle",qty:1,unit:"kit",price:150,est:true,store:"Mercado Livre",link:ML("bomba-de-agua-spindle-cnc")});
  } else {
    add({id:"sp1cv",cat:"Spindle",item:"Kit spindle 1 CV TVS-35 + inversor de frequência",det:"Kit fechado: motor e inversor",qty:1,unit:"kit",price:2420,est:true,store:"TECMAF",link:"https://loja.tecmaf.com.br/kit-1cv-spindle-tvs-inversor"});
  }

  /* ---------- ELÉTRICA E SEGURANÇA ---------- */
  add({id:"esteira",cat:"Elétrica e segurança",item:"Esteira porta-cabos 15x40 mm",det:"Eixos X e Y",qty:Math.round(xm+ym+2),unit:"m",price:69,est:true,store:"Mercado Livre",link:ML("esteira-porta-cabos-15x40")});
  add({id:"indutivo",cat:"Elétrica e segurança",item:"Sensor indutivo NPN (home X/Y/Z)",det:"Referenciamento",qty:3,unit:"pç",price:22,est:true,store:"Mercado Livre",link:ML("sensor-indutivo-npn-lj12a3")});
  add({id:"fimcurso",cat:"Elétrica e segurança",item:"Chave fim de curso",det:"Limites dos 3 eixos",qty:6,unit:"pç",price:3.5,store:"Eletrogate",link:"https://www.eletrogate.com/chave-fim-de-curso-haste-longa"});
  add({id:"estop",cat:"Elétrica e segurança",item:"Botão de emergência (E-stop)",det:"",qty:1,unit:"pç",price:29,est:true,store:"Mercado Livre",link:ML("botao-de-emergencia-1nf")});
  add({id:"botoes",cat:"Elétrica e segurança",item:"Push buttons (pause/continua/stop)",det:"",qty:4,unit:"pç",price:7.5,est:true,store:"Eletrogate",link:"https://www.eletrogate.com"});
  add({id:"caixa",cat:"Elétrica e segurança",item:"Painel/caixa elétrica + bornes + conectores Mike",det:"",qty:1,unit:"vb",price:350,est:true,store:"Mercado Livre / Baú da Eletrônica",link:ML("caixa-de-comando-eletrica-40x30")});
  add({id:"cabos",cat:"Elétrica e segurança",item:"Cabos, terminais e miudezas elétricas",det:"Cabo blindado 4 vias p/ motores, cabo PP, terminais",qty:1,unit:"vb",price:300,est:true,store:"Mercado Livre",link:ML("cabo-blindado-4-vias-1mm")});
  add({id:"extras",cat:"Elétrica e segurança",item:"Parafusos e componentes extras (reserva)",det:"",qty:1,unit:"vb",price:500,est:true,store:"—"});

  /* ---------- MÃO DE OBRA E FRETE ---------- */
  const horas = Math.round(MO_HORAS_BASE*(x+y)/MO_REF);
  const souMontador = state.modo==="montador";
  add({id:"maoobra",cat:"Mão de obra e frete",item:"Mão de obra (montagem, ajuste, teste)",
    det: souMontador
      ? `${MO_HORAS_BASE} h de referência para 700×500 mm, proporcional ao tamanho (${x}+${y} mm). Edite a quantidade (horas) e o preço (R$/h).`
      : `Montagem, alinhamento, ajuste e teste da máquina, já no orçamento. Estimativa de ${horas} h para esta configuração.`,
    qty:horas,unit:"h",price:MO_RS_H,store:"—",lock:!souMontador});
  add({id:"frete",cat:"Mão de obra e frete",item:"Fretes (estimativa)",det:"",qty:1,unit:"vb",price:600,est:true,store:"—"});

  /* ---------- itens acrescentados pelo usuário ---------- */
  Object.keys(extras).forEach(cat=>{
    (extras[cat]||[]).forEach(e=>{
      add({id:e.id,cat,item:e.item,det:e.det,qty:e.qty,unit:e.unit,price:e.price,
        store:e.store||"",link:e.link||"",extra:true});
    });
  });
  return rows;
}

/* ---------- desenho isométrico da máquina ----------
   Mesma máquina da landing, dirigida pelo X/Y/Z escolhidos. Cores por classe (tokens em base.css).
   Tela de tamanho FIXO com a máquina ajustada dentro: assim o desenho não muda de tamanho conforme
   a mesa, e as cotas ficam sempre no mesmo corpo de texto. As margens reservam espaço para os
   rótulos, que ficam deslocados das setas e antes eram cortados pela borda. */
const VIZ_W=720, VIZ_H=380, VIZ_CAP=22, VIZ_PADX=70, VIZ_PADY=26;
function draw3D(){
  const X=state.x, Y=state.y, Zc=state.z;
  const C=0.866, S=0.5;
  const baseH=78, topH=20, railW=Math.min(40, Y*0.07), railH=16;
  const colW=78, colD=62, colH=200+Zc, beamH=84;
  const gx=(X-colW)/2, zW=64, zLen=Zc+120;
  const zTop=baseH+topH, beamZ=zTop+colH, zEnd=beamZ+beamH-10;

  let k=1, ox=0, oy=0, pts=[], out=[];
  const P=(x,y,z)=>{const p=[ox+(x-y)*C*k, oy+(x+y)*S*k-z*k];pts.push(p);return p;};
  const n=v=>v.toFixed(1);
  // pinta por classe (regras em base.css): var() em atributo de apresentação tem suporte irregular
  const poly=(pp,cls,extra="")=>out.push(`<polygon points="${pp.map(p=>`${n(p[0])},${n(p[1])}`).join(" ")}" class="${cls}"${extra}/>`);
  const line=(a,b,cls,w)=>out.push(`<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" class="${cls}" stroke-width="${w}" stroke-linecap="round"/>`);
  const box=(x,y,z,dx,dy,dz,c)=>{
    poly([P(x,y,z+dz),P(x+dx,y,z+dz),P(x+dx,y+dy,z+dz),P(x,y+dy,z+dz)],c[0]);
    poly([P(x+dx,y,z),P(x+dx,y+dy,z),P(x+dx,y+dy,z+dz),P(x+dx,y,z+dz)],c[1]);
    poly([P(x,y+dy,z),P(x+dx,y+dy,z),P(x+dx,y+dy,z+dz),P(x,y+dy,z+dz)],c[2]);
  };
  const M=["m1","m2","m3"], TP=["tp1","tp2","tp3"], A=["a1","a2","a3"], T=["t1","t2","t3"];
  const F=["f1","f2","f3"], W=["w1","w2","w3"], Zc3=["z1","z2","z3"], SP=["s1","s2","s3"];

  const CX="#e5484d", CY="#2f9e63", CZ="#3b82f6";
  const mk=c=>`<marker id="ah-${c.slice(1)}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="${c}"/></marker>`;
  const fx=v=>(v/1000).toLocaleString("pt-BR");
  let ar="";
  const cota=(p1,p2,cor,label,dxT,dyT)=>{
    ar+=`<line x1="${n(p1[0])}" y1="${n(p1[1])}" x2="${n(p2[0])}" y2="${n(p2[1])}" stroke="${cor}" stroke-width="2" marker-start="url(#ah-${cor.slice(1)})" marker-end="url(#ah-${cor.slice(1)})"/>`+
      `<text x="${n((p1[0]+p2[0])/2+dxT)}" y="${n((p1[1]+p2[1])/2+dyT)}" fill="${cor}" font-size="15" font-weight="600" class="cota" text-anchor="middle">${label}</text>`;
  };

  // desenha tudo; roda duas vezes: a 1ª mede (k=1), a 2ª desenha já ajustado à tela
  function build(){
  pts=[]; out=[]; ar="";
  box(0,0,0,X,Y,baseH,M);                                   // base
  box(-10,-10,baseH,X+20,Y+20,topH,TP);                     // tampo
  const nSlots=Math.max(3,Math.min(9,Math.round(Y/110)));   // rasgos T acompanham a largura
  for(let i=1;i<=nSlots;i++){
    const yy=(Y/(nSlots+1))*i;
    line(P(-4,yy,zTop),P(X+4,yy,zTop),"slot",2.2);
  }
  box(-6,-4,baseH+4,X+12,9,9,F);                            // fuso do X
  box(-6,22,zTop,X+12,railW,railH,T);                       // trilho frente
  box(-6,Y-22-railW,zTop,X+12,railW,railH,T);               // trilho fundo
  // peça em usinagem, proporcional à mesa
  const pw=Math.min(X*0.34,360), pd=Math.min(Y*0.36,240), ph=26;
  const px=gx-pw*0.62, py=Y/2-pd/2;
  box(px,py,zTop,pw,pd,ph,W);
  const inset=Math.min(34,pw*0.12,pd*0.12);
  poly([P(px+inset,py+inset,zTop+ph),P(px+pw-inset,py+inset,zTop+ph),
        P(px+pw-inset,py+pd-inset,zTop+ph),P(px+inset,py+pd-inset,zTop+ph)],
       "cut",' stroke-width="1.4"');
  box(gx,-colD,zTop,colW,colD,colH,A);                      // coluna frente
  box(gx-4,-colD-4,beamZ,colW+8,Y+2*colD+8,beamH,A);        // travessa
  box(gx-7,-colD-2,beamZ+18,6,Y+2*colD+4,14,T);             // trilho da travessa
  box(gx+(colW-zW)/2,Y/2-46,zEnd-zLen,zW,92,zLen,Zc3);      // eixo Z
  const spx=gx+(colW-46)/2, spy=Y/2-28, spZ=zEnd-zLen-96;
  box(spx,spy,spZ,46,52,96,SP);                             // spindle
  box(spx+12,spy+14,spZ-16,22,24,16,["c1","c2","c3"]);      // pinça
  box(spx+18,spy+19,spZ-42,10,14,26,["tool1","tool2","tool3"]); // fresa
  box(gx,Y,zTop,colW,colD,colH,A);                          // coluna fundo
  cota(P(0,-colD-130,0),P(X,-colD-130,0),CX,`X ${fx(X)} m`,20,-9);
  cota(P(X+140,0,0),P(X+140,Y,0),CY,`Y ${fx(Y)} m`,26,20);
  cota(P(gx+colW/2,Y+colD+150,zTop),P(gx+colW/2,Y+colD+150,zTop+Zc),CZ,`Z ${Zc} mm`,-46,4);
  }

  build();                                                  // 1ª passada: mede em escala 1
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  const minX=Math.min(...xs), minY=Math.min(...ys);
  const bw=Math.max(...xs)-minX, bh=Math.max(...ys)-minY;
  const dispW=VIZ_W-2*VIZ_PADX, dispH=VIZ_H-VIZ_CAP-2*VIZ_PADY;
  k=Math.min(dispW/bw, dispH/bh);
  ox=VIZ_PADX-minX*k+(dispW-bw*k)/2;                        // centraliza na área útil
  oy=VIZ_PADY-minY*k+(dispH-bh*k)/2;
  build();                                                  // 2ª passada: desenha ajustado

  document.getElementById("viz").innerHTML=
    `<svg class="maquina" viewBox="0 0 ${VIZ_W} ${VIZ_H}" xmlns="http://www.w3.org/2000/svg">`+
    `<defs>${mk(CX)}${mk(CY)}${mk(CZ)}</defs>`+
    `<g class="corpo" stroke-width="1" stroke-linejoin="round">${out.join("")}</g>${ar}`+
    `<text x="${VIZ_W/2}" y="${VIZ_H-6}" fill="currentColor" opacity=".55" font-size="13" text-anchor="middle">Mesa ${fx(X)} × ${fx(Y)} m · pórtico móvel no X · curso Z ${Zc} mm — esquema ilustrativo</text></svg>`;
}

/* ---------- render ---------- */
const matDefs=[["aluminio","Alumínio"],["madeira","Madeira / MDF"]];
const transDefs=[["fuso","Fuso de esferas"],["correia","Correia"],["cremalheira","Cremalheira"]];
const motorDefs=Object.entries(MOTORS).map(([k,v])=>[k,v.label]);
const perfilDefs=Object.entries(PERFIS).map(([k,v])=>[k,v.label]);
const modoDefs=Object.entries(MODOS).map(([k,v])=>[k,v.label]);

function mkOpts(el,defs,key,onSel){
  el.innerHTML="";
  defs.forEach(([val,label])=>{
    const b=document.createElement("button");
    b.className="opt"+(state[key]===val?" sel":"");
    b.textContent=label;
    b.onclick=()=>{state[key]=val;if(onSel)onSel(val);persist();render();};
    el.appendChild(b);
  });
}

function persist(){localStorage.setItem("cncCfg",JSON.stringify(state));}

function render(){
  const perfilRecomendado = () => {
    if(state.mat==="madeira") return state.x>=1500 ? "p4040r" : "p4040b";
    return state.x>=1500 ? "p4080" : "p4040r";
  };
  mkOpts(document.getElementById("matOpts"),matDefs,"mat",()=>{
    state.motor = state.mat==="aluminio" ? "closed34" : "open23";
    if(state.mat==="aluminio"){ state.x=700; state.y=500; }
    else { state.x=1500; state.y=1000; }
    state.perfil = perfilRecomendado();
  });
  mkOpts(document.getElementById("xOpts"),LENS.map(l=>[l,(l/1000).toLocaleString("pt-BR")+" m"]),"x",()=>{state.perfil=perfilRecomendado();});
  mkOpts(document.getElementById("yOpts"),LENS.map(l=>[l,(l/1000).toLocaleString("pt-BR")+" m"]),"y");
  mkOpts(document.getElementById("zOpts"),ZLENS.map(l=>[l,l+" mm"]),"z");
  mkOpts(document.getElementById("transOpts"),transDefs,"trans");
  mkOpts(document.getElementById("motorOpts"),motorDefs,"motor");
  mkOpts(document.getElementById("perfilOpts"),perfilDefs,"perfil");
  mkOpts(document.getElementById("modoOpts"),modoDefs,"modo");
  document.getElementById("modoNote").textContent = MODOS[state.modo].note;

  document.getElementById("matNote").textContent = state.mat==="aluminio"
    ? "Alumínio exige rigidez: guia de 20 mm, fuso de esferas e malha fechada. Aqui vale a MENOR máquina que resolve o seu problema — quanto maior o vão, maior a flexão."
    : "Madeira e MDF perdoam mais: dá para usar malha aberta e componentes mais acessíveis, com um custo bem menor.";
  document.getElementById("transNote").textContent = {
    fuso:"Fuso de esferas: elimina a folga (backlash) — o recomendado para alumínio. Acima de 1,5 m o fuso pode chicotear em altas rotações.",
    correia:"Correia T10: barata e rápida, mas tem elasticidade — ok para madeira, não recomendada para corte de alumínio de qualidade.",
    cremalheira:"Cremalheira: boa para máquinas longas (2 m+), exige redução no motor. Comum em routers grandes de madeira/plasma."
  }[state.trans];
  document.getElementById("axisNote").innerHTML =
    (state.x===700&&state.y===500
      ? "<b style='color:var(--ok)'>✓ 700 × 500 mm é o ponto de equilíbrio para alumínio</b> — resolve a maioria das peças com menos vão livre, menos flexão e menos erro acumulado. "
      : "")+
    "X = eixo longitudinal (pórtico, 2 lados / 2 motores). Y = travessa do pórtico. Z = profundidade (curso vertical) — sempre com fuso de esferas; quanto maior o curso, maior a alavanca do spindle.";
  document.getElementById("motorNote").textContent = MOTORS[state.motor].note;
  const pmN = perfilMetros(state.x/1000,state.y/1000);
  document.getElementById("perfilNote").textContent =
    PERFIS[state.perfil].nota + ` Metragem calculada: ${pmN.m.toLocaleString("pt-BR")} m (${pmN.breakdown}).`;

  const box=document.getElementById("alertBox");
  const warns=[];
  if(state.mat==="aluminio"&&state.trans==="correia") warns.push("⚠ Correia em máquina para ALUMÍNIO: a elasticidade vira vibração e marca na peça. Considere fuso de esferas.");
  if(state.mat==="aluminio"&&(state.x>1500||state.y>1500)) warns.push("⚠ Eixos acima de 1,5 m para alumínio: a flexão cresce de forma não linear e exigiria guias e estrutura bem maiores. Prefira a menor máquina que resolve o seu problema.");
  if(state.trans==="fuso"&&state.x===2000) warns.push("⚠ Fuso de 2 m: risco de chicoteamento em velocidade — considere fuso rotativo (castanha acionada) ou cremalheira para esse comprimento.");
  if(state.mat==="aluminio"&&state.motor!=="closed34") warns.push("⚠ Motorização em malha aberta para ALUMÍNIO: a perda de passo não é detectada e a peça sai fora de medida. Prefira malha fechada.");
  if(state.motor==="open23"&&(state.x>=1500||state.mat==="aluminio")) warns.push("⚠ NEMA 23 em pórtico pesado ou eixo ≥ 1,5 m: torque provavelmente insuficiente — considere NEMA 34.");
  if(state.mat==="aluminio"&&state.perfil==="p4040b") warns.push("⚠ Perfil 40x40 básico com guia de 20 mm e fuso Ø20: a seção vira o elo fraco. Use no mínimo o 40x40 reforçado, e de preferência 40x80 nas longarinas do X.");
  if(state.x>=1500&&(state.perfil==="p4040b"||state.perfil==="p4040r")) warns.push("⚠ Eixo X de "+(state.x/1000).toLocaleString("pt-BR")+" m com perfil 40x40: a flexão no vão cresce de forma não linear. Considere 40x80 ou 80x80 nas longarinas.");
  if(state.z>=500&&state.mat==="aluminio") warns.push("⚠ Eixo Z de 500 mm para alumínio: cada milímetro a mais aumenta a alavanca do spindle e vira vibração. Use só se realmente precisar da altura.");
  box.style.display=warns.length?"block":"none";
  box.innerHTML=warns.join("<br>");

  const rows=buildBOM();
  const tb=document.getElementById("bom");
  tb.innerHTML="";
  let total=0, catTotals={}, cats=[];
  rows.forEach(r=>{
    // item travado ignora edições e exclusões (inclusive as deixadas pelo outro modo)
    const o = r.lock ? {} : (overrides[r.id]||{});
    r.qtyEff = o.qty!==undefined?o.qty:r.qty;
    r.priceEff = o.price!==undefined?o.price:r.price;
    r.itemEff = o.item!==undefined?o.item:r.item;
    r.detEff = o.det!==undefined?o.det:(r.det||"");
    r.unitEff = o.unit!==undefined?o.unit:r.unit;
    r.linkEff = o.link||r.link;
    r.storeEff = o.store||r.store;
    r.customLink = !!o.link;
    r.off = r.lock ? false : !!excluded[r.id];
    r.sub = r.off?0:r.qtyEff*r.priceEff;
    total+=r.sub;
    if(!catTotals[r.cat]){catTotals[r.cat]=0;cats.push(r.cat);}
    catTotals[r.cat]+=r.sub;
  });
  cats.forEach(cat=>{
    const trc=document.createElement("tr");trc.className="cat";
    trc.innerHTML=`<td colspan="8"><span class="catnome">${escAttr(cat)}</span>`+
      `<button class="addit" data-cat="${escAttr(cat)}" title="Acrescentar um item nesta categoria">+ item</button>`+
      `<span class="catsum">${fmt(catTotals[cat])}</span></td>`;
    tb.appendChild(trc);
    rows.filter(r=>r.cat===cat).forEach(r=>{
      const tr=document.createElement("tr");
      if(r.off) tr.className="off";
      const badge=r.chk?'<span class="chk">✔ VERIFICADO</span>':(r.est?'<span class="est">EST</span>':'');
      // data-label alimenta o layout de cartão no celular, onde a tabela vira lista
      tr.innerHTML= r.lock
        ? `<td class="cel-inc" data-label="Incluir"><span class="fixo" title="Item fixo do orçamento">•</span></td>`+
          `<td class="cel-item" data-label="Item">${escAttr(r.itemEff)}</td>`+
          `<td class="det" data-label="Detalhe">${escAttr(r.detEff)}</td>`+
          `<td class="num" data-label="Qtd">${r.qtyEff}</td>`+
          `<td data-label="Unid">${escAttr(r.unitEff)}</td>`+
          `<td class="num" data-label="Preço unit.">${fmt(r.priceEff)}</td>`+
          `<td class="num sub-total" data-label="Subtotal">${fmt(r.sub)}</td>`+
          `<td class="det" data-label="Loja">${r.storeEff||""}</td>`
        : `<td class="cel-inc" data-label="Incluir"><button class="inc${r.off?"":" on"}" data-id="${r.id}" aria-pressed="${r.off?"false":"true"}" title="${r.off?"Item excluído — clique para incluir":"Item incluído — clique para excluir"}"></button></td>`+
          `<td class="cel-item" data-label="Item">`+
            `<input class="nome" data-id="${r.id}" data-f="item" value="${escAttr(r.itemEff)}" placeholder="nome do item" aria-label="Nome do item"${r.off?" disabled":""}>`+
            badge+
            (r.extra?`<button class="rmit" data-id="${r.id}" title="Remover este item que você acrescentou">remover</button>`:"")+
          `</td>`+
          `<td class="det" data-label="Detalhe"><input class="descr" data-id="${r.id}" data-f="det" value="${escAttr(r.detEff)}" placeholder="descrição (opcional)" aria-label="Descrição"${r.off?" disabled":""}></td>`+
          `<td class="num" data-label="Qtd"><input class="qty" data-id="${r.id}" data-f="qty" type="number" min="0" step="any" value="${r.qtyEff}"${r.off?" disabled":""} aria-label="Quantidade"></td>`+
          `<td data-label="Unid"><input class="unid" data-id="${r.id}" data-f="unit" list="listaUnidades" value="${escAttr(r.unitEff)}" aria-label="Unidade"${r.off?" disabled":""}></td>`+
          `<td class="num" data-label="Preço unit."><input class="price" data-id="${r.id}" data-f="price" type="number" min="0" step="any" value="${+r.priceEff.toFixed(6)}"${r.off?" disabled":""} aria-label="Preço unitário"></td>`+
          `<td class="num sub-total" data-label="Subtotal">${r.off?"—":fmt(r.sub)}</td>`+
          `<td class="det" data-label="Loja">${r.linkEff?`<a href="${r.linkEff}" target="_blank" rel="noopener">${r.storeEff}</a>`:(r.storeEff||"")}`+
          `<button class="lnk${r.customLink?" custom":""}" data-id="${r.id}" aria-label="Trocar o link da loja" title="${r.customLink?"Link personalizado — clique para alterar":"Achou em outro site? Clique para colar o link novo"}">✎</button></td>`;
      tb.appendChild(tr);
    });
  });
  tb.querySelectorAll("input.qty,input.price").forEach(inp=>{
    inp.onchange=()=>{
      const id=inp.dataset.id,f=inp.dataset.f,v=parseFloat(inp.value);
      overrides[id]=overrides[id]||{};
      if(isNaN(v)){delete overrides[id][f];}else{overrides[id][f]=v;}
      salvaOverrides();
      render();
    };
  });
  // nome e descrição: texto livre. Guarda como está; vazio volta ao valor de fábrica.
  tb.querySelectorAll("input.nome,input.descr").forEach(inp=>{
    inp.onchange=()=>{
      const id=inp.dataset.id,f=inp.dataset.f,v=inp.value.trim();
      const base=rows.find(x=>x.id===id);
      overrides[id]=overrides[id]||{};
      if(v==="" && !(base&&base.extra)) delete overrides[id][f]; else overrides[id][f]=v;
      salvaOverrides();
      render();
    };
  });
  // unidade: entre m/cm/mm converte quantidade e preço para o subtotal não mudar de significado
  tb.querySelectorAll("input.unid").forEach(inp=>{
    inp.onchange=()=>{
      const id=inp.dataset.id, nova=inp.value.trim();
      const r=rows.find(x=>x.id===id);
      if(!r||!nova){ render(); return; }
      overrides[id]=overrides[id]||{};
      overrides[id].unit=nova;
      const conv=converteUnidade(r.qtyEff,r.priceEff,r.unitEff,nova);
      if(conv){ overrides[id].qty=conv.qty; overrides[id].price=conv.price; }
      salvaOverrides();
      render();
    };
  });
  tb.querySelectorAll("button.addit").forEach(btn=>{
    btn.onclick=()=>{
      const cat=btn.dataset.cat;
      const id="x"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      extras[cat]=extras[cat]||[];
      extras[cat].push({id,item:"",det:"",qty:1,unit:"pç",price:0,store:"",link:""});
      salvaExtras();
      render();
      const novo=document.querySelector(`input.nome[data-id="${id}"]`);
      if(novo){ novo.focus(); novo.scrollIntoView({block:"center",behavior:"smooth"}); }
    };
  });
  tb.querySelectorAll("button.rmit").forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.id;
      const r=rows.find(x=>x.id===id);
      const nome=(r&&r.itemEff)||"este item";
      if(!confirm(`Remover "${nome}" da lista?`)) return;
      Object.keys(extras).forEach(c=>{ extras[c]=(extras[c]||[]).filter(e=>e.id!==id); });
      delete overrides[id]; delete excluded[id];
      salvaExtras(); salvaOverrides();
      localStorage.setItem("cncExcluded",JSON.stringify(excluded));
      render();
    };
  });
  tb.querySelectorAll("button.lnk").forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.id, r=rows.find(x=>x.id===id);
      const url=prompt("Cole o link do produto (deixe vazio p/ manter, digite - para voltar ao original):", r.linkEff||"");
      if(url===null) return;
      overrides[id]=overrides[id]||{};
      if(url.trim()==="-"){ delete overrides[id].link; delete overrides[id].store; }
      else if(url.trim()!==""){
        overrides[id].link=url.trim();
        const loja=prompt("Nome da loja (opcional):", r.storeEff||"");
        if(loja&&loja.trim()) overrides[id].store=loja.trim();
        else { try{ overrides[id].store=new URL(url.trim()).hostname.replace("www.",""); }catch(e){} }
      }
      salvaOverrides();
      render();
    };
  });
  tb.querySelectorAll("button.inc").forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.id;
      if(excluded[id]) delete excluded[id]; else excluded[id]=true;
      localStorage.setItem("cncExcluded",JSON.stringify(excluded));
      render();
    };
  });
  document.getElementById("grandTotal").textContent=fmt(total);
  document.getElementById("cfgLabel").textContent=
    `${state.mat==="aluminio"?"Alumínio":"Madeira"} · X ${(state.x/1000).toLocaleString("pt-BR")} m × Y ${(state.y/1000).toLocaleString("pt-BR")} m × Z ${state.z} mm · ${transDefs.find(t=>t[0]===state.trans)[1]} · ${MOTORS[state.motor].label} · Perfil ${PERFIS[state.perfil].label}`;
  draw3D();
  window.__cncTotal = total;
}

document.getElementById("resetBtn").onclick=()=>{
  const qtdExtras=Object.values(extras).reduce((a,l)=>a+(l?l.length:0),0);
  const aviso="Isto descarta os preços, quantidades, nomes, descrições, unidades e links que você editou, e reinclui os itens excluídos."
    + (qtdExtras?`\n\nTambém apaga ${qtdExtras} item(ns) que você acrescentou.`:"")
    + "\n\nContinuar?";
  if(confirm(aviso)){
    overrides={};excluded={};extras={};
    localStorage.removeItem("cncOverrides");localStorage.removeItem("cncExcluded");localStorage.removeItem("cncExtras");
    render();
  }
};

/* ---------- exportação Excel (SpreadsheetML com fórmulas) ---------- */
function buildExcelXml(){
  const xs=v=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const cS=(v,st)=>`<Cell${st?` ss:StyleID="${st}"`:""}><Data ss:Type="String">${xs(v)}</Data></Cell>`;
  const cL=(v,url,st)=>`<Cell${st?` ss:StyleID="${st}"`:""}${url?` ss:HRef="${xs(url)}"`:""}><Data ss:Type="String">${xs(v)}</Data></Cell>`;
  const cN=(v,st)=>`<Cell${st?` ss:StyleID="${st}"`:""}><Data ss:Type="Number">${v}</Data></Cell>`;
  const cF=(f,st)=>`<Cell ss:Formula="${f}"${st?` ss:StyleID="${st}"`:""}><Data ss:Type="Number">0</Data></Cell>`;
  const row=(cells,extra)=>`<Row${extra||""}>${cells.join("")}</Row>`;

  const rows=buildBOM();
  rows.forEach(r=>{
    const o=r.lock?{}:(overrides[r.id]||{});
    r.qtyEff=o.qty!==undefined?o.qty:r.qty;
    r.priceEff=o.price!==undefined?o.price:r.price;
    r.itemEff=o.item!==undefined?o.item:r.item;
    r.detEff=o.det!==undefined?o.det:(r.det||"");
    r.unitEff=o.unit!==undefined?o.unit:r.unit;
    r.linkEff=o.link||r.link||""; r.storeEff=o.store||r.store||"";
    r.off=r.lock?false:!!excluded[r.id];
  });
  const cats=[...new Set(rows.map(r=>r.cat))];
  const cfg=document.getElementById("cfgLabel").textContent;

  let xr=[], rn=0, subRows=[];
  const push=(cells,extra)=>{xr.push(row(cells,extra));rn++;};
  push([cS("CUSTO CNC ROUTER","tit")]);
  push([cS("Configuração: "+cfg,"sub")]);
  push([cS("Exportado em "+new Date().toLocaleString("pt-BR")+" — edite QTD, PREÇO ou INCLUIR (1/0): os subtotais e o total recalculam sozinhos","sub")]);
  push([]);
  push(["Categoria","Item","Detalhe / uso","Incluir (1/0)","Qtd","Unid","Preço unit.","Subtotal","Loja","Link do produto"].map(h=>cS(h,"h")));
  cats.forEach(cat=>{
    const its=rows.filter(r=>r.cat===cat);
    its.forEach(r=>{
      push([cS(cat),cS(r.itemEff+(r.extra?" (acrescentado pelo cliente)":(r.est?" (estimativa)":""))), cS(r.detEff,"wrap"),
        cN(r.off?0:1), cN(r.qtyEff), cS(r.unitEff||""), cN(+r.priceEff.toFixed(6),"cur"),
        cF("=IF(RC[-4]=1,RC[-3]*RC[-1],0)","cur"), cS(r.storeEff), cL(r.linkEff?"abrir anúncio":"",r.linkEff||null)]);
    });
    push([cS(""),cS("SUBTOTAL — "+cat,"catB"),cS(""),cS(""),cS(""),cS(""),cS("","catB"),
      cF(`=SUM(R[-${its.length}]C:R[-1]C)`,"catB"),cS(""),cS("")]);
    subRows.push(rn);
    push([]);
  });
  push([cS(""),cS("TOTAL GERAL","tot"),cS(""),cS(""),cS(""),cS(""),cS("","tot"),
    cF("="+subRows.map(r=>`R${r}C`).join("+"),"tot"),cS(""),cS("")]);

  // aba 2: quem pediu, o que escolheu e para onde responder
  const c = (typeof contato==="object" && contato) ? contato : {};
  const val = k => String(c[k]||"").trim();
  let xq=[];
  xq.push(row([cS("SOLICITAÇÃO DE CNC ROUTER","tit")]));
  xq.push(row([cS("Gerada em "+new Date().toLocaleString("pt-BR"),"sub")]));
  xq.push(row([]));
  xq.push(row([cS("DADOS DO SOLICITANTE","tit")]));
  [["Nome",val("nome")],["E-mail",val("email")],["WhatsApp",val("whats")],
   ["Cidade / UF",val("cidade")],["O que pretende produzir",val("obs")]
  ].forEach(p=>xq.push(row([cS(p[0],"catB"),cS(p[1]||"—","wrap")])));
  xq.push(row([]));
  xq.push(row([cS("CONFIGURAÇÃO ESCOLHIDA","tit")]));
  [["Material",state.mat==="aluminio"?"Alumínio":"Madeira / MDF"],
   ["Eixo X",state.x+" mm"],["Eixo Y",state.y+" mm"],["Eixo Z (profundidade)",state.z+" mm"],
   ["Transmissão",transDefs.find(t=>t[0]===state.trans)[1]],
   ["Motorização",MOTORS[state.motor].label],
   ["Perfil de alumínio",PERFIS[state.perfil].label],
   ["Montagem",MODOS[state.modo].label]
  ].forEach(p=>xq.push(row([cS(p[0],"catB"),cS(p[1])])));
  xq.push(row([]));
  xq.push(row([cS("ENVIAR PARA","tit")]));
  [["E-mail",CONTATO.EMAIL],["WhatsApp",CONTATO.WHATSAPP_LABEL]]
    .forEach(p=>xq.push(row([cS(p[0],"catB"),cS(p[1])])));

  const xml=`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="tit"><Font ss:Bold="1" ss:Size="14"/></Style>
 <Style ss:ID="sub"><Font ss:Color="#666666"/></Style>
 <Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2F5597" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>
 <Style ss:ID="catB"><Font ss:Bold="1"/><Interior ss:Color="#D9E2F3" ss:Pattern="Solid"/><NumberFormat ss:Format="&quot;R$&quot;\\ #,##0.00##"/></Style>
 <Style ss:ID="cur"><NumberFormat ss:Format="&quot;R$&quot;\\ #,##0.00##"/></Style>
 <Style ss:ID="tot"><Font ss:Bold="1" ss:Size="12"/><Interior ss:Color="#FFE699" ss:Pattern="Solid"/><NumberFormat ss:Format="&quot;R$&quot;\\ #,##0.00##"/></Style>
 <Style ss:ID="wrap"><Alignment ss:WrapText="1" ss:Vertical="Top"/></Style>
</Styles>
<Worksheet ss:Name="Custo CNC"><Table>
 <Column ss:Width="130"/><Column ss:Width="290"/><Column ss:Width="260"/><Column ss:Width="70"/><Column ss:Width="45"/><Column ss:Width="40"/><Column ss:Width="85"/><Column ss:Width="95"/><Column ss:Width="170"/><Column ss:Width="110"/>
 ${xr.join("\n")}
</Table></Worksheet>
<Worksheet ss:Name="Configuração e Requisitos"><Table>
 <Column ss:Width="330"/><Column ss:Width="420"/>
 ${xq.join("\n")}
</Table></Worksheet>
</Workbook>`;
  const nome=`Custo CNC Router - ${state.mat} ${state.x}x${state.y}.xls`;
  return { xml, nome };
}
function excelBlob(){ const {xml}=buildExcelXml(); return new Blob(["﻿"+xml],{type:"application/vnd.ms-excel"}); }
function exportExcel(){ const {nome}=buildExcelXml(); baixarBlob(excelBlob(), nome); }
document.getElementById("xlsBtn").onclick=exportExcel;

/* ---------- enviar solicitação (config + Excel) ---------- */
function b64FromBlob(blob){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=()=>res(String(fr.result).split(",")[1]);
    fr.onerror=rej;
    fr.readAsDataURL(blob);
  });
}
const enviaBtn=document.getElementById("enviaBtn");
if(enviaBtn) enviaBtn.onclick=async()=>{
  const quem=(contato.nome||"").trim();
  const comoResponder=(contato.email||"").trim() || (contato.whats||"").trim();
  if(!quem || !comoResponder){
    alert("Preencha ao menos o seu nome e o e-mail ou WhatsApp, em \"Seus dados\", para conseguirmos retornar.");
    const alvo=document.querySelector('[data-ck="nome"]');
    if(alvo && alvo.focus) alvo.focus();
    return;
  }
  const {nome}=buildExcelXml();
  const blob=excelBlob();
  const cfg=document.getElementById("cfgLabel").textContent;
  const total=fmt(window.__cncTotal||0);
  const corpo=
    "Nova solicitação de CNC Router\n\n"+
    contatoTexto().join("\n")+"\n\n"+
    "Configuração: "+cfg+"\n"+
    "Montagem: "+MODOS[state.modo].label+"\n"+
    "Custo estimado no configurador: "+total+"\n\n"+
    "Segue em anexo a planilha com a lista de componentes e os cálculos.";
  const anexo={ nome, base64: await b64FromBlob(blob), blob };
  enviaBtn.disabled=true; enviaBtn.textContent="enviando…";
  try{
    const r=await enviarSolicitacao({assunto:"Solicitação CNC Router — "+quem, corpo,
      params:{nome:quem, email:contato.email||"", telefone:contato.whats||"", configuracao:cfg, total}, anexo});
    if(r.via==="emailjs") alert("Solicitação enviada com a planilha anexada. Em breve retornamos. Obrigado!");
    else alert("Baixamos a planilha e abrimos seu e-mail já preenchido para "+CONTATO.EMAIL+".\nAnexe o arquivo \""+nome+"\" que acabou de baixar e envie.");
  }catch(e){
    console.error(e);
    alert("Não foi possível preparar o envio. Exporte a planilha e envie para "+CONTATO.EMAIL+".");
  }finally{
    enviaBtn.disabled=false; enviaBtn.textContent="Enviar solicitação";
  }
};

render();

/* ---------- dados do solicitante (vão na planilha e no e-mail) ---------- */
const CONTKEY="cncContato";
let contato={};
try{contato=JSON.parse(localStorage.getItem(CONTKEY)||"{}")}catch(e){}
const contatoCampos=()=>[...document.querySelectorAll("[data-ck]")];
contatoCampos().forEach(el=>{
  const k=el.dataset.ck;
  el.value=contato[k]||"";
  el.oninput=()=>{contato[k]=el.value;localStorage.setItem(CONTKEY,JSON.stringify(contato));};
});
const contatoRotulos={nome:"Nome",email:"E-mail do cliente",whats:"WhatsApp do cliente",cidade:"Cidade / UF",obs:"O que pretende produzir"};
function contatoTexto(){
  return Object.keys(contatoRotulos)
    .filter(k=>(contato[k]||"").trim())
    .map(k=>contatoRotulos[k]+": "+contato[k].trim());
}
