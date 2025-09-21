# Security Policy

## API Token Security

### ⚠️ IMPORTANT: Never commit your API token to version control

This application requires a Raindrop.io API token to function. The token must be kept secure and never exposed in public repositories.

### Best Practices

1. **Environment Variables**: Always use environment variables to store your API token
   - Set `RAINDROP_TOKEN` environment variable
   - Never hardcode tokens in source code

2. **Local Development**: Use `.env` files for local development only
   - Create a `.env` file from `.env.example`
   - Ensure `.env` is in `.gitignore` (it is by default)
   - Never commit `.env` files

3. **Production Deployment**:
   - Use secure environment variable management (e.g., AWS Secrets Manager, HashiCorp Vault)
   - Rotate tokens regularly
   - Use minimal permission scopes when creating tokens

4. **Token Generation**:
   - Generate tokens at: https://app.raindrop.io/settings/integrations
   - Create separate tokens for development and production
   - Revoke tokens immediately if compromised

### What NOT to do

- ❌ Never commit `.env` files
- ❌ Never hardcode tokens in source code
- ❌ Never share tokens in issues, pull requests, or documentation
- ❌ Never use production tokens in development
- ❌ Never log or print tokens to console

### If a Token is Exposed

1. Immediately revoke the token at: https://app.raindrop.io/settings/integrations
2. Generate a new token
3. Update your environment variables
4. Review logs to check for unauthorized access
5. If the exposed token was in a git commit:
   - Remove it from history using `git filter-branch` or BFG Repo-Cleaner
   - Force push the cleaned history
   - Ensure all team members pull the updated history

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please:

1. **DO NOT** create a public GitHub issue
2. Send details privately to the maintainer
3. Allow reasonable time for a fix before public disclosure

## Dependencies

- Regularly update dependencies to patch security vulnerabilities
- Run `npm audit` periodically to check for known vulnerabilities
- Use `npm audit fix` to automatically fix vulnerabilities when possible

## Data Privacy

- This server only accesses data you explicitly authorize via your API token
- No data is stored locally beyond runtime memory
- No analytics or tracking is performed
- All API communication uses HTTPS