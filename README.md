# Grad Tracker Frontend

A graduation progress tracking application built with Next.js, React, and Chakra UI v3.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: Chakra UI v3
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm 9+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd grad-tracker-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## AI-Assisted Development Setup

This project is configured for AI-assisted development with Chakra UI MCP (Model Context Protocol).

### For Claude Code Users

1. Open the project in Claude Code:
   ```bash
   cd grad-tracker-frontend
   claude
   ```

2. Claude Code will automatically detect `.mcp.json` and load the Chakra UI MCP server.

3. The AI can now use Chakra UI tools to:
   - Look up component props and examples
   - Get theme tokens and colors
   - Validate v3 compatibility

### For Cursor Users

1. Open the project in Cursor
2. Add to `.cursor/mcp.json` (create if it doesn't exist):
   ```json
   {
     "mcpServers": {
       "chakra-ui": {
         "command": "npx",
         "args": ["-y", "@anthropic-ai/mcp-chakra-ui"]
       }
     }
   }
   ```
3. Restart Cursor to load the MCP server

### For Other AI Tools

If your AI tool supports MCP, configure it to run:
```bash
npx -y @anthropic-ai/mcp-chakra-ui
```

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── layout.tsx       # Root layout with Chakra Provider
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── components/
│   └── ui/              # Chakra UI component wrappers
└── lib/                 # Utilities and helpers
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Contributing

1. Create a feature branch
2. Make your changes
3. Run `npm run lint` to check for issues
4. Submit a pull request

## Resources

- [Chakra UI v3 Docs](https://chakra-ui.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [CLAUDE.md](./CLAUDE.md) - AI assistant instructions
