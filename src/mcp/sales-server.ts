import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  getProductVelocity,
  getSalesOverview,
  getSalesTrend,
  productVelocityInput,
  salesAnalyticsInput,
  salesTrendInput,
} from '../lib/analytics/sales'
import { getMcpCurrentUser } from '../lib/mcp/auth'

const server = new McpServer({
  name: 'bubble-sales-dashboard',
  version: '0.1.0',
})

function jsonContent(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  }
}

server.registerTool(
  'get_sales_overview',
  {
    title: 'Get sales overview',
    description: 'Returns revenue, average order value, number of orders, and units sold for the scoped dashboard user.',
    inputSchema: salesAnalyticsInput.shape,
  },
  async (input) => {
    const user = await getMcpCurrentUser()
    return jsonContent(await getSalesOverview(user, salesAnalyticsInput.parse(input)))
  },
)

server.registerTool(
  'get_sales_trend',
  {
    title: 'Get sales trend',
    description: 'Returns revenue, AOV, and order count grouped by day, week, or month.',
    inputSchema: salesTrendInput.shape,
  },
  async (input) => {
    const user = await getMcpCurrentUser()
    return jsonContent(await getSalesTrend(user, salesTrendInput.parse(input)))
  },
)

server.registerTool(
  'get_product_velocity',
  {
    title: 'Get product velocity',
    description: 'Returns fast-moving or slow-moving sold products by units sold, with revenue and order count.',
    inputSchema: productVelocityInput.shape,
  },
  async (input) => {
    const user = await getMcpCurrentUser()
    return jsonContent(await getProductVelocity(user, productVelocityInput.parse(input)))
  },
)

server.registerPrompt(
  'boss_sales_review',
  {
    title: 'Boss sales review',
    description: 'A prompt template for reviewing sales, AOV, orders, and product movement.',
    argsSchema: {
      period: z.string().optional(),
    },
  },
  ({ period }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Review the dashboard sales performance${period ? ` for ${period}` : ''}. Start with revenue, AOV, number of orders, fast-moving products, and slow-moving products. Use the available Bubble sales MCP tools and call out the date range and user scope.`,
        },
      },
    ],
  }),
)

const transport = new StdioServerTransport()
await server.connect(transport)
