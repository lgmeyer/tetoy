# Integração Asaas

Este é o plano para substituir os dados mocked do dashboard por dados reais do Asaas com segurança.

## 1. Configurar ambiente

1. Criar uma conta Sandbox em https://sandbox.asaas.com.
2. Gerar a chave de API pelo painel web do Asaas, em Integracoes.
3. Preencher o arquivo local `.env`:

```env
ASAAS_ENV=sandbox
ASAAS_API_KEY=$aact_hmlg_sua_chave
ASAAS_WEBHOOK_AUTH_TOKEN=token-forte-com-mais-de-32-caracteres
ASAAS_WEBHOOK_PUBLIC_URL=https://seu-dominio.com/api/webhooks/asaas
PORT=3000
```

Use `ASAAS_ENV=production` somente depois de validar o fluxo no Sandbox e trocar a chave para uma chave com prefixo de producao.

## 2. Rodar o dashboard pelo proxy local

O dashboard nao deve chamar a API do Asaas direto pelo browser, porque a chave ficaria exposta. A primeira camada segura foi criada em `server.js`.

```bash
npm start
```

Depois acesse:

```text
http://localhost:3000
```

Sem `ASAAS_API_KEY`, a tela continua usando os dados mocked. Com a chave configurada, o frontend chama `/api/dashboard`, que consulta o Asaas pelo servidor e normaliza os dados para a tela.

## 3. Dados usados nesta primeira etapa

1. `GET /v3/payments`: alimenta entradas da semana, extrato e grafico por vencimento ou data de pagamento.
2. `GET /v3/subscriptions`: alimenta a lista de recorrentes esperados.
3. `POST /api/webhooks/asaas`: recebe eventos do Asaas e valida o header `asaas-access-token` quando `ASAAS_WEBHOOK_AUTH_TOKEN` estiver definido.

Nesta fase, os pagamentos do Asaas entram como receitas. Saidas operacionais ainda precisam de uma fonte propria, como contas a pagar, extrato bancario ou outro ERP.

## 4. Validar Sandbox

1. Criar alguns clientes, cobrancas e assinaturas no Sandbox.
2. Conferir se as semanas do dashboard exibem os pagamentos.
3. Testar status diferentes: pendente, recebido, vencido e estornado.
4. Confirmar que cobrancas com assinatura aparecem como recorrentes.
5. Exportar CSV e comparar com o painel do Asaas.

## 5. Ativar webhooks

Configure um webhook no Asaas apontando para `ASAAS_WEBHOOK_PUBLIC_URL`, usando o mesmo valor de `ASAAS_WEBHOOK_AUTH_TOKEN` como token de autenticacao. Eventos iniciais recomendados:

```text
PAYMENT_CREATED
PAYMENT_UPDATED
PAYMENT_CONFIRMED
PAYMENT_RECEIVED
PAYMENT_OVERDUE
PAYMENT_REFUNDED
```

O endpoint atual apenas valida e registra o evento. O proximo passo e persistir esses eventos em banco com idempotencia pelo `id` do evento.

## 6. Proximas evolucoes

1. Persistir snapshots em banco para evitar depender de chamadas ao Asaas a cada abertura do painel.
2. Criar conciliacao de saidas a partir da fonte escolhida.
3. Adicionar filtros por grupo de cliente, forma de pagamento e status.
4. Criar tratamento visual para erro de API e ambiente sem permissao.
5. Separar configuracoes de Sandbox e Producao no deploy.
