"use strict";

/* ===== 1. Configurações e referências aos elementos do HTML ===== */
const LIMITE_CARACTERES = 5000;
const $ = (id) => document.getElementById(id);

const campo = $("mensagem");
const contador = $("contador");
const erro = $("erro");
const terminal = $("terminal");
const btnAnalisar = $("btn-analisar");

const EXEMPLO_SUSPEITO =
  "URGENTE: sua conta será bloqueada em 24 horas! Confirme sua senha e o código de verificação em http://banco-seguro-login.xyz/acesso. " +
  "Você ganhou um prêmio de R$ 1.000 grátis!";
const EXEMPLO_COMUM =
  "Oi! A reunião do grupo de informática é amanhã às 14h na sala 3. Leve o notebook. Qualquer dúvida me avisa.";

/* ===== 2. Regras de detecção =====
   Cada regra tem: nome, pontos, expressão regular (padrão) e explicação.
   O texto é normalizado (minúsculo, sem acentos) antes do teste. */
const REGRAS = [
  { nome: "Urgência ou ameaça de bloqueio", pontos: 25,
    padrao: /urgente|imediatamente|agora mesmo|em 24 horas|ultimas horas|prazo|expira|bloquead|bloqueio|suspens|cancelad/,
    explicacao: "Golpistas criam pressão para você agir sem pensar." },
  { nome: "Pedido de senha ou código", pontos: 30,
    padrao: /senha|codigo de verificacao|codigo de seguranca|codigo de autenticacao|token|cvv|confirme seus dados/,
    explicacao: "Empresas sérias não pedem senhas ou códigos por mensagem." },
  { nome: "Promessa de prêmio ou dinheiro", pontos: 20,
    padrao: /voce ganhou|ganhou|premio|sorteado|dinheiro gratis|gratis|heranca|reembolso/,
    explicacao: "Prêmios inesperados são isca comum em golpes." },
  { nome: "Presença de link", pontos: 15,
    padrao: /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|br|xyz|top|info|ru)\b/,
    explicacao: "Links podem levar a páginas falsas. Não clique sem verificar." },
  { nome: "Endereço HTTP (sem criptografia)", pontos: 10,
    padrao: /http:\/\//,
    explicacao: "HTTP não protege os dados enviados; sites legítimos usam HTTPS." },
  { nome: "Link encurtado", pontos: 10,
    padrao: /bit\.ly|tinyurl|goo\.gl|is\.gd|t\.co\//,
    explicacao: "Links encurtados escondem o destino real." }
];

