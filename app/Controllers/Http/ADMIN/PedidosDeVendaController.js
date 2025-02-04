
"use strict";

const Database = use("Database");
const Env = use("Env");
const logger = require("../../../../dump/index")
const { spawn } = require('child_process');

class PedidosDeVenda {
  /** @param {object} ctx
   * @param {import('@adonisjs/framework/src/Request')} ctx.request
   */
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      // buscar o "cab" e "det" dos pedidos pendentes
      let [pedidosCab, pedidosDet] = await Promise.all([
        Database.raw(QUERY_PEDIDOS_DE_VENDA_A_FATURAR_CAB),
        Database.raw(QUERY_PEDIDOS_DE_VENDA_A_FATURAR_DET)
      ]);

      pedidosCab.forEach((pc, i) => {
        pedidosCab[i].Itens = pedidosDet.filter(pd => pd.PedidoID === pc.PedidoID)
      })

      for (let index in pedidosCab) {
        let [empresa, cliente] = await Promise.all([
          Database.connection("pg").raw(QUERY_EMPRESA_NO_NASAJON, [pedidosCab[index].Filial]),
          Database.connection("pg").raw(QUERY_CLIENTE_NO_NASAJON, [pedidosCab[index].CNPJ])
        ]);

        let pedido = { rows: [] }
        if (empresa.rows.length > 0 && cliente.rows.length > 0) {
          pedido = await Database
            .connection("pg")
            .raw(QUERY_PEDIDO_NO_NASAJON, [pedidosCab[index].PedidoID])
        }

        let log = { rows: [] }
        if (pedido.rows.length > 0) {
          log = await Database
            .connection("pg")
            .raw(QUERY_LOG_DO_PEDIDO_NO_NASAJON, [pedido.rows[0].id_pedido])
        }

        pedidosCab[index].emitenteNoNasajon = empresa.rows.length > 0
        pedidosCab[index].destinatarioNoNasajon = cliente.rows.length > 0
        pedidosCab[index].pedidoNoNasajon = pedido.rows.length > 0
        pedidosCab[index].pedido = pedido.rows
        pedidosCab[index].logDoPedidoNoNasajon = log.rows
      }


      response.status(200).send({
        Pedidos: pedidosCab,
      });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'PedidosDeVenda.Show',
      })
    }
  }

  // TESTADO
  async CancelRequest({ request, response }) {
    const token = request.header("authorization");
    const { PedidoID } = request.only(['PedidoID'])

    try {
      // verificar se o pedido já subiu pro NSJ
      let pedido = { rows: [] }

      pedido = await Database
        .connection("pg")
        .raw(QUERY_PEDIDO_NO_NASAJON, [PedidoID])

      // o pedido não pode ter sido faturado ainda(status !== 1), se sim, lançar erro
      if (pedido.rows.length > 0 && pedido.rows[0].status === 1) {
        response.status(400).send('Nota já emitida')
        return
      } else if (pedido.rows.length > 0) {
        // atualizar com status 4 no NSJ
        await Database.connection('pg').raw('update swvix.pedido set status = 4 where num_externo = ?', [PedidoID])
      }

      // colocar status C na dbo.PedidosVenda
      await Database.raw("update dbo.PedidosVenda set STATUS = 'C' where PedidoID = ?", [PedidoID])

      // atualizo o status para P e removo o PedidoId na dbo.PedidosVendaCab
      await Database.raw("update dbo.PedidosVendaCab set STATUS = 'P', PedidoId = null where PedidoId = ?", [PedidoID])

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'PedidosDeVenda.CancelRequest',
      })
    }
  }

  // NÃO TESTADO
  async CancelSale({ request, response }) {
    const token = request.header("authorization");
    const { PedidoID } = request.only(['PedidoID'])

    try {
      // let pedido = { rows: [] }

      // pedido = await Database
      //   .connection("pg")
      //   .raw(QUERY_PEDIDO_NO_NASAJON, [PedidoID])

      // if (
      //   pedido.rows.length > 0 &&
      //   (
      //     pedido.rows[0].status === 2 || (
      //       pedido.rows[0].status === 3 &&
      //       pedido.rows[0].processado === false
      //     ) || (
      //       pedido.rows[0].status === 0 &&
      //       pedido.rows[0].processado === false
      //     )
      //   )
      // ) {
      //   await Database
      //     .connection('pg')
      //     .raw(
      //       'update swvix.pedido set status = 4, num_externo = ? where num_externo = ?',
      //       [`${PedidoID}E`, PedidoID]
      //     )
      // }

      // await Database.table("dbo.PedidosVendaCab")
      //   .where({

      //   })
      //   .update({
      //     STATUS: 'C',
      //   });

      // await Database.table("dbo.PedidosVenda")
      //   .where({

      //   })
      //   .update({
      //     STATUS: 'C',
      //   });

      // await Database.table("dbo.SDBase")
      //   .where({

      //   })
      //   .update({
      //     D_QUANT: 0,
      //     VENVLR: 0,
      //     D_PRCVEN: 0,
      //     D_TOTAL: 0,
      //     D_DESC: 0
      //   });

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'PedidosDeVenda.CancelSale',
      })
    }
  }

  // TESTADO
  async DeprocessSale({ request, response }) {
    const token = request.header("authorization");
    const { PedidoID } = request.only(['PedidoID'])

    try {
      let pedido = { rows: [] }

      pedido = await Database
        .connection("pg")
        .raw(QUERY_PEDIDO_NO_NASAJON, [PedidoID])

      if (pedido.rows.length > 0 && pedido.rows[0].status === 1) {
        response.status(400).send('Nota já emitida')
        return
      } else if (pedido.rows.length > 0) {
        await Database.connection('pg').raw('update swvix.pedido set status = 4, num_externo = ? where num_externo = ?', [`${PedidoID}E`, PedidoID])
      } else {
        response.status(400).send('Pedido não está no nasajon')
        return
      }

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'PedidosDeVenda.DeprocessSale',
      })
    }
  }

  // TESTADO
  async ReissueOrder({ request, response }) {
    const token = request.header("authorization");
    const { PedidoID } = request.only(['PedidoID'])

    try {
      let pedido = { rows: [] }

      pedido = await Database
        .connection("pg")
        .raw(QUERY_PEDIDO_NO_NASAJON, [PedidoID])

      if (pedido.rows.length > 0 && pedido.rows[0].status === 1) {
        response.status(400).send('Nota já emitida')
        return
      } else if (pedido.rows.length > 0) {
        await Database.connection('pg').raw('update swvix.pedido set status = 3, processado = false where num_externo = ?', [PedidoID])
      } else {
        response.status(400).send('Pedido não está no nasajon')
        return
      }

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'PedidosDeVenda.ReissueOrder',
      })
    }
  }

  // NÃO TESTADO
  async ConvertToReturn({ request, response }) {
    const token = request.header("authorization");
    const { PedidoID, ChaveRef } = request.only(['PedidoID', 'ChaveRef'])
    try {

      // Trocar o tipo de operação do pedido(de VENDA para DEVOLUCAODEVENDA)
      // Na tabela itempedido, referenciar os items do pedido de devolucao com a chavene do pedido a ser devolvido
      // Colocar o CFOP 1202 devolucao dentro do estado, 2202 entre estados (tanto em pedido quanto itempedido)      

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'PedidosDeVenda.ConvertToReturn',
      })
    }
  }
}

