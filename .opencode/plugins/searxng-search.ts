import { Plugin } from "@opencode/plugin"
import { tool, type Hooks } from "@opencode-ai/plugin"

interface SearchResult {
  title: string
  url: string
  snippet: string
  engine?: string
}

interface SearXNGResponse {
  results: Array<{
    title: string
    url: string
    content: string
    engine?: string
  }>
  number_of_results?: number
  query?: string
}

interface FormattedResponse {
  query: string
  resultsFound: number
  results: SearchResult[]
  formattedResults: string
}

interface SearXNGArgs {
  query: string
  categories?: string
  language?: string
  pageno?: number
  time_range?: string
  safesearch?: number
}

const searxngUrl = "http://searxng.vier.services/search"

const TOOL_DESCRIPTION =
  "Search the internet using SearXNG service. Returns up to 10 web search results with titles, URLs, and snippets."

/**
 * Shared search implementation used by both the V1 and V2 entrypoints.
 * Returns the JSON response as a string, with error handling included.
 */
async function searchSearXNG(args: SearXNGArgs, externalSignal?: AbortSignal): Promise<string> {
  const {
    query,
    categories,
    language,
    pageno = 1,
    time_range,
    safesearch,
  } = args

  try {
    // Build query parameters
    const params = new URLSearchParams()
    params.append("q", query)
    params.append("format", "json")
    params.append("results_on_new_tab", "0")
    params.append("pageno", pageno.toString())

    if (categories) params.append("categories", categories)
    if (language) params.append("language", language)
    if (time_range) params.append("time_range", time_range)
    if (safesearch !== undefined) params.append("safesearch", safesearch.toString())

    const fullUrl = `${searxngUrl}?${params.toString()}`

    // Basic auth: the instance URL may embed user:password@ credentials
    // (https://user:password@host/search). WHATWG fetch ignores
    // URL-embedded credentials, so they are sent as an Authorization
    // header instead.
    const endpoint = new URL(fullUrl)
    const headers: Record<string, string> = {
      "User-Agent": "OpenCode-SearXNG-Tool/1.0",
      Accept: "application/json",
    }
    if (endpoint.username || endpoint.password) {
      headers.Authorization = `Basic ${btoa(`${endpoint.username}:${endpoint.password}`)}`
      endpoint.username = ""
      endpoint.password = ""
    }

    // 10 second timeout, combined with the session signal when OpenCode V2 provides one
    const timeoutSignal = AbortSignal.timeout(10_000)
    const signal = externalSignal ? AbortSignal.any([timeoutSignal, externalSignal]) : timeoutSignal

    // Make the API request
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers,
      signal,
    })

    if (!response.ok) {
      throw new Error(
        `SearXNG API error: ${response.status} ${response.statusText}`
      )
    }

    const data = (await response.json()) as SearXNGResponse

    // Extract and limit results to 10
    const limitedResults: SearchResult[] = (data.results || [])
      .slice(0, 10)
      .map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content,
        engine: result.engine,
      }))

    // Format results for human readability
    let formattedResults = ""
    if (limitedResults.length > 0) {
      formattedResults = limitedResults
        .map(
          (result, index) =>
            `${index + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.snippet}`
        )
        .join("\n\n")
    } else {
      formattedResults = "No results found for the given query."
    }

    const response_data: FormattedResponse = {
      query,
      resultsFound: data.number_of_results || limitedResults.length,
      results: limitedResults,
      formattedResults,
    }

    return JSON.stringify(response_data, null, 2)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error)
    return JSON.stringify(
      {
        query,
        error: true,
        errorMessage: `Failed to search SearXNG: ${errorMessage}`,
        results: [],
        formattedResults: `Error: ${errorMessage}`,
      },
      null,
      2
    )
  }
}

export default {
  // OpenCode V2 entrypoint: registers the tool through the plugin API.
  ...Plugin.define({
    id: "searxng-search",
    async setup(ctx) {
      const registration = await ctx.tool.transform((editor) => {
        editor.add({
          name: "searxng-search",
          description: TOOL_DESCRIPTION,
          input: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "The search query (e.g., 'OpenCode documentation', 'SearXNG API')",
              },
              categories: {
                type: "string",
                description:
                  "Comma-separated list of categories to search (e.g., 'general,social media')",
              },
              language: {
                type: "string",
                description: "Language code for results (e.g., 'en', 'de', 'fr')",
              },
              pageno: {
                type: "integer",
                minimum: 1,
                description: "Page number of results (default: 1)",
              },
              time_range: {
                type: "string",
                enum: ["day", "month", "year"],
                description: "Filter results by time range",
              },
              safesearch: {
                type: "integer",
                minimum: 0,
                maximum: 2,
                description: "Safe search level: 0 (off), 1 (moderate), 2 (strict)",
              },
            },
            required: ["query"],
            additionalProperties: false,
          },
          async execute(input: unknown, context: unknown) {
            const args = input as SearXNGArgs
            const signal = (context as { signal?: AbortSignal } | undefined)
              ?.signal
            const content = await searchSearXNG(args, signal)
            return { content }
          },
        })
      })
      return () => registration.dispose()
    },
  }),

  // OpenCode V1 entrypoint (supported in V1 1.18.29 and newer): registers the
  // same tool through the legacy tool() helper.
  async server(): Promise<Hooks> {
    return {
      tool: {
        "searxng-search": tool({
          description: TOOL_DESCRIPTION,
          args: {
            query: tool.schema
              .string()
              .describe("The search query (e.g., 'OpenCode documentation', 'SearXNG API')"),
            categories: tool.schema
              .string()
              .optional()
              .describe("Comma-separated list of categories to search (e.g., 'general,social media')"),
            language: tool.schema
              .string()
              .optional()
              .describe("Language code for results (e.g., 'en', 'de', 'fr')"),
            pageno: tool.schema
              .number()
              .int()
              .positive()
              .optional()
              .describe("Page number of results (default: 1)"),
            time_range: tool.schema
              .enum(["day", "month", "year"])
              .optional()
              .describe("Filter results by time range"),
            safesearch: tool.schema
              .number()
              .int()
              .min(0)
              .max(2)
              .optional()
              .describe("Safe search level: 0 (off), 1 (moderate), 2 (strict)"),
          },
          async execute(args) {
            return await searchSearXNG(args as SearXNGArgs)
          },
        }),
      },
    }
  },
}
