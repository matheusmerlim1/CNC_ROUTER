/* contato.js — configuração central de contato + envio de solicitação (EmailJS com fallback mailto)
   Carregar ANTES dos JS de página. Requer o SDK do EmailJS carregado no <head> para o envio automático. */
"use strict";

const CONTATO = {
  EMAIL: "matheusmerlim@gmail.com",
  WHATSAPP: "5522992074505",              // formato internacional para wa.me (55 + DDD + número)
  WHATSAPP_LABEL: "(22) 99207-4505",
  EMAILJS: {
    serviceId:  "service_rhvn7od",        // fornecido pelo Matheus
    templateId: "",                        // TODO: EmailJS → Email Templates → ID (formato template_xxxxxxx)
    publicKey:  "",                        // TODO: EmailJS → Account → General/API Keys → Public Key
    /* Anexo desligado: o plano atual do EmailJS não permite, e o base64 da planilha
       (~40 KB) estourava o limite de payload junto com a tabela. A lista vai no corpo
       do e-mail como tabela HTML. Ligue de novo se o plano passar a permitir. */
    enviarAnexo: false
  }
};

// EmailJS está pronto para enviar de verdade (com anexo) só quando as 3 chaves + o SDK existem
const emailjsPronto = () =>
  typeof window !== "undefined" && window.emailjs &&
  CONTATO.EMAILJS.serviceId && CONTATO.EMAILJS.templateId && CONTATO.EMAILJS.publicKey;

// inicializa o SDK se a public key já foi preenchida
if (typeof window !== "undefined" && window.emailjs && CONTATO.EMAILJS.publicKey) {
  try { emailjs.init({ publicKey: CONTATO.EMAILJS.publicKey }); } catch (e) { /* ignora */ }
}

function waLink(msg){
  return "https://wa.me/" + CONTATO.WHATSAPP + (msg ? ("?text=" + encodeURIComponent(msg)) : "");
}
function mailtoLink(assunto, corpo){
  return "mailto:" + CONTATO.EMAIL + "?subject=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(corpo);
}

/* Copia texto. O clipboard novo exige contexto seguro (https), então cai no método
   antigo quando a página abre por file:// */
async function copiarTexto(txt){
  try{
    if (navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(txt); return true; }
  }catch(e){ /* tenta o método antigo */ }
  try{
    const ta = document.createElement("textarea");
    ta.value = txt; ta.setAttribute("readonly","");
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }catch(e){ return false; }
}

/* Gatilho de download de um Blob (usado para o cliente anexar manualmente) */
function baixarBlob(blob, nome){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* Envia uma solicitação.
   opts: { assunto, corpo, params={}, anexo={nome,base64,blob} }
   Retorna { ok, via, erro }:
     via "emailjs"    -> enviado de verdade, sem sair da página
     via "sem-config" -> EmailJS não configurado; quem chamou resolve (WhatsApp/cópia)
     via "falhou"     -> EmailJS configurado mas recusou o envio

   Não abre `mailto`: isso jogava o cliente no Outlook, que muitas vezes nem está
   configurado, e a solicitação morria ali. O envio de verdade depende do EmailJS. */
async function enviarSolicitacao(opts){
  const { assunto, corpo, params = {}, anexo = null } = opts;

  if (!emailjsPronto()) return { ok:false, via:"sem-config" };

  try{
    const p = Object.assign({ assunto, mensagem: corpo, to_email: CONTATO.EMAIL, reply_to: params.email || "" }, params);
    if (anexo && CONTATO.EMAILJS.enviarAnexo){ p.anexo = anexo.base64; p.anexo_nome = anexo.nome; }
    await emailjs.send(CONTATO.EMAILJS.serviceId, CONTATO.EMAILJS.templateId, p);
    return { ok:true, via:"emailjs" };
  }catch(e){
    console.warn("EmailJS recusou o envio.", e);
    return { ok:false, via:"falhou", erro:e };
  }
}

/* ---------- tema claro/escuro (botão #temaBtn no cabeçalho) ---------- */
function temaAtual(){
  return document.documentElement.getAttribute("data-theme")
    || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
function initTema(){
  const salvo = localStorage.getItem("tema");
  if (salvo) document.documentElement.setAttribute("data-theme", salvo);
  const b = document.getElementById("temaBtn");
  if (!b) return;
  const pinta = () => { b.textContent = temaAtual()==="dark" ? "☀" : "☾"; b.title = "Alternar tema claro/escuro"; };
  b.onclick = () => {
    const prox = temaAtual()==="dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", prox);
    localStorage.setItem("tema", prox);
    pinta();
  };
  pinta();
}
if (typeof document !== "undefined"){
  if (document.readyState !== "loading") initTema();
  else document.addEventListener("DOMContentLoaded", initTema);
}

// exporta para Node (testes) sem afetar o browser
if (typeof module !== "undefined" && module.exports){
  module.exports = { CONTATO, emailjsPronto, waLink, mailtoLink, enviarSolicitacao };
}