module.exports = PedidosDeVenda;

const QUERY_PEDIDOS_DE_VENDA_A_FATURAR_CAB = "SELECT dbo.PedidosVenda.PedidoID, dbo.PedidosVendaCab.PvTipo, dbo.PedidosVenda.Filial, dbo.FilialEntidadeGrVenda.GrupoVenda, dbo.Cliente.Razão_Social as Cliente, dbo.PedidosVenda.CNPJi, dbo.Cliente.CNPJ, dbo.PedidosVenda.CodigoCliente, dbo.PedidosVenda.LojaCliente, dbo.FilialEntidadeGrVenda.UF, Count(dbo.PedidosVenda.PedidoItemID) AS ItensNoPedido, Sum(dbo.PedidosVenda.PrecoTotal) AS ValorTotal, dbo.PedidosVenda.DataCriacao, Max(dbo.PedidosVenda.TES) AS MáxDeTES FROM dbo.PedidosVenda INNER JOIN dbo.FilialEntidadeGrVenda ON dbo.PedidosVenda.Filial = dbo.FilialEntidadeGrVenda.M0_CODFIL INNER JOIN dbo.PedidosVendaCab on dbo.PedidosVendaCab.PedidoId = dbo.PedidosVenda.PedidoID INNER JOIN dbo.Cliente on dbo.Cliente.A1_COD = dbo.PedidosVenda.CodigoCliente and dbo.Cliente.A1_LOJA = dbo.PedidosVenda.LojaCliente WHERE ( ((dbo.PedidosVenda.CodigoTotvs) Is Null) and NASAJON = 'S' ) GROUP BY dbo.PedidosVenda.PedidoID, dbo.PedidosVenda.Filial, dbo.FilialEntidadeGrVenda.GrupoVenda, dbo.PedidosVenda.CNPJi, dbo.Cliente.CNPJ, dbo.Cliente.Razão_Social, dbo.PedidosVenda.CodigoCliente, dbo.PedidosVenda.LojaCliente, dbo.FilialEntidadeGrVenda.UF, dbo.PedidosVenda.DataCriacao, dbo.PedidosVenda.STATUS, dbo.PedidosVendaCab.PvTipo HAVING (((dbo.PedidosVenda.STATUS) Is Null)) ORDER BY dbo.PedidosVenda.DataCriacao DESC"
const QUERY_PEDIDOS_DE_VENDA_A_FATURAR_DET = "SELECT dbo.PedidosVenda.PedidoID, dbo.PedidosVenda.PedidoItemID, dbo.PedidosVenda.CodigoProduto, dbo.Produtos.Produto, dbo.PedidosVenda.QtdeVendida, dbo.PedidosVenda.PrecoUnitarioLiquido, dbo.PedidosVenda.VlrDesconto, dbo.PedidosVenda.PrecoTotal, dbo.PedidosVenda.TES FROM dbo.PedidosVenda INNER JOIN dbo.FilialEntidadeGrVenda ON dbo.PedidosVenda.Filial = dbo.FilialEntidadeGrVenda.M0_CODFIL INNER JOIN dbo.Produtos on dbo.Produtos.ProdId = dbo.PedidosVenda.CodigoProduto WHERE ( dbo.PedidosVenda.CodigoTotvs Is Null and NASAJON = 'S' and dbo.PedidosVenda.STATUS Is Null ) ORDER BY dbo.PedidosVenda.PedidoID DESC, dbo.PedidosVenda.PedidoItemID ASC"
const QUERY_EMPRESA_NO_NASAJON = "select empresa from ns.empresas where codigo = ?"
const QUERY_CLIENTE_NO_NASAJON = "select pessoa from ns.pessoas where chavecnpj = ?"
const QUERY_PEDIDO_NO_NASAJON = "select id_pedido, num_pedido, cod_operacao, status, cfop, processado, emitir from swvix.pedido where num_externo = ? order by dt_emissao DESC"
const QUERY_LOG_DO_PEDIDO_NO_NASAJON = "select mensagem from swvix.log_execucaojob where id_pedido = ? order by datahora DESC, lastupdate DESC"