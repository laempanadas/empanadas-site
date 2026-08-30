const NUMERO_WHATSAPP = "551126690644";

let cardapioOriginal = { categorias: [], itens: [] };
let carrinhoState = {};
let categoriaAtiva = "todos";

document.addEventListener("DOMContentLoaded", async () => {
  configurarEventosDelegados();
  habilitarArrastarComMouse("categorias-container");
  iniciarAutoplayCarrossel();

  await carregarCardapio();

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

async function carregarCardapio() {
  try {
    const response = await fetch("assets/js/cardapio.json");

    if (!response.ok) {
      throw new Error(`Falha ao carregar cardápio: ${response.status}`);
    }

    cardapioOriginal = await response.json();
  } catch (error) {
    console.error("Erro de carregamento do cardápio:", error);

    if (window.Swal) {
      window.Swal.fire({
        icon: "error",
        title: "Ops!",
        text: "Não foi possível conectar o carrinho ao cardápio. Recarregue a página ou fale conosco pelo WhatsApp.",
        confirmButtonColor: "#d95d39"
      });
    }
  }
}

function configurarEventosDelegados() {
  const categorias = document.getElementById("categorias-container");

  if (categorias) {
    categorias.addEventListener("click", (event) => {
      const botao = event.target.closest("[data-categoria-filtro]");

      if (!botao) {
        return;
      }

      categoriaAtiva = botao.dataset.categoriaFiltro;
      atualizarEstiloBotoesCategoria();
      filtrarCardapio();
    });
  }

  const cardapioGrid = document.getElementById("cardapio-grid");

  if (cardapioGrid) {
    cardapioGrid.addEventListener("click", (event) => {
      const botao = event.target.closest("[data-action][data-id]");

      if (!botao) {
        return;
      }

      const id = botao.dataset.id;
      const delta = botao.dataset.action === "add" ? 1 : -1;

      alterarQuantidade(id, delta);
    });
  }

  const btnAbrirCarrinho = document.getElementById("btn-abrir-carrinho");
  if (btnAbrirCarrinho) {
    btnAbrirCarrinho.addEventListener("click", abrirCarrinho);
  }

  const btnBottomBar = document.getElementById("btn-bottombar-carrinho");
  if (btnBottomBar) {
    btnBottomBar.addEventListener("click", abrirCarrinho);
  }

  const btnFecharCarrinho = document.getElementById("btn-fechar-carrinho");
  if (btnFecharCarrinho) {
    btnFecharCarrinho.addEventListener("click", fecharCarrinho);
  }

  const formCheckout = document.getElementById("checkout-form");

  if (formCheckout) {
    formCheckout.addEventListener("submit", (event) => {
      event.preventDefault();

      const nome = document.getElementById("nome-cliente").value.trim();
      const endereco = document.getElementById("endereco-cliente").value.trim();
      const pagamento = document.getElementById("pagamento-cliente").value;

      enviarPedidoParaWhatsApp(nome, endereco, pagamento);
    });
  }
}

function atualizarEstiloBotoesCategoria() {
  document.querySelectorAll("[data-categoria-filtro]").forEach((botao) => {
    const ativo = botao.dataset.categoriaFiltro === categoriaAtiva;

    botao.setAttribute("aria-pressed", ativo ? "true" : "false");
    botao.className = `btn btn-sm rounded-full px-5 border-none shrink-0 ${
      ativo
        ? "bg-terracotta-500 text-white shadow-sm"
        : "bg-gray-100 text-gray-700"
    }`;
  });
}

function filtrarCardapio() {
  document.querySelectorAll("#cardapio-grid > [data-categoria]").forEach((card) => {
    const categoria = card.dataset.categoria;
    const visivel = categoriaAtiva === "todos" || categoria === categoriaAtiva;

    card.hidden = !visivel;
  });
}

function alterarQuantidade(id, delta) {
  const item = cardapioOriginal.itens.find((produto) => produto.id === id);

  if (!item) {
    console.error("SKU não encontrado no cardapio.json:", id);
    return;
  }

  const quantidadeAtual = carrinhoState[id] || 0;
  const novaQuantidade = quantidadeAtual + delta;

  if (novaQuantidade <= 0) {
    delete carrinhoState[id];
  } else {
    carrinhoState[id] = novaQuantidade;
  }

  if (delta > 0) {
    if (typeof window.fbq === "function") {
      window.fbq("track", "AddToCart", {
        content_ids: [item.id],
        content_type: "product",
        value: item.preco,
        currency: "BRL"
      });
    }

    if (quantidadeAtual === 0 && window.Swal) {
      window.Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: false
      }).fire({
        icon: "success",
        title: `${item.nome} adicionado!`
      });
    }
  }

  atualizarIndicadores();
  atualizarControlesDosItens();

  if (document.getElementById("modal_carrinho")?.open) {
    abrirCarrinho();
  }
}

