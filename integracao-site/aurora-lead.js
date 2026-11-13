/*!
 * Aurora Bartenders — registra o pedido de orçamento do site no sistema comercial.
 *
 * Como funciona: quando a pessoa conclui o formulário, o site continua abrindo o WhatsApp
 * exatamente como hoje. Em paralelo, este arquivo manda os mesmos dados para o sistema,
 * que cria o contato e o negócio em "Novo lead". Se o sistema estiver fora do ar, nada
 * muda para o cliente: o WhatsApp abre do mesmo jeito.
 *
 * Uso (veja LEIA-ME.md):
 *   1. No <script id="aurora-cfg"> do site, acrescente  "sistema": "https://ENDEREÇO-DO-SISTEMA"
 *   2. No envio do formulário, logo depois de gerar a referência (a "Ref." da mensagem):
 *        window.auroraRegistrarPedido && window.auroraRegistrarPedido(formulario, referencia);
 *
 * Não usa cookies, não lê a resposta e não bloqueia a página.
 */
(function () {
  "use strict";
  var cfg = {};
  try {
    var el = document.getElementById("aurora-cfg");
    cfg = JSON.parse((el && el.textContent) || "{}");
  } catch (e) {}
  var sistema = String(cfg.sistema || "").replace(/\/+$/, "");

  function marcado(form, nome) {
    var campo = form.querySelector('[name="' + nome + '"]:checked');
    return campo ? campo.value : "";
  }
  function marcados(form, nome) {
    return Array.prototype.map.call(form.querySelectorAll('[name="' + nome + '"]:checked'), function (c) {
      return c.value;
    });
  }
  function texto(form, nome) {
    var campo = form.querySelector('[name="' + nome + '"]');
    return campo && typeof campo.value === "string" ? campo.value.trim() : "";
  }

  window.auroraRegistrarPedido = function (form, referencia) {
    if (!sistema || !form) return false;
    try {
      var semData = form.querySelector('[name="semdata"]');
      var dataADefinir = !!(semData && semData.checked);
      var origem = "";
      try {
        origem = sessionStorage.getItem("aurora_origem") || "";
      } catch (e) {}
      var pedido = {
        ref: String(referencia || ""),
        nome: texto(form, "nome"),
        whatsapp: texto(form, "whatsapp"), // só existe se o site passar a pedir (opcional)
        tipo: marcado(form, "tipo"),
        data: dataADefinir ? "" : texto(form, "data"),
        mes: dataADefinir ? texto(form, "mes") : "",
        cidadeop: marcado(form, "cidadeop"),
        cidade: marcado(form, "cidadeop") === "outra" ? texto(form, "cidade") : "",
        convidados: marcado(form, "convidados"),
        pacote: marcado(form, "pacote"),
        drinks: marcados(form, "drinks"),
        obs: texto(form, "obs"),
        origem_site: origem,
        site_web: texto(form, "site_web"), // campo-armadilha: pessoas não veem, robôs preenchem
      };
      var corpo = JSON.stringify(pedido);
      var destino = sistema + "/api/publico/leads";
      // "text/plain" evita a consulta prévia do navegador (preflight) e "keepalive" deixa o
      // envio terminar mesmo se a página sair para o WhatsApp no mesmo instante.
      if (window.fetch) {
        fetch(destino, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: corpo,
          keepalive: true,
          mode: "cors",
          credentials: "omit",
        }).catch(function () {});
        return true;
      }
      if (navigator.sendBeacon) return navigator.sendBeacon(destino, corpo);
    } catch (e) {}
    return false;
  };
})();
