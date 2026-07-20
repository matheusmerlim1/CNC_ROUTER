/* versionar.js — carimba a versão nos links de CSS/JS das páginas.
   O GitHub Pages serve os arquivos com Cache-Control: max-age=600, então o navegador
   segura a versão antiga por até 10 minutos (e às vezes bem mais, se revalidar mal).
   Com ?v=<hash do conteúdo>, o endereço muda quando o arquivo muda, e o navegador
   é obrigado a buscar o novo. Rodar antes de publicar:  node tools/versionar.js  */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const raiz = path.resolve(__dirname, "..");
const paginas = ["index.html", "configurador.html", "formulario-cliente.html"];

const hashDe = arquivo => {
  const abs = path.join(raiz, arquivo);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash("sha1").update(fs.readFileSync(abs)).digest("hex").slice(0, 8);
};

let alterados = 0;
for (const pagina of paginas) {
  const abs = path.join(raiz, pagina);
  const antes = fs.readFileSync(abs, "utf8");
  // pega href/src de assets locais, com ou sem ?v= anterior
  const depois = antes.replace(/(href|src)="(assets\/[^"?]+)(\?v=[^"]*)?"/g, (todo, attr, arquivo) => {
    const h = hashDe(arquivo);
    return h ? `${attr}="${arquivo}?v=${h}"` : todo;
  });
  if (depois !== antes) {
    fs.writeFileSync(abs, depois);
    alterados++;
    console.log("  versionado:", pagina);
  }
}
console.log(alterados ? `${alterados} página(s) atualizada(s).` : "Nada a fazer: versões já em dia.");
