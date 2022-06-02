"use strict";

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")

class PedidosDeCompra {
  /** @param {object} ctx
   * @param {import('@adonisjs/framework/src/Request')} ctx.request
   */
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      if (
        !(verified.role === "Sistema" || verified.role === "BackOffice" || verified.role === "Técnica Pilão" || verified.role === "Técnica Bianchi" || verified.role === "Expedição")
      ) {
        throw new Errow('Usuário não permitido')
      }

      let pedidosDeCompraEmAberto = await Database.raw(QUERY_PEDIDOS_DE_COMPRA_EM_ABERTO)

      for (let i = 0; i < pedidosDeCompraEmAberto.length; i++) {
        let d = await Database.raw("select PedidoItemID, CodigoProduto, Produto, QtdeVendida, PrecoUnitarioLiquido, PrecoTotal from dbo.PedidosVenda left join dbo.Produtos on dbo.PedidosVenda.CodigoProduto = dbo.Produtos.ProdId where Filial = '0201' and PedidoID = ? order by PedidoItemID ASC", [pedidosDeCompraEmAberto[i].PedidoID])

        pedidosDeCompraEmAberto[i] = {
          ...pedidosDeCompraEmAberto[i],
          Detalhes: d
        }
      }

      response.status(200).send({
        Pedidos: pedidosDeCompraEmAberto
      });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'PedidosDeCompra.Show',
      })
    }
  }
}

module.exports = PedidosDeCompra;

const QUERY_PEDIDOS_DE_COMPRA_EM_ABERTO = "SELECT dbo.FilialEntidadeGrVenda.UF, dbo.PedidosVenda.Filial, dbo.PedidosVenda.CodigoCliente, dbo.PedidosVenda.LojaCliente, dbo.PedidosVenda.PedidoID, dbo.PedidosVenda.MsgBO, Count(dbo.PedidosVenda.PedidoItemID) AS ContarDePedidoItemID, dbo.PedidosVenda.DataCriacao, dbo.PedidosVenda.TipOp, Max(dbo.PedidosVenda.TES) AS MáxDeTES, Sum(dbo.PedidosVenda.PrecoTotal) AS SomaDePrecoTotal FROM dbo.PedidosVenda INNER JOIN dbo.FilialEntidadeGrVenda ON dbo.PedidosVenda.Filial = dbo.FilialEntidadeGrVenda.M0_CODFIL WHERE (((dbo.PedidosVenda.CodigoTotvs) Is Null)) GROUP BY dbo.FilialEntidadeGrVenda.UF, dbo.PedidosVenda.STATUS, dbo.FilialEntidadeGrVenda.NASAJON, dbo.PedidosVenda.Filial, dbo.PedidosVenda.CodigoCliente, dbo.PedidosVenda.LojaCliente, dbo.PedidosVenda.PedidoID, dbo.PedidosVenda.MsgBO, dbo.PedidosVenda.DataCriacao, dbo.PedidosVenda.DataIntegracao, dbo.PedidosVenda.TipOp, dbo.PedidosVenda.SERIE, dbo.PedidosVenda.EMISS HAVING (((dbo.PedidosVenda.STATUS) Is Null and dbo.FilialEntidadeGrVenda.NASAJON = 'N')) ORDER BY dbo.PedidosVenda.DataCriacao DESC"