// Número do WhatsApp que receberá os pedidos
const NUMERO_WHATSAPP = "551126690644"; 

// Estados Globais da Aplicação
let cardapioOriginal = { categorias: [], itens: [] };
let carrinhoState = {}; // Estrutura: { "id_do_item": quantidade }
let categoriaAtiva = "todos";

// CORREÇÃO: guardamos os botões já criados para não recriar o HTML a cada
// clique. Recriar o innerHTML do container toda vez zerava o scrollLeft da
// barra de categorias (overflow-x-auto), fazendo a tela "voltar pro início"
// sempre que você clicava numa categoria mais à direita (Bebidas, Vinhos...).
let botoesCategoria = []; // [{ id: "salgada", el: <button> }, ...]

// 1. Inicialização do Site
document.addEventListener("DOMContentLoaded", async () => {
    await carregarCardapio();
    configurarEventos();
    iniciarAutoplayCarrossel();
    habilitarArrastarComMouse("categorias-container");
    lucide.createIcons();
});

// NOVO: permite arrastar a barra de categorias com o botão do mouse
// (por padrão, overflow-x-auto só rola com touch/trackpad/scrollbar,
// não com "clicar e arrastar" no desktop — por isso parecia travado).
function habilitarArrastarComMouse(idContainer) {
    const container = document.getElementById(idContainer);
    if (!container) return;

    let arrastando = false;
    let posInicialX = 0;
    let scrollInicial = 0;

    container.addEventListener("mousedown", (e) => {
        arrastando = true;
        container.classList.add("cursor-grabbing");
        posInicialX = e.pageX - container.offsetLeft;
        scrollInicial = container.scrollLeft;
    });

    container.addEventListener("mouseleave", () => {
        arrastando = false;
        container.classList.remove("cursor-grabbing");
    });

    container.addEventListener("mouseup", () => {
        arrastando = false;
        container.classList.remove("cursor-grabbing");
    });

    container.addEventListener("mousemove", (e) => {
        if (!arrastando) return;
        e.preventDefault();
        const posAtualX = e.pageX - container.offsetLeft;
        const distancia = (posAtualX - posInicialX) * 1.2; // multiplicador de sensibilidade
        container.scrollLeft = scrollInicial - distancia;
    });
}

// Busca os dados do arquivo JSON local
async function carregarCardapio() {
    try {
        const response = await fetch("assets/js/cardapio.json");
        if (!response.ok) throw new Error("Erro ao carregar o cardápio.");
        cardapioOriginal = await response.json();
        
        renderizarFiltrosCategorias();
        renderizarCardapio();
    } catch (error) {
        console.error("Erro de carregamento:", error);
    }
}

// 2. Renderização de Categorias e Itens

// CORREÇÃO: essa função agora só roda UMA VEZ (na carga inicial do cardápio).
// Ela monta os botões e guarda a referência de cada um em `botoesCategoria`.
// Depois disso, o clique não recria mais nada aqui — só troca classes
// (ver atualizarEstiloBotoesCategoria).
function renderizarFiltrosCategorias() {
    const container = document.getElementById("categorias-container");
    if (!container) return; // Proteção: impede erro se o elemento não existir na página

    container.innerHTML = "";
    botoesCategoria = [];

    // Botão "Todas"
    const btnTodas = document.createElement("button");
    btnTodas.innerText = "Todas";
    btnTodas.onclick = () => alternarCategoria("todos");
    container.appendChild(btnTodas);
    botoesCategoria.push({ id: "todos", el: btnTodas });

    // Categorias do JSON
    cardapioOriginal.categorias.forEach(cat => {
        const btnCat = document.createElement("button");
        btnCat.innerText = cat.nome;
        btnCat.onclick = () => alternarCategoria(cat.id);
        container.appendChild(btnCat);
        botoesCategoria.push({ id: cat.id, el: btnCat });
    });

    atualizarEstiloBotoesCategoria();
}

// NOVA FUNÇÃO: só troca as classes de cor/estado dos botões já existentes,
// sem tocar no DOM do container (preserva a posição do scroll horizontal).
function atualizarEstiloBotoesCategoria() {
    botoesCategoria.forEach(({ id, el }) => {
        const ativo = id === categoriaAtiva;
        el.className = `btn btn-sm rounded-full px-5 border-none shrink-0 ${
            ativo ? 'bg-terracotta-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700'
        }`;
    });
}

