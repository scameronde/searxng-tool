# SearXNG OpenCode Tool

A custom OpenCode tool that enables AI agents to search the internet using the SearXNG service. This tool integrates with a SearXNG instance for privacy-focused, decentralized web search capabilities.

Works with both **OpenCode V1** (1.18.29 or newer) and **OpenCode V2**. A single plugin file supports both versions: V1 loads it through the legacy `tool()` API, V2 through the new plugin API.

## Features

- **Privacy-Focused Search**: Uses SearXNG, a metasearch engine that doesn't track users
- **AI Agent Optimized**: Returns structured JSON data that LLMs can easily parse and understand
- **Human-Readable Output**: Includes formatted results for debugging and manual inspection
- **Flexible Parameters**: Support for language, categories, time range filtering, and safe search options
- **Error Handling**: Graceful error messages when searches fail
- **Result Limiting**: Automatically limits to 10 most relevant results per query

## Installation

This tool is designed to be used with OpenCode. Place the `.opencode/` directory in your OpenCode project root, then install the dependencies. OpenCode loads the plugin automatically from `.opencode/plugins/` at startup — no configuration is required.

### OpenCode V2

OpenCode V2 loads the plugin through the `Plugin.define` entrypoint (`.opencode/plugins/searxng-search.ts`). No additional steps are needed.

```bash
# Copy this entire directory structure into your OpenCode project
cp -r .opencode /path/to/your/opencode-project/.opencode/

# Then install dependencies in your project root
npm install
```

### OpenCode V1

OpenCode V1 (1.18.29 or newer) loads the same file through the legacy `server()` entrypoint and registers the tool with the `tool()` helper from `@opencode-ai/plugin`.

```bash
# Copy this entire directory structure into your OpenCode project
cp -r .opencode /path/to/your/opencode-project/.opencode/

# Then install dependencies in your project root
npm install
```

> **Note:** V1 support requires OpenCode 1.18.29 or newer, which added object plugin entrypoints. The tool requires both `@opencode-ai/plugin` (V1) and `@opencode/plugin` (V2) from `package.json`, so a single installation works for either version of OpenCode.

## Usage

### Basic Search

The tool is called `searxng-search` and accepts the following parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The search query (e.g., "OpenCode documentation") |
| `categories` | string | No | Comma-separated list of categories (e.g., "general,social media") |
| `language` | string | No | Language code (e.g., "en", "de", "fr") |
| `pageno` | number | No | Page number (default: 1) |
| `time_range` | enum | No | Filter by: "day", "month", or "year" |
| `safesearch` | number | No | Safe search level: 0 (off), 1 (moderate), 2 (strict) |

### Agent Usage Example

When used by an OpenCode agent, the tool returns JSON with the following structure:

```json
{
  "query": "OpenCode tool creation",
  "resultsFound": 1250,
  "results": [
    {
      "title": "Custom Tools | OpenCode",
      "url": "https://opencode.ai/docs/custom-tools/",
      "snippet": "Create tools the LLM can call in opencode...",
      "engine": "duckduckgo"
    }
  ],
  "formattedResults": "1. Custom Tools | OpenCode\n   URL: https://opencode.ai/docs/custom-tools/\n   Create tools the LLM can call in opencode..."
}
```

The response includes:
- **query**: The search query that was executed
- **resultsFound**: Total number of results found (if available)
- **results**: Array of up to 10 search results with structured data
  - **title**: Page title
  - **url**: Direct URL to the result
  - **snippet**: Brief text snippet from the page
  - **engine**: Search engine that returned this result (e.g., Google, DuckDuckGo)
- **formattedResults**: Human-readable text formatting of the results

### Error Handling

If a search fails, the tool returns an error response:

```json
{
  "query": "your search query",
  "error": true,
  "errorMessage": "Failed to search SearXNG: <error details>",
  "results": [],
  "formattedResults": "Error: <error details>"
}
```

## Configuration

The tool is configured to connect to the SearXNG instance at:
```
http://searxng.vier.services
```

To use a different SearXNG instance, modify the `searxngUrl` constant in `.opencode/plugins/searxng-search.ts`:

```typescript
const searxngUrl = "http://your-searxng-instance.com/search"
```

### Private Instances Behind Basic Auth

Many self-hosted SearXNG instances are protected with basic auth. Embed the credentials in the URL using the standard `user:password@` syntax:

```typescript
const searxngUrl = "https://user:password@your-private-instance.com/search"
```

