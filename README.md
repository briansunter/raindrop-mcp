# Raindrop MCP Server

A Model Context Protocol server for [Raindrop.io](https://raindrop.io) - manage your bookmarks, collections, tags, and highlights through Claude and other MCP clients.

## Quick Start

1. Get your API token from [Raindrop.io Settings](https://app.raindrop.io/settings/integrations)

2. Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "raindrop": {
      "command": "npx",
      "args": ["@briansunter/raindrop-mcp"],
      "env": {
        "RAINDROP_TOKEN": "your-token-here"
      }
    }
  }
}
```

3. Restart Claude Desktop

That's it! You can now ask Claude to manage your Raindrop bookmarks.

## What You Can Do

**Bookmarks**
- Search and list your bookmarks with powerful filters
- Create bookmarks from URLs (with auto-parsing)
- Update and organize existing bookmarks
- Bulk operations with field filtering

**Collections**
- Browse and manage your collections
- Create nested collection structures
- Move bookmarks between collections

**Tags**
- List and search tags
- Merge or rename tags across your library
- Clean up tag organization

**Advanced**
- Parse metadata from any URL
- Check if URLs already exist in your library
- Access and manage highlights

## Common Examples

### Save a bookmark

```
"Save this article to my Reading List collection"
https://example.com/article
```

### Search your library

```
"Find all GitHub repositories I've bookmarked about Python"
```

### Organize tags

```
"Rename the tag 'js' to 'javascript' across all my bookmarks"
```

### Bulk operations

```
"List all my bookmarks tagged with #productivity, but only show me the titles and links"
```

## Available Tools

### Bookmarks (Raindrops)
- `list-raindrops` - List bookmarks from a collection
- `get-raindrop` - Get a specific bookmark by ID
- `create-raindrop` - Save a new bookmark
- `update-raindrop` - Modify an existing bookmark
- `delete-raindrop` - Remove a bookmark
- `search-raindrops` - Search with advanced syntax

### Collections
- `list-collections` - Get all collections
- `get-collection` - Get collection details
- `create-collection` - Create a new collection
- `update-collection` - Modify a collection
- `delete-collection` - Remove a collection

### Tags
- `list-tags` - Get all tags
- `merge-tags` - Merge or rename tags
- `delete-tags` - Remove tags

### Utilities
- `parse-url` - Extract metadata from a URL
- `check-url-exists` - Check if URLs are already saved
- `list-highlights` - Get highlights from bookmarks

## Advanced Usage

### Search Operators

Use Raindrop.io's powerful search syntax:

- `#tag` - Filter by tag
- `site:example.com` - Filter by domain
- `type:article` - Filter by type (article, image, video, document, audio)
- `important:true` - Only favorites
- `created:>2024-01-01` - Filter by date

**Example**: `#programming site:github.com type:article`

### Field Filtering

Reduce response size by selecting only the fields you need:

**Presets** (for raindrops):
- `minimal` - Just ID, link, and title
- `basic` - Common fields (adds excerpt, tags, created, domain)
- `standard` - Most useful fields (adds note, type, cover, lastUpdate, important)

**Custom fields**:
```json
{
  "fields": ["_id", "title", "link", "tags"]
}
```

### Pagination

For large result sets:
- `page` - Page number (starts at 0)
- `perpage` - Items per page (max 50, default 25)

### Minimal Responses

Add `minimal: true` to any create/update/delete operation to just get `"ok"` back instead of the full response - useful for bulk operations.

### Special Collection IDs

- `0` - All bookmarks (except Trash)
- `-1` - Unsorted bookmarks
- `-99` - Trash

## Installation Options

### NPX (Recommended)
```bash
npx @briansunter/raindrop-mcp
```

### Bunx (Bun users)
```bash
bunx @briansunter/raindrop-mcp
```

### Global Install
```bash
npm install -g @briansunter/raindrop-mcp
```

Or with Bun:
```bash
bun install -g @briansunter/raindrop-mcp
```

### Local Development
```bash
git clone https://github.com/briansunter/raindrop-mcp.git
cd raindrop-mcp
npm install
npm run build
```

## Configuration

### Claude Desktop

Edit your Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

**Using NPX** (Node.js):
```json
{
  "mcpServers": {
    "raindrop": {
      "command": "npx",
      "args": ["@briansunter/raindrop-mcp"],
      "env": {
        "RAINDROP_TOKEN": "your-token-here"
      }
    }
  }
}
```

**Using Bunx** (Bun):
```json
{
  "mcpServers": {
    "raindrop": {
      "command": "bunx",
      "args": ["@briansunter/raindrop-mcp"],
      "env": {
        "RAINDROP_TOKEN": "your-token-here"
      }
    }
  }
}
```

**Using local installation**:
```json
{
  "mcpServers": {
    "raindrop": {
      "command": "node",
      "args": ["/absolute/path/to/raindrop-mcp/dist/index.js"],
      "env": {
        "RAINDROP_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Other MCP Clients

Set the `RAINDROP_TOKEN` environment variable and run with your preferred package runner:

**With NPX:**
```bash
npx @briansunter/raindrop-mcp
```

**With Bunx:**
```bash
bunx @briansunter/raindrop-mcp
```

The server runs on stdio transport and works with any MCP-compatible client.

## Troubleshooting

### "Incorrect access_token" Error

Your token is invalid. Common fixes:

1. **Get a fresh token** from https://app.raindrop.io/settings/integrations
2. **Check for extra spaces** - copy/paste carefully
3. **Use a Test Token** from the Integrations page, not an app password

Test your token:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.raindrop.io/rest/v1/user
```

Valid tokens return your user data. Invalid tokens return a 401 error.

### Server Not Appearing in Claude

1. Restart Claude Desktop completely
2. Check the config file location is correct
3. Verify the JSON is valid (no trailing commas, proper quotes)
4. Check Claude's MCP logs for errors

## API Documentation

This server implements the [Raindrop.io REST API](https://developer.raindrop.io/).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT - See [LICENSE](LICENSE) for details.
