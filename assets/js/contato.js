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
    publicKey:  ""                         // TODO: EmailJS → Account → General/API Keys → Public Key
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

/* Gatilho de download de um Blob (usado no fallback para o cliente anexar manualmente) */
function baixarBlob(blob, nome){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* Envia uma solicitação.
   opts: { assunto, corpo, params={}, anexo=null, aoFinalizar=null }
   anexo (opcional): { nome, base64 }  base64 SEM o prefixo "data:...;base64,"
   Retorna { ok, via }  — via: "emailjs" | "mailto"
*/
async function enviarSolicitacao(opts){
  const { assunto, corpo, params = {}, anexo = null } = opts;

  if (emailjsPronto()){
    try{
      const p = Object.assign({ assunto, mensagem: corpo, to_email: CONTATO.EMAIL, reply_to: params.email || "" }, params);
      if (anexo){ p.anexo = anexo.base64; p.anexo_nome = anexo.nome; }
      await emailjs.send(CONTATO.EMAILJS.serviceId, CONTATO.EMAILJS.templateId, p);
      return { ok:true, via:"emailjs" };
    }catch(e){
      console.warn("EmailJS falhou — usando fallback mailto.", e);
    }
  }

  // Fallback: abre o e-mail do cliente já preenchido (o anexo o cliente anexa manualmente,
  // pois a página estática não consegue anexar sozinha sem EmailJS configurado).
  if (anexo && anexo.blob) baixarBlob(anexo.blob, anexo.nome);
  const corpoFinal = corpo + (anexo ? ("\n\n[Anexe o arquivo que baixou junto: " + anexo.nome + "]") : "");
  window.location.href = mailtoLink(assunto, corpoFinal);
  return { ok:true, via:"mailto" };
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
