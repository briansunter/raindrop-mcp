# MCP Raindrop Server

A Model Context Protocol (MCP) server that provides integration with the Raindrop.io bookmarking service API.

## Features

### Collections Management
- List all collections (root and nested)
- Get collection details
- Create new collections
- Update existing collections
- Delete collections

### Bookmarks (Raindrops) Management
- List bookmarks from any collection
- Get specific bookmark details
- Create new bookmarks with auto-parsing
- Update bookmark properties
- Delete bookmarks
- Search bookmarks with advanced operators

### Tags Management
- List all tags or tags from specific collections
- Rename tags
- Delete tags

### Additional Features
- Parse URL metadata
- Check if URLs already exist in your account
- List and manage highlights

## Installation

### For Users

Install via npm:
```bash
npm install -g raindrop-mcp
```

Or use directly with npx (no installation needed):
```bash
npx raindrop-mcp
```

### For Development

Clone and build from source:
```bash
git clone https://github.com/briansunter/raindrop-mcp.git
cd raindrop-mcp
npm install
npm run build
```

## Configuration

### Setting up your API Token

The server requires a Raindrop.io API token set as an environment variable.

1. Get your API token from: https://app.raindrop.io/settings/integrations
2. Set the environment variable:

```bash
export RAINDROP_TOKEN="your-raindrop-api-token-here"
```

Or create a `.env` file (for local development):

```bash
cp .env.example .env
# Edit .env and add your token
```

## Usage

### With Claude Desktop

Add one of the following configurations to your Claude Desktop settings:

#### Option 1: Using NPX (Recommended for published package)
```json
{
  "mcpServers": {
    "raindrop": {
      "command": "npx",
      "args": ["raindrop-mcp"],
      "env": {
        "RAINDROP_TOKEN": "your-raindrop-api-token-here"
      }
    }
  }
}
```

#### Option 2: Using Node.js (Local development)
```json
{
  "mcpServers": {
    "raindrop": {
      "command": "node",
      "args": ["/absolute/path/to/raindrop-mcp/dist/index.js"],
      "env": {
        "RAINDROP_TOKEN": "your-raindrop-api-token-here"
      }
    }
  }
}
```

#### Option 3: Using Bun (Alternative)
```json
{
  "mcpServers": {
    "raindrop": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/raindrop-mcp/src/index.ts"],
      "env": {
        "RAINDROP_TOKEN": "your-raindrop-api-token-here"
      }
    }
  }
}
```

**Note**: Make sure to:
1. For NPX: Install the package globally with `npm install -g raindrop-mcp` or use it directly
2. For Node.js/Bun: Replace `/absolute/path/to/raindrop-mcp` with the actual absolute path
3. For Node.js: Build the project first with `npm run build`
4. Replace `your-raindrop-api-token-here` with your actual token
5. Verify your token is valid (see Troubleshooting below)

### Direct Usage

```bash
# Set the token
export RAINDROP_TOKEN="your-raindrop-api-token-here"

# Run the server
npm start
```

### Using with dotenv (for development)

```bash
# Create .env file with your token
echo 'RAINDROP_TOKEN=your-token-here' > .env

# Install dotenv package
npm install dotenv

# Run with dotenv
node -r dotenv/config dist/index.js
```

The server runs on stdio transport and can be integrated with any MCP client.

## Available Tools

### Collections

- **list-collections**: Get all root or nested collections
  - **fields**: Optional field filtering (array of field names like `['_id', 'title', 'count']`)
- **get-collection**: Get details of a specific collection
  - **fields**: Optional field filtering
- **create-collection**: Create a new collection
  - **minimal**: Return just "ok" instead of full response (saves tokens)
- **update-collection**: Update an existing collection
  - **minimal**: Return just "ok" instead of full response
- **delete-collection**: Delete a collection
  - **minimal**: Return just "ok" instead of full response

### Raindrops (Bookmarks)

- **list-raindrops**: Get bookmarks from a collection
  - **Pagination**: `page` (starting from 0), `perpage` (max 50, default 25)
  - **Field selection**: Use presets or custom field arrays (see below)
  - **Sorting**: `-created`, `created`, `score`, `-sort`, `title`, `-title`, `domain`, `-domain`
  - **nested**: Include bookmarks from nested collections
- **get-raindrop**: Get a specific bookmark
  - **Field selection**: Use presets or custom field arrays
- **create-raindrop**: Create a new bookmark
  - **minimal**: Return just "ok" instead of full response
- **update-raindrop**: Update an existing bookmark
  - **fields**: Optional field filtering for response
  - **minimal**: Return just "ok" instead of full response
- **delete-raindrop**: Delete a bookmark
  - **minimal**: Return just "ok" instead of full response
- **search-raindrops**: Search bookmarks using Raindrop.io's search syntax
  - **Pagination**: `page` (starting from 0), `perpage` (max 50, default 25)
  - **Field selection**: Use presets or custom field arrays
  - **Sorting**: Same options as list-raindrops

### Tags

- **list-tags**: Get all tags or tags from a specific collection
  - **fields**: Optional field filtering (e.g., `['_id', 'count']`)