function atualizarControlesDosItens() {
  document.querySelectorAll("[data-item-id]").forEach((container) => {
    const id = container.dataset.itemId;
    const quantidade = carrinhoState[id] || 0;

    if (quantidade > 0) {
      container.innerHTML = `
        <button
          type="button"
          data-action="remove"
          data-id="${id}"
          class="btn btn-xs btn-circle bg-gray-100 text-gray-800 border-none hover:bg-gray-200"
          aria-label="Remover uma unidade"
        >
          <i data-lucide="minus" class="w-3.5 h-3.5"></i>
        </button>

        <span class="font-semibold text-sm w-4 text-center" aria-label="${quantidade} itens">
          ${quantidade}
        </span>

        <button
          type="button"
          data-action="add"
          data-id="${id}"
          class="btn btn-xs btn-circle bg-terracotta-500 text-white border-none hover:bg-terracotta-600"
          aria-label="Adicionar uma unidade"
        >
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
        </button>
      `;
    } else {
      container.innerHTML = `
        <button
          type="button"
          data-action="add"
          data-id="${id}"
          class="btn btn-xs rounded-full bg-terracotta-500 hover:bg-terracotta-600 text-white border-none px-4"
        >
          Adicionar
        </button>
      `;
    }
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function calcularTotal() {
  return Object.entries(carrinhoState).reduce((total, [id, quantidade]) => {
    const item = cardapioOriginal.itens.find((produto) => produto.id === id);

    return total + (item ? item.preco * quantidade : 0);
  }, 0);
}

function totalItens() {
  return Object.values(carrinhoState).reduce(
    (total, quantidade) => total + quantidade,
    0
  );
}

function formatarPreco(valor) {
  return `R$ ${valor.toFixed(2)}`;
}

function atualizarIndicadores() {
  const quantidadeTotal = totalItens();
  const total = calcularTotal();

  const badge = document.getElementById("badge-cart");

  if (badge) {
    badge.textContent = quantidadeTotal;

    if (quantidadeTotal > 0) {
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  const bottomBar = document.getElementById("bottom-bar");
  const totalBottomBar = document.getElementById("bottom-bar-total");

  if (bottomBar && totalBottomBar) {
    totalBottomBar.textContent = formatarPreco(total);

    if (quantidadeTotal > 0) {
      bottomBar.classList.remove("translate-y-full");
    } else {
      bottomBar.classList.add("translate-y-full");
    }
  }
}

function abrirCarrinho() {
  const modal = document.getElementById("modal_carrinho");
  const lista = document.getElementById("carrinho-itens-lista");
  const totalModal = document.getElementById("modal-total");

  if (!modal || !lista || !totalModal) {
    return;
  }

  lista.innerHTML = "";

  if (totalItens() === 0) {
    lista.innerHTML = `
      <div class="text-center py-8 text-gray-400">
        <i data-lucide="frown" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
        <p>Seu carrinho está vazio.</p>
      </div>
    `;

    totalModal.textContent = "R$ 0,00";

    if (window.lucide) {
      window.lucide.createIcons();
    }

    if (!modal.open) {
      modal.showModal();
    }

    return;
  }

  Object.entries(carrinhoState).forEach(([id, quantidade]) => {
    const item = cardapioOriginal.itens.find((produto) => produto.id === id);

    if (!item) {
      return;
    }

    const linha = document.createElement("div");
    linha.className = "flex justify-between items-center bg-gray-50 p-3 rounded-xl";
    linha.innerHTML = `
      <div class="flex-1 min-w-0 pr-2">
        <h3 class="font-bold text-sm text-gray-900 truncate">${item.nome}</h3>
        <span class="text-xs text-gray-500">${formatarPreco(item.preco)} un.</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-gray-800">x${quantidade}</span>
        <span class="font-bold text-sm text-gray-950 min-w-[60px] text-right">${formatarPreco(item.preco * quantidade)}</span>
      </div>
    `;

    lista.appendChild(linha);
  });

  totalModal.textContent = formatarPreco(calcularTotal());

  if (window.lucide) {
    window.lucide.createIcons();
  }

  if (!modal.open) {
    modal.showModal();
  }
}

function fecharCarrinho() {
  const modal = document.getElementById("modal_carrinho");

  if (modal?.open) {
    modal.close();
  }
}

function enviarPedidoParaWhatsApp(nome, endereco, pagamento) {
  if (totalItens() === 0) {
    return;
  }

  const totalPedido = calcularTotal();
  const idsItens = Object.keys(carrinhoState);

  if (typeof window.fbq === "function") {
    window.fbq("track", "Purchase", {
      content_ids: idsItens,
      content_type: "product",
      value: totalPedido,
      currency: "BRL"
    });
  }

  let itensTexto = "";

  Object.entries(carrinhoState).forEach(([id, quantidade]) => {
    const item = cardapioOriginal.itens.find((produto) => produto.id === id);

    if (item) {
      itensTexto += `- ${quantidade}x ${item.nome} [${id}]\n`;
    }
  });

  const mensagem =
    `*LA EMPANADAS - NOVO PEDIDO* 🥟\n\n` +
    `*Cliente:* ${nome}\n` +
    `*Entregar em:* ${endereco}\n` +
    `*Pagamento:* ${pagamento}\n\n` +
    `*Itens do Pedido:*\n${itensTexto}\n` +
    `*Total Estimado:* ${formatarPreco(totalPedido)}\n\n` +
    `_Por favor, confirme meu pedido para iniciarmos o preparo!_ ✨`;

  const linkWhatsApp =
    `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP}&text=${encodeURIComponent(mensagem)}`;

  const novaAba = window.open(linkWhatsApp, "_blank", "noopener,noreferrer");

  if (novaAba) {
    novaAba.opener = null;
  }
}

function habilitarArrastarComMouse(idContainer) {
  const container = document.getElementById(idContainer);

  if (!container) {
    return;
  }

  let arrastando = false;
  let posicaoInicialX = 0;
  let scrollInicial = 0;

  container.addEventListener("mousedown", (event) => {
    arrastando = true;
    container.classList.add("cursor-grabbing");
    posicaoInicialX = event.pageX - container.offsetLeft;
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

  container.addEventListener("mousemove", (event) => {
    if (!arrastando) {
      return;
    }

    event.preventDefault();

    const posicaoAtualX = event.pageX - container.offsetLeft;
    const distancia = (posicaoAtualX - posicaoInicialX) * 1.2;

    container.scrollLeft = scrollInicial - distancia;
  });
}

function iniciarAutoplayCarrossel() {
  const track = document.getElementById("carousel-track");

  if (!track) {
    return;
  }

  let slideAtivo = 1;
  const totalSlides = 2;

  setInterval(() => {
    slideAtivo = slideAtivo === totalSlides ? 1 : slideAtivo + 1;

    const slide = document.getElementById(`slide${slideAtivo}`);

    if (slide) {
      track.scrollTo({
        left: slide.offsetLeft,
        behavior: "smooth"
      });
    }
  }, 5000);
}