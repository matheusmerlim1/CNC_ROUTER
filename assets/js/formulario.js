/* formulario.js — salva respostas, exporta .txt, envia solicitação. Requer contato.js. */
"use strict";
const KEY="clienteReq";
let dados={};
try{dados=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
const fields=[...document.querySelectorAll("[data-rk]")];
const saved=document.getElementById("savedMsg");
let t=null;
function flash(){saved.textContent="✔ salvo";clearTimeout(t);t=setTimeout(()=>saved.textContent="",1500);}
fields.forEach(el=>{
  const k=el.dataset.rk;
  if(el.type==="checkbox"){ el.checked=!!dados[k]; el.onchange=()=>{dados[k]=el.checked;localStorage.setItem(KEY,JSON.stringify(dados));flash();}; }
  else{ el.value=dados[k]||""; el.oninput=()=>{dados[k]=el.value;localStorage.setItem(KEY,JSON.stringify(dados));flash();}; }
});

function montarTexto(){
  const linhas=["01-FORM-001 — REQUISITOS DO PRODUTO (CLIENTE)","Gerado em: "+new Date().toLocaleString("pt-BR"),""];
  document.querySelectorAll(".sec").forEach(sec=>{
    const titulo=sec.querySelector("h2").textContent;
    const resp=[];
    sec.querySelectorAll("[data-rk]").forEach(el=>{
      const l=el.dataset.l||el.dataset.rk;
      if(el.type==="checkbox"){ if(el.checked) resp.push("  [x] "+l); }
      else if(el.value.trim()) resp.push("  "+l+": "+el.value.trim());
    });
    if(resp.length){ linhas.push(titulo); linhas.push(...resp); linhas.push(""); }
  });
  return linhas.join("\r\n");
}
function textoBlob(){ return new Blob([montarTexto()],{type:"text/plain;charset=utf-8"}); }

document.getElementById("txtBtn").onclick=()=>baixarBlob(textoBlob(),"requisitos-produto-cliente.txt");
document.getElementById("pdfBtn").onclick=()=>window.print();
document.getElementById("limparBtn").onclick=()=>{
  if(confirm("Apagar todas as respostas deste formulário?")){
    dados={};localStorage.removeItem(KEY);
    fields.forEach(el=>{ if(el.type==="checkbox") el.checked=false; else el.value=""; });
  }
};

function b64FromBlob(blob){
  return new Promise((res,rej)=>{ const fr=new FileReader();
    fr.onload=()=>res(String(fr.result).split(",")[1]); fr.onerror=rej; fr.readAsDataURL(blob); });
}
const enviarBtn=document.getElementById("enviarBtn");
enviarBtn.onclick=async()=>{
  const nome=(dados.cli_nome||"cliente").trim();
  const corpo="Nova solicitação de produto — formulário 01-FORM-001\n\n"+montarTexto();
  const blob=textoBlob();
  const anexo={ nome:"requisitos-"+nome.replace(/\s+/g,"-").toLowerCase()+".txt", base64: await b64FromBlob(blob), blob };
  enviarBtn.disabled=true; enviarBtn.textContent="enviando…";
  try{
    const r=await enviarSolicitacao({assunto:"Solicitação de produto — "+(nome||"cliente"),
      corpo, params:{nome, email:dados.cli_email||"", telefone:dados.cli_tel||""}, anexo});
    if(r.via==="emailjs"){
      alert("Solicitação enviada. Em breve retornamos. Obrigado!");
      return;
    }
    // sem EmailJS não há envio automático: copia tudo e leva ao WhatsApp, sem passar pelo Outlook
    baixarBlob(blob,anexo.nome);
    const copiou=await copiarTexto(corpo);
    const irWhats=confirm(
      (copiou?"Copiamos suas respostas e baixamos o arquivo.":"Baixamos o arquivo com suas respostas.")+
      "\n\nQuer enviar agora pelo WhatsApp?");
    if(irWhats) window.open(waLink(corpo.slice(0,1500)),"_blank","noopener");
    else if(copiou) alert("Suas respostas estão na área de transferência.\nCole no e-mail para "+CONTATO.EMAIL+".");
  }catch(e){
    console.error(e);
    alert("Não foi possível preparar o envio. Exporte as respostas e envie para "+CONTATO.EMAIL+".");
  }finally{
    enviarBtn.disabled=false; enviarBtn.textContent="Enviar solicitação";
  }
};
