/* index.js — liga os botões de contato da landing usando a config de contato.js */
"use strict";
(function(){
  const msg = "Olá! Vim pelo site da CNC Router e gostaria de tirar uma dúvida / seguir com um projeto.";
  const wa = document.getElementById("waBtn");
  if (wa) wa.href = waLink(msg);
  const mail = document.getElementById("mailBtn");
  if (mail) mail.href = mailtoLink("Solicitação — CNC Router", msg);
  const lbl = document.getElementById("waLabel");
  if (lbl) lbl.textContent = CONTATO.WHATSAPP_LABEL;
})();