/* ===== 3. Lógica de análise (funções pequenas) ===== */
function normalizarTexto(texto) {
  // Remove acentos e deixa tudo minúsculo para facilitar a comparação
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function classificarRisco(pontuacao) {
  if (pontuacao < 30) return { chave: "baixo", rotulo: "RISCO BAIXO" };
  if (pontuacao < 60) return { chave: "medio", rotulo: "RISCO MÉDIO" };
  return { chave: "alto", rotulo: "RISCO ALTO" };
}

function analisarTexto(texto) {
  const normalizado = normalizarTexto(texto);
  const sinais = [];
  let total = 0;
  for (const regra of REGRAS) {
    const achado = normalizado.match(regra.padrao);
    if (achado) {
      sinais.push({ nome: regra.nome, pontos: regra.pontos, explicacao: regra.explicacao, trecho: achado[0] });
      total += regra.pontos;
    }
  }
  const pontuacao = Math.min(100, Math.max(0, total)); // limita entre 0 e 100
  return { sinais, pontuacao, nivel: classificarRisco(pontuacao) };
}

function obterRecomendacao(chave) {
  const textos = {
    baixo: "Poucos indícios encontrados, mas continue atento. Em caso de dúvida, confirme com o remetente por outro canal.",
    medio: "Há sinais de alerta. Não clique em links nem envie dados; confirme pelo site ou app oficial.",
    alto: "Muitos sinais de alerta. Não clique, não responda e não informe dados. Apague e denuncie a mensagem."
  };
  return textos[chave];
}

/* ===== 4. Exibição do resultado (apenas textContent: seguro contra HTML injetado) ===== */
function mostrarResultado(r) {
  $("relatorio-vazio").hidden = true;
  $("resultado").hidden = false;

  const selo = $("selo");
  selo.textContent = r.nivel.rotulo;
  const classe = "nivel-" + r.nivel.chave;
  $("resultado").className = classe;

  $("pontos").textContent = String(r.pontuacao);
  $("barra").setAttribute("aria-valuenow", String(r.pontuacao));
  $("barra-preenchimento").style.width = r.pontuacao + "%";
  $("recomendacao").textContent = obterRecomendacao(r.nivel.chave);

  const lista = $("lista-sinais");
  lista.replaceChildren();
  if (r.sinais.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nenhum sinal das regras foi encontrado nesta mensagem.";
    lista.appendChild(li);
  }
  for (const s of r.sinais) {
    const li = document.createElement("li");
    const titulo = document.createElement("b");
    titulo.textContent = s.nome + " (+" + s.pontos + ")";
    const expl = document.createElement("span");
    expl.textContent = s.explicacao;
    const trecho = document.createElement("small");
    trecho.textContent = "Trecho detectado: " + s.trecho;
    li.append(titulo, document.createElement("br"), expl, trecho);
    lista.appendChild(li);
  }
}

/* ===== 5. Terminal visual (apenas decorativo) ===== */
function escreverNoTerminal(mensagem) {
  const linha = document.createElement("p");
  linha.textContent = mensagem;
  terminal.appendChild(linha);
  terminal.scrollTop = terminal.scrollHeight;
}

function esperar(ms) {
  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return new Promise((resolve) => setTimeout(resolve, reduzido ? 0 : ms));
}

/* ===== 6. Ações dos botões ===== */
function atualizarContador() {
  contador.textContent = campo.value.length + " / " + LIMITE_CARACTERES;
}

async function aoAnalisar() {
  const texto = campo.value.trim();
  erro.textContent = "";
  if (texto === "") { erro.textContent = "Cole uma mensagem antes de analisar."; campo.focus(); return; }
  if (texto.length > LIMITE_CARACTERES) { erro.textContent = "Mensagem acima de " + LIMITE_CARACTERES + " caracteres."; return; }

  btnAnalisar.disabled = true;
  for (const passo of ["Inicializando ferramentas…", "Analisando padrões…", "Verificando indicadores…"]) {
    escreverNoTerminal(passo);
    await esperar(600);
  }
  mostrarResultado(analisarTexto(texto));
  escreverNoTerminal("Análise concluída.");
  btnAnalisar.disabled = false;
  $("relatorio").scrollIntoView({ behavior: "smooth" });
}

function aoLimpar() {
  campo.value = "";
  erro.textContent = "";
  atualizarContador();
  $("resultado").hidden = true;
  $("relatorio-vazio").hidden = false;
  escreverNoTerminal("Campo limpo.");
  campo.focus();
}

function carregarExemplo(texto) {
  campo.value = texto;
  erro.textContent = "";
  atualizarContador();
  escreverNoTerminal("Exemplo carregado.");
}

/* ===== 8. Fundo animado: chuva de números binários (canvas) ===== */
function iniciarChuvaBinaria() {
  const canvas = $("binario");
  const ctx = canvas.getContext("2d");
  const tamanho = 16;           // tamanho de cada dígito em pixels
  let gotas = [];               // posição vertical de cada coluna

  function ajustarTela() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gotas = Array.from({ length: Math.floor(canvas.width / tamanho) }, () => Math.random() * canvas.height / tamanho);
  }

  function desenharQuadro(estatico) {
    // O retângulo semitransparente cria o rastro que some aos poucos
    ctx.fillStyle = estatico ? "#010814" : "rgba(1, 8, 20, 0.14)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#2e9bff";
    ctx.font = tamanho + "px monospace";
    gotas.forEach((linha, coluna) => {
      ctx.fillText(Math.random() < 0.5 ? "0" : "1", coluna * tamanho, linha * tamanho);
      if (linha * tamanho > canvas.height && Math.random() > 0.975) gotas[coluna] = 0;
      gotas[coluna] = gotas[coluna] + 1;
    });
  }

  ajustarTela();
  window.addEventListener("resize", ajustarTela);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (let i = 0; i < 40; i++) desenharQuadro(i === 0); // imagem fixa, sem animação
  } else {
    setInterval(() => desenharQuadro(false), 70);
  }
}

/* ===== 7. Inicialização ===== */
function iniciar() {
  campo.addEventListener("input", atualizarContador);
  btnAnalisar.addEventListener("click", aoAnalisar);
  $("btn-limpar").addEventListener("click", aoLimpar);
  $("btn-exemplo-suspeito").addEventListener("click", () => carregarExemplo(EXEMPLO_SUSPEITO));
  $("btn-exemplo-comum").addEventListener("click", () => carregarExemplo(EXEMPLO_COMUM));
  escreverNoTerminal("CyberGuard iniciado.");
  escreverNoTerminal("Aguardando mensagem…");
  atualizarContador();
  iniciarChuvaBinaria();
}
iniciar();