- **merge-tags**: Merge multiple tags into one, or rename a single tag
  - Can merge multiple tags (e.g., `["javascript", "js"]` → `"JavaScript"`)
  - Can rename a single tag (e.g., `["python"]` → `"Python"`)
  - Optional: limit to specific collection
  - **minimal**: Return just "ok" instead of full response
- **delete-tags**: Delete one or more tags
  - **minimal**: Return just "ok" instead of full response

### Highlights

- **list-highlights**: Get highlights from all bookmarks or specific collection
  - **Pagination**: `page` (starting from 0), `perpage` (max 50, default 25)
  - **fields**: Optional field filtering (e.g., `['_id', 'text', 'color', 'note']`)

### Utilities

- **parse-url**: Parse and extract metadata from a URL
- **check-url-exists**: Check if URLs are already saved in your account

## Field Selection & Presets

Many tools support field filtering to reduce response size and save tokens. You can use:

### Field Presets (for Raindrops)

- **minimal**: `_id`, `link`, `title`
- **basic**: `_id`, `link`, `title`, `excerpt`, `tags`, `created`, `domain`
- **standard**: `_id`, `link`, `title`, `excerpt`, `note`, `tags`, `type`, `cover`, `created`, `lastUpdate`, `domain`, `important`
- **media**: `_id`, `link`, `title`, `cover`, `media`, `type`, `file`
- **organization**: `_id`, `title`, `tags`, `collection`, `collectionId`, `sort`, `removed`
- **metadata**: `_id`, `created`, `lastUpdate`, `creatorRef`, `user`, `broken`, `cache`

### Custom Field Arrays

Specify exactly which fields you want:
```json
{
  "fields": ["_id", "title", "link", "tags"]
}
```

### Empty Array

Return only metadata (no item/items):
```json
{
  "fields": []
}
```

## Minimal Responses

Many tools support a `minimal` parameter that returns just `"ok"` instead of the full response. This is useful for:
- Bulk operations where you don't need the response data
- Saving tokens in conversations
- Faster responses when you only care about success/failure

## Example Usage

### Creating a bookmark

```json
{
  "tool": "create-raindrop",
  "arguments": {
    "link": "https://example.com",
    "title": "Example Website",
    "tags": ["example", "demo"],
    "collectionId": 0,
    "minimal": true
  }
}
```

### Searching bookmarks with field filtering

```json
{
  "tool": "search-raindrops",
  "arguments": {
    "search": "#development site:github.com",
    "collectionId": 0,
    "perpage": 50,
    "fields": "minimal"
  }
}
```

Or with custom fields:
```json
{
  "tool": "search-raindrops",
  "arguments": {
    "search": "#development",
    "fields": ["_id", "link", "title", "tags"]
  }
}
```

### Listing raindrops with pagination

```json
{
  "tool": "list-raindrops",
  "arguments": {
    "collectionId": 0,
    "page": 0,
    "perpage": 25,
    "sort": "-created",
    "fields": "basic"
  }
}
```

### Creating a collection

```json
{
  "tool": "create-collection",
  "arguments": {
    "title": "My New Collection",
    "view": "grid",
    "public": false,
    "minimal": true
  }
}
```

### Merging tags

**IMPORTANT**: Both `tags` and `newTag` are required parameters.

Merge multiple tags into one:
```json
{
  "tool": "merge-tags",
  "arguments": {
    "tags": ["javascript", "js", "JS"],
    "newTag": "JavaScript",
    "minimal": true
  }
}
```

Rename a single tag:
```json
{
  "tool": "merge-tags",
  "arguments": {
    "tags": ["python"],
    "newTag": "Python"
  }
}
```

**Common Errors**:
- ❌ Missing parameters: Both `tags` (array) and `newTag` (string) must be provided
- ❌ Empty tags array: Must include at least one tag to merge
- ❌ Empty newTag string: The new tag name cannot be empty

## Search Operators

The search functionality supports Raindrop.io's advanced search operators:

- `#tag` - Search by tag
- `site:example.com` - Search by domain
- `type:article` - Search by type (article, image, video, document, audio)
- `created:>2024-01-01` - Search by date
- `important:true` - Search favorites
- `broken:true` - Find broken links

## Special Collection IDs

- `0` - All bookmarks (except Trash)
- `-1` - Unsorted bookmarks
- `-99` - Trash

## Development

```bash
# Run in development mode
npm run dev

# Build the project
npm run build

# Start the built server
npm start
```

## Troubleshooting

### "Incorrect access_token" Error

If you get this error, it means the token is invalid. Common causes:

1. **Token is incorrect**: Double-check the token from https://app.raindrop.io/settings/integrations
2. **Token has extra spaces**: Make sure there are no spaces or newlines in your token
3. **Token is expired or revoked**: Generate a new token
4. **Wrong token type**: Make sure you're using a "Test token" from the Integrations page

To test your token:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  https://api.raindrop.io/rest/v1/user
```

A valid token will return your user data. An invalid token will return a 401 error.

## API Documentation

This server implements the [Raindrop.io REST API](https://developer.raindrop.io/). For more details on the API endpoints and capabilities, refer to the official documentation.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

MIT - See [LICENSE](LICENSE) for details
