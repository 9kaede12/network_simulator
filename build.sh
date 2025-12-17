#!/bin/bash

# Python依存関係のインストール
pip install -r backend/requirements.txt

# Node.js依存関係のインストールとビルド
npm install
npm run build

# distフォルダの確認とデバッグ
echo "=== Checking dist directory ==="
ls -la
if [ -d "dist" ]; then
    echo "✅ dist directory exists"
    ls -la dist/
else
    echo "❌ dist directory not found"
fi

echo "Build completed successfully!"