The tool extracts the credentials and sends them as an `Authorization: Basic ...` header. This is required because WHATWG `fetch` (used by OpenCode's runtime) silently ignores URL-embedded credentials. Instances without credentials work unchanged.

## Search Tips

### Effective Queries
- Use specific keywords: `"machine learning algorithms"` instead of `"machine learning"`
- Combine terms for narrower results: `site:github.com Python testing`
- Use quotes for exact phrases: `"exact phrase search"`

### Category Filtering
Available categories vary by instance, but typically include:
- `general` - General web search
- `images` - Image search
- `news` - News articles
- `social media` - Social media results
- `science` - Scientific resources
- `IT` - IT/Technology resources

### Language Support
Specify language codes as ISO 639-1 (two-letter codes):
- `en` - English
- `de` - German
- `fr` - French
- `es` - Spanish
- `zh` - Chinese
- etc.

### Time Range Filtering
Limit results to a specific time period:
- `day` - Last 24 hours
- `month` - Last 30 days
- `year` - Last year

## API Response Details

### Success Response
```typescript
{
  query: string              // The search query
  resultsFound: number       // Total results found
  results: SearchResult[]    // Array of up to 10 results
  formattedResults: string   // Human-readable formatted results
}

// SearchResult structure:
{
  title: string      // Page title
  url: string        // Page URL
  snippet: string    // Text snippet from page
  engine?: string    // Source search engine
}
```

### Error Response
```typescript
{
  query: string              // The search query
  error: true                // Error flag
  errorMessage: string       // Detailed error message
  results: []                // Empty results array
  formattedResults: string   // Error message as text
}
```

## Timeout Behavior

The tool has a 10-second timeout for API requests to SearXNG. If the search takes longer than 10 seconds, it will return an error message.

## Rate Limiting

The tool doesn't implement built-in rate limiting, but SearXNG may enforce its own rate limits. If you're making many searches, consider:
- Spacing out requests by a few seconds
- Using more specific queries to reduce needed searches
- Caching results at the agent level if appropriate

## Examples

### Simple Web Search
Agent query: "Search for information about React hooks"

```bash
searxng-search(query="React hooks")
```

### Search with Language Filter
Agent query: "Search for Python documentation in German"

```bash
searxng-search(query="Python documentation", language="de")
```

### News Search with Time Filter
Agent query: "Find recent news about artificial intelligence"

```bash
searxng-search(query="artificial intelligence news", time_range="week")
```

### Safe Search Enabled
Agent query: "Find educational resources about cybersecurity"

```bash
searxng-search(query="cybersecurity education", safesearch=2)
```

## Troubleshooting

### "Failed to connect" Error
- Verify the SearXNG instance at `http://searxng.vier.services` is accessible
- Check your network connection
- Check firewall rules that might block the connection

### "HTTP 4xx/5xx Error"
- Verify the query is properly formatted
- Check if the SearXNG instance is running
- Try a simpler query to test connectivity

### Empty Results
- The query might be too specific or not match any documents
- Try using fewer keywords
- Check if the correct language is specified

### Timeout Errors
- The SearXNG instance might be under heavy load
- Try again in a few moments
- Try a simpler query

## Architecture

The tool is built as a TypeScript plugin module that supports both OpenCode versions from one file:

- **V2 entrypoint** (`Plugin.define` + `setup`): registers the `searxng-search` tool through the V2 plugin API, using a JSON Schema input definition.
- **V1 entrypoint** (`server`): registers the same tool with the legacy `tool()` helper and Zod argument schema.
- **Shared implementation** (`searchSearXNG`): both entrypoints call the same search function, which accepts search parameters, constructs the SearXNG API URL, makes an HTTP GET request, parses the JSON response, limits results to 10 entries, formats them for both LLM processing and human reading, and returns structured JSON with error handling.

## Performance

- **Response Time**: Typically 1-3 seconds depending on query complexity
- **Result Limit**: 10 results per query to keep responses concise
- **Request Timeout**: 10 seconds
- **Memory Usage**: Minimal - tool is stateless and doesn't cache results

## Privacy Considerations

SearXNG is a privacy-focused metasearch engine that:
- Does not track users
- Does not store search history
- Aggregates results from multiple search engines
- Provides user IP anonymization options

This makes it ideal for AI agents that need to search the internet without creating tracking profiles.

## Development

### Project Structure
```
searxng-tool/
├── .opencode/
│   └── plugins/
│       └── searxng-search.ts       # Plugin (V1 + V2 entrypoints, shared search logic)
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
└── README.md                       # This file
```

### Building
```bash
npm install
tsc
```

### Modifying the Tool

To customize the tool:

1. Edit `.opencode/plugins/searxng-search.ts`
2. Update the `searxngUrl` constant for different instances
3. Modify the shared `searchSearXNG` function to change behavior
4. Adjust the result limit (currently set to 10) inside `searchSearXNG`
5. Update the argument schema in both the V2 `input` JSON Schema and the V1 `args` Zod schema when changing parameters

## License

MIT

## Contributing

To contribute improvements:
1. Fork this repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues or questions:
- Check the [OpenCode documentation](https://opencode.ai/docs/)
- Visit the [OpenCode Discord community](https://opencode.ai/discord)
- Report issues at [https://github.com/sst/opencode](https://github.com/sst/opencode/issues)

## Related Resources

- [OpenCode V1 Custom Tools Documentation](https://opencode.ai/docs/custom-tools/)
- [OpenCode V2 Plugins Documentation](https://opencode.ai/v2/docs/build/plugins)
- [OpenCode V1 to V2 Migration Guide](https://opencode.ai/v2/docs/migrate-v1)
- [SearXNG Documentation](https://docs.searxng.org/)
- [SearXNG Public Instances](https://searx.space/)
