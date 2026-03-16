# 02. Extension Manifest + 빌드 설정

> package.json contributes (이슈 #5), team.json 경로 (이슈 #6), Vite 멀티 엔트리포인트 (이슈 #7) 해결

---

## 1. package.json 전문

```json
{
  "name": "claude-team-gui",
  "displayName": "Claude Team",
  "description": "AI 팀원과 함께하는 멀티에이전트 회의",
  "version": "0.1.0",
  "publisher": "claude-team",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other", "AI"],
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension/extension.js",
  "icon": "media/icon.png",

  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "claude-team",
          "title": "Claude Team",
          "icon": "media/icon.svg"
        }
      ]
    },
    "views": {
      "claude-team": [
        {
          "type": "webview",
          "id": "claudeTeam.sidebar",
          "name": "Team",
          "retainContextWhenHidden": true
        }
      ]
    },
    "commands": [
      {
        "command": "claudeTeam.startMeeting",
        "title": "Claude Team: 회의 시작",
        "icon": "$(play)"
      },
      {
        "command": "claudeTeam.openPanel",
        "title": "Claude Team: 회의 패널 열기",
        "icon": "$(comment-discussion)"
      },
      {
        "command": "claudeTeam.setApiKey",
        "title": "Claude Team: API 키 설정"
      },
      {
        "command": "claudeTeam.clearApiKey",
        "title": "Claude Team: API 키 초기화"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "claudeTeam.startMeeting",
          "when": "view == claudeTeam.sidebar",
          "group": "navigation"
        }
      ],
      "editor/context": [
        {
          "command": "claudeTeam.startMeeting",
          "when": "editorHasSelection",
          "group": "claude-team"
        }
      ]
    },
    "configuration": {
      "title": "Claude Team",
      "properties": {
        "claudeTeam.defaultMode": {
          "type": "string",
          "enum": ["quick", "deep"],
          "default": "deep",
          "description": "기본 회의 방식 (quick: 빠른 회의 ~$0.01, deep: 심층 회의 ~$0.10)"
        },
        "claudeTeam.staggerDelayMs": {
          "type": "number",
          "default": 200,
          "minimum": 50,
          "maximum": 1000,
          "description": "심층 회의 시 에이전트 간 API 호출 딜레이 (ms)"
        },
        "claudeTeam.maxTokensPerAgent": {
          "type": "number",
          "default": 2048,
          "minimum": 512,
          "maximum": 8192,
          "description": "에이전트당 최대 출력 토큰 수"
        },
        "claudeTeam.maxRetries": {
          "type": "number",
          "default": 2,
          "minimum": 0,
          "maximum": 5,
          "description": "에이전트 실패 시 최대 재시도 횟수"
        }
      }
    }
  },

  "scripts": {
    "dev": "concurrently \"npm run dev:extension\" \"npm run dev:webview\"",
    "dev:extension": "node esbuild.config.mjs --watch",
    "dev:webview": "vite build --watch",
    "build": "npm run build:extension && npm run build:webview",
    "build:extension": "node esbuild.config.mjs",
    "build:webview": "vite build",
    "package": "npm run build && vsce package",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },

  "devDependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "@types/vscode": "^1.85.0",
    "@vitejs/plugin-react": "^4.0.0",
    "concurrently": "^8.0.0",
    "esbuild": "^0.20.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.0.0",
    "@vscode/vsce": "^2.0.0"
  }
}
```

### 핵심 포인트

| 항목 | 설정 | 이유 |
|------|------|------|
| `retainContextWhenHidden` | `true` | 사이드바 닫았다 열어도 React 상태 유지 |
| `activationEvents` | `onStartupFinished` | 필요 시 로드 (무조건 시작은 아님) |
| `editor/context` | `editorHasSelection` | 코드 선택 → 우클릭 → 회의 시작 |

---

## 2. SecretStorage 키 네이밍

```typescript
// src/services/config-service.ts
const SECRET_KEYS = {
  anthropic: 'claude-team.apiKey.anthropic',
  openai:    'claude-team.apiKey.openai',
  gemini:    'claude-team.apiKey.gemini',
} as const;

type ProviderId = keyof typeof SECRET_KEYS;
```

- Extension Host의 `context.secrets`에서만 접근
- Webview에는 `hasKey: boolean`만 전달 (키 값 절대 미전달)
- Provider 전환 시: 키 존재 확인 → 없으면 `vscode.window.showInputBox()` 프롬프트
- 키 업데이트: 신규 키 `validateKey()` 통과 시에만 기존 키 교체 (롤백 안전)

---

## 3. 파일 경로 (이슈 #6 해결)

```typescript
// src/services/profile-manager.ts
import * as vscode from 'vscode';
import * as path from 'path';

export class ProfileManager {
  private readonly teamJsonUri: vscode.Uri;

  constructor(private context: vscode.ExtensionContext) {
    // ✅ 배포 후에도 정확한 경로
    this.teamJsonUri = vscode.Uri.file(
      path.join(context.extensionPath, 'data', 'team.json')
    );
  }

  async loadTeam(): Promise<TeamMember[]> {
    const raw = await vscode.workspace.fs.readFile(this.teamJsonUri);
    const data = JSON.parse(Buffer.from(raw).toString('utf-8'));
    return data.members;
  }
}
```

**경로 규칙**:
| 파일 | 경로 | API |
|------|------|-----|
| team.json | `context.extensionPath + '/data/team.json'` | `vscode.workspace.fs.readFile` |
| Webview HTML | `context.extensionPath + '/dist/webview/sidebar.html'` | `webview.asWebviewUri` |
| API 키 | SecretStorage | `context.secrets.get/store` |
| 설정값 | VS Code Settings | `vscode.workspace.getConfiguration('claudeTeam')` |
| 결과 저장 | 워크스페이스 | `vscode.workspace.fs.writeFile` |

---

## 4. Vite 설정 (이슈 #7 해결)

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/webview',
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, 'src/webview/sidebar/index.html'),
        panel:   resolve(__dirname, 'src/webview/panel/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    cssCodeSplit: true,
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
});
```

**빌드 결과물**:
```
dist/
├── extension/
│   └── extension.js          ← esbuild 출력
└── webview/
    ├── sidebar.js             ← Sidebar React 앱
    ├── panel.js               ← Panel React 앱
    ├── chunks/
    │   └── PixelAvatar-[hash].js  ← 공유 코드 (자동 분리)
    └── assets/
        └── style-[hash].css
