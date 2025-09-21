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

```bash
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

#### Option 1: Using Node.js (Recommended)
```json
{
  "mcpServers": {
    "raindrop": {
      "command": "node",
      "args": ["/path/to/mcp-raindrop/dist/index.js"],
      "env": {
        "RAINDROP_TOKEN": "your-raindrop-api-token-here"
      }
    }
  }
}
```

#### Option 2: Using Bun
```json
{
  "mcpServers": {
    "raindrop": {
      "command": "bun",
      "args": ["run", "/path/to/mcp-raindrop/src/index.ts"],
      "env": {
        "RAINDROP_TOKEN": "your-raindrop-api-token-here"
      }
    }
  }
}
```

**Note**: Make sure to:
1. Replace `/path/to/mcp-raindrop` with the actual path
2. Build the project first if using Node.js: `npm run build`
3. Verify your token is valid (see Troubleshooting below)

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
  - Supports optional pagination parameters (page, perpage) if API supports it
- **get-collection**: Get details of a specific collection
- **create-collection**: Create a new collection
- **update-collection**: Update an existing collection
- **delete-collection**: Delete a collection

### Raindrops (Bookmarks)

- **list-raindrops**: Get bookmarks from a collection
  - Pagination: page (starting from 0), perpage (max 50, default 25)
- **get-raindrop**: Get a specific bookmark
- **create-raindrop**: Create a new bookmark
- **update-raindrop**: Update an existing bookmark
- **delete-raindrop**: Delete a bookmark
- **search-raindrops**: Search bookmarks using Raindrop.io's search syntax
  - Pagination: page (starting from 0), perpage (max 50, default 25)

### Tags

- **list-tags**: Get all tags or tags from a specific collection
  - Supports optional pagination parameters (page, perpage) if API supports it
- **rename-tag**: Rename a tag across all bookmarks
- **delete-tags**: Delete one or more tags

### Highlights

- **list-highlights**: Get highlights from all bookmarks or specific collection
  - Pagination: page (starting from 0), perpage (max 50, default 25)

### Utilities

- **parse-url**: Parse and extract metadata from a URL
- **check-url-exists**: Check if URLs are already saved in your account

## Example Usage

### Creating a bookmark

```json
{
  "tool": "create-raindrop",
  "arguments": {
    "link": "https://example.com",
    "title": "Example Website",
    "tags": ["example", "demo"],
    "collectionId": 0
  }
}
```

### Searching bookmarks

```json
{
  "tool": "search-raindrops",
  "arguments": {
    "search": "#development site:github.com",
    "collectionId": 0,
    "perpage": 50
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
    "public": false
  }
}
```

## Pagination

The following tools support pagination for handling large result sets:

- **list-raindrops**, **search-raindrops**: Full pagination support
  - `page`: Page number starting from 0
  - `perpage`: Items per page (1-50, default 25)
- **list-highlights**: Full pagination support
  - `page`: Page number starting from 0
  - `perpage`: Items per page (1-50, default 25)
- **list-collections**, **list-tags**: Optional pagination
  - These endpoints may not support pagination in the API but parameters are accepted for future compatibility

When using pagination, responses typically include:
- `count`: Total number of items
- `items`: Array of results for current page
- `collectionId`: Collection context (when applicable)

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

## Security

**⚠️ IMPORTANT**: Never commit your API token to version control. See [SECURITY.md](SECURITY.md) for detailed security guidelines.

## API Documentation

This server implements the [Raindrop.io REST API](https://developer.raindrop.io/). For more details on the API endpoints and capabilities, refer to the official documentation.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

MIT - See [LICENSE](LICENSE) for details