// CORREÇÃO: não chama mais renderizarFiltrosCategorias() (que recriava tudo).
// Agora só atualiza o estilo dos botões existentes + redesenha o cardápio.
function alternarCategoria(idCategoria) {
    categoriaAtiva = idCategoria;
    atualizarEstiloBotoesCategoria();
    renderizarCardapio();
}

function renderizarCardapio() {
    const grid = document.getElementById("cardapio-grid");
    if (!grid) return; // Proteção: impede erro se o elemento não existir na página
    
    grid.innerHTML = "";

    const itensFiltrados = categoriaAtiva === "todos" 
        ? cardapioOriginal.itens 
        : cardapioOriginal.itens.filter(item => item.categoriaId === categoriaAtiva);

    itensFiltrados.forEach(item => {
        const itemNoCarrinho = carrinhoState[item.id] || 0;
        
        const card = document.createElement("div");
        card.className = "card card-side bg-white shadow-sm border border-orange-100 rounded-2xl overflow-hidden h-36";
        
        card.innerHTML = `
            <figure class="w-1/3 min-w-[120px] h-full relative">
                <img src="${item.imagem}" alt="${item.nome}" class="object-cover w-full h-full" />
            </figure>
            <div class="card-body p-4 w-2/3 justify-between">
                <div>
                    <h3 class="font-bold text-gray-900 text-sm leading-tight">${item.nome}</h3>
                    <p class="text-xs text-gray-500 mt-1 line-clamp-2">${item.descricao}</p>
                </div>
                <div class="flex items-center justify-between mt-2">
                    <span class="text-base font-bold text-terracotta-600">R$ ${item.preco.toFixed(2)}</span>
                    <div class="flex items-center gap-2">
                        ${itemNoCarrinho > 0 ? `
                            <button onclick="alterarQuantidade('${item.id}', -1)" class="btn btn-xs btn-circle bg-gray-100 text-gray-800 border-none hover:bg-gray-200">
                                <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                            </button>
                            <span class="font-semibold text-sm w-4 text-center">${itemNoCarrinho}</span>
                            <button onclick="alterarQuantidade('${item.id}', 1)" class="btn btn-xs btn-circle bg-terracotta-500 text-white border-none hover:bg-terracotta-600">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                            </button>
                        ` : `
                            <button onclick="alterarQuantidade('${item.id}', 1)" class="btn btn-xs rounded-full bg-terracotta-500 hover:bg-terracotta-600 text-white border-none px-4">
                                Adicionar
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    
    lucide.createIcons();
}

// 3. Gerenciamento do Carrinho
function alterarQuantidade(id, delta) {
    const qtyAtual = carrinhoState[id] || 0;
    const novaQty = qtyAtual + delta;

    if (novaQty <= 0) {
        delete carrinhoState[id];
    } else {
        carrinhoState[id] = novaQty;
    }

    if (delta > 0 && qtyAtual === 0) {
        const itemObj = cardapioOriginal.itens.find(i => i.id === id);
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500,
            timerProgressBar: false
        });
        Toast.fire({
            icon: 'success',
            title: `${itemObj.nome} adicionado!`
        });
    }

    atualizarIndicadores();
    renderizarCardapio();
}

function calcularTotal() {
    return Object.entries(carrinhoState).reduce((totalAcumulado, [id, qty]) => {
        const item = cardapioOriginal.itens.find(i => i.id === id);
        return totalAcumulado + (item ? item.preco * qty : 0);
    }, 0);
}

function totalItens() {
    return Object.values(carrinhoState).reduce((a, b) => a + b, 0);
}

function atualizarIndicadores() {
    const total = calcularTotal();
    const totalItensCount = totalItens();

    const badge = document.getElementById("badge-cart");
    if (badge) {
        if (totalItensCount > 0) {
            badge.innerText = totalItensCount;
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
        }
    }

    const bottomBar = document.getElementById("bottom-bar");
    const bottomTotalText = document.getElementById("bottom-bar-total");
    
    if (bottomBar && bottomTotalText) {
        if (totalItensCount > 0) {
            bottomTotalText.innerText = `R$ ${total.toFixed(2)}`;
            bottomBar.classList.remove("translate-y-full");
        } else {
            bottomBar.classList.add("translate-y-full");
        }
    }
}