```

### esbuild.config.mjs

```javascript
import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension/extension.js',
  external: ['vscode'],  // VS Code API는 런타임 제공
  format: 'cjs',
  platform: 'node',
  sourcemap: !isWatch ? false : 'inline',
  minify: !isWatch,
  target: 'node18',
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('Extension host watching...');
} else {
  await esbuild.build(config);
  console.log('Extension host built.');
}
```

### 공유 컴포넌트 관리

`src/webview/shared/` 아래 코드는 sidebar와 panel 모두에서 import 가능:
- `PixelAvatar.tsx` — Rollup이 자동으로 공통 chunk로 분리
- `tokens/*.css` — 각 엔트리에서 import
- `hooks/useVscodeMessage.ts` — postMessage 래퍼

별도 패키지나 monorepo 구조 불필요. Vite의 rollup output이 자동으로 공통 청크를 추출.

---

## 5. VS Code tasks.json (개발 편의)

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev",
      "type": "shell",
      "command": "npm run dev",
      "isBackground": true,
      "problemMatcher": ["$tsc-watch"],
      "group": { "kind": "build", "isDefault": true }
    }
  ]
}
```

## 6. launch.json (F5 디버깅)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}/extension"],
      "outFiles": ["${workspaceFolder}/extension/dist/**/*.js"],
      "preLaunchTask": "dev"
    }
  ]
}
```

---

## 7. .vscodeignore (패키징 제외)

```
.vscode/**
src/**
node_modules/**
*.ts
!dist/**
esbuild.config.mjs
vite.config.ts
tsconfig.json
.gitignore
```

> .vsix에는 `dist/`, `data/`, `media/`, `package.json`만 포함됨.
