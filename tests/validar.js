"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function fakeElement(){
  return {
    value:"", textContent:"", innerHTML:"", checked:false, disabled:false, type:"text",
    dataset:{}, style:{}, children:[],
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    appendChild(child){this.children.push(child);return child;},
    addEventListener(){}, click(){},
    querySelector(){return null;}, querySelectorAll(){return [];}, closest(){return null;},
    previousElementSibling:null
  };
}

function configuradorContext(){
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, fakeElement());
    return nodes.get(id);
  };
  const storage = new Map();
  const document = {
    readyState:"loading",
    documentElement:{getAttribute(){return null;},setAttribute(){}},
    getElementById:get,
    createElement:fakeElement,
    querySelector(){return fakeElement();},
    querySelectorAll(){return [];},
    addEventListener(){}
  };
  const localStorage = {
    getItem:key=>storage.has(key)?storage.get(key):null,
    setItem:(key,value)=>storage.set(key,String(value)),
    removeItem:key=>storage.delete(key)
  };
  const window = {document,localStorage,matchMedia:()=>({matches:false}),__cncTotal:0};
  const context = vm.createContext({
    document, localStorage, window, Blob, URL:{createObjectURL(){return "blob:test";},revokeObjectURL(){}},
    FileReader:function(){}, console, confirm:()=>false, prompt:()=>"", alert(){},
    setTimeout, clearTimeout, matchMedia:window.matchMedia
  });
  // a página carrega contato.js antes do configurador.js; o teste faz o mesmo
  vm.runInContext(read("assets/js/contato.js"), context, {filename:"assets/js/contato.js"});
  let source = read("assets/js/configurador.js");
  const antes = source;
  source = source.replace("\nrender();\n", "\n/* render desativado pelo teste */\n");
  assert.notEqual(source, antes, "âncora do render() mudou — ajuste o teste");
  vm.runInContext(source, context, {filename:"assets/js/configurador.js"});
  return context;
}

