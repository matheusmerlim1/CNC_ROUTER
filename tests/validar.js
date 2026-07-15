"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
    for (const match of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)){
      const ref = match[1];
      if (!/^(?:https?:|mailto:|#)/.test(ref)) assert(fs.existsSync(path.join(root,ref)), `${file}: ativo ausente ${ref}`);
    }
  }
  assert(read("formulario-cliente.html").includes("@emailjs/browser@4"), "formulário sem SDK do EmailJS");
  for (const file of jsFiles) new vm.Script(read(file),{filename:file});
}

async function testContato(){
  let downloads=0;
  const anchor=fakeElement();
  anchor.click=()=>downloads++;
  const storage=new Map();
  const document={
    readyState:"loading",documentElement:{getAttribute(){return null;},setAttribute(){}},
    createElement:()=>anchor,getElementById:()=>null,addEventListener(){}
  };
  const window={document,location:{href:""},matchMedia:()=>({matches:false})};
  const context=vm.createContext({
    document,window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    URL:{createObjectURL:()=>"blob:test",revokeObjectURL(){}},Blob,console,setTimeout:fn=>{fn();return 1;},clearTimeout
  });
  vm.runInContext(read("assets/js/contato.js"),context,{filename:"assets/js/contato.js"});
  const result=await vm.runInContext(
    `enviarSolicitacao({assunto:"Teste",corpo:"Corpo",anexo:{nome:"teste.txt",base64:"dGVzdGU=",blob:new Blob(["teste"])}})`,
    context
  );
  assert.equal(result.via,"mailto");
  assert.equal(downloads,1,"fallback deve baixar exatamente um anexo");
  assert(window.location.href.startsWith("mailto:matheusmerlim@gmail.com"));
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
    let desenhos=0, svgExemplo="";
    for(const x of LENS) for(const y of LENS) for(const z of ZLENS){
      Object.assign(state,{x,y,z}); draw3D();
      const svg=document.getElementById("viz").innerHTML;
      if(svg.includes("NaN")||!svg.includes("<polygon")) throw new Error("SVG inválido");
      svgExemplo=svg;
      desenhos++;
    }
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
      grandeHoras:grande.qty,montadorLock,clienteLock,svg:svgExemplo,xml:excel.xml,nome:excel.nome};
  })()`,context);
  assert.equal(stats.combinacoes,5400);
  assert.equal(stats.desenhos,75);
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

(async()=>{
  testEstrutura();
  await testContato();
  const stats=await testConfigurador();
  console.log("OK — estrutura, sintaxe, fallback com download, Excel e SVG validados.");
  console.log(`OK — ${stats.combinacoes} combinações de BOM; ${stats.desenhos} combinações do desenho 3D.`);
  console.log(`OK — mão de obra: ${stats.baseHoras} h / R$ ${stats.baseValor}; máquina 1500×1000: ${stats.grandeHoras} h.`);
})().catch(err=>{console.error(err);process.exitCode=1;});
