#!/bin/bash

# Python依存関係のインストール
pip install -r backend/requirements.txt

# Node.js依存関係のインストールとビルド
npm install
npm run build

echo "Build completed successfully!"