function testEstrutura(){
  const htmlFiles = ["index.html","configurador.html","formulario-cliente.html"];
  const jsFiles = ["assets/js/contato.js","assets/js/index.js","assets/js/configurador.js","assets/js/formulario.js"];
  for (const file of [...htmlFiles,...jsFiles,"assets/css/base.css","assets/css/index.css","assets/css/configurador.css","assets/css/formulario.css"]){
    const text = read(file);
    assert(!text.includes("\uFFFD"), `${file}: caractere de substituição indica problema de encoding`);
  }
  for (const file of htmlFiles){
    const html = read(file);
    const keys = [...html.matchAll(/data-rk="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(keys).size, keys.length, `${file}: data-rk duplicado`);
    assert(!/<style[\s>]/i.test(html), `${file}: CSS inline em bloco`);
    assert(!/="var\(--/.test(html), `${file}: var() em atributo de apresentação — pinte por classe`);
    // sem ?v=<hash> o navegador segura o CSS/JS antigo e a atualização "não aparece"
    for (const m of html.matchAll(/(?:href|src)="(assets\/[^"?]+)(\?v=([^"]*))?"/g)){
      const esperado=crypto.createHash("sha1").update(fs.readFileSync(path.join(root,m[1]))).digest("hex").slice(0,8);
      assert.equal(m[3],esperado,`${file}: ${m[1]} sem versão em dia — rode: node tools/versionar.js`);
    }
    for (const match of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)){
      const ref = match[1].split("?")[0];        // tira o ?v=<hash> antes de procurar no disco
      if (!/^(?:https?:|mailto:|#)/.test(ref)) assert(fs.existsSync(path.join(root,ref)), `${file}: ativo ausente ${ref}`);
    }
  }
  assert(read("formulario-cliente.html").includes("@emailjs/browser@4"), "formulário sem SDK do EmailJS");
  for (const file of jsFiles) new vm.Script(read(file),{filename:file});
}

async function testContato(){
  const anchor=fakeElement();
  const storage=new Map();
  const document={
    readyState:"loading",documentElement:{getAttribute(){return null;},setAttribute(){}},
    createElement:()=>anchor,getElementById:()=>null,addEventListener(){}
  };
  const window={document,location:{href:""},matchMedia:()=>({matches:false})};
  const context=vm.createContext({
    document,window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    URL:{createObjectURL:()=>"blob:test",revokeObjectURL(){}},Blob,console,setTimeout:fn=>{fn();return 1;},clearTimeout,
    navigator:{}
  });
  vm.runInContext(read("assets/js/contato.js"),context,{filename:"assets/js/contato.js"});
  const result=await vm.runInContext(
    `enviarSolicitacao({assunto:"Teste",corpo:"Corpo",anexo:{nome:"teste.txt",base64:"dGVzdGU=",blob:new Blob(["teste"])}})`,
    context
  );
  // sem as chaves do EmailJS o envio não acontece — e não pode cair no mailto/Outlook
  assert.equal(result.via,"sem-config","sem EmailJS o envio precisa avisar, não abrir cliente de e-mail");
  assert.equal(result.ok,false,"sem EmailJS a solicitação não foi enviada de fato");
  assert.equal(window.location.href,"","enviarSolicitacao não pode navegar a página (era o pulo para o Outlook)");
  // o mailto continua existindo só para o botão E-mail da landing, escolha explícita de quem visita
  const link=vm.runInContext(`mailtoLink("Assunto","Corpo")`,context);
  assert(link.startsWith("mailto:matheusmerlim@gmail.com"),"mailtoLink segue disponível para a landing");
}

async function testConfigurador(){
  const context=configuradorContext();
  const stats=vm.runInContext(`(()=>{
    const mats=["aluminio","madeira"], transs=["fuso","correia","cremalheira"];
    const motors=Object.keys(MOTORS), perfis=Object.keys(PERFIS);
    let combinacoes=0, menor=Infinity, maior=0;
    for(const mat of mats) for(const trans of transs) for(const motor of motors) for(const perfil of perfis)
      for(const x of LENS) for(const y of LENS) for(const z of ZLENS){
        Object.assign(state,{mat,trans,motor,perfil,x,y,z});
        const rows=buildBOM();
        const ids=new Set(); let total=0;
        for(const row of rows){
          if(ids.has(row.id)) throw new Error("ID duplicado: "+row.id);
          ids.add(row.id);
          if(!Number.isFinite(row.qty)||!Number.isFinite(row.price)||row.qty<0||row.price<0) throw new Error("valor inválido: "+row.id);
          if(row.link && !row.link.startsWith("http://") && !row.link.startsWith("https://")) throw new Error("link inválido: "+row.id);
          total+=row.qty*row.price;
        }
        if(!(total>0&&Number.isFinite(total))) throw new Error("total inválido");
        menor=Math.min(menor,total); maior=Math.max(maior,total); combinacoes++;
      }
    let desenhos=0, svgExemplo="", cortados=[], rotulos=0;
    for(const x of LENS) for(const y of LENS) for(const z of ZLENS){
      Object.assign(state,{x,y,z}); draw3D();
      const svg=document.getElementById("viz").innerHTML;
      if(svg.includes("NaN")||!svg.includes("<polygon")) throw new Error("SVG inválido");
      // nenhum rótulo de cota pode vazar do viewBox: o texto fica deslocado da seta e some na borda
      const vb=svg.match(/viewBox="0 0 ([\\d.]+) ([\\d.]+)"/);
      if(!vb) throw new Error("viewBox inesperado");
      const vw=parseFloat(vb[1]), vh=parseFloat(vb[2]);
      for(const m of svg.matchAll(/<text x="([-\\d.]+)" y="([-\\d.]+)"[^>]*>([^<]+)<\\/text>/g)){
        const tx=parseFloat(m[1]), ty=parseFloat(m[2]), meia=m[3].length*4.6;
        rotulos++;
        if(tx-meia<0||tx+meia>vw||ty<0||ty>vh) cortados.push(x+"x"+y+"x"+z+' "'+m[3]+'"');
      }
      svgExemplo=svg;
      desenhos++;
    }
    if(cortados.length) throw new Error("rótulo cortado pela borda: "+cortados.slice(0,3).join(" | "));
    Object.assign(state,{mat:"aluminio",trans:"fuso",motor:"closed34",perfil:"p4040r",x:700,y:500,z:400,modo:"montador"});
    const base=buildBOM().find(r=>r.id==="maoobra");
    const montadorLock=!!base.lock;
    Object.assign(state,{modo:"cliente"});
    const clienteLock=!!buildBOM().find(r=>r.id==="maoobra").lock;
    Object.assign(state,{x:1500,y:1000});
    const grande=buildBOM().find(r=>r.id==="maoobra");
    Object.assign(state,{x:700,y:500});
    document.getElementById("cfgLabel").textContent="Teste 700 × 500";
    contato.nome="Fulano"; contato.email="fulano@exemplo.com"; contato.whats="(22) 90000-0000";
    const excel=buildExcelXml();
    return {combinacoes,desenhos,menor,maior,baseHoras:base.qty,baseValor:base.qty*base.price,
      grandeHoras:grande.qty,montadorLock,clienteLock,rotulos,svg:svgExemplo,xml:excel.xml,nome:excel.nome};
  })()`,context);
  assert.equal(stats.combinacoes,5400);
  assert.equal(stats.desenhos,75);
  // 4 rótulos por desenho (X, Y, Z e a legenda): garante que a checagem de corte de fato inspecionou
  assert.equal(stats.rotulos,300,"a checagem de rótulos não inspecionou o esperado");
  assert.equal(stats.baseHoras,60);
  assert.equal(stats.baseValor,4200);
  assert.equal(stats.grandeHoras,125);
  // modos: só o montador edita a mão de obra
  assert.equal(stats.montadorLock,false,"no modo montador a mão de obra deve ser editável");
  assert.equal(stats.clienteLock,true,"no modo cliente a mão de obra não pode ser editável");
  // o desenho pinta por classe: var() em atributo de apresentação falha em parte dos navegadores
  // e o fallback silencioso pintaria a máquina de preto
  assert(!/="var\(--/.test(stats.svg),"desenho não pode usar var() em atributo de apresentação");
  assert(stats.svg.includes('class="m1"')&&stats.svg.includes('class="corpo"'),"desenho deve pintar por classe");
  // a planilha precisa levar quem pediu e para onde responder
  assert(stats.xml.includes("DADOS DO SOLICITANTE"),"Excel sem o bloco do solicitante");
  assert(stats.xml.includes("Fulano")&&stats.xml.includes("fulano@exemplo.com"),"Excel sem os dados de contato preenchidos");
  assert(stats.xml.includes("ENVIAR PARA")&&stats.xml.includes("matheusmerlim@gmail.com"),"Excel sem o destino do envio");
  assert(stats.xml.includes("TOTAL GERAL"));
  assert.equal((stats.xml.match(/<Worksheet\b/g)||[]).length,2);
  assert.equal((stats.xml.match(/<Row\b/g)||[]).length,(stats.xml.match(/<\/Row>/g)||[]).length);
  assert.equal((stats.xml.match(/<Cell\b/g)||[]).length,(stats.xml.match(/<\/Cell>/g)||[]).length);
  assert(stats.xml.includes('ss:Formula="=IF(RC[-4]=1,RC[-3]*RC[-1],0)"'));
  const bytes=new Uint8Array(await vm.runInContext("excelBlob().arrayBuffer()",context));
  assert.deepEqual([...bytes.slice(0,3)],[0xEF,0xBB,0xBF],"arquivo Excel precisa começar com BOM UTF-8");
  return stats;
}

function testItensEditaveis(){
  const context=configuradorContext();
  return vm.runInContext(`(()=>{
    Object.assign(state,{mat:"aluminio",trans:"fuso",motor:"closed34",perfil:"p4040r",x:700,y:500,z:400,modo:"montador"});

    // 1) conversão de unidade preserva o subtotal (é o ponto da funcionalidade)
    const antes=5.8*174;
    const c=converteUnidade(5.8,174,"m","mm");
    const conv={qty:c.qty,price:c.price,subtotalIgual:Math.abs(c.qty*c.price-antes)<0.01};
    const ida=converteUnidade(1,1000,"m","cm");
    const volta=converteUnidade(ida.qty,ida.price,"cm","m");
    const roundTrip=(volta.qty===1&&volta.price===1000);
    const naoConversivel=converteUnidade(2,10,"pç","kit");

    // 2) item acrescentado pelo usuário aparece na categoria escolhida
    extras["Estrutura"]=[{id:"xteste",item:"Parafuso especial",det:"M8 inox",qty:10,unit:"pç",price:3.5,store:"Loja X",link:"https://exemplo.com/x"}];
    const comExtra=buildBOM();
    const ex=comExtra.find(r=>r.id==="xteste");

    // 3) nome, descrição e unidade editados chegam à planilha
    overrides["perfil"]={item:"Perfil renomeado",det:"descrição trocada",unit:"mm",qty:5800,price:0.174};
    document.getElementById("cfgLabel").textContent="Teste";
    const xml=buildExcelXml().xml;

    // item removido tem que sumir de tudo: da lista, da planilha e do texto do envio.
    // (antes o liga/desliga só zerava o subtotal e a linha continuava indo na planilha)
    const totalAntes=buildBOM().length;
    removidos["ddcs"]=true;
    const semItem=buildBOM();
    const xmlSem=buildExcelXml().xml;
    const textoSem=listaMaterialTexto();
    const remocao={
      sumiuDaLista:!semItem.some(r=>r.id==="ddcs"),
      contagem:totalAntes-semItem.length,
      sumiuDaPlanilha:!xmlSem.includes("DDCS Expert"),
      sumiuDoTexto:!textoSem.includes("DDCS Expert")
    };
    delete removidos["ddcs"];
    const voltou=buildBOM().some(r=>r.id==="ddcs");

    return {conv,roundTrip,naoConversivel,remocao,voltou,
      // preço por mm tem 3 casas: arredondar para 2 faria o total da planilha divergir da tela
      xmlPrecoCheio:xml.includes(">0.174<"),
      xmlSemArredondar:!xml.includes(">0.17<"),
      extraOk:!!ex, extraCat:ex&&ex.cat, extraMarcado:ex&&ex.extra===true,
      xmlTemExtra:xml.includes("Parafuso especial")&&xml.includes("acrescentado pelo cliente"),
      xmlTemNome:xml.includes("Perfil renomeado"),
      xmlTemDesc:xml.includes("descrição trocada"),
      xmlTemUnidade:xml.includes(">mm<")};
  })()`,context);
}

(async()=>{
  testEstrutura();
  await testContato();
  const stats=await testConfigurador();
  const ed=testItensEditaveis();
  // conversão: 5,8 m x R$174/m  ->  5800 mm x R$0,174/mm, com o mesmo subtotal
  assert.equal(ed.conv.qty,5800,"m -> mm deve multiplicar a quantidade por 1000");
  assert.equal(ed.conv.price,0.174,"m -> mm deve dividir o preço por 1000");
  assert(ed.conv.subtotalIgual,"a conversão de unidade não pode alterar o subtotal");
  assert(ed.roundTrip,"converter ida e volta tem que devolver os valores originais");
  assert.equal(ed.naoConversivel,null,"pç -> kit não é conversível: só troca o rótulo");
  // itens acrescentados
  assert(ed.extraOk,"item acrescentado deve entrar na lista");
  assert.equal(ed.extraCat,"Estrutura","item acrescentado deve ficar na categoria escolhida");
  assert(ed.extraMarcado,"item acrescentado deve vir marcado como extra");
  assert(ed.xmlTemExtra,"a planilha deve trazer o item acrescentado, identificado como tal");
  // edição de nome/descrição/unidade
  assert(ed.xmlTemNome,"nome editado deve chegar à planilha");
  assert(ed.xmlTemDesc,"descrição editada deve chegar à planilha");
  assert(ed.xmlTemUnidade,"unidade editada deve chegar à planilha");
  // sem isto, R$0,174/mm virava R$0,17/mm e o total da planilha não batia com o da tela
  assert(ed.xmlPrecoCheio,"a planilha precisa levar o preço com as casas decimais completas");
  assert(ed.xmlSemArredondar,"preço não pode ser arredondado para 2 casas na planilha");
  // remoção: o item tem que sumir de tudo, não só zerar o subtotal
  assert(ed.remocao.sumiuDaLista,"item removido não pode continuar na lista");
  assert.equal(ed.remocao.contagem,1,"remover deve tirar exatamente uma linha");
  assert(ed.remocao.sumiuDaPlanilha,"item removido NÃO pode ir na planilha (era o bug relatado)");
  assert(ed.remocao.sumiuDoTexto,"item removido não pode ir no texto do envio");
  assert(ed.voltou,"desfazer a remoção precisa devolver o item à lista");
  console.log("OK — estrutura, sintaxe, fallback com download, Excel e SVG validados.");
  console.log(`OK — ${stats.combinacoes} combinações de BOM; ${stats.desenhos} combinações do desenho 3D.`);
  console.log(`OK — mão de obra: ${stats.baseHoras} h / R$ ${stats.baseValor}; máquina 1500×1000: ${stats.grandeHoras} h.`);
  console.log(`OK — itens editáveis: 5,8 m → ${ed.conv.qty} mm a R$ ${ed.conv.price}/mm (subtotal preservado); extra e edições na planilha.`);
})().catch(err=>{console.error(err);process.exitCode=1;});
