#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch, { Response } from "node-fetch";

const API_BASE_URL = "https://api.raindrop.io/rest/v1";
const AUTH_TOKEN = process.env.RAINDROP_TOKEN;

if (!AUTH_TOKEN) {
  console.error("Error: RAINDROP_TOKEN environment variable is not set");
  console.error("Please set RAINDROP_TOKEN with your Raindrop.io API token");
  process.exit(1);
}

interface RaindropApiError {
  result: false;
  error?: string;
  errorMessage?: string;
}

// Field presets for common use cases
const FIELD_PRESETS = {
  minimal: ['_id', 'link', 'title'],
  basic: ['_id', 'link', 'title', 'excerpt', 'tags', 'created', 'domain'],
  standard: ['_id', 'link', 'title', 'excerpt', 'note', 'tags', 'type', 'cover', 'created', 'lastUpdate', 'domain', 'important'],
  media: ['_id', 'link', 'title', 'cover', 'media', 'type', 'file'],
  organization: ['_id', 'title', 'tags', 'collection', 'collectionId', 'sort', 'removed'],
  metadata: ['_id', 'created', 'lastUpdate', 'creatorRef', 'user', 'broken', 'cache'],
} as const;

type FieldPreset = keyof typeof FIELD_PRESETS;

// Helper function to safely parse JSON in preprocessing
function safeJsonParse(val: any): any {
  // If already an array, return as-is
  if (Array.isArray(val)) {
    return val;
  }
  // If undefined or null, return as-is
  if (val === undefined || val === null) {
    return val;
  }
  // If string, try to parse as JSON
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      // Return undefined on parse error so Zod's optional() handles it
      return undefined;
    }
  }
  // For other types, return as-is
  return val;
}

// Helper function to filter object fields
function filterFields(obj: any, fields?: string[] | FieldPreset): any {
  if (!fields) return obj;

  // If it's a preset name, get the fields from preset
  const fieldList = typeof fields === 'string' && fields in FIELD_PRESETS
    ? FIELD_PRESETS[fields as FieldPreset]
    : fields as string[];

  if (!Array.isArray(fieldList)) return obj;

  // Empty array means filter out all fields - return empty object
  if (fieldList.length === 0) return {};

  // Handle single object
  if (!Array.isArray(obj)) {
    const filtered: any = {};
    for (const field of fieldList) {
      if (field in obj) {
        filtered[field] = obj[field];
      }
    }
    return filtered;
  }

  // Handle array of objects
  return obj.map((item: any) => {
    const filtered: any = {};
    for (const field of fieldList) {
      if (field in item) {
        filtered[field] = item[field];
      }
    }
    return filtered;
  });
}

// Helper function to apply field filtering to API responses
function filterApiResponse(data: any, fields?: string[] | FieldPreset): any {
  if (!fields) return data;

  // Resolve preset to array if needed
  const fieldList = typeof fields === 'string' && fields in FIELD_PRESETS
    ? FIELD_PRESETS[fields as FieldPreset]
    : fields as string[];

  // For empty array, return only top-level metadata (remove item/items)
  if (Array.isArray(fieldList) && fieldList.length === 0) {
    const { item, items, ...metadata } = data;
    return metadata;
  }

  // For responses with items array (e.g., raindrops)
  if (data.items && Array.isArray(data.items)) {
    return {
      ...data,
      items: filterFields(data.items, fields)
    };
  }

  // For responses with item object (e.g., single raindrop)
  if (data.item && typeof data.item === 'object') {
    return {
      ...data,
      item: filterFields(data.item, fields)
    };
  }

  // For direct array responses (e.g., collections)
  if (Array.isArray(data)) {
    return filterFields(data, fields);
  }

  // For other response types, return as-is
  return data;
}

class RaindropClient {
  private headers: Record<string, string>;