// 4. Fluxo de Checkout e Envio Seguro para WhatsApp
function abrirCarrinho() {
    const modal = document.getElementById("modal_carrinho");
    const listaHtml = document.getElementById("carrinho-itens-lista");
    const totalText = document.getElementById("modal-total");

    if (!modal || !listaHtml || !totalText) return;

    listaHtml.innerHTML = "";

    if (totalItens() === 0) {
        listaHtml.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <i data-lucide="frown" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                <p>Seu carrinho está vazio.</p>
            </div>
        `;
        totalText.innerText = "R$ 0,00";
        lucide.createIcons();
        modal.showModal();
        return;
    }

    Object.entries(carrinhoState).forEach(([id, qty]) => {
        const item = cardapioOriginal.itens.find(i => i.id === id);
        if (!item) return;

        const row = document.createElement("div");
        row.className = "flex justify-between items-center bg-gray-50 p-3 rounded-xl";
        row.innerHTML = `
            <div class="flex-1 min-w-0 pr-2">
                <h4 class="font-bold text-sm text-gray-900 truncate">${item.nome}</h4>
                <span class="text-xs text-gray-500">R$ ${item.preco.toFixed(2)} un.</span>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-sm font-semibold text-gray-800">x${qty}</span>
                <span class="font-bold text-sm text-gray-950 min-w-[60px] text-right">R$ ${(item.preco * qty).toFixed(2)}</span>
            </div>
        `;
        listaHtml.appendChild(row);
    });

    totalText.innerText = `R$ ${calcularTotal().toFixed(2)}`;
    lucide.createIcons();
    modal.showModal();
}

function fecharCarrinho() {
    const modal = document.getElementById("modal_carrinho");
    if (modal) modal.close();
}

function configurarEventos() {
    const form = document.getElementById("checkout-form");
    if (!form) return;
    
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const nome = document.getElementById("nome-cliente").value;
        const endereco = document.getElementById("endereco-cliente").value;
        const pagamento = document.getElementById("pagamento-cliente").value;

        enviarPedidoParaWhatsApp(nome, endereco, pagamento);
    });
}

function enviarPedidoParaWhatsApp(nome, endereco, pagamento) {
    if (totalItens() === 0) return;

    let itensTexto = "";
    Object.entries(carrinhoState).forEach(([id, qty]) => {
        const item = cardapioOriginal.itens.find(i => i.id === id);
        if (item) {
            itensTexto += `- ${qty}x ${item.nome} [${id}]\n`;
        }
    });

    const valorEstimado = calcularTotal().toFixed(2);

    const mensagem = `*LA EMPANADAS - NOVO PEDIDO* 🥟\n\n` +
                     `*Cliente:* ${nome}\n` +
                     `*Entregar em:* ${endereco}\n` +
                     `*Pagamento:* ${pagamento}\n\n` +
                     `*Itens do Pedido:*\n${itensTexto}\n` +
                     `*Total Estimado:* R$ ${valorEstimado}\n\n` +
                     `_Por favor, confirme meu pedido para iniciarmos o preparo!_ ✨`; 

    const linkWhatsApp = `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP}&text=${encodeURIComponent(mensagem)}`;
    
    carrinhoState = {};
    atualizarIndicadores();
    renderizarCardapio();
    fecharCarrinho();

    window.open(linkWhatsApp, "_blank");
}

// CORREÇÃO: scrollIntoView() rolava a PÁGINA INTEIRA de volta pro topo
// (não só o carrossel) sempre que o slide trocava e o carrossel estava fora
// da tela — por isso a página "pulava" sozinha enquanto você tentava ver
// o footer. Agora rolamos só o container do carrossel (#carousel-track),
// via scrollTo, sem tocar no scroll da página.
function iniciarAutoplayCarrossel() {
    let slideAtivo = 1;
    const totalSlides = 2;
    const track = document.getElementById("carousel-track");
    if (!track) return;

    setInterval(() => {
        slideAtivo = slideAtivo === totalSlides ? 1 : slideAtivo + 1;
        const elementoSlide = document.getElementById(`slide${slideAtivo}`);

        if (elementoSlide) {
            track.scrollTo({
                left: elementoSlide.offsetLeft,
                behavior: "smooth"
            });
        }
    }, 5000);
}

// GARANTIA DE ESCOPO GLOBAL: Vincula as funções ao escopo da janela (window)
// Isso impede erros de "function undefined" ao clicar nos botões inline do HTML
window.alternarCategoria = alternarCategoria;
window.alterarQuantidade = alterarQuantidade;
window.abrirCarrinho = abrirCarrinho;
window.fecharCarrinho = fecharCarrinho;
