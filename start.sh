#!/bin/bash

# デバッグ: 現在のディレクトリとファイル構造を確認
echo "=== Current directory ==="
pwd
echo ""
echo "=== Files in current directory ==="
ls -la
echo ""
echo "=== Checking for dist directory ==="
if [ -d "dist" ]; then
    echo "✅ dist directory found"
    ls -la dist/
else
    echo "❌ dist directory not found"
fi
echo ""

# UvicornでFastAPIサーバーを起動
uvicorn backend.server:app --host 0.0.0.0 --port $PORT