  constructor(token: string) {
    this.headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  private async handleResponse(response: Response): Promise<any> {
    let data: any;
    try {
      data = await response.json() as any;
    } catch (e) {
      throw new Error(`Failed to parse JSON response: ${response.status} ${response.statusText}`);
    }

    if (!response.ok || data.result === false) {
      const error = data as RaindropApiError;
      throw new Error(
        error.errorMessage || error.error || `API request failed: ${response.status}`
      );
    }

    return data;
  }

  // Collections API
  async getCollections(root: boolean = true): Promise<any> {
    const endpoint = root ? "/collections" : "/collections/childrens";
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: this.headers,
    });
    return this.handleResponse(response);
  }

  async getCollection(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/collection/${id}`, {
      headers: this.headers,
    });
    return this.handleResponse(response);
  }

  async createCollection(data: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/collection`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateCollection(id: number, data: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/collection/${id}`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteCollection(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/collection/${id}`, {
      method: "DELETE",
      headers: this.headers,
    });
    return this.handleResponse(response);
  }

  // Raindrops API
  async getRaindrops(collectionId: number, params?: any): Promise<any> {
    const queryParams = new URLSearchParams(params || {});
    const url = `${API_BASE_URL}/raindrops/${collectionId}${queryParams.toString() ? `?${queryParams}` : ""}`;
    const response = await fetch(url, {
      headers: this.headers,
    });
    return this.handleResponse(response);
  }

  async getRaindrop(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/raindrop/${id}`, {
      headers: this.headers,
    });
    return this.handleResponse(response);
  }

  async createRaindrop(data: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/raindrop`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateRaindrop(id: number, data: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/raindrop/${id}`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteRaindrop(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/raindrop/${id}`, {
      method: "DELETE",
      headers: this.headers,
    });
    return this.handleResponse(response);
  }

  // Search API
  async searchRaindrops(collectionId: number, search: string, params?: any): Promise<any> {
    const queryParams = new URLSearchParams({ search, ...params });
    const url = `${API_BASE_URL}/raindrops/${collectionId}?${queryParams}`;
    const response = await fetch(url, {
      headers: this.headers,
    });
    return this.handleResponse(response);
  }

  // Tags API
  async getTags(collectionId?: number): Promise<any> {
    const url = collectionId !== undefined
      ? `${API_BASE_URL}/tags/${collectionId}`
      : `${API_BASE_URL}/tags`;
    const response = await fetch(url, {
      headers: this.headers,
    });
    return this.handleResponse(response);
  }

  async mergeTags(tags: string[], newTag: string, collectionId?: number): Promise<any> {
    const url = collectionId !== undefined
      ? `${API_BASE_URL}/tags/${collectionId}`
      : `${API_BASE_URL}/tags`;
    const response = await fetch(url, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify({
        tags,
        replace: newTag,
      }),
    });
    return this.handleResponse(response);
  }

  async deleteTags(tags: string[], collectionId?: number): Promise<any> {
    const url = collectionId !== undefined
      ? `${API_BASE_URL}/tags/${collectionId}`
      : `${API_BASE_URL}/tags`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.headers,
      body: JSON.stringify({ tags }),
    });
    return this.handleResponse(response);
  }

  // Highlights API
  async getHighlights(collectionId?: number, params?: any): Promise<any> {
    const queryParams = new URLSearchParams(params || {});
    const url = collectionId !== undefined
      ? `${API_BASE_URL}/highlights/${collectionId}${queryParams.toString() ? `?${queryParams}` : ""}`
      : `${API_BASE_URL}/highlights${queryParams.toString() ? `?${queryParams}` : ""}`;
    const response = await fetch(url, {
      headers: this.headers,
    });
    return this.handleResponse(response);
  }

  // Import/Export API
  async parseUrl(url: string): Promise<any> {
    const queryParams = new URLSearchParams({ url });
    const response = await fetch(`${API_BASE_URL}/import/url/parse?${queryParams}`, {
      headers: this.headers,
    });
    return this.handleResponse(response);
  }

  async checkUrlExists(urls: string[]): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/import/url/exists`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ urls }),
    });
    return this.handleResponse(response);
  }
}

// Initialize the MCP server
const server = new McpServer({
  name: "mcp-raindrop",
  version: "1.0.0",
});

const client = new RaindropClient(AUTH_TOKEN);

// Register tools for Collections
server.registerTool(
  "list-collections",
  {
    title: "List Collections",
    description: "Get all root or nested collections (Note: Collections API returns all collections without pagination)",
    inputSchema: {
      root: z.boolean().default(true).describe("Get root collections (true) or nested collections (false)"),
      fields: z.preprocess(
        safeJsonParse,
        z.array(z.string())
      ).optional().describe("Array of field names to include in the response (e.g., ['_id', 'title', 'count', 'public', 'parent'])")
    },
  },
  async ({ root, fields }) => {
    try {
      const result = await client.getCollections(root);
      const filtered = filterApiResponse(result, fields as string[]);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get-collection",
  {
    title: "Get Collection",
    description: "Get details of a specific collection with field selection support",
    inputSchema: {
      id: z.number().describe("Collection ID"),
      fields: z.preprocess(
        safeJsonParse,
        z.array(z.string())
      ).optional().describe("Array of field names to include in the response (e.g., ['_id', 'title', 'count', 'public', 'parent'])")
    },
  },
  async ({ id, fields }) => {
    try {
      const result = await client.getCollection(id);
      const filtered = filterApiResponse(result, fields as string[]);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "create-collection",
  {
    title: "Create Collection",
    description: "Create a new collection",
    inputSchema: {
      title: z.string().describe("Name of the collection"),
      description: z.string().optional().describe("Collection description"),
      parentId: z.number().optional().describe("Parent collection ID for nested collections"),
      view: z.enum(["list", "simple", "grid", "masonry"]).default("list").describe("View style"),
      public: z.boolean().default(false).describe("Make collection public"),
      cover: z.array(z.string()).optional().describe("Collection cover URL"),
    },
  },
  async (params) => {
    try {
      const data: any = {
        title: params.title,
        view: params.view,
        public: params.public,
      };
      
      if (params.description) data.description = params.description;
      if (params.parentId) data.parent = { $id: params.parentId };
      if (params.cover) data.cover = params.cover;
      
      const result = await client.createCollection(data);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "update-collection",
  {
    title: "Update Collection",
    description: "Update an existing collection",
    inputSchema: {
      id: z.number().describe("Collection ID"),
      title: z.string().optional().describe("New name of the collection"),
      description: z.string().optional().describe("New description"),
      parentId: z.number().optional().describe("New parent collection ID"),
      view: z.enum(["list", "simple", "grid", "masonry"]).optional().describe("View style"),
      public: z.boolean().optional().describe("Make collection public/private"),
      expanded: z.boolean().optional().describe("Expand/collapse sub-collections"),
    },
  },
  async (params) => {
    try {
      const { id, ...data } = params;
      const updateData: any = {};
      
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.parentId !== undefined) updateData.parent = { $id: data.parentId };
      if (data.view !== undefined) updateData.view = data.view;
      if (data.public !== undefined) updateData.public = data.public;
      if (data.expanded !== undefined) updateData.expanded = data.expanded;
      
      const result = await client.updateCollection(id, updateData);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "delete-collection",
  {
    title: "Delete Collection",
    description: "Remove a collection and all its descendants. Raindrops will be moved to Trash.",
    inputSchema: {
      id: z.number().describe("Collection ID to delete"),
    },
  },
  async ({ id }) => {
    try {
      const result = await client.deleteCollection(id);
      return {
        content: [
          {
            type: "text",
            text: "Collection deleted successfully",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register tools for Raindrops
server.registerTool(
  "list-raindrops",
  {
    title: "List Raindrops",
    description: "Get raindrops from a collection with pagination and field selection support",
    inputSchema: {
      collectionId: z.number().describe("Collection ID (0 for all, -1 for Unsorted, -99 for Trash)"),
      page: z.number().min(0).default(0).describe("Page number (starts from 0)"),
      perpage: z.number().min(1).max(50).default(25).describe("Items per page (max 50)"),
      sort: z.enum(["-created", "created", "score", "-sort", "title", "-title", "domain", "-domain"]).optional().describe("Sort order"),
      search: z.string().optional().describe("Search query"),
      nested: z.boolean().optional().describe("Include bookmarks from nested collections"),
      fields: z.preprocess(
        safeJsonParse,
        z.union([
          z.enum(["minimal", "basic", "standard", "media", "organization", "metadata"]),
          z.array(z.string())
        ])
      ).optional().describe("Field selection: Use preset ('minimal', 'basic', 'standard', 'media', 'organization', 'metadata') or array of field names")
    },
  },
  async (params) => {
    try {
      const { collectionId, fields, ...queryParams } = params;
      const result = await client.getRaindrops(collectionId, queryParams);
      const filtered = filterApiResponse(result, fields as string[] | FieldPreset);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get-raindrop",
  {
    title: "Get Raindrop",
    description: "Get a specific raindrop/bookmark by ID with field selection support",
    inputSchema: {
      id: z.number().describe("Raindrop ID"),
      fields: z.preprocess(
        safeJsonParse,
        z.union([
          z.enum(["minimal", "basic", "standard", "media", "organization", "metadata"]),
          z.array(z.string())
        ])
      ).optional().describe("Field selection: Use preset ('minimal', 'basic', 'standard', 'media', 'organization', 'metadata') or array of field names")
    },
  },
  async ({ id, fields }) => {
    try {
      const result = await client.getRaindrop(id);
      const filtered = filterApiResponse(result, fields as string[] | FieldPreset);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "create-raindrop",
  {
    title: "Create Raindrop",
    description: "Create a new raindrop/bookmark",
    inputSchema: {
      link: z.string().describe("URL of the bookmark"),
      title: z.string().optional().describe("Title (will be auto-parsed if not provided)"),
      excerpt: z.string().optional().describe("Description/excerpt"),
      note: z.string().optional().describe("Personal note"),
      tags: z.preprocess(
        safeJsonParse,
        z.array(z.string())
      ).optional().describe("Tags for the bookmark"),
      collectionId: z.number().optional().describe("Collection ID (default: -1 for Unsorted)"),
      important: z.boolean().optional().describe("Mark as favorite"),
      pleaseParse: z.boolean().default(true).describe("Auto-parse metadata from URL"),
    },
  },
  async (params) => {
    try {
      const data: any = {
        link: params.link,
      };
      
      if (params.title) data.title = params.title;
      if (params.excerpt) data.excerpt = params.excerpt;
      if (params.note) data.note = params.note;
      if (params.tags) data.tags = params.tags;
      if (params.collectionId !== undefined) {
        data.collection = { $id: params.collectionId };
      }
      if (params.important !== undefined) data.important = params.important;
      if (params.pleaseParse) data.pleaseParse = {};
      
      const result = await client.createRaindrop(data);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "update-raindrop",
  {
    title: "Update Raindrop",
    description: "Update an existing raindrop/bookmark with field selection support",
    inputSchema: {
      id: z.number().describe("Raindrop ID"),
      title: z.string().optional().describe("New title"),
      excerpt: z.string().optional().describe("New description"),
      note: z.string().optional().describe("New note"),
      tags: z.preprocess(
        safeJsonParse,
        z.array(z.string())
      ).optional().describe("New tags (replaces existing)"),
      link: z.string().optional().describe("New URL"),
      collectionId: z.number().optional().describe("Move to different collection"),
      important: z.boolean().optional().describe("Mark/unmark as favorite"),
      order: z.number().optional().describe("Sort order position"),
      fields: z.preprocess(
        safeJsonParse,
        z.union([
          z.enum(["minimal", "basic", "standard", "media", "organization", "metadata"]),
          z.array(z.string())
        ])
      ).optional().describe("Field selection: Use preset ('minimal', 'basic', 'standard', 'media', 'organization', 'metadata'), array of field names, or empty array [] to return only result status")
    },
  },
  async (params) => {
    try {
      const { id, collectionId, fields, ...data } = params;
      const updateData: any = { ...data };

      if (collectionId !== undefined) {
        updateData.collection = { $id: collectionId };
      }

      const result = await client.updateRaindrop(id, updateData);
      const filtered = filterApiResponse(result, fields as string[] | FieldPreset);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "delete-raindrop",
  {
    title: "Delete Raindrop",
    description: "Delete a raindrop/bookmark (moves to Trash, or permanently deletes if already in Trash)",
    inputSchema: {
      id: z.number().describe("Raindrop ID to delete"),
    },
  },
  async ({ id }) => {
    try {
      const result = await client.deleteRaindrop(id);
      return {
        content: [
          {
            type: "text",
            text: "Raindrop deleted successfully",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register search tool
server.registerTool(
  "search-raindrops",
  {
    title: "Search Raindrops",
    description: "Search for raindrops using Raindrop.io's search syntax with pagination and field selection support",
    inputSchema: {
      search: z.string().describe("Search query (supports operators like #tag, site:example.com, etc.)"),
      collectionId: z.number().default(0).describe("Collection to search in (0 for all)"),
      page: z.number().min(0).default(0).describe("Page number (starts from 0)"),
      perpage: z.number().min(1).max(50).default(25).describe("Items per page (max 50)"),
      sort: z.enum(["-created", "created", "score", "-sort", "title", "-title", "domain", "-domain"]).optional().describe("Sort order"),
      fields: z.preprocess(
        safeJsonParse,
        z.union([
          z.enum(["minimal", "basic", "standard", "media", "organization", "metadata"]),
          z.array(z.string())
        ])
      ).optional().describe("Field selection: Use preset ('minimal', 'basic', 'standard', 'media', 'organization', 'metadata') or array of field names")
    },
  },
  async (params) => {
    try {
      const { collectionId, search, fields, ...otherParams } = params;
      const result = await client.searchRaindrops(collectionId, search, otherParams);
      const filtered = filterApiResponse(result, fields as string[] | FieldPreset);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register tag tools
server.registerTool(
  "list-tags",
  {
    title: "List Tags",
    description: "Get all tags or tags from a specific collection (Note: Tags API returns all tags without pagination)",
    inputSchema: {
      collectionId: z.number().optional().describe("Collection ID (omit for all tags)"),
      fields: z.preprocess(
        safeJsonParse,
        z.array(z.string())
      ).optional().describe("Array of field names to include in the response (e.g., ['_id', 'count'])")
    },
  },
  async ({ collectionId, fields }) => {
    try {
      const result = await client.getTags(collectionId);
      const filtered = filterApiResponse(result, fields as string[]);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "merge-tags",
  {
    title: "Merge/Rename Tags",
    description: "Merge multiple tags into a new tag name, or rename a single tag. All specified tags will be replaced with the new tag name across all bookmarks.",
    inputSchema: {
      tags: z.preprocess(
        safeJsonParse,
        z.array(z.string()).min(1, "At least one tag must be specified")
      ).describe("List of tag names to merge/rename (can be a single tag or multiple tags)"),
      newTag: z.string().min(1, "New tag name is required and cannot be empty").describe("New tag name to replace all specified tags"),
      collectionId: z.number().optional().describe("Limit operation to specific collection (omit to apply across all collections)"),
    },
  },
  async ({ tags, newTag, collectionId }) => {
    try {
      // Validate required parameters
      if (!tags || tags.length === 0) {
        throw new Error("Parameter 'tags' is required and must be a non-empty array of tag names");
      }
      if (!newTag || newTag.trim() === "") {
        throw new Error("Parameter 'newTag' is required and cannot be empty");
      }

      const result = await client.mergeTags(tags, newTag, collectionId);
      return {
        content: [
          {
            type: "text",
            text: tags.length === 1
              ? "Tag renamed successfully"
              : `${tags.length} tags merged into '${newTag}' successfully`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "delete-tags",
  {
    title: "Delete Tags",
    description: "Delete one or more tags",
    inputSchema: {
      tags: z.array(z.string()).describe("Tags to delete"),
      collectionId: z.number().optional().describe("Limit to specific collection"),
    },
  },
  async ({ tags, collectionId }) => {
    try {
      const result = await client.deleteTags(tags, collectionId);
      return {
        content: [
          {
            type: "text",
            text: "Tags deleted successfully",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register highlight tools
server.registerTool(
  "list-highlights",
  {
    title: "List Highlights",
    description: "Get all highlights or highlights from a specific collection with pagination and field selection support",
    inputSchema: {
      collectionId: z.number().optional().describe("Collection ID (omit for all highlights)"),
      page: z.number().min(0).default(0).describe("Page number (starts from 0)"),
      perpage: z.number().min(1).max(50).default(25).describe("Items per page (max 50, default 25)"),
      fields: z.preprocess(
        safeJsonParse,
        z.array(z.string())
      ).optional().describe("Array of field names to include in the response (e.g., ['_id', 'text', 'color', 'note', 'created'])")
    },
  },
  async (params) => {
    try {
      const { collectionId, fields, ...queryParams } = params;
      const result = await client.getHighlights(collectionId, queryParams);
      const filtered = filterApiResponse(result, fields as string[]);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register URL parsing tools
server.registerTool(
  "parse-url",
  {
    title: "Parse URL",
    description: "Parse and extract metadata from a URL",
    inputSchema: {
      url: z.string().describe("URL to parse"),
    },
  },
  async ({ url }) => {
    try {
      const result = await client.parseUrl(url);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "check-url-exists",
  {
    title: "Check URL Exists",
    description: "Check if URLs are already saved in your Raindrop.io account",
    inputSchema: {
      urls: z.array(z.string()).describe("URLs to check"),
    },
  },
  async ({ urls }) => {
    try {
      const result = await client.checkUrlExists(urls);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Main function to start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Raindrop.